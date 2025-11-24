const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2/options");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();

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