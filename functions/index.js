const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2/options");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const functions = require("firebase-functions");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { generateEmailHtml } = require('./emailTemplate'); 
const menuCache = {}; 
const CACHE_DURATION = 1000 * 60 * 10;
if (!admin.apps.length) {
  admin.initializeApp();
}

// Set max instances to control costs
setGlobalOptions({ maxInstances: 10 });

// --- 1. SHARED MATH HELPER (Logic Logic) ---
function calculateVerifiedItemPrice(menuItem, orderItem) {
    if (!menuItem || !menuItem.pricing || menuItem.pricing.length === 0) return null;

    let basePrice = 0;
    const customerChoices = orderItem.customizations || {};

    // 1. Base Price
    if (menuItem.pricing.length === 1) {
        basePrice = parseFloat(menuItem.pricing[0].price);
    } else {
        const pricingKey = menuItem.pricing[0].size ? 'size' : 'temp'; 
        const customerChoiceValue = customerChoices[menuItem.pricing[0].size ? 'Size' : 'Temperature']; 
        const matchedPriceOption = menuItem.pricing.find(p => p[pricingKey] === customerChoiceValue);
        basePrice = matchedPriceOption ? parseFloat(matchedPriceOption.price) : parseFloat(menuItem.pricing[0].price);
    }

    // 2. Add-Ons
    let addOnPrice = 0;
    if (menuItem.addOns && menuItem.addOns.length > 0) {
        menuItem.addOns.forEach(addOnGroup => {
            const groupTitle = addOnGroup.title; 
            const customerSelections = customerChoices[groupTitle]; 
            if (!customerSelections) return; 

            if (addOnGroup.freeToppingLimit !== undefined && addOnGroup.postLimitPrice !== undefined) {
                const count = Array.isArray(customerSelections) ? customerSelections.length : 1;
                const extra = Math.max(0, count - addOnGroup.freeToppingLimit);
                addOnPrice += (extra * parseFloat(addOnGroup.postLimitPrice));
            } else {
                const arr = Array.isArray(customerSelections) ? customerSelections : [customerSelections];
                arr.forEach(sel => {
                    const choice = addOnGroup.choices.find(c => (typeof c === 'object' ? c.addOnName : c) === sel);
                    if (choice && typeof choice === 'object' && choice.price > 0) {
                        addOnPrice += parseFloat(choice.price);
                    }
                });
            }
        });
    }

    return basePrice + addOnPrice;
}

async function getMenuItemsBatch(itemIds) {
    const uniqueIds = [...new Set(itemIds)]; // Remove duplicates
    const now = Date.now();
    const missedIds = [];
    const itemMap = {}; // Will hold { itemId: itemData }

    // 1. Check Cache first
    uniqueIds.forEach(id => {
        const cached = menuCache[id];
        if (cached && (now - cached.timestamp < CACHE_DURATION)) {
            itemMap[id] = cached.data;
        } else {
            missedIds.push(id);
        }
    });

    // 2. If we have everything in cache, return immediately
    if (missedIds.length === 0) return itemMap;

    // 3. Fetch ONLY missing items in ONE Firestore call (batch read)
    // Note: getAll supports passing a list of document references
    const refs = missedIds.map(id => admin.firestore().collection('menuItems').doc(id));
    
    if (refs.length > 0) {
        const snapshots = await admin.firestore().getAll(...refs);
        
        snapshots.forEach(snap => {
            if (snap.exists) {
                const data = snap.data();
                // Important: Ensure the data has the ID attached for easy reference later
                // (If your DB data doesn't have an 'id' field, this adds it safely)
                if (!data.id) data.id = snap.id; 

                // Save to Cache
                menuCache[snap.id] = { data: data, timestamp: now };
                itemMap[snap.id] = data;
            }
        });
    }

    return itemMap;
}
// --- 2. SHARED DB CALCULATION HELPER (Prevents Code Duplication) ---
// This fixes the missing function error and ensures security across all endpoints
async function calculateCartTotal(items) {
    let calculatedTotal = 0;
    let itemSummary = [];
    
    if (!items || items.length === 0) {
        return { subtotal: 0, tax: 0, totalWithTax: 0, amountInCents: 0, itemSummary: [] };
    }

    // 1. Extract IDs from the cart
    const itemIds = items.map(i => i.id);

    // 2. FETCH ALL ITEMS AT ONCE (Optimization: 1 Read vs N Reads)
    const dbItemMap = await getMenuItemsBatch(itemIds);

    // 3. Calculate using the Map
    for (const item of items) {
        if (!item.quantity || item.quantity <= 0) continue; 

        // Get data from our new map
        const dbData = dbItemMap[item.id];

        if (dbData) {
            // Use your existing math helper
            const price = calculateVerifiedItemPrice(dbData, { customizations: item.options || {} });

            if (price !== null && !isNaN(price)) {
                const lineTotal = price * item.quantity;
                calculatedTotal += lineTotal;
                itemSummary.push(`${item.id} (x${item.quantity}) - $${lineTotal.toFixed(2)}`);
            }
        }
    }

    const taxAmount = calculatedTotal * 0.13;
    const totalWithTax = calculatedTotal + taxAmount;
    const amountInCents = Math.round(totalWithTax * 100);

    return { 
        subtotal: calculatedTotal,
        tax: taxAmount,
        totalWithTax: totalWithTax,
        amountInCents: amountInCents,
        itemSummary: itemSummary
    };
}

