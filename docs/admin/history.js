import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    doc,      
    getDoc,
    limit, 
    onSnapshot,
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

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
        const [year, month, day] = dateString.split('-').map(Number);

        
        const start = new Date(year, month - 1, day);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(year, month - 1, day);
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
   currentUnsubscribe = onSnapshot(historyQuery, async (snapshot) => {
    container.innerHTML = ""; 
    
    if (snapshot.empty) {
        container.innerHTML = `
            <div style="text-align:center; padding: 20px; color: #666;">
                <h3>No orders found.</h3>
                <p>${mode === 'DATE' ? 'No resolved orders on this date.' : 'History is empty.'}</p>
            </div>`;
        return;
    }

    // FIX: Fetch each document individually to get ALL fields
    for (const docSnapshot of snapshot.docs) {
        const fullDoc = await getDoc(doc(db, "orders", docSnapshot.id));
        if (fullDoc.exists()) {
            createHistoryCard(fullDoc.id, fullDoc.data(), container);
        }
    }
}, (error) => {
    console.error("Firestore Error:", error);
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
async function testFetchOrder() {
    const testOrderId = "2025-11-20_17-36-48_1015"; // Use the actual order ID from your screenshot
    const docRef = doc(db, "orders", testOrderId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        console.log("Direct fetch - Full data:", docSnap.data());
        console.log("Direct fetch - Pickup time:", docSnap.data().pickupTime);
    }
}
testFetchOrder();
// --- CARD CREATOR ---
// --- CARD CREATOR (MODIFIED) ---
async function createHistoryCard(orderId, order, container) {
   
    const card = document.createElement('div');
    card.className = 'order-card history-card';
const headerDiv = document.createElement('div');
    headerDiv.className = 'order-header';
    
    let dateString = "Unknown Date";
    let timeString = "Unknown Time";
    if(order.orderDate && order.orderDate.seconds) {
        const jsDate = new Date(order.orderDate.seconds * 1000);
        dateString = jsDate.toLocaleDateString();
        timeString = jsDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // Extract pickup time ONCE for the entire order
    let displayTime = "ASAP";
    if (order.pickupTime && order.pickupTime.trim() !== "") {
        displayTime = order.pickupTime;
    }

    headerDiv.innerHTML = `
        <h3>Order #${order.orderNumber || orderId}</h3>
        <p><strong>Customer:</strong> ${order.customerName || 'N/A'}</p>
        <p><strong>Phone:</strong> ${order.phoneNumber || 'N/A'}</p>
        <p><strong>Date:</strong> ${dateString}</p>
        <p><strong>Time:</strong> ${timeString}</p>
        <p><strong>Pickup Time:</strong> ${displayTime}</p>
    `;

    card.appendChild(headerDiv);
    
    const itemsUl = document.createElement('ul');
    itemsUl.className = 'order-items-list';

    const totalsDiv = document.createElement('div');
    totalsDiv.className = 'totals-container';

    card.appendChild(itemsUl);
    card.appendChild(totalsDiv);
    container.appendChild(card);

    // --- MODIFIED LOGIC: FETCH FROM SUBCOLLECTION ---
    try {
        // NEW: Create a reference to the 'orderList' subcollection for this specific order
        const itemsRef = collection(db, "orders", orderId, "orderList");
        
        // NEW: Execute the query to get all item documents from the subcollection
        const itemsSnapshot = await getDocs(itemsRef);

        // NEW: Convert the snapshot into a plain array of item objects
        const itemsArray = itemsSnapshot.docs.map(doc => doc.data());
        
        console.log(`Order [${orderId}] - Fetched ${itemsArray.length} items from its subcollection.`);

        itemsUl.innerHTML = ""; 
        let subtotal = 0;
        
        if (itemsArray.length === 0) {
            itemsUl.innerHTML = "<li>No items found in this order's subcollection.</li>";
        }

        // The rest of your logic remains EXACTLY THE SAME, as it already works with an array.
        itemsArray.forEach((item) => {
            const menuItem = menuItemsMap[item.itemId]; 
            if (!menuItem) {
                console.warn(`Item ID "${item.itemId}" not found in menuItemsMap!`);
            }
            
            let verifiedPrice = item.price;
            if (menuItem) {
                verifiedPrice = calculateVerifiedItemPrice(menuItem, item) || item.price;
            }

            const lineTotal = verifiedPrice * item.quantity;
            subtotal += lineTotal;

            const li = document.createElement('li');
            
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'item-details';
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
        console.error(`Error rendering items for order ${orderId}:`, e);
        itemsUl.innerHTML = '<li class="error-text">Error displaying items.</li>';
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