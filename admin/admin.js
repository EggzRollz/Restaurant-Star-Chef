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

// --- UPDATED createOrderCard FUNCTION with robust checks ---
// ... (imports and helper functions remain the same) ...

function createOrderCard(order) {
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';
    // Add data attribute for easier styling/targeting if needed
    orderCard.setAttribute('data-status', order.status.toLowerCase()); 

    // --- 1. Order Header Container (holds H2 and the button) ---
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
    
    deleteButton.addEventListener('click', () => {
        deleteOrder(order.orderNumber);
    });

    // Structure the header: H2 and Button together
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

    // --- 4. Items List Header ---
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
            li.textContent = `Error: Item ID "${baseId}" not found in menu data or is missing its name.`;
            itemsFragment.appendChild(li);
            return; 
        }

        const itemDetailsDiv = document.createElement('div');
        itemDetailsDiv.className = 'item-details';
        itemDetailsDiv.textContent = `${item.quantity} x ${menuItem.name_english}`; 

        const itemCodeP = document.createElement('p');
        itemCodeP.className = 'item-id-code';
        itemCodeP.innerHTML = `Item Code: <strong>${baseId}</strong>`; 

        const customizationsDiv = renderCustomizationsFromObject(item); 

        li.appendChild(itemDetailsDiv);
        li.appendChild(itemCodeP);
        li.appendChild(customizationsDiv); 

        itemsFragment.appendChild(li);
    });

    itemsUl.appendChild(itemsFragment); 

    // --- 5. Assemble the Card (The Fix is here!) ---
    orderCard.appendChild(headerContainer); // Append the complete header
    orderCard.appendChild(customerP);
    orderCard.appendChild(phoneP);
    orderCard.appendChild(timeP);
    orderCard.appendChild(itemsH3);
    orderCard.appendChild(itemsUl);

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