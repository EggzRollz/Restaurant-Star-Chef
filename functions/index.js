const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore"); // <--- NEW IMPORT
const { setGlobalOptions } = require("firebase-functions/v2/options");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { generateEmailHtml } = require('./emailTemplate'); 

const menuCache = {}; 
const CACHE_DURATION = 1000 * 60 * 10;

if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({ maxInstances: 10 });

// --- 1. SHARED MATH HELPER ---
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
    const uniqueIds = [...new Set(itemIds)]; 
    const now = Date.now();
    const missedIds = [];
    const itemMap = {}; 

    uniqueIds.forEach(id => {
        const cached = menuCache[id];
        if (cached && (now - cached.timestamp < CACHE_DURATION)) {
            itemMap[id] = cached.data;
        } else {
            missedIds.push(id);
        }
    });

    if (missedIds.length === 0) return itemMap;

    const refs = missedIds.map(id => admin.firestore().collection('menuItems').doc(id));
    
    if (refs.length > 0) {
        const snapshots = await admin.firestore().getAll(...refs);
        snapshots.forEach(snap => {
            if (snap.exists) {
                const data = snap.data();
                if (!data.id) data.id = snap.id; 
                menuCache[snap.id] = { data: data, timestamp: now };
                itemMap[snap.id] = data;
            }
        });
    }

    return itemMap;
}

