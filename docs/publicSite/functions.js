const functions = require("firebase-functions");
const Stripe = require("stripe");

exports.createPaymentIntent = functions
  .runWith({ secrets: ["STRIPE_SECRET"] })
  .https.onRequest(async (req, res) => {
    // 1. CORS Headers (Allow your website to talk to this function)
    res.set("Access-Control-Allow-Origin", "*"); 
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    // Handle the "pre-flight" check
    if (req.method === "OPTIONS") {
      res.end();
      return;
    }

    try {
      const stripe = Stripe(process.env.STRIPE_SECRET);
      
      // We expect the amount to be passed in CENTS (e.g., $10.00 = 1000)
      const { amount } = req.body; 

      // 2. Create the Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount, 
        currency: "cad",
        automatic_payment_methods: { enabled: true },
      });

      // 3. Send the key back to the frontend
      res.json({ clientSecret: paymentIntent.client_secret });
      
    } catch (error) {
      console.error("Stripe Error:", error);
      res.status(500).send({ error: error.message });
    }
  });