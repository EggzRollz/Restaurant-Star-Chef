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
                // First order ever? Start at 1000
                nextNum = 1000;
            } else {
                const data = sfDoc.data();
                const lastDate = data.lastResetDate;

                if (lastDate !== todayStr) {
                    // DATA MISMATCH: It is a new day! Reset to 1000
                    nextNum = 1000;
                } else {
                    // SAME DAY: Increment the number
                    nextNum = data.current + 1;
                }
            }

            // Update the counter with the new number AND today's date
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
            title: item.title || "Unknown Item", 
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
            // 1. Get Order Number (Resets to 1000 if it's a new day)
            const newOrderNumber = await getNextOrderNumber(db);

            // 2. Start Batch
            const batch = writeBatch(db);
            const newOrderRef = doc(collection(db, "orders"));
            const newHistoryRef = doc(db, "history", newOrderRef.id);

            // 3. Set Main Order Data
            const orderData = {
                orderId: newOrderRef.id, 
                orderNumber: newOrderNumber, 
                customerName: `${firstName.value.trim()} ${lastName.value.trim()}`,
                phoneNumber: phone.value.trim(),
                orderDate: serverTimestamp(), 
                status: 'new',
                totalItems: cartPayload.length 
            };
            
            batch.set(newOrderRef, orderData);
            
            // 4. Add Items to Subcollection
            cartPayload.forEach((item) => {
                const orderDatabaseRef = doc(collection(db, "orders", newOrderRef.id, "orderList"));
                
               
              
                batch.set(orderDatabaseRef, item); 
              
            });

            // 5. Commit
            await batch.commit();
            
            console.log("Order submitted successfully!", newOrderNumber);
            localStorage.removeItem('cart');
            window.location.href = `thank-you.html?order=${newOrderNumber}`;

        } catch (error) {
            console.error("Error placing order: ", error);
            alert("Error placing order. Please try again.");
            placeOrderBttn.disabled = false;
            placeOrderBttn.textContent = "Place Order";
        }
    });
}