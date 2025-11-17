import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "../publicSite/main.js";

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const db = getDatabase(app); 
const firestore = getFirestore(app); 

let menuItemsMap = {};


/**
 * Fetches all menu items from Firestore and stores them in the menuItemsMap.
 */
async function loadMenuData() {
    console.log("Fetching menu data...");
    const querySnapshot = await getDocs(collection(firestore, "menuItems"));
    querySnapshot.forEach((doc) => {
        menuItemsMap[doc.id] = doc.data();
    });
    console.log("Menu data loaded. Ready to process orders.");
}
async function deleteOrder(orderNumber) {
    if (!confirm(`Are you sure you want to remove Order #${orderNumber} from the queue?`)) {
        return; // User cancelled the operation
    }
    
    try {
        const orderRef = ref(db, 'orders/' + orderNumber);
        await remove(orderRef);
        console.log(`Order #${orderNumber} successfully removed.`);
        // Since we are using onValue, the UI will automatically refresh after removal!
    } catch (error) {
        console.error("Error removing order:", error);
        alert(`Failed to remove Order #${orderNumber}. Check console for details.`);
    }
}
/**
 * Helper function to parse customizations from itemId (e.g., E1_PR-C -> "Protein: C")
 * NOTE: This helper uses .createElement and .textContent internally for safety!
 */

const renderCustomizationsFromObject = (item) => {
    const customizationContainer = document.createElement('div');
    customizationContainer.className = 'item-customizations';
    
    // Check if the customizations object exists and has keys
    if (!item.customizations || Object.keys(item.customizations).length === 0) {
        const span = document.createElement('span');
        span.textContent = 'No customizations'; 
        customizationContainer.appendChild(span);
        return customizationContainer;
    }

    // Loop through the customization key/value pairs (e.g., {Protein: 'C', Size: 'L'})
    Object.entries(item.customizations).forEach(([key, value]) => {
        const customP = document.createElement('p');
        
        // Build the text node safely: Key: Value
        const keyStrong = document.createElement('strong');
        keyStrong.textContent = `${key}:`; 
        
        customP.appendChild(keyStrong);
        customP.append(` ${value}`); 

        customizationContainer.appendChild(customP);
    });

    return customizationContainer;
};

const CUSTOMIZATION_TO_DB_KEY_MAP = {
  Size: 'size',
  Temperature: 'temp'
};