// --- 3. CREATE INTENT ---
exports.createPaymentIntent = onRequest(
  { secrets: ["STRIPE_SECRET"], cors: true },
  async (req, res) => {
    try {
      const stripe = Stripe(process.env.STRIPE_SECRET);
      const { items } = req.body; 
      if (!items || items.length === 0) return res.status(400).send({ error: "Empty cart" });

      // Use Shared Helper
      const calcResult = await calculateCartTotal(items);

      if (calcResult.amountInCents < 50) {
        return res.status(400).send({ error: "Total too low" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: calcResult.amountInCents, 
        currency: "cad",
        automatic_payment_methods: { enabled: true },
        metadata: {
            description: "Online Order",
            items: calcResult.itemSummary.join(", ").substring(0, 499),
            subtotal: `$${calcResult.subtotal.toFixed(2)}`,
            tax: `$${calcResult.tax.toFixed(2)}`,
            total_charged: `$${calcResult.totalWithTax.toFixed(2)}`
        }
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      console.error("Stripe Create Error:", error);
      res.status(500).send({ error: error.message });
    }
  }
);


// --- 4. UPDATE INTENT (This was broken in your code) ---
exports.updatePaymentIntent = onRequest(
  // Added Configuration Object (Secrets + CORS)
  { secrets: ["STRIPE_SECRET"], cors: true },
  async (req, res) => {
    try {
        const stripe = Stripe(process.env.STRIPE_SECRET);
        const { paymentIntentId, items } = req.body;

        if (!paymentIntentId || !items) return res.status(400).send({ error: "Missing ID or Items" });

        // Use Shared Helper (Fixes the "calculateOrderAmount is undefined" crash)
        const calcResult = await calculateCartTotal(items);

        if (calcResult.amountInCents < 50) {
             return res.status(400).send({ error: "Total too low" });
        }

        // Update Stripe
        const paymentIntent = await stripe.paymentIntents.update(
            paymentIntentId,
            { 
                amount: calcResult.amountInCents,
                metadata: {
                    description: "Online Order (Updated)",
                    items: calcResult.itemSummary.join(", ").substring(0, 499),
                    total_charged: `$${calcResult.totalWithTax.toFixed(2)}`
                }
            }
        );

        res.send({ amount: paymentIntent.amount, status: 'updated' });
    } catch (error) {
        console.error("Stripe Update Error:", error);
        res.status(500).send({ error: error.message });
    }
  }
);

async function updateDailyStats(orderData) {
    const db = admin.firestore();
    // 1. Get today's date string (YYYY-MM-DD)
    // Adjust timeZone if needed, assuming Eastern Time for now
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    
    const statsRef = db.collection("dailyStats").doc(todayStr);

    const gross = parseFloat(orderData.totalPaid); // This is Total (inc tax)
    const net = gross / 1.13; // Back out tax (approx)
    const isOnline = orderData.paymentMethod === 'online';

    // Calculate Fees (approx logic from your original code)
    const estimatedFees = isOnline ? (gross * 0.029) + 0.30 : 0;

    // Prepare atomic increments
    const inc = admin.firestore.FieldValue.increment;

    const updateData = {
        date: todayStr, // Store date just in case
        totalOrders: inc(1),
        grossSales: inc(gross),
        netSales: inc(net),
        
        // Nested metrics for Online vs Instore
        "online.count": isOnline ? inc(1) : inc(0),
        "online.gross": isOnline ? inc(gross) : inc(0),
        "online.fees": isOnline ? inc(estimatedFees) : inc(0),
        
        "instore.count": !isOnline ? inc(1) : inc(0),
        "instore.gross": !isOnline ? inc(gross) : inc(0),
    };

    // Update Item Counts (Atomic increment for every item in the cart)
    if (orderData.items && Array.isArray(orderData.items)) {
        orderData.items.forEach(item => {
            // Field keys cannot contain dots, ensure ID is clean
            const itemId = item.itemId; 
            const qty = item.quantity || 1;
            // Map structure: items.springRolls = 5
            updateData[`items.${itemId}`] = inc(qty);
            
            // Optional: Store name so we don't have to look it up later
            // Note: This overwrites the name every time, which is fine
            updateData[`itemNames.${itemId}`] = item.customizations && Object.keys(item.customizations).length > 0 
                ? `${item.itemId} (Custom)` 
                : item.itemId; 
        });
    }

    // Set with merge: true creates the doc if it doesn't exist, or updates it if it does
    await statsRef.set(updateData, { merge: true });
}
// --- 5. VERIFY & CREATE ORDER ---
exports.verifyAndCreateOrder = onRequest(
  { secrets: ["STRIPE_SECRET"], cors: true, maxInstances: 10 },
  async (req, res) => {
    try {
      const stripe = Stripe(process.env.STRIPE_SECRET);
      const { paymentIntentId, cartItems, customerDetails, scheduledTime } = req.body;

      if (!paymentIntentId || !cartItems) {
        return res.status(400).send({ error: "Missing payment ID or cart data" });
      }

      // 1. Check Stripe Status
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== "succeeded") {
        return res.status(400).send({ error: "Payment has not succeeded" });
      }

      // 2. Check Duplicates
      const orderQuery = await admin.firestore().collection('orders')
        .where('stripeId', '==', paymentIntentId).get();
      if (!orderQuery.empty) {
        return res.status(200).send({ message: "Order already processed", orderId: orderQuery.docs[0].id });
      }

      // 3. RE-CALCULATE PRICE (Using Shared Helper)
      // This implicitly fixes the Negative Quantity security hole because the helper ignores quantity <= 0
      const calcResult = await calculateCartTotal(cartItems);

      // 4. Compare Totals
      const paidAmount = paymentIntent.amount;
      // Allow 2 cent variance
      if (Math.abs(calcResult.amountInCents - paidAmount) > 2) {
        console.error(`Fraud Warning: Calc $${calcResult.amountInCents} vs Paid $${paidAmount}`);
        return res.status(400).send({ error: "Cart content does not match payment amount." });
      }

      // 5. Generate Order Number & Save
      const counterRef = admin.firestore().collection("counters").doc("orderCounter");
      const todayStr = new Date().toISOString().split('T')[0]; 

      const newOrderNumber = await admin.firestore().runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(counterRef);
        let nextNum;
        if (!sfDoc.exists) {
            nextNum = 1000;
        } else {
            const data = sfDoc.data();
            nextNum = (data.lastResetDate !== todayStr) ? 1000 : data.current + 1;
        }
        transaction.set(counterRef, { current: nextNum, lastResetDate: todayStr });
        return nextNum;
      });

      const now = new Date();
      const formattedDate = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-'); 
      const customDocId = `${formattedDate}_${newOrderNumber}`;

      const orderData = {
          orderId: customDocId,
          orderNumber: newOrderNumber,
          customerName: customerDetails.name,
          phoneNumber: customerDetails.phone,
          orderDate: admin.firestore.FieldValue.serverTimestamp(),
          pickupTime: scheduledTime || "ASAP",
          status: 'new',
          totalItems: cartItems.length,
          items: cartItems.map(i => ({
            itemId: i.id,
            quantity: i.quantity,
            customizations: i.options || {}
          })), 
          paymentMethod: 'online',
          paymentStatus: 'paid',
          stripeId: paymentIntentId,
          totalPaid: (paidAmount / 100).toFixed(2)
      };

      await admin.firestore().collection("orders").doc(customDocId).set(orderData);
       updateDailyStats(orderData).catch(err => console.error("Stats Update Failed:", err));
      res.status(200).send({ success: true, orderNumber: newOrderNumber });

    } catch (error) {
      console.error("Verify Order Error:", error);
      res.status(500).send({ error: error.message });
    }
  }
);

