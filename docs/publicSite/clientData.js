// --- 1. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    runTransaction, 
    writeBatch, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./config.js";
import { validateCheckoutForm } from './checkout.js';

// --- 2. INITIALIZE ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const placeOrderBttn = document.getElementById("place-order-button");
const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const phone = document.getElementById("phone");
const selectedPickupTimeInput = document.getElementById('selectedPickupTime');


// --- 3. HELPER: GET ORDER NUMBER (With Daily Reset) ---
async function getNextOrderNumber(db) {
    const counterRef = doc(db, "counters", "orderCounter");

    // Get today's date as a string YYYY-MM-DD (e.g., "2023-10-27")
    // This ensures we compare strictly by date, not time.
    const todayStr = new Date().toISOString().split('T')[0]; 

    try {
        return await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(counterRef);
            
            let nextNum;
            
            if (!sfDoc.exists()) {
                nextNum = 1000;
            } else {
                const data = sfDoc.data();
                const lastDate = data.lastResetDate;

                if (lastDate !== todayStr) {
                    nextNum = 1000;
                } else {
                    nextNum = data.current + 1;
                }
            }
            transaction.set(counterRef, { 
                current: nextNum,
                lastResetDate: todayStr
            });

            return nextNum;
        });
    } catch (e) {
        console.error("Counter transaction failed: ", e);
        throw e;
    }
}

// --- 4. EVENT LISTENER ---
if (placeOrderBttn) {
    placeOrderBttn.addEventListener("click", async (event) => {
        event.preventDefault(); 
        
        // Validation
        const validationResult = validateCheckoutForm();
        if (!validationResult.isValid) {
            if (validationResult.firstInvalidField) {
                validationResult.firstInvalidField.scrollIntoView({
                    behavior: 'smooth', block: 'center'
                });
            }
            return; 
        }
        
        // Payload Setup
        const cartPayload = JSON.parse(localStorage.getItem('cart')).map(item => ({
            itemId: item.baseId || item.id.split('_')[0], 
            title: item.name || "Unknown Item", 
            price: item.price || 0,
            status: 'pending',
            quantity: item.quantity,
            customizations: item.customizations || {} 
        }));

        if (cartPayload.length === 0) {
            alert("Your cart is empty.");
            return; 
        }
        
        placeOrderBttn.disabled = true;
        placeOrderBttn.textContent = "Placing Order...";

        try {
            // 1. Get Order Number
            const newOrderNumber = await getNextOrderNumber(db);

            const now = new Date();
            const formattedDate = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-'); 
            const customDocId = `${formattedDate}_${newOrderNumber}`;

            // 2. Start Batch and create reference WITH the custom ID
            const batch = writeBatch(db);
            const newOrderRef = doc(db, "orders", customDocId); 
            
            let selectedTime = selectedPickupTimeInput.value;
            if (!selectedTime || selectedTime === "") {
                console.warn("Hidden input was empty. Defaulting to ASAP.");
                selectedTime = "ASAP"; 
            }
          
            
            
            // 3. Set Main Order Data (with items embedded)
            const orderData = {
                orderId: newOrderRef.id,
                orderNumber: newOrderNumber, 
                customerName: `${firstName.value.trim()} ${lastName.value.trim()}`,
                phoneNumber: '+1' + phone.value.replace(/\D/g, ''),
                orderDate: serverTimestamp(), 
                pickupTime: selectedTime,
                status: 'new',
                totalItems: cartPayload.length, 
                items: cartPayload  // All items stored here
            };
            
            batch.set(newOrderRef, orderData);
            
            // REMOVED: No more subcollection writes!
            // This saves X writes per order (where X = number of items)

            // 4. Commit the batch write
            await batch.commit();
            
            console.log("Order submitted successfully!", newOrderNumber);
            
            try {
                // Replace this URL with the one you got from Google Cloud Function
                const SMS_FUNCTION_URL = "https://send-order-text-924721320321.northamerica-northeast2.run.app"; 

                // We use 'await' to ensure the request sends before the page changes.
                // It is fast (usually < 1 second).
                await fetch(SMS_FUNCTION_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        customerName: `${firstName.value.trim()} ${lastName.value.trim()}`,
                        phoneNumber: phone.value.trim(), // Make sure your input captures the full number!
                        orderNumber: newOrderNumber,
                        pickupTime: selectedTime
                    })
                });
                console.log("SMS Request sent!");
            } catch (smsError) {
                // If the text fails (e.g., server down), we simply log it.
                // We DO NOT stop the redirect, because the order is already in the database.
                console.warn("Failed to send SMS, but order was saved:", smsError);
            }
            localStorage.removeItem('cart');
            
            // 5. Encode and Redirect
            const encodedPhoneNumber = encodeURIComponent(phone.value.trim()); 

            const encodedTime = encodeURIComponent(selectedTime);
            window.location.href = `thank-you.html?order=${newOrderNumber}&time=${encodedTime}&phone=${encodedPhoneNumber}`;

        } catch (error) {
            console.error("Error placing order: ", error);
            
            alert("An error occurred while placing your order. Please wait a moment and try again.");
            
            placeOrderBttn.textContent = "Error - Try Again";

            setTimeout(() => {
                placeOrderBttn.disabled = false;
                placeOrderBttn.textContent = "Place Order";
            }, 5000);
        }
    });
}