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

// --- 2. SHARED DB CALCULATION HELPER (Prevents Code Duplication) ---
// This fixes the missing function error and ensures security across all endpoints
async function calculateCartTotal(items) {
    let calculatedTotal = 0;
    let itemSummary = [];
    const COLLECTION_NAME = 'menuItems'; 

    for (const item of items) {
        // SECURITY: Prevent Negative Quantity
        if (!item.quantity || item.quantity <= 0) {
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
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: "eggrollzspam@gmail.com", pass: process.env.EMAIL_PASSWORD },
    });
    const db = admin.firestore();
    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ordersSnapshot = await db.collection("orders").where("orderDate", ">=", startDate).get();
    let metrics = {
        orders: 0, grossSales: 0, netSales: 0,   
        online: { count: 0, gross: 0, feesEstimated: 0 },
        instore: { count: 0, gross: 0 }, itemMap: {} 
    };
    ordersSnapshot.forEach((doc) => {
        const order = doc.data();
        metrics.orders++;
        let orderSubtotal = 0;
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                const price = Number(item.price) || 0;
                const qty = Number(item.quantity) || 1;
                orderSubtotal += (price * qty);
                const id = item.itemId || "N/A"; 
                const name = item.title || "Unknown Item";
                if (!metrics.itemMap[id]) metrics.itemMap[id] = { name: name, count: 0 };
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

    const dataForTemplate = {
        startDate: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        endDate: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        grossSales: metrics.grossSales.toFixed(2),
        netSales: metrics.netSales.toFixed(2),
        totalOrders: metrics.orders,
        avgOrderValue: metrics.orders > 0 ? (metrics.grossSales / metrics.orders).toFixed(2) : "0.00",
        onlineMetrics: { count: metrics.online.count, gross: metrics.online.gross.toFixed(2), fees: metrics.online.feesEstimated.toFixed(2) },
        instoreMetrics: { count: metrics.instore.count, gross: metrics.instore.gross.toFixed(2) },
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