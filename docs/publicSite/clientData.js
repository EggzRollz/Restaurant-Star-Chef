// --- 1. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, collection, doc, runTransaction, writeBatch, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";
import { validateCheckoutForm } from './checkout.js';
import { updateCartQuantityDisplay } from './main.js'; // Ensure this path is correct
import { Cart } from './cart.js'; // Ensure this path is correct

// --- 2. INITIALIZE ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global Stripe Variables
let stripe;
let elements;
let isStripeInitialized = false;

// --- 3. HELPER: GET ORDER NUMBER (Your original code) ---
async function getNextOrderNumber(db) {
    const counterRef = doc(db, "counters", "orderCounter");
    const todayStr = new Date().toISOString().split('T')[0]; 

    try {
        return await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(counterRef);
            let nextNum;
            
            if (!sfDoc.exists()) {
                nextNum = 1000;
            } else {
                const data = sfDoc.data();
                if (data.lastResetDate !== todayStr) {
                    nextNum = 1000;
                } else {
                    nextNum = data.current + 1;
                }
            }
            transaction.set(counterRef, { current: nextNum, lastResetDate: todayStr });
            return nextNum;
        });
    } catch (e) {
        console.error("Counter transaction failed: ", e);
        throw e;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const placeOrderBttn = document.getElementById("place-order-button");
    const firstName = document.getElementById("firstName");
    const lastName = document.getElementById("lastName");
    const phone = document.getElementById("phone");
    const selectedPickupTimeInput = document.getElementById('selectedPickupTime');
    const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
    const onlinePaymentContainer = document.getElementById('online-payment-container');
    
    // Initialize Cart
    const cart = new Cart();
    cart.loadFromStorage();

    // Initialize Stripe (Your Public Key)
    stripe = Stripe("pk_test_51SWctgGoQxdZDWdoSxxfc3aRRgygJUc69RP9vTzMQBCQrdkdmN0LZQS9iQxrkNsLZNciuqr4yJH7yP9v5O6Kg0b600lqhXMv4f");

    // --- 4. PAYMENT UI LOGIC ---
    async function togglePaymentSection() {
        const selectedOption = document.querySelector('input[name="paymentMethod"]:checked');
        if (!selectedOption) return;

        if (selectedOption.value === 'online'  && cart.getItems().length > 0) {
            onlinePaymentContainer.classList.remove('hidden');
            
            // Calculate Total
            const items = cart.getItems();
            const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal * 1.13; // Adding HST
            const cartItems = cart.getItems().map(item => ({
                id: item.baseId || item.id, // The ID used in your Firestore 'menu' collection
                quantity: item.quantity,
                options: item.customizations // Only if options cost extra money
            }));

            if (cartItems.length > 0 && !isStripeInitialized) {
                placeOrderBttn.disabled = true;
                placeOrderBttn.textContent = "Loading Payment...";
                
                await initializeStripeElement(cartItems);
                
                placeOrderBttn.disabled = false;
                placeOrderBttn.textContent = "Place Order";
                isStripeInitialized = true; 
            }
        } else {
            onlinePaymentContainer.classList.add('hidden');
        }
    }

    async function initializeStripeElement(cartItems) {
    try {
        const FUNCTION_URL = "https://createpaymentintent-276czbbs6q-uc.a.run.app"; 

        const response = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: cartItems }), // <--- SAFE
        });

        if (!response.ok) throw new Error("Network response was not ok");
        const { clientSecret } = await response.json();

        // --- START OF STYLING SECTION ---
        const appearance = { 
            theme: 'stripe', // Options: 'stripe', 'night', 'flat'
            
            variables: {
                // 1. Primary Brand Color (Used for focus outlines and the "Pay" checkmark)
                colorPrimary: '#c7b884ff', // Example: Red

                // 2. Background Color of the inputs
                colorBackground: '#ffffff',

                // 3. Text Color
                colorText: '#30313d',

                // 4. Border Radius (Rounded corners)
                borderRadius: '4px',

                // 5. Font Family (Match your website font)
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
            },
            
            // Advanced Rules (CSS-like)
            rules: {
                '.Input': {
                    border: '1px solid #ccc', // Light grey border
                    boxShadow: 'none',        // Remove default shadow
                    padding: '12px',          // More spacing inside
                },
                '.Input:focus': {
                    border: '1px solid #a2956b', // Red border when clicking inside
                    boxShadow: '0 0 0 1px #e0ce94ff', // Red glow
                },
                '.Label': {
                    fontWeight: '500', // Make labels slightly bolder
                    color: '#444',
                }
            }
        };
        // --- END OF STYLING SECTION ---

        elements = stripe.elements({ appearance, clientSecret });
        const paymentElement = elements.create("payment", { layout: "tabs" });
        paymentElement.mount("#payment-element");

    } catch (error) {
        console.error("Failed to load Stripe:", error);
        alert("Payment system error. Please refresh.");
    }
}

    // --- 5. SHARED: FINALIZE ORDER (Database + SMS + Redirect) ---
    // This runs AFTER payment is confirmed (or immediately for cash)
    async function finalizeOrderInDatabase(paymentDetails) {
        // 1. Get Payload
        const cartPayload = JSON.parse(localStorage.getItem('cart')).map(item => ({
            itemId: item.baseId || item.id.split('_')[0], 
            title: item.name || "Unknown Item", 
            price: item.price || 0,
            quantity: item.quantity,
            customizations: item.customizations || {} 
        }));

        // 2. Get Order Number
        const newOrderNumber = await getNextOrderNumber(db);
        const now = new Date();
        const formattedDate = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-'); 
        const customDocId = `${formattedDate}_${newOrderNumber}`;

        // 3. Batch Write
        const batch = writeBatch(db);
        const newOrderRef = doc(db, "orders", customDocId); 
        
        let selectedTime = selectedPickupTimeInput.value;
        if (!selectedTime || selectedTime === "") selectedTime = "ASAP"; 
        
        const orderData = {
            orderId: newOrderRef.id,
            orderNumber: newOrderNumber, 
            customerName: `${firstName.value.trim()} ${lastName.value.trim()}`,
            phoneNumber: '+1' + phone.value.replace(/\D/g, ''),
            orderDate: serverTimestamp(), 
            pickupTime: selectedTime,
            status: 'new',
            totalItems: cartPayload.length, 
            items: cartPayload,
            paymentMethod: paymentDetails.method, // 'online' or 'instore'
            paymentStatus: paymentDetails.status, // 'paid' or 'unpaid'
            stripeId: paymentDetails.stripeId || null
        };
        
        batch.set(newOrderRef, orderData);
        await batch.commit();
        
        // 4. Send SMS
        try {
            const SMS_FUNCTION_URL = "https://send-order-text-924721320321.northamerica-northeast2.run.app"; 
            await fetch(SMS_FUNCTION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerName: `${firstName.value.trim()} ${lastName.value.trim()}`,
                    phoneNumber: phone.value.trim(),
                    orderNumber: newOrderNumber,
                    pickupTime: selectedTime
                })
            });
        } catch (smsError) {
            console.warn("Failed to send SMS, but order was saved:", smsError);
        }

        // 5. Cleanup & Redirect
        localStorage.removeItem('cart');
        const encodedPhoneNumber = encodeURIComponent(phone.value.trim()); 
        const encodedTime = encodeURIComponent(selectedTime);
        window.location.href = `thank-you.html?order=${newOrderNumber}&time=${encodedTime}&phone=${encodedPhoneNumber}`;
    }

    // --- 6. MAIN CLICK LISTENER ---
    if (placeOrderBttn) {
        placeOrderBttn.addEventListener("click", async (event) => {
            event.preventDefault(); 
            
            // 1. Validate Standard Fields (Name, Phone, Time)
            const validationResult = validateCheckoutForm();
            
            if (!validationResult.isValid) {
                if (validationResult.firstInvalidField) {
                    validationResult.firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return; // Stop here if personal info is missing
            }

            const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
            if (cartItems.length === 0) {
                alert("Your cart is empty.");
                return; 
            }

            // 2. Check Payment Method Selection
            const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
            
            if (!selectedMethod) {
                alert("Please select a payment method.");
                return;
            }

            // 3. Special Validation for Online Payment
            if (selectedMethod === 'online') {
                // If user clicked "Online" but the form didn't load (or they didn't wait)
                if (!stripe || !elements) {
                    alert("Please wait for the payment form to load.");
                    return;
                }
            }

            placeOrderBttn.disabled = true;
            placeOrderBttn.textContent = "Processing...";

            try {
                // === PATH A: ONLINE PAYMENT ===
                if (selectedMethod === 'online') {
                    
                    // Process Payment
                    const { error, paymentIntent } = await stripe.confirmPayment({
                        elements,
                        confirmParams: { return_url: window.location.href },
                        redirect: "if_required" 
                    });

                    if (error) {
                        // --- NEW: HANDLE STRIPE VALIDATION ERRORS VISUALLY ---
                        console.error(error);

                        // If fields are empty or invalid, Stripe throws type "validation_error" or "card_error"
                        if (error.type === "validation_error" || error.type === "card_error") {
                            
                            const paymentContainer = document.getElementById('online-payment-container');
                            
                            // 1. Add your red/shake animation class
                            paymentContainer.classList.add('highlight-error');
                            
                            // 2. Scroll to the payment section
                            paymentContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

                            // 3. Remove class after animation (matches your existing logic)
                            setTimeout(() => {
                                paymentContainer.classList.remove('highlight-error');
                            }, 2500);
                        } else {
                            // Technical errors (network issues, etc)
                            alert(error.message || "Payment Failed");
                        }

                        placeOrderBttn.disabled = false;
                        placeOrderBttn.textContent = "Place Order";
                        return; // STOP HERE
                    }

                    // Success! Now save to DB
                    if (paymentIntent && paymentIntent.status === "succeeded") {
                        await finalizeOrderInDatabase({
                            method: 'online',
                            status: 'paid',
                            stripeId: paymentIntent.id
                        });
                    }
                } 
                // === PATH B: PAY IN STORE ===
                else {
                    await finalizeOrderInDatabase({
                        method: 'in-store',
                        status: 'unpaid',
                        stripeId: null
                    });
                }

            } catch (error) {
                console.error("Order Error: ", error);
                alert("An error occurred. Please try again.");
                placeOrderBttn.disabled = false;
                placeOrderBttn.textContent = "Place Order";
            }
        });
    }

    // Listeners for Radio Buttons
    paymentRadios.forEach(radio => {
        radio.addEventListener('change', togglePaymentSection);
    });

    // Handle Cart Updates (Reset Payment if cart changes)
    window.addEventListener('cartUpdated', () => {
        if (isStripeInitialized) {
            isStripeInitialized = false;
            document.getElementById('payment-element').innerHTML = "";
            onlinePaymentContainer.classList.add('hidden');
            const onlineRadio = document.querySelector('input[value="online"]');
            if(onlineRadio) onlineRadio.checked = false;
            alert("Cart updated. Please select payment method again.");
        }
    });
});