async function calculateCartTotal(items) {
    let calculatedTotal = 0;
    let itemSummary = [];
    
    if (!items || items.length === 0) {
        return { subtotal: 0, tax: 0, totalWithTax: 0, amountInCents: 0, itemSummary: [] };
    }

    const itemIds = items.map(i => i.id);
    const dbItemMap = await getMenuItemsBatch(itemIds);

    for (const item of items) {
        if (!item.quantity || item.quantity <= 0) continue; 

        const dbData = dbItemMap[item.id];

        if (dbData) {
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

// --- 2. STRIPE ENDPOINTS ---
exports.createPaymentIntent = onRequest(
  { secrets: ["STRIPE_SECRET"], cors: true },
  async (req, res) => {
    try {
      const stripe = Stripe(process.env.STRIPE_SECRET);
      const { items } = req.body; 
      if (!items || items.length === 0) return res.status(400).send({ error: "Empty cart" });

      const calcResult = await calculateCartTotal(items);

      if (calcResult.amountInCents < 50) {
        return res.status(400).send({ error: "Total too low" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: calcResult.amountInCents, 
        currency: "cad",
        payment_method_types: ['card'], 

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

exports.updatePaymentIntent = onRequest(
  { secrets: ["STRIPE_SECRET"], cors: true },
  async (req, res) => {
    try {
        const stripe = Stripe(process.env.STRIPE_SECRET);
        const { paymentIntentId, items } = req.body;

        if (!paymentIntentId || !items) return res.status(400).send({ error: "Missing ID or Items" });

        const calcResult = await calculateCartTotal(items);

        if (calcResult.amountInCents < 50) {
             return res.status(400).send({ error: "Total too low" });
        }

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

// --- 3. VERIFY & CREATE ORDER (Online Only) ---
// --- 3. VERIFY & CREATE ORDER (Online Only) ---
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

      // 3. Security Check
      const calcResult = await calculateCartTotal(cartItems);
      const paidAmount = paymentIntent.amount;
      if (Math.abs(calcResult.amountInCents - paidAmount) > 2) {
        return res.status(400).send({ error: "Cart content does not match payment amount." });
      }

      // 4. Generate Order Number
      const counterRef = admin.firestore().collection("counters").doc("orderCounter");
      const todayStr = new Date().toLocaleDateString("en-CA", { 
            timeZone: "America/Toronto" 
        });

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

        // 1. Get Date part (YYYY-MM-DD) in Toronto time
        const datePart = now.toLocaleDateString("en-CA", { 
            timeZone: "America/Toronto" 
        });

        // 2. Get Time part (HH:mm:ss) in Toronto time 
        // (We use 'en-GB' here because it guarantees 24-hour format like 19:05:00)
        const timePart = now.toLocaleTimeString("en-GB", { 
            timeZone: "America/Toronto",
            hour12: false 
        });

        // 3. Combine them: "2025-11-26_19-30-00"
        const formattedDate = `${datePart}_${timePart}`.replace(/:/g, '-'); 
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
          
          // --- FIX IS HERE: Wrap in Number() ---
          totalPaid: Number((paidAmount / 100).toFixed(2)) 
      };

      // 5. Save Order (This will trigger onOrderCreated below)
      await admin.firestore().collection("orders").doc(customDocId).set(orderData);

      res.status(200).send({ success: true, orderNumber: newOrderNumber });

    } catch (error) {
      console.error("Verify Order Error:", error);
      res.status(500).send({ error: error.message });
    }
  }
);

// --- 4. NEW: AUTOMATIC STATS UPDATER (FIXED) ---
exports.onOrderCreated = onDocumentCreated("orders/{orderId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return; 

    const orderData = snapshot.data();
    const db = admin.firestore();
    
    // 1. Determine Date (Use Toronto Time)
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    const statsRef = db.collection("dailyStats").doc(todayStr);

    // 2. SAFE CHECK: Determine Payment Method
    const rawMethod = (orderData.paymentMethod || '').toLowerCase();
    const stripeId = orderData.stripeId;

    // LOGIC: 
    // It is Online IF: Method is 'online' OR (Method is NOT 'in-store' AND stripeId is valid)
    // It is In-Store IF: Method is 'in-store' OR 'cash'
    let isOnline = false;

    if (rawMethod === 'in-store' || rawMethod === 'cash' || rawMethod === 'instore') {
        isOnline = false;
    } else if (rawMethod === 'online') {
        isOnline = true;
    } else {
        // Fallback: If method is missing, look for a Stripe ID
        isOnline = (!!stripeId && stripeId !== "null" && stripeId !== "");
    }

    console.log(`[STATS] Order: ${orderData.orderNumber} | Method: ${rawMethod} | StripeId: ${stripeId} | Result: ${isOnline ? 'ONLINE' : 'IN-STORE'}`);

    // 3. Determine Amounts
    const gross = parseFloat(orderData.totalPaid || 0); // Note: For In-Store unpaid orders, this might be 0. 
    // If you want to track the *value* of in-store orders even if unpaid yet, use orderData.items calculation.
    // Assuming 'totalPaid' is populated for in-store orders upon creation:
    
    const net = gross / 1.13;
    const estimatedFees = isOnline ? (gross * 0.029) + 0.30 : 0;

    const inc = admin.firestore.FieldValue.increment;

    // 4. Prepare Update
    const updateData = {
        date: todayStr,
        totalOrders: inc(1),
        grossSales: inc(gross),
        netSales: inc(net),
        
        // Online Stats
        "online.count": isOnline ? inc(1) : inc(0),
        "online.gross": isOnline ? inc(gross) : inc(0),
        "online.fees": isOnline ? inc(estimatedFees) : inc(0),
        
        // In-Store Stats
        "instore.count": !isOnline ? inc(1) : inc(0),
        "instore.gross": !isOnline ? inc(gross) : inc(0),
    };

    // 5. Update Item Counts
    if (orderData.items && Array.isArray(orderData.items)) {
        orderData.items.forEach(item => {
            const rawId = item.itemId || "unknown";
            const cleanId = String(rawId).replace(/[\.\/\s\#\[\]\*]/g, "_");
            const qty = item.quantity || 1;

            updateData[`items.${cleanId}`] = inc(qty);
            
            const itemName = item.customizations && Object.keys(item.customizations).length > 0 
                ? `${rawId} (Custom)` 
                : rawId;
            updateData[`itemNames.${cleanId}`] = itemName;
        });
    }

    try {
        await statsRef.set(updateData, { merge: true });
        console.log(`[SUCCESS] Stats updated for Order ${orderData.orderNumber}`);
    } catch (err) {
        console.error("Failed to update daily stats:", err);
    }
});



// --- 5. REPORTING (STRICT TIMEZONE FIX) ---
async function generateAndSendReport(targetEmail) {
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    
    // === STEP 1: FORCE DATE TO TORONTO "YYYY-MM-DD" ===
    // We do not care what time it is in UTC. We only want the date string in Toronto.
    const nowRaw = new Date();
    const torontoDateStr = nowRaw.toLocaleDateString("en-CA", { 
        timeZone: "America/Toronto" 
    }); 
    // Result: "2025-11-26" (Even if it is Nov 27th in UTC)

    // === STEP 2: CREATE "ANCHOR" DATES ===
    // We append "T12:00:00" (Noon) to ensure we are safely in the middle of the day.
    // This prevents any timezone offset from shifting the date to the previous/next day.
    const currentWeekEnd = new Date(torontoDateStr + "T12:00:00");
    
    const currentWeekStart = new Date(currentWeekEnd);
    currentWeekStart.setDate(currentWeekEnd.getDate() - 7);
    
    const prevWeekStart = new Date(currentWeekEnd);
    prevWeekStart.setDate(currentWeekEnd.getDate() - 14);

    // === STEP 3: GENERATE DATABASE KEYS ===
    // Helper to turn our Date objects back into "YYYY-MM-DD" strings for Firestore
    const toYMD = (dateObj) => dateObj.toISOString().split('T')[0];

    // Since we created the dates at Noon UTC (via the string constructor), 
    // .toISOString() will return the correct date part.
    const splitDateStr = toYMD(currentWeekStart); // "2025-11-19"
    const startDateStr = toYMD(prevWeekStart);    // "2025-11-12"

    console.log(`[REPORT DEBUG] Range: ${startDateStr} to ${torontoDateStr}`);

    const statsSnapshot = await db.collection("dailyStats")
        .where("date", ">=", startDateStr)
        .orderBy("date", "asc")
        .get();

    // ... (Variables setup remains the same) ...
    let currentWeek = { sales: 0, orders: 0 };
    let prevWeek = { sales: 0, orders: 0 };
    
    let metrics = {
        orders: 0, grossSales: 0, netSales: 0,
        online: { count: 0, gross: 0, feesEstimated: 0 },
        instore: { count: 0, gross: 0 },
        itemMap: {}
    };

    let chartDataCurrent = []; 
    let chartDataPrev = [];    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    statsSnapshot.forEach((doc) => {
        const day = doc.data();
        const dateStr = day.date; 
        
        // Use Noon to parse the DB date safely
        const d = new Date(dateStr + "T12:00:00"); 

        if (dateStr >= splitDateStr) {
            // CURRENT WEEK
            const dayOrders = (day.totalOrders || 0);
            const dayGross = (day.grossSales || 0);
            
            metrics.orders += dayOrders;
            metrics.grossSales += dayGross;
            metrics.netSales += (day.netSales || 0);

            if (day.online) {
                metrics.online.count += (day.online.count || 0);
                metrics.online.gross += (day.online.gross || 0);
                metrics.online.feesEstimated += (day.online.fees || 0);
            }

            // 2. Add In-Store Stats (If they exist)
            if (day.instore) {
                metrics.instore.count += (day.instore.count || 0);
                metrics.instore.gross += (day.instore.gross || 0);
            }


            if (day.items) {
                Object.entries(day.items).forEach(([itemId, count]) => {
                    if (typeof count === 'number') {
                        const name = (day.itemNames && day.itemNames[itemId]) ? day.itemNames[itemId] : itemId;
                        if (!metrics.itemMap[itemId]) metrics.itemMap[itemId] = { name: name, count: 0 };
                        metrics.itemMap[itemId].count += count;
                    }
                });
            }

            currentWeek.sales += dayGross;
            currentWeek.orders += dayOrders;
            chartDataCurrent[d.getDay()] = dayGross;

        } else {
            // PREV WEEK
            prevWeek.sales += (day.grossSales || 0);
            prevWeek.orders += (day.totalOrders || 0);
            chartDataPrev[d.getDay()] = (day.grossSales || 0);
        }
    });

    // ... (Chart Logic remains the same) ...
    const chartConfig = {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'This Week',
                    data: chartDataCurrent, 
                    borderColor: '#2e7d32', 
                    backgroundColor: 'rgba(46, 125, 50, 0.1)',
                    fill: true
                },
                {
                    label: 'Last Week',
                    data: chartDataPrev,
                    borderColor: '#999', 
                    borderDash: [5, 5], 
                    fill: false
                }
            ]
        },
        options: {
            legend: { position: 'bottom' },
            title: { display: false },
            scales: {
                yAxes: [{ ticks: { callback: (val) => '$' + val } }]
            }
        }
    };
    
    for(let i=0; i<7; i++) {
        if(chartDataCurrent[i] === undefined) chartDataCurrent[i] = 0;
        if(chartDataPrev[i] === undefined) chartDataPrev[i] = 0;
    }
    chartConfig.data.datasets[0].data = chartDataCurrent;
    chartConfig.data.datasets[1].data = chartDataPrev;

    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=500&h=300`;

    const topItemsRows = Object.entries(metrics.itemMap)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((item, index) => {
            return `
            <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 10px;">
                    <div style="font-weight: bold; color: #333;">
                        <!-- NEW FORMAT: 1. [ID] Name -->
                        ${index + 1}. <span style="color: #999; font-weight: normal; font-size: 12px;">[${item.id}]</span> ${item.name}
                    </div>
                </td>
                <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 14px;">${item.count}</td>
            </tr>`;
        }).join("");

    // === STEP 4: STRICT DATE FORMATTING FOR EMAIL TEXT ===
    // Because we created currentWeekEnd as "YYYY-MM-DD" + "T12:00:00",
    // simple string formatting is now safe.
    const simpleFormat = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const dataForTemplate = {
        startDate: simpleFormat(currentWeekStart), // e.g. "Nov 19"
        endDate: simpleFormat(currentWeekEnd),     // e.g. "Nov 26"
        
        grossSales: metrics.grossSales.toFixed(2),
        netSales: metrics.netSales.toFixed(2),
        totalOrders: metrics.orders,
        avgOrderValue: metrics.orders > 0 ? (metrics.grossSales / metrics.orders).toFixed(2) : "0.00",
        onlineMetrics: { count: metrics.online.count, gross: metrics.online.gross.toFixed(2), fees: metrics.online.feesEstimated.toFixed(2) },
        instoreMetrics: { count: metrics.instore.count, gross: metrics.instore.gross.toFixed(2) },
        topItemsRows: topItemsRows,
        chartUrl: chartUrl,
        comparisons: {
            salesChange: calculatePercentChange(currentWeek.sales, prevWeek.sales),
            ordersChange: calculatePercentChange(currentWeek.orders, prevWeek.orders)
        }
    };

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: "eggrollzspam@gmail.com", pass: process.env.EMAIL_PASSWORD },
    });

    await transporter.sendMail({
        from: '"Star Chef Reports" <eggrollzspam@gmail.com>',
        to: targetEmail,
        subject: `📊 Weekly Report: $${Math.round(metrics.grossSales)} Sales (${dataForTemplate.comparisons.salesChange > 0 ? '+' : ''}${dataForTemplate.comparisons.salesChange.toFixed(0)}%)`,
        html: generateEmailHtml(dataForTemplate), 
    });

    return { count: metrics.orders, revenue: metrics.grossSales };
}

const REPORT_RECIPIENTS = "connorlau@hotmail.com, jennifersun1123@gmail.com";

exports.sendWeeklyReport = onSchedule(
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

const calculatePercentChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0; 
    return ((current - previous) / previous) * 100;
};


exports.recalculateStats = onRequest(
    { cors: true, secrets: ["CORS_PASSWORD"] }, // Add secret
    async (req, res) => {
        // 1. Security Check
        if (req.query.key !== process.env.CORS_PASSWORD) {
            return res.status(403).send("Unauthorized");
        }
        const db = admin.firestore();
        const dateStr = req.query.date; // Expects "2025-11-26"

        if (!dateStr) return res.status(400).send("Please provide ?date=YYYY-MM-DD");

        try {
            console.log(`Recalculating for ${dateStr}...`);

           const targetDate = new Date(dateStr + "T12:00:00"); 

            // Calculate Midnight in Toronto
            const startOfDay = new Date(targetDate.toLocaleString("en-US", { timeZone: "America/Toronto" }));
            startOfDay.setHours(0, 0, 0, 0);

            // Calculate End of Day in Toronto
            const endOfDay = new Date(startOfDay);
            endOfDay.setHours(23, 59, 59, 999);

            // --- 2. GET ORDERS ---
            const ordersSnap = await db.collection('orders')
                .where('orderDate', '>=', startOfDay)
                .where('orderDate', '<=', endOfDay)
                .get();

            // --- 3. INITIALIZE ZERO STATS ---
            // We do this BEFORE checking if empty, so we have a "Zero Template" ready.
            let stats = {
                date: dateStr, // Ensure date is inside the object
                totalOrders: 0,
                grossSales: 0,
                netSales: 0,
                online: { count: 0, gross: 0, fees: 0 },
                instore: { count: 0, gross: 0 },
                items: {},
                itemNames: {}
            };

            // --- 4. AGGREGATE (Only runs if orders exist) ---
            if (!ordersSnap.empty) {
                ordersSnap.forEach(doc => {
                    const data = doc.data();
                    const total = parseFloat(data.totalPaid || 0);
                    const net = total / 1.13; 
                    
                    // Determine Method
                    const rawMethod = (data.paymentMethod || '').toLowerCase();
                    const stripeId = data.stripeId;
                    let isOnline = false;

                    if (rawMethod === 'online') isOnline = true;
                    else if (rawMethod === 'in-store' || rawMethod === 'cash') isOnline = false;
                    else isOnline = (!!stripeId && stripeId !== "null" && stripeId !== "");

                    // Add to totals
                    stats.totalOrders += 1;
                    stats.grossSales += total;
                    stats.netSales += net;

                    if (isOnline) {
                        stats.online.count += 1;
                        stats.online.gross += total;
                        stats.online.fees += ((total * 0.029) + 0.30);
                    } else {
                        stats.instore.count += 1;
                        stats.instore.gross += total;
                    }

                    // Count Items
                    if (data.items && Array.isArray(data.items)) {
                        data.items.forEach(item => {
                            const cleanId = String(item.itemId).replace(/[\.\/\s\#\[\]\*]/g, "_");
                            if (!stats.items[cleanId]) {
                                stats.items[cleanId] = 0;
                                stats.itemNames[cleanId] = item.title || item.itemId; 
                            }
                            stats.items[cleanId] += (item.quantity || 1);
                        });
                    }
                });
            } else {
                console.log(`No orders found for ${dateStr}. Resetting stats to 0.`);
            }

            // --- 5. OVERWRITE DB (Even if 0) ---
            const docRef = db.collection('dailyStats').doc(dateStr);
            
            // Use .set() to completely overwrite. 
            // If you used .update(), it would fail if the doc didn't exist.
            await docRef.set(stats);

            res.send({ 
                message: "Stats Recalculated Successfully", 
                date: dateStr, 
                foundOrders: stats.totalOrders, // Will be 0 if wiped
                gross: stats.grossSales         // Will be 0 if wiped
            });

        } catch (error) {
            console.error(error);
            res.status(500).send(error.message);
        }
    }
);