// --- 6. REPORTING FUNCTIONS (UNCHANGED) ---
async function generateAndSendReport(targetEmail) {
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    
    // Calculate Date Range
    const now = new Date();
    const pastDate = new Date();
    pastDate.setDate(now.getDate() - 14); // Look back 14 days
    const startDateStr = pastDate.toISOString().split('T')[0];

    // 1. OPTIMIZED READ: Query 'dailyStats' instead of 'orders'
    // This reads maximum ~14 documents regardless of how many orders you have.
    const statsSnapshot = await db.collection("dailyStats")
        .where("date", ">=", startDateStr)
        .orderBy("date", "asc")
        .get();

    let metrics = {
        orders: 0, grossSales: 0, netSales: 0,   
        online: { count: 0, gross: 0, feesEstimated: 0 },
        instore: { count: 0, gross: 0 }, 
        itemMap: {} 
    };

    // 2. Aggregate the Daily Summaries
    statsSnapshot.forEach((doc) => {
        const day = doc.data();
        
        metrics.orders += (day.totalOrders || 0);
        metrics.grossSales += (day.grossSales || 0);
        metrics.netSales += (day.netSales || 0);

        // Online Stats
        if (day.online) {
            metrics.online.count += (day.online.count || 0);
            metrics.online.gross += (day.online.gross || 0);
            metrics.online.feesEstimated += (day.online.fees || 0);
        }

        // Instore Stats
        if (day.instore) {
            metrics.instore.count += (day.instore.count || 0);
            metrics.instore.gross += (day.instore.gross || 0);
        }

        // Combine Item Counts
        if (day.items) {
            Object.entries(day.items).forEach(([itemId, count]) => {
                const name = (day.itemNames && day.itemNames[itemId]) ? day.itemNames[itemId] : itemId;
                
                if (!metrics.itemMap[itemId]) {
                    metrics.itemMap[itemId] = { name: name, count: 0 };
                }
                metrics.itemMap[itemId].count += count;
            });
        }
    });

    // 3. (UNCHANGED) Generate HTML Table for Top Items
    const topItemsRows = Object.entries(metrics.itemMap)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((item, index) => {
            const bg = index % 2 === 0 ? '#f9f9f9' : '#ffffff';
            return `
            <tr style="background-color: ${bg};">
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    ${index + 1}. <span style="color: #999; font-family: monospace; font-size: 12px;">[${item.id}]</span> ${item.name}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${item.count}</td>
            </tr>`;
        }).join("");

    // 4. (UNCHANGED) Send Email
    const dataForTemplate = {
        startDate: pastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        endDate: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        grossSales: metrics.grossSales.toFixed(2),
        netSales: metrics.netSales.toFixed(2),
        totalOrders: metrics.orders,
        avgOrderValue: metrics.orders > 0 ? (metrics.grossSales / metrics.orders).toFixed(2) : "0.00",
        onlineMetrics: { count: metrics.online.count, gross: metrics.online.gross.toFixed(2), fees: metrics.online.feesEstimated.toFixed(2) },
        instoreMetrics: { count: metrics.instore.count, gross: metrics.instore.gross.toFixed(2) },
        topItemsRows: topItemsRows
    };

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: "eggrollzspam@gmail.com", pass: process.env.EMAIL_PASSWORD },
    });

    const emailHtml = generateEmailHtml(dataForTemplate);
    await transporter.sendMail({
        from: '"Star Chef Reports" <eggrollzspam@gmail.com>',
        to: targetEmail,
        subject: `📊 Weekly Report: ${dataForTemplate.startDate} - ${dataForTemplate.endDate}`,
        html: emailHtml, 
    });

    return { count: metrics.orders, revenue: metrics.grossSales };
}
const REPORT_RECIPIENTS = "connorlau@hotmail.com, jennifersun1123@gmail.com";

exports.sendBiweeklyReport = onSchedule(
  { schedule: "every monday 09:00", timeZone: "America/Toronto", secrets: ["EMAIL_PASSWORD"], maxInstances: 1 },
  async (event) => {
    try { await generateAndSendReport(REPORT_RECIPIENTS); } 
    catch (error) { console.error("Error in scheduled report:", error); }
  }
);

exports.manualReportTest = onRequest(
    { secrets: ["EMAIL_PASSWORD"], maxInstances: 1, invoker: "public" },
    async (req, res) => {
        try {
            const result = await generateAndSendReport(REPORT_RECIPIENTS);
            res.send(`Success! Sent. Found ${result.count} orders. Rev: $${result.revenue.toFixed(2)}`);
        } catch (error) { res.status(500).send("Error: " + error.message); }
    }
);