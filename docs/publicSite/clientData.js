import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./main.js";
import { validateCheckoutForm } from './checkout.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Select DOM elements needed for submission
const placeOrderBttn = document.getElementById("place-order-button");
const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const phone = document.getElementById("phone");

async function getOrderNumber(db) {
    const counterRef = ref(db, "ordercount");
    const result = await runTransaction(counterRef, (currentCount) => {
        return (currentCount === null) ? 1000 : currentCount + 1;
    });
    return result.snapshot.val();
}

/**
 * Writes the final order data to the Firebase Realtime Database.
 */
function writeOrderData(orderDetails) {
    return set(ref(db, 'orders/' + orderDetails.orderNumber), orderDetails);
}


if (placeOrderBttn) {
    placeOrderBttn.addEventListener("click", async (event) => {
        event.preventDefault(); 
        
        // --- MODIFIED: Capture the result object from the validation function ---
        const validationResult = validateCheckoutForm();

        // --- MODIFIED: Check the 'isValid' property and scroll if invalid ---
        if (!validationResult.isValid) {
            // Use the returned element to scroll it into view
            if (validationResult.firstInvalidField) {
                validationResult.firstInvalidField.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center' // This centers the field in the viewport
                });
            }
            return; // Stop the function execution
        }

        // --- The rest of your code remains the same ---
        const cartPayload = JSON.parse(localStorage.getItem('cart')).map(item => ({
            itemId: item.baseId || item.id.split('_')[0], 
    
            quantity: item.quantity,
            customizations: item.customizations || {} // Also add a fallback for customizations
        }));

        if (cartPayload.length === 0) {
            alert("Your cart is empty. Please add items before placing an order.");
            return; 
        }
        
        placeOrderBttn.disabled = true;
        placeOrderBttn.textContent = "Placing Order...";

        try {
            const newOrderNumber = await getOrderNumber(db);
            const orderDetails = {
                orderNumber: newOrderNumber,
                customerName: `${firstName.value.trim()} ${lastName.value.trim()}`,
                phoneNumber: phone.value.trim(),
                orderDate: new Date().toISOString(),
                status: 'new',
                items: cartPayload
            };

            await writeOrderData(orderDetails);
            
            console.log("Order submitted successfully!", orderDetails);
            localStorage.removeItem('cart');
            window.location.href = `thank-you.html?order=${newOrderNumber}`;

        } catch (error) {
            console.error("Error placing order: ", error);
            alert("There was an error placing your order. Please try again.");
            
            placeOrderBttn.disabled = false;
            placeOrderBttn.textContent = "Place Order";
        }
    });
}