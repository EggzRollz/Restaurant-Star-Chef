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
            // Formats the date to "YYYY-MM-DD_HH-MM-SS"
            const formattedDate = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-'); 
        
            const customDocId = `${formattedDate}_${newOrderNumber}`; // Example: "2025-11-20_08-10-15_1001"

            // 3. Start Batch and create reference WITH the custom ID
            const batch = writeBatch(db);
            // Pass your custom ID as the second argument to doc()
            const newOrderRef = doc(db, "orders", customDocId); 
            
            const selectedTime = selectedPickupTimeInput.value;

            // 4. Set Main Order Data
            const orderData = {
                orderId: newOrderRef.id, // This will now be your custom ID
                orderNumber: newOrderNumber, 
                customerName: `${firstName.value.trim()} ${lastName.value.trim()}`,
                phoneNumber: phone.value.trim(),
                orderDate: serverTimestamp(), 
                pickupTime: selectedTime,
                status: 'new',
                totalItems: cartPayload.length, 
                items: cartPayload
            };
            
            batch.set(newOrderRef, orderData);
            
            // 4. Add Items to Subcollection
            cartPayload.forEach((item) => {
                const itemRef = doc(collection(db, "orders", newOrderRef.id, "orderList"));
                batch.set(itemRef, item); 
            });

            // 5. Commit the batch write
            await batch.commit();
            
            console.log("Order submitted successfully!", newOrderNumber);
            localStorage.removeItem('cart');
            if (!selectedTime || selectedTime === "") {
                console.warn("Hidden input was empty. Defaulting to ASAP.");
                selectedTime = "ASAP"; 
            }

            // 3. Encode and Redirect
            const encodedTime = encodeURIComponent(selectedTime);
            window.location.href = `thank-you.html?order=${newOrderNumber}&time=${encodedTime}`;


        } catch (error) {
            console.error("Error placing order: ", error);
            
            // --- MODIFIED CATCH BLOCK ---
            alert("An error occurred while placing your order. Please wait a moment and try again.");
            
            placeOrderBttn.textContent = "Error - Try Again";

            // Cooldown to prevent runaway loops
            setTimeout(() => {
                placeOrderBttn.disabled = false;
                placeOrderBttn.textContent = "Place Order";
            }, 5000); // 5 second cooldown
        }
    });
}