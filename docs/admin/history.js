import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit, 
    onSnapshot,
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "../publicSite/config.js";

// --- INITIALIZE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global Variables
let menuItemsMap = {};
let currentUnsubscribe = null; 

// --- AUTH & STARTUP ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("History Access Granted:", user.email);

    // FIX 1: Force clear the Date Input to prevent browser caching issues
    const datePicker = document.getElementById("history-date-picker");
    if (datePicker) datePicker.value = "";

    loadMenuData().then(() => {
        setupCalendarControls();
        fetchHistoryQuery("RECENT"); // Always start with Recent
    });
  } else {
    window.location.href = "login.html";
  }
});

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => window.location.href = "login.html");
    });
}

// --- LOAD MENU DATA ---
async function loadMenuData() {
    try {
        const querySnapshot = await getDocs(collection(db, "menuItems"));
        querySnapshot.forEach((doc) => {
            menuItemsMap[doc.id] = doc.data();
        });
    } catch (error) {
        console.error("Error loading menu:", error);
    }
}

// --- CALENDAR CONTROLS LOGIC ---
function setupCalendarControls() {
    const datePicker = document.getElementById("history-date-picker");
    const resetBtn = document.getElementById("reset-history-btn");
    
    if (!datePicker || !resetBtn) return;

    // 1. On Date Change
    datePicker.addEventListener("change", (e) => {
        const selectedDate = e.target.value;
        if (selectedDate) {
            fetchHistoryQuery("DATE", selectedDate);
        }
    });

    // 2. On Reset Click
    resetBtn.addEventListener("click", () => {
        datePicker.value = ""; // Clear visual input
        fetchHistoryQuery("RECENT");
    });
}

