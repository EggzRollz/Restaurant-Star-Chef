const { onRequest } = require("firebase-functions/v2/https");
const Stripe = require("stripe");

// Notice how we pass options (secrets and cors) right here at the start
exports.createPaymentIntent = onRequest(
  { 
    secrets: ["STRIPE_SECRET"],
    cors: true  // <--- This handles all the browser security stuff for you automatically!
  },
  async (req, res) => {
    try {
      // Initialize Stripe with the secret
      const stripe = Stripe(process.env.STRIPE_SECRET);
      
      // We expect the amount to be passed in CENTS
      // req.body is automatically parsed in v2
      const { amount } = req.body; 

      if (!amount) {
         res.status(400).send({ error: "Amount is required" });
         return;
      }

      // Create the Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount, 
        currency: "cad",
        automatic_payment_methods: { enabled: true },
      });

      // Send the key back to the frontend
      res.json({ clientSecret: paymentIntent.client_secret });
      
    } catch (error) {
      console.error("Stripe Error:", error);
      res.status(500).send({ error: error.message });
    }
  }
);