function calculateVerifiedItemPrice(menuItem, orderItem) {
    console.group(`[Price Verification] for: ${menuItem.name_english}`);
    console.log("Database Item:", menuItem);
    console.log("Customer Order Item:", orderItem);

    if (!menuItem || !menuItem.pricing || menuItem.pricing.length === 0) {
        console.error("Pricing error: Menu item has no pricing information in the database.");
        console.groupEnd();
        return null;
    }

    // --- 1. DETERMINE THE BASE PRICE ---
    // This section mirrors the client-side logic for setting the initial price
    // based on whether the item has one price or multiple (e.g., by Size).
    let basePrice = 0;
    const customerChoices = orderItem.customizations || {};

    if (menuItem.pricing.length === 1) {
        // Simple item with only one default price.
        basePrice = menuItem.pricing[0].price;
        console.log(`Base Price (Simple): $${basePrice}`);
    } else {
        // Item with multiple pricing options (e.g., Size, Temperature).
        // We find which option the customer selected.
        const pricingKey = menuItem.pricing[0].size ? 'size' : 'temp'; // 'size' or 'temp'
        const pricingTitle = menuItem.pricing[0].size ? 'Size' : 'Temperature'; // 'Size' or 'Temperature'

        const customerChoiceValue = customerChoices[pricingTitle]; // e.g., The customer chose "Small"
        
        // Find the matching price object in the database's pricing array.
        const matchedPriceOption = menuItem.pricing.find(p => p[pricingKey] === customerChoiceValue);

        if (matchedPriceOption) {
            basePrice = matchedPriceOption.price;
            console.log(`Base Price (Matched Choice '${customerChoiceValue}'): $${basePrice}`);
        } else {
            // Fallback if the customer's choice isn't found in the DB. This indicates a potential issue.
            basePrice = menuItem.pricing[0].price;
            console.warn(`Could not find a matching price option for choice '${customerChoiceValue}'. Defaulting to first price: $${basePrice}`);
        }
    }

    // --- 2. CALCULATE ADD-ON PRICE ---
    // This section mirrors the complex add-on calculation, including the two distinct models.
    let addOnPrice = 0;
    if (menuItem.addOns && menuItem.addOns.length > 0) {
        console.log("Calculating Add-On prices...");
        
        menuItem.addOns.forEach(addOnGroup => {
            const groupTitle = addOnGroup.title; // e.g., "Choose Your Toppings"
            const customerSelectionsForGroup = customerChoices[groupTitle]; // e.g., ["Mushroom", "Pepperoni", "Onion"]

            if (!customerSelectionsForGroup) {
                return; // Customer made no selections in this group, so skip.
            }

            // --- MODEL A: "Free Limit" / Combo Logic ---
            // This is triggered if the database group has 'freeToppingLimit' and 'postLimitPrice' defined.
            if (addOnGroup.freeToppingLimit !== undefined && addOnGroup.postLimitPrice !== undefined) {
                const selectionsCount = Array.isArray(customerSelectionsForGroup) ? customerSelectionsForGroup.length : 1;
                const freeLimit = addOnGroup.freeToppingLimit;
                const pricePerExtra = addOnGroup.postLimitPrice;

                // This calculation is identical to the client-side code.
                const extraItems = Math.max(0, selectionsCount - freeLimit);
                const groupPrice = extraItems * pricePerExtra;
                
                console.log(` -> Group '${groupTitle}' (Combo Style): ${selectionsCount} items selected, ${freeLimit} are free. Extra cost for ${extraItems} items: $${groupPrice.toFixed(2)}`);
                addOnPrice += groupPrice;

            // --- MODEL B: "Standard" Add-On Logic ---
            // This runs for all other add-on groups.
            } else {
                // Normalize to an array to handle both single (radio) and multiple (checkbox) selections easily.
                const selectionsArray = Array.isArray(customerSelectionsForGroup) ? customerSelectionsForGroup : [customerSelectionsForGroup];
                let groupPrice = 0;

                selectionsArray.forEach(selectionName => {
                    // Find the chosen add-on in the database to get its REAL price.
                    const dbChoice = addOnGroup.choices.find(choice => (typeof choice === 'object' ? choice.addOnName : choice) === selectionName);
                    
                    // Only add a price if it's an object with a price > 0.
                    if (dbChoice && typeof dbChoice === 'object' && dbChoice.price > 0) {
                        groupPrice += dbChoice.price;
                    }
                });
                 console.log(` -> Group '${groupTitle}' (Standard Style): Total price for selections is $${groupPrice.toFixed(2)}`);
                 addOnPrice += groupPrice;
            }
        });
    }

    const finalPrice = basePrice + addOnPrice;
    console.log(`Final Verified Price: $${basePrice.toFixed(2)} (base) + $${addOnPrice.toFixed(2)} (add-ons) = $${finalPrice.toFixed(2)}`);
    console.groupEnd();
    
    return finalPrice;
}

