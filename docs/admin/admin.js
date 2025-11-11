import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "../main.js";

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

function findPriceForOrderItem(menuItem, orderItem) {
    // --- Diagnostic Logging ---
    console.group(`[Pricing Check] for Item ID: ${orderItem.itemId}`);
    console.log("Order Item Data:", orderItem);
    console.log("Database Menu Item Data:", menuItem);

    if (!menuItem.pricing || menuItem.pricing.length === 0) {
        console.warn("Decision: No pricing array found. Returning null.");
        console.groupEnd();
        return null;
    }

    if (menuItem.pricing.length === 1) {
        console.log("Decision: Simple item with one price. Returning default.");
        console.groupEnd();
        return menuItem.pricing[0].price;
    }

    const allCustomerChoices = orderItem.customizations || {};
    console.log("All Customer Choices:", allCustomerChoices);

    // --- KEY CHANGE: Filter for ONLY price-affecting choices ---
    const priceAffectingChoices = {};
    for (const key in allCustomerChoices) {
        if (CUSTOMIZATION_TO_DB_KEY_MAP.hasOwnProperty(key)) {
            priceAffectingChoices[key] = allCustomerChoices[key];
        }
    }
    console.log("Filtered Price-Affecting Choices:", priceAffectingChoices);
    // --- END OF KEY CHANGE ---
    
    // If there are no price-affecting choices, we can just take the default price.
    if (Object.keys(priceAffectingChoices).length === 0) {
        console.log("Decision: No price-affecting customizations found. Returning default price.");
        console.groupEnd();
        return menuItem.pricing[0].price;
    }

    const priceInfo = menuItem.pricing.find(priceOption => {
        // Now, we only need to match against the filtered choices.
        return Object.keys(priceAffectingChoices).every(customizationKey => {
            const dbKey = CUSTOMIZATION_TO_DB_KEY_MAP[customizationKey];
            return priceOption[dbKey] === priceAffectingChoices[customizationKey];
        });
    });

    if (priceInfo) {
        console.log("SUCCESS: Found a perfect match in pricing array:", priceInfo);
        console.log(`Decision: Using matched price: ${priceInfo.price}`);
        console.groupEnd();
        return priceInfo.price;
    } else {
        console.warn("FAILURE: Could not find a price option that matched the price-affecting choices.");
        console.log("Decision: Using fallback price:", menuItem.pricing[0].price);
        console.groupEnd();
        return menuItem.pricing[0].price;
    }
}
// --- UPDATED createOrderCard FUNCTION with robust checks ---
// ... (imports and helper functions remain the same) ...

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
        
        const singleItemPrice = findPriceForOrderItem(menuItem, item);

        if (singleItemPrice !== null) {
            const lineItemTotal = item.quantity * singleItemPrice;
            subtotal += lineItemTotal; // <-- KEY CHANGE: Add to running subtotal
            itemPriceDiv.textContent = `$${lineItemTotal.toFixed(2)}`;
        } else {
            itemPriceDiv.textContent = 'Price N/A';
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