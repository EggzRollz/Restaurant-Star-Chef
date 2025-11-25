const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2/options");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const functions = require("firebase-functions");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { generateEmailHtml } = require('./emailTemplate'); 

if (!admin.apps.length) {
  admin.initializeApp();
}


// Set max instances to control costs
setGlobalOptions({ maxInstances: 10 });

// --- HELPER: CALCULATE PRICE ---
function calculateVerifiedItemPrice(menuItem, orderItem) {
    if (!menuItem || !menuItem.pricing || menuItem.pricing.length === 0) return null;

    let basePrice = 0;
    const customerChoices = orderItem.customizations || {};

    // 1. Base Price
    if (menuItem.pricing.length === 1) {
        basePrice = parseFloat(menuItem.pricing[0].price);
    } else {
        const pricingKey = menuItem.pricing[0].size ? 'size' : 'temp'; 
        const pricingTitle = menuItem.pricing[0].size ? 'Size' : 'Temperature'; 
        const customerChoiceValue = customerChoices[pricingTitle]; 
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

            // Combo Model
            if (addOnGroup.freeToppingLimit !== undefined && addOnGroup.postLimitPrice !== undefined) {
                const count = Array.isArray(customerSelections) ? customerSelections.length : 1;
                const extra = Math.max(0, count - addOnGroup.freeToppingLimit);
                addOnPrice += (extra * parseFloat(addOnGroup.postLimitPrice));
            } 
            // Standard Model
            else {
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

// --- MAIN FUNCTION ---
exports.createPaymentIntent = onRequest(
  { 
    secrets: ["STRIPE_SECRET"],
    cors: true  
  },
  async (req, res) => {

    try {
      const stripe = Stripe(process.env.STRIPE_SECRET);
      const { items } = req.body; 

      if (!items || items.length === 0) return res.status(400).send({ error: "Empty cart" });

      console.log("Processing Items:", JSON.stringify(items));

      let calculatedTotal = 0;
      let itemSummary = []; // We will store item names here to verify later

      const COLLECTION_NAME = 'menuItems'; 

      for (const item of items) {
        // --- SECURITY: Prevent Negative Quantity Hack ---
        if (!item.quantity || item.quantity <= 0) {
            console.warn(`Ignored invalid quantity for item ${item.id}`);
            continue; 
        }

        const docRef = admin.firestore().collection(COLLECTION_NAME).doc(item.id);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const dbData = docSnap.data();
            const price = calculateVerifiedItemPrice(dbData, { customizations: item.options || {} });

            if (price !== null && !isNaN(price)) {
                const lineTotal = price * item.quantity;
                calculatedTotal += lineTotal;
                
                // Add to summary for Stripe Dashboard
                itemSummary.push(`${item.id} (x${item.quantity}) - $${lineTotal.toFixed(2)}`);
            }
        }
      }

      // Final Math
      const taxAmount = calculatedTotal * 0.13;
      const totalWithTax = calculatedTotal + taxAmount;
      const amountInCents = Math.round(totalWithTax * 100);

      // Logs for Firebase Console
      console.log(`Subtotal: $${calculatedTotal.toFixed(2)}`);
      console.log(`Tax (13%): $${taxAmount.toFixed(2)}`);
      console.log(`Total: $${totalWithTax.toFixed(2)} (${amountInCents} cents)`);

      if (amountInCents < 50) {
        return res.status(400).send({ error: "Total too low" });
      }

      // Create Intent with METADATA (This is how you verify!)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents, 
        currency: "cad",
        automatic_payment_methods: { enabled: true },
        metadata: {
            // This will show up in your Stripe Dashboard
            description: "Online Order",
            items: itemSummary.join(", ").substring(0, 499), // Stripe limit 500 chars
            subtotal: `$${calculatedTotal.toFixed(2)}`,
            tax: `$${taxAmount.toFixed(2)}`,
            total_charged: `$${totalWithTax.toFixed(2)}`
        }
      });

      res.json({ clientSecret: paymentIntent.client_secret });
      
    } catch (error) {
      console.error("Stripe Error:", error);
      res.status(500).send({ error: error.message });
    }
  }
);