function createOrderCard(order) {
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';
    orderCard.setAttribute('data-status', order.status.toLowerCase());

    // --- CONFIGURATION ---
    const HST_RATE = 0.13; // 13% HST. Change this value if your tax rate is different.

    // --- INITIALIZE TOTALS ---
    let subtotal = 0;

    // --- 1. Order Header Container ---
    const headerContainer = document.createElement('div');
    headerContainer.className = 'order-header-container';

    const h2 = document.createElement('h2');
    h2.textContent = `Order #${order.orderNumber} `;
    
    const statusSpan = document.createElement('span');
    statusSpan.className = 'status';
    statusSpan.textContent = order.status;
    h2.appendChild(statusSpan);

    // --- 2. The Close/Delete Button ---
    const deleteButton = document.createElement('button');
    deleteButton.textContent = '✖'; 
    deleteButton.className = 'delete-order-btn';
    deleteButton.title = `Mark Order #${order.orderNumber} as complete and remove.`;
    deleteButton.addEventListener('click', () => deleteOrder(order.orderNumber));

    headerContainer.appendChild(h2);
    headerContainer.appendChild(deleteButton);

    // --- 3. Details (Customer, Phone, Time) ---
    const customerP = document.createElement('p');
    customerP.innerHTML = `<strong>Customer:</strong> ${order.customerName}`; 
    const phoneP = document.createElement('p');
    phoneP.innerHTML = `<strong>Phone:</strong> ${order.phoneNumber}`;
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true }; 
    const formattedTime = new Date(order.orderDate).toLocaleTimeString(undefined, timeOptions);
    const timeP = document.createElement('p');
    timeP.innerHTML = `<strong>Time:</strong> ${formattedTime}`;

    // --- 4. Items List ---
    const itemsH3 = document.createElement('h3');
    itemsH3.textContent = 'Items:';
    const itemsUl = document.createElement('ul');
    itemsUl.className = 'order-items-list'; 

    const itemsFragment = document.createDocumentFragment();

    order.items.forEach(item => {
        const baseId = item.itemId.split('_')[0]; 
        const menuItem = menuItemsMap[baseId]; 

        const li = document.createElement('li');
        
        if (!menuItem || !menuItem.name_english) { 
            li.textContent = `Error: Item ID "${baseId}" not found.`;
            itemsFragment.appendChild(li);
            return; 
        }

        const itemDetailsDiv = document.createElement('div');
        itemDetailsDiv.className = 'item-details';
        itemDetailsDiv.textContent = `${item.quantity} x ${menuItem.name_english}`;
        
        const itemPriceDiv = document.createElement('div');
    itemPriceDiv.className = 'item-price';
    
    // Use the new, secure price calculation function.
    const singleItemPrice = calculateVerifiedItemPrice(menuItem, item);

    if (singleItemPrice !== null) {
        const lineItemTotal = item.quantity * singleItemPrice;
        subtotal += lineItemTotal; // Add to the running subtotal for the order
        itemPriceDiv.textContent = `$${lineItemTotal.toFixed(2)}`;
    } else {
        itemPriceDiv.textContent = 'Price Error'; // Make it clear if calculation failed
    }

        const itemCodeP = document.createElement('p');
        itemCodeP.className = 'item-id-code';
        itemCodeP.innerHTML = `Item Code: <strong>${baseId}</strong>`; 

        const customizationsDiv = renderCustomizationsFromObject(item); 

        li.appendChild(itemDetailsDiv);
        li.appendChild(itemPriceDiv);
        li.appendChild(itemCodeP);
        li.appendChild(customizationsDiv); 

        itemsFragment.appendChild(li);
    });

    itemsUl.appendChild(itemsFragment); 

    // --- 5. NEW: Create Totals Section ---
    const hst = subtotal * HST_RATE;
    const total = subtotal + hst;

    const totalsContainer = document.createElement('div');
    totalsContainer.className = 'totals-container';

    const subtotalP = document.createElement('p');
    subtotalP.className = 'total-line subtotal';
    // Using spans for easy flexbox alignment
    subtotalP.innerHTML = `<span>Subtotal:</span> <span>$${subtotal.toFixed(2)}</span>`;

    const hstP = document.createElement('p');
    hstP.className = 'total-line hst';
    hstP.innerHTML = `<span>HST (${(HST_RATE * 100).toFixed(0)}%):</span> <span>$${hst.toFixed(2)}</span>`;

    const totalP = document.createElement('p');
    totalP.className = 'total-line total';
    totalP.innerHTML = `<strong>Total:</strong> <strong>$${total.toFixed(2)}</strong>`;
    
    totalsContainer.appendChild(subtotalP);
    totalsContainer.appendChild(hstP);
    totalsContainer.appendChild(totalP);

    // --- 6. Assemble the Card ---
    orderCard.appendChild(headerContainer);
    orderCard.appendChild(customerP);
    orderCard.appendChild(phoneP);
    orderCard.appendChild(timeP);
    orderCard.appendChild(itemsH3);
    orderCard.appendChild(itemsUl);
    orderCard.appendChild(totalsContainer); // <-- Add the new totals section

    return orderCard;
}

// ... (rest of admin.js code remains the same) ...

function renderOrders(ordersObject) {
    const container = document.getElementById('live-orders-container');
    if (!container) return;

    // Clear the container using a safe method
    container.textContent = ''; 

    if (!ordersObject) {
        const noOrders = document.createElement('p');
        noOrders.textContent = 'No orders found.';
        container.appendChild(noOrders);
        return;
    }

    const ordersArray = Object.values(ordersObject);
    
    // Use a DocumentFragment to minimize DOM manipulations
    const fragment = document.createDocumentFragment();

    // Render each order
    ordersArray.forEach(order => {
        const orderCard = createOrderCard(order); // Call the helper to build the card
        fragment.appendChild(orderCard);
    });
    
    // Append all cards to the container in a single, efficient step
    container.appendChild(fragment);
}

/**
 * Sets up the real-time listener for the 'orders' path in the database.
 */
function listenForLiveOrders() {
    const ordersRef = ref(db, 'orders/');
    onValue(ordersRef, (snapshot) => {
        const ordersData = snapshot.val();
        console.log("Received new order data:", ordersData);
        renderOrders(ordersData);
    });
}

// --- Main Application Flow ---
async function initializeAdmin() {
    await loadMenuData(); // First, load the menu so we can display item names
    listenForLiveOrders(); // Then, start listening for orders
}

// Start the application
initializeAdmin();