// --- MAIN QUERY HANDLER ---
function fetchHistoryQuery(mode, dateString = null) {
    const container = document.getElementById('history-orders-container');
    const filterLabel = document.getElementById('active-filter-label');

    // Stop previous listener
    if (currentUnsubscribe) {
        currentUnsubscribe();
        currentUnsubscribe = null;
    }

    container.innerHTML = "<p>Loading orders...</p>";

    let historyQuery;
    const ordersRef = collection(db, "orders");

    if (mode === "DATE" && dateString) {
        // Fix timezone: Create date at local midnight
        const start = new Date(dateString);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(dateString);
        end.setHours(23, 59, 59, 999);

        const startTimestamp = Timestamp.fromDate(start);
        const endTimestamp = Timestamp.fromDate(end);

        if (filterLabel) filterLabel.textContent = `Viewing: ${dateString}`;

        historyQuery = query(
            ordersRef, 
            where("status", "==", "resolved"), 
            where("orderDate", ">=", startTimestamp),
            where("orderDate", "<=", endTimestamp),
            orderBy("orderDate", "desc")
        );
    } else {
        // Default: Last 50
        if (filterLabel) filterLabel.textContent = "Viewing: Latest Orders";
        historyQuery = query(
            ordersRef, 
            where("status", "==", "resolved"), 
            orderBy("orderDate", "desc"), 
            limit(50)
        );
    }

    // Start Listener
    currentUnsubscribe = onSnapshot(historyQuery, (snapshot) => {
        container.innerHTML = ""; 
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div style="text-align:center; padding: 20px; color: #666;">
                    <h3>No orders found.</h3>
                    <p>${mode === 'DATE' ? 'No resolved orders on this date.' : 'History is empty.'}</p>
                </div>`;
            return;
        }

        snapshot.forEach((docSnapshot) => {
            createHistoryCard(docSnapshot.id, docSnapshot.data(), container);
        });
    }, (error) => {
        console.error("Firestore Error:", error);
        // Check for Index Error
        if (error.code === 'failed-precondition' || error.message.includes("index")) {
            container.innerHTML = `
                <div style="padding:15px; border: 1px solid red; background: #fff0f0; color: red;">
                    <strong>System Requirement:</strong> This search requires a Firestore Index.<br>
                    Open your browser console (F12) and click the link provided by Firebase to create it automatically.
                </div>`;
        } else {
            container.innerHTML = `<p class="error-text">Error: ${error.message}</p>`;
        }
    });
}

// --- CARD CREATOR ---
async function createHistoryCard(orderId, order, container) {
    const card = document.createElement('div');
    card.className = 'order-card history-card'; 

    // Header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'order-header-container';
    const h2 = document.createElement('h2');
    let dateStr = "Unknown Date";
    if(order.orderDate && order.orderDate.seconds) {
        dateStr = new Date(order.orderDate.seconds * 1000).toLocaleString();
    }
    h2.innerHTML = `Order #${order.orderNumber || 'N/A'} <span class="order-date">(${dateStr})</span>`;
    headerDiv.appendChild(h2);

    // Details
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'customer-details';
    detailsDiv.innerHTML = `<p><strong>${order.customerName || 'Guest'}</strong> | <a href="tel:${order.phoneNumber}">${order.phoneNumber || ''}</a></p>`;

    // Items List
    const itemsUl = document.createElement('ul');
    itemsUl.className = 'order-items-list';
    itemsUl.textContent = "Loading items..."; 

    // Totals
    const totalsDiv = document.createElement('div');
    totalsDiv.className = 'totals-container';

    card.appendChild(headerDiv);
    card.appendChild(detailsDiv);
    card.appendChild(itemsUl);
    card.appendChild(totalsDiv);
    
    container.appendChild(card);

    // Fetch Sub-collection items
    try {
        const itemsRef = collection(db, "orders", orderId, "orderList");
        const itemsSnapshot = await getDocs(itemsRef);
        
        itemsUl.innerHTML = ""; 
        let subtotal = 0;
        
        if (itemsSnapshot.empty) {
            itemsUl.innerHTML = "<li>No items found in this order.</li>";
        }

        itemsSnapshot.forEach((doc) => {
            const item = doc.data();
            const menuItem = menuItemsMap[item.itemId]; 
            
            // FIX 2: Safe Price Calculation (If menu item deleted, use saved price)
            let verifiedPrice = item.price;
            if (menuItem) {
                verifiedPrice = calculateVerifiedItemPrice(menuItem, item) || item.price;
            }

            const lineTotal = verifiedPrice * item.quantity;
            subtotal += lineTotal;

            const li = document.createElement('li');
            
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'item-details';
            // FIX 3: Safe Name Display (If menu item deleted, use saved title)
            const itemName = menuItem ? menuItem.name_english : (item.title || "Unknown Item");
            detailsDiv.textContent = `${item.quantity} x ${itemName}`;
            
            const idDiv = document.createElement('div');
            idDiv.className = 'item-id';
            idDiv.textContent = `ID: ${item.itemId}`;
            detailsDiv.appendChild(idDiv);

            const priceDiv = document.createElement('div');
            priceDiv.className = 'item-price';
            priceDiv.textContent = `$${lineTotal.toFixed(2)}`;

            li.appendChild(detailsDiv);
            li.appendChild(priceDiv);
            li.appendChild(renderCustomizationsFromObject(item));
            
            itemsUl.appendChild(li);
        });

        const tax = subtotal * 0.13;
        totalsDiv.innerHTML = `
            <p class="totals-line">
                Sub: $${subtotal.toFixed(2)} | Tax: $${tax.toFixed(2)} | <strong>Total: $${(subtotal + tax).toFixed(2)}</strong>
            </p>
        `;

    } catch (e) {
        console.error("Error fetching items:", e);
        itemsUl.innerHTML = '<li class="error-text">Error loading items.</li>';
    }
}

// --- HELPERS (Price Calculation) ---
function calculateVerifiedItemPrice(menuItem, orderItem) {
    if (!menuItem || !menuItem.pricing) return null;

    let basePrice = 0;
    const customerChoices = orderItem.customizations || {};

    if (menuItem.pricing.length === 1) {
        basePrice = menuItem.pricing[0].price;
    } else {
        const pricingKey = menuItem.pricing[0].size ? 'size' : 'temp';
        const customerChoiceValue = customerChoices[menuItem.pricing[0].size ? 'Size' : 'Temperature'];
        const matched = menuItem.pricing.find(p => p[pricingKey] === customerChoiceValue);
        basePrice = matched ? matched.price : menuItem.pricing[0].price;
    }

    let addOnPrice = 0;
    if (menuItem.addOns) {
        menuItem.addOns.forEach(group => {
            const selections = customerChoices[group.title];
            if (!selections) return;

            if (group.freeToppingLimit !== undefined) {
                const count = Array.isArray(selections) ? selections.length : 1;
                const extra = Math.max(0, count - group.freeToppingLimit);
                addOnPrice += (extra * group.postLimitPrice);
            } else {
                const arr = Array.isArray(selections) ? selections : [selections];
                arr.forEach(name => {
                    const choice = group.choices.find(c => (c.addOnName || c) === name);
                    if (choice && choice.price) addOnPrice += choice.price;
                });
            }
        });
    }
    return basePrice + addOnPrice;
}

const renderCustomizationsFromObject = (item) => {
    const container = document.createElement('div');
    container.className = 'item-customizations';
    if (!item.customizations) return container;
    
    Object.entries(item.customizations).forEach(([key, value]) => {
        container.innerHTML += `<p><strong>${key}:</strong> ${value}</p>`;
    });
    return container;
};