async function generateAndSendReport(targetEmail) {
    if (!admin.apps.length) admin.initializeApp();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "eggrollzspam@gmail.com",
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const db = admin.firestore();
    const now = new Date();
    // Reporting period: Last 14 days
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const ordersSnapshot = await db.collection("orders")
        .where("orderDate", ">=", startDate)
        .get();

    // 2. METRICS
    let metrics = {
        orders: 0,
        grossSales: 0, 
        netSales: 0,   
        online: { count: 0, gross: 0, feesEstimated: 0 },
        instore: { count: 0, gross: 0 },
        itemMap: {} 
    };

    // 3. PROCESS LOOP
    ordersSnapshot.forEach((doc) => {
        const order = doc.data();
        metrics.orders++;
        let orderSubtotal = 0;

        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                const price = Number(item.price) || 0;
                const qty = Number(item.quantity) || 1;
                orderSubtotal += (price * qty);

                // Track ID and Name
                const id = item.itemId || "N/A"; 
                const name = item.title || "Unknown Item";

                if (!metrics.itemMap[id]) {
                    metrics.itemMap[id] = { name: name, count: 0 };
                }
                metrics.itemMap[id].count += qty;
            });
        }

        const taxRate = 1.13; 
        const orderTotalWithTax = orderSubtotal * taxRate;

        metrics.netSales += orderSubtotal;
        metrics.grossSales += orderTotalWithTax;

        if (order.paymentMethod === 'online') {
            metrics.online.gross += orderTotalWithTax;
            metrics.online.count++;
            metrics.online.feesEstimated += (orderTotalWithTax * 0.029) + 0.30;
        } else {
            metrics.instore.gross += orderTotalWithTax;
            metrics.instore.count++;
        }
    });

    // 4. PREPARE ROWS FOR TEMPLATE (With ID First)
    const topItemsRows = Object.entries(metrics.itemMap)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((item, index) => {
            const bg = index % 2 === 0 ? '#f9f9f9' : '#ffffff';
            
            // --- UPDATED: ID IS NOW FIRST ---
            return `
            <tr style="background-color: ${bg};">
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    ${index + 1}. 
                    <span style="color: #999; font-family: monospace; font-size: 12px; margin-right: 6px;">[${item.id}]</span>
                    ${item.name}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">
                    ${item.count}
                </td>
            </tr>`;
        })
        .join("");

    const dataForTemplate = {
        startDate: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        endDate: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        grossSales: metrics.grossSales.toFixed(2),
        netSales: metrics.netSales.toFixed(2),
        totalOrders: metrics.orders,
        avgOrderValue: metrics.orders > 0 ? (metrics.grossSales / metrics.orders).toFixed(2) : "0.00",
        onlineMetrics: {
            count: metrics.online.count,
            gross: metrics.online.gross.toFixed(2),
            fees: metrics.online.feesEstimated.toFixed(2)
        },
        instoreMetrics: {
            count: metrics.instore.count,
            gross: metrics.instore.gross.toFixed(2)
        },
        topItemsRows: topItemsRows
    };

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
// --- 2. SCHEDULED REPORT (Production) ---
exports.sendBiweeklyReport = onSchedule(
  {
    schedule: "every monday 09:00",
    timeZone: "America/Toronto",
    secrets: ["EMAIL_PASSWORD"],
    maxInstances: 1,
  },
  async (event) => {
    try {
        console.log("Running Scheduled Report...");
        await generateAndSendReport(REPORT_RECIPIENTS);
        console.log("Scheduled report sent.");
    } catch (error) {
        console.error("Error in scheduled report:", error);
    }
  }
);

// --- 3. MANUAL TEST REPORT (Click Link to Test) ---
exports.manualReportTest = onRequest(
    { 
        secrets: ["EMAIL_PASSWORD"],
        maxInstances: 1,
        invoker: "public" // Allow clicking from browser
    },
    async (req, res) => {
        try {
            // You can change the email here if you want to verify it yourself first
            const result = await generateAndSendReport(REPORT_RECIPIENTS);
            res.send(`Success! Report sent. <br> Found ${result.count} orders. <br> Revenue Calculated: $${result.revenue.toFixed(2)}`);
        } catch (error) {
            console.error("Error:", error);
            res.status(500).send("Error generating report: " + error.message);
        }
    }
);


exports.verifyAndCreateOrder = onRequest(
  { 
    secrets: ["STRIPE_SECRET"],
    cors: true,
    maxInstances: 10 // Safety limit
  },
  async (req, res) => {
    try {
      const stripe = Stripe(process.env.STRIPE_SECRET);
      const { paymentIntentId, cartItems, customerDetails, scheduledTime } = req.body;

      if (!paymentIntentId || !cartItems) {
        return res.status(400).send({ error: "Missing payment ID or cart data" });
      }

      // 1. VERIFY WITH STRIPE
      // We ask Stripe directly: "What is the status of this ID?"
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== "succeeded") {
        return res.status(400).send({ error: "Payment has not succeeded" });
      }

      // Check if we already saved this order (Idempotency)
      // We use the Stripe ID as part of the document ID to prevent duplicates
      const orderQuery = await admin.firestore().collection('orders')
        .where('stripeId', '==', paymentIntentId).get();

      if (!orderQuery.empty) {
        return res.status(200).send({ message: "Order already processed", orderId: orderQuery.docs[0].id });
      }

      // 2. RE-CALCULATE CART PRICE (The Security Fix)
      // The user sent us a cart. We must prove this cart costs the amount they paid.
      let serverCalculatedTotal = 0;
      const COLLECTION_NAME = 'menuItems'; 

      // We verify the item existence and price again
      for (const item of cartItems) {
        const docRef = admin.firestore().collection(COLLECTION_NAME).doc(item.id);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const dbData = docSnap.data();
            const price = calculateVerifiedItemPrice(dbData, { customizations: item.options || {} });
            if (price !== null) {
                serverCalculatedTotal += (price * item.quantity);
            }
        }
      }

      // Add Tax (Must match your createPaymentIntent logic exactly)
      const taxAmount = serverCalculatedTotal * 0.13;
      const totalWithTax = serverCalculatedTotal + taxAmount;
      const serverCalculatedCents = Math.round(totalWithTax * 100);

      // 3. COMPARE TOTALS
      // Allow a tiny difference (e.g., 1-2 cents) for floating point rounding errors
      const paidAmount = paymentIntent.amount;
      
      if (Math.abs(serverCalculatedCents - paidAmount) > 2) {
        console.error(`Fraud Warning: Calc $${serverCalculatedCents} vs Paid $${paidAmount}`);
        // We DO NOT write the order if the prices don't match
        return res.status(400).send({ error: "Cart content does not match payment amount." });
      }

      // 4. SAVE TO FIRESTORE
      // If we are here, the money is real, and the cart matches the money.
      
      // Generate Order Number (Logic moved from client to here)
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
          })), // Simplified structure
          paymentMethod: 'online',
          paymentStatus: 'paid',
          stripeId: paymentIntentId,
          totalPaid: (paidAmount / 100).toFixed(2)
      };

      await admin.firestore().collection("orders").doc(customDocId).set(orderData);

      console.log(`Order created successfully: #${newOrderNumber}`);
      res.status(200).send({ success: true, orderNumber: newOrderNumber });

    } catch (error) {
      console.error("Verify Order Error:", error);
      res.status(500).send({ error: error.message });
    }
  }
);