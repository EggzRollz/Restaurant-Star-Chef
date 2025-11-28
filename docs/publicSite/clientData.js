// --- 1. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, doc, runTransaction, writeBatch, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";
import { validateCheckoutForm } from './checkout.js';
import { Cart } from './cart.js'; // Ensure this path is correct

// --- 2. INITIALIZE ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global Stripe Variables
let stripe;
let elements;
let isStripeInitialized = false;
let paymentElement;
let currentPaymentIntentId = null;





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
    
    if (selectedPickupTimeInput) {
    selectedPickupTimeInput.addEventListener('change', async () => {
        const selectedOption = document.querySelector('input[name="paymentMethod"]:checked');
        const isOnline = selectedOption && selectedOption.value === 'online';

        // 1. If Paying In Store: FORCE ENABLE the button
        if (!isOnline) {
            placeOrderBttn.disabled = false;
            placeOrderBttn.textContent = "Place Order";
            return;
        }

        // 2. If Paying Online: Update Stripe with new time (Optional, prevents mismatches)
        // If you want the time change to update the Stripe intent price/metadata:
        if (isOnline && currentPaymentIntentId) {
             await updateStripeTotal();
        }
    });
}

    // --- 4. PAYMENT UI LOGIC ---
    async function togglePaymentSection() {
        const selectedOption = document.querySelector('input[name="paymentMethod"]:checked');
        if (!selectedOption) return;

        const isOnline = selectedOption.value === 'online';

        // --- SCENARIO 1: PAY IN STORE (Instant Exit) ---
        if (!isOnline) {
            onlinePaymentContainer.classList.add('hidden');
            // Force enable immediately and stop the function
            placeOrderBttn.disabled = false;
            placeOrderBttn.textContent = "Place Order";
            return; 
        }

        // --- SCENARIO 2: ONLINE PAYMENT (Only run heavy logic here) ---
        onlinePaymentContainer.classList.remove('hidden');
        cart.loadFromStorage(); 
        
        const cartItems = cart.getItems().map(item => ({
            id: item.baseId || item.id.split('_')[0],
            quantity: item.quantity || 1,
            options: item.customizations || {} 
        }));

        // Only disable if we actually need to load Stripe
        if (cartItems.length > 0 && !isStripeInitialized) {
            placeOrderBttn.disabled = true;
            placeOrderBttn.textContent = "Loading Payment...";
            
            await initializeStripeElement(cartItems);
            
            placeOrderBttn.disabled = false;
            placeOrderBttn.textContent = "Place Order";
            isStripeInitialized = true; 
        }
    }

    async function initializeStripeElement(cartItems) {
        try {
            const FUNCTION_URL = "https://createpaymentintent-276czbbs6q-uc.a.run.app"; 

            const response = await fetch(FUNCTION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: cartItems }), 
            });

            if (!response.ok) throw new Error("Network response was not ok");
            const { clientSecret } = await response.json();
            currentPaymentIntentId = clientSecret.split('_secret_')[0];
            const appearance = { 
                theme: 'stripe',
                variables: {
                    colorPrimary: '#c7b884ff',
                    colorBackground: '#ffffff',
                    colorText: '#30313d',
                    borderRadius: '4px',
                    fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                },
                rules: {
                    '.Input': { border: '1px solid #ccc', boxShadow: 'none', padding: '12px' },
                    '.Input:focus': { border: '1px solid #a2956b', boxShadow: '0 0 0 1px #e0ce94ff' },
                    '.Label': { fontWeight: '500', color: '#444' }
                }
            };

            elements = stripe.elements({ appearance, clientSecret });
            
            // Create and assign to global variable so we can unmount it later
            paymentElement = elements.create("payment", { layout: "tabs" });
            paymentElement.mount("#payment-element");

        } catch (error) {
            console.error("Failed to load Stripe:", error);
            alert("Payment system error. Please refresh.");
        }
    }
async function updateStripeTotal() {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    if (selectedMethod !== 'online') return; 
    if (!currentPaymentIntentId) return;

    // --- FIX: Create a local instance of Cart ---
    const cart = new Cart(); 
    cart.loadFromStorage(); 
    
    const rawItems = cart.getItems();

    // If cart is empty, don't update
    if (rawItems.length === 0) return;

    const placeOrderBttn = document.getElementById("place-order-button");
    
    // --- REMOVED: const originalText = placeOrderBttn.textContent; --- 
    // We don't want to capture "Calculating..."
    
    // Disable button while updating price
    placeOrderBttn.disabled = true;
    placeOrderBttn.textContent = "Updating Price...";

    const cartItems = rawItems.map(item => ({
        id: item.baseId || item.id.split('_')[0],
        quantity: item.quantity || 1,
        options: item.customizations || {} 
    }));

    try {
        const UPDATE_URL = "https://updatepaymentintent-276czbbs6q-uc.a.run.app"; 

        const response = await fetch(UPDATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                paymentIntentId: currentPaymentIntentId,
                items: cartItems 
            }), 
        });

        if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.error || "Update failed");
        }
        console.log("Stripe price updated successfully");

    } catch (e) {
        console.error("Price update failed", e);
        // Force a reload of the payment element to prevent "Price Mismatch" errors
        isStripeInitialized = false; 
        document.getElementById('payment-element').innerHTML = "";
        alert("There was an error updating your cart total. Please refresh the page.");
    } finally {
        placeOrderBttn.disabled = false;
        
        // --- FIX: Hard reset to "Place Order" ---
        placeOrderBttn.textContent = "Place Order"; 
    }
}
// --- 5. SHARED: FINALIZE ORDER (Database + SMS + Redirect) ---
// --- 5. SHARED: FINALIZE ORDER (Database + SMS + Redirect) ---
async function finalizeOrderInDatabase(paymentDetails) {
    console.log("Starting finalizeOrderInDatabase..."); // DEBUG LOG

    try {
        // 1. Get Payload directly from LocalStorage
        const rawCart = JSON.parse(localStorage.getItem('cart')) || [];
        console.log("Raw Cart from Storage:", rawCart); // DEBUG LOG

        if (rawCart.length === 0) {
            console.error("Cart is empty, aborting.");
            return;
        }
        
        // --- CALCULATE TOTAL HERE ---
        let calculatedSubtotal = 0;

        const cartPayload = rawCart.map((item, index) => {
            // FIX: Handle price parsing explicitly and log it
            const rawPrice = String(item.price);
            // Remove any '$' or non-numeric characters except '.'
            const cleanPrice = rawPrice.replace(/[^0-9.]/g, ''); 
            const price = parseFloat(cleanPrice) || 0;
            const qty = parseInt(item.quantity) || 1;
            
            console.log(`Item ${index} | Raw: ${rawPrice} | Clean: ${cleanPrice} | Final: ${price}`); // DEBUG LOG

            // Add to running total
            calculatedSubtotal += (price * qty);

            return {
                itemId: item.baseId || item.id.split('_')[0], 
                title: item.name || "Unknown Item", 
                price: price,
                quantity: qty,
                customizations: item.customizations || {} 
            };
        });

        console.log("Calculated Subtotal:", calculatedSubtotal); // DEBUG LOG

        // Calculate Tax & Final Total
        const hstAmount = calculatedSubtotal * 0.13;
        const finalTotal = calculatedSubtotal + hstAmount;
        
        console.log("Final Total to be saved:", finalTotal); // DEBUG LOG

        // 2. Get Order Number
        console.log("Fetching order number...");
        const newOrderNumber = await getNextOrderNumber(db);
        console.log("Order Number retrieved:", newOrderNumber);

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
            paymentMethod: paymentDetails.method, 
            paymentStatus: paymentDetails.status, 
            stripeId: paymentDetails.stripeId || null,
            totalPaid: parseFloat(finalTotal.toFixed(2)) // Ensure this is a number
        };
        
        console.log("Attempting to write to DB with data:", orderData); // DEBUG LOG

        batch.set(newOrderRef, orderData);
        await batch.commit();

        console.log("DB Write Successful"); // DEBUG LOG

        // 4. Cleanup & Redirect
        localStorage.removeItem('cart');
        const encodedPhoneNumber = encodeURIComponent(phone.value.trim()); 
        const encodedTime = encodeURIComponent(selectedTime);
        window.location.href = `thank-you.html?order=${newOrderNumber}&time=${encodedTime}&phone=${encodedPhoneNumber}`;

    } catch (e) {
        console.error("CRITICAL ERROR in finalizeOrderInDatabase:", e);
        alert("Error creating order. Check console for details.");
    }
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

// Prepare Cart Items for the function
const cartItemsForServer = JSON.parse(localStorage.getItem('cart')).map(item => ({
    id: item.baseId || item.id.split('_')[0],
    quantity: item.quantity,
    options: item.customizations || {} 
}));

placeOrderBttn.disabled = true;
placeOrderBttn.textContent = "Processing...";

try {
    // === PATH A: ONLINE PAYMENT ===
    if (selectedMethod === 'online') {
        
        // 1. Confirm Payment with Stripe
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
           
            const VERIFY_URL = "https://verifyandcreateorder-276czbbs6q-uc.a.run.app"; // <--- UPDATE THIS URL AFTER DEPLOYING
            
            const response = await fetch(VERIFY_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    paymentIntentId: paymentIntent.id,
                    cartItems: cartItemsForServer,
                    customerDetails: {
                        name: `${firstName.value.trim()} ${lastName.value.trim()}`,
                        phone: '+1' + phone.value.replace(/\D/g, '')
                    },
                    scheduledTime: selectedPickupTimeInput.value
                }), 
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Order verification failed");
            }

            // Success!
            localStorage.removeItem('cart');
            const rawPhone = phone.value.trim();
            const rawTime = selectedPickupTimeInput.value || "ASAP";

            // 2. Encode them for the URL (Safety for special characters like spaces or :)
            const encodedPhone = encodeURIComponent(rawPhone);
            const encodedTime = encodeURIComponent(rawTime);

            // 3. Redirect
            window.location.href = `thank-you.html?order=${result.orderNumber}&phone=${encodedPhone}&time=${encodedTime}`;;
        }
    } 
                else {
        console.log("Selected In-Store Payment. Calling finalizeOrderInDatabase..."); // DEBUG LOG
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
let debounceTimer = null; // Variable to track the timer

window.addEventListener('cartUpdated', async () => {
        // 1. Clear any pending online calculations
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }

        const selectedOption = document.querySelector('input[name="paymentMethod"]:checked');
        const isOnline = selectedOption && selectedOption.value === 'online';

        // --- SCENARIO 1: NOT PAYING ONLINE? STOP HERE. ---
        if (!isOnline) {
            // Just ensure button is ready to go, then exit.
            placeOrderBttn.disabled = false;
            placeOrderBttn.textContent = "Place Order";
            onlinePaymentContainer.classList.add('hidden');
            return; // Don't run any other logic!
        }

        // --- SCENARIO 2: PAYING ONLINE (Only now do we do the work) ---
        cart.loadFromStorage();
        const hasItems = cart.getItems().length > 0;

        if (isStripeInitialized && hasItems) {
            // Only disable to prevent user clicking while price updates
            placeOrderBttn.disabled = true;
            placeOrderBttn.textContent = "Calculating..."; 
            
            debounceTimer = setTimeout(async () => {
                await updateStripeTotal(); 
            }, 1000); 
        }
        else if (!isStripeInitialized && hasItems) {
            togglePaymentSection();
        }
        else {
            // Online but cart is empty -> Reset
            if (paymentElement) {
                paymentElement.unmount();
                paymentElement = null;
            }
            isStripeInitialized = false;
            placeOrderBttn.disabled = false;
            placeOrderBttn.textContent = "Place Order";
        }
    });
const initialMethod = document.querySelector('input[name="paymentMethod"]:checked');
    
    // If "In Store" is default (or nothing is checked), FORCE ENABLE immediately
    if (!initialMethod || initialMethod.value !== 'online') {
        placeOrderBttn.disabled = false;
        placeOrderBttn.textContent = "Place Order";
    } else {
        // Only if "Online" is default do we trigger the loading logic
        togglePaymentSection();
    }

});