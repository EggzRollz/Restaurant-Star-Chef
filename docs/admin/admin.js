import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, query, orderBy, onSnapshot, setDoc, serverTimestamp,limit, where  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

// --- 2. INITIALIZE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 


// SOUND VARIABLES - Only ONE audio object needed
let notificationAudio = new Audio("./sounds/yo_phone_linging.mp3");
let soundEnabled = localStorage.getItem('soundEnabled') === 'true'; // Load saved state


// 1. Capture the exact time this page was opened
const pageLoadTime = new Date(); 
// Global Variables
let menuItemsMap = {};
const logoutBtn = document.getElementById("logout-btn");


// --- 3. AUTH LISTENER (The Fix) ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // 1. User is confirmed logged in.
    console.log("Welcome Kitchen Staff:", user.email);
   console.log("TEST0.1111111")
    // 2. Load the menu data FIRST (wait for it)
    await loadMenuData();
    initializeSoundButton();

    initializeCacheButton();
    // 3. THEN start listening for orders
    listenForLiveOrders();
    
  } else {
    // No user logged in. Kick them out!
    console.log("No access. Redirecting to login...");
    window.location.href = "login.html";
  }
});

function initializeSoundButton() {
    const enableSoundBtn = document.getElementById('enable-sound-btn');
    
    if (!enableSoundBtn) {
        console.error('Enable sound button not found');
        return;
    }

    // Audio is already created at the top, just set volume
    notificationAudio.volume = 1.0;

    // Set initial button state based on saved preference
    updateSoundButtonUI(enableSoundBtn, soundEnabled);

    enableSoundBtn.addEventListener('click', () => {
        if (!soundEnabled) {
            // Try to play sound as a test
            notificationAudio.currentTime = 0;
            notificationAudio.play()
                .then(() => {
                    soundEnabled = true;
                    localStorage.setItem('soundEnabled', 'true'); // Save to localStorage
                    updateSoundButtonUI(enableSoundBtn, true);
                    console.log('✓ Sound notifications enabled');
                })
                .catch((error) => {
                    console.error('Failed to enable sound:', error);
                    alert('Could not enable sound. Please check browser permissions.');
                });
        } else {
            // Disable sound
            soundEnabled = false;
            localStorage.setItem('soundEnabled', 'false'); // Save to localStorage
            updateSoundButtonUI(enableSoundBtn, false);
            console.log('✗ Sound notifications disabled');
        }
    });
}

function updateSoundButtonUI(button, isEnabled) {
    const icon = button.querySelector('.sound-icon');
    const text = button.querySelector('.sound-text');
    
    if (isEnabled) {
        button.classList.add('enabled');
        icon.textContent = '🔊';
        text.textContent = 'Sounds Enabled';
    } else {
        button.classList.remove('enabled');
        icon.textContent = '🔇';
        text.textContent = 'Enable Sounds';
    }
}

function playNewOrderSound() {
    if (soundEnabled && notificationAudio) {
        notificationAudio.currentTime = 0;
        notificationAudio.play().catch((error) => {
            console.error('Failed to play notification sound:', error);
        });
    } else {
        console.log('Sound not enabled - user needs to click "Enable Sounds" button');
    }
}





























// Logout Button Logic
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => window.location.href = "login.html");
    });
}
async function invalidateMenuCache() {
    console.log("Button clicked! Starting cache invalidation...");
    
    if (!db) {
        console.error("Database not initialized!");
        alert("❌ Database not available");
        return;
    }
    
    const metadataRef = doc(db, "metadata", "menuInfo");
    
    try {
        console.log("Attempting to write to Firestore...");
        
        await setDoc(metadataRef, {
            lastUpdated: serverTimestamp()
        }, { merge: true });
        
        console.log("Write successful!");
        alert("✅ Menu cache updated! Users will fetch fresh data.");
        
    } catch (error) {
        console.error("Error updating metadata:", error);
        alert("❌ Failed to invalidate cache: " + error.message);
    }
}

// Add this NEW function right after
function initializeCacheButton() {
    const updateCacheBtn = document.getElementById('update-cache-btn');
    
    if (!updateCacheBtn) {
        console.error('Update cache button not found in DOM');
        return;
    }
    
    console.log('Cache update button found, attaching listener...');
    updateCacheBtn.addEventListener('click', invalidateMenuCache);
}
// --- 4. LOAD MENU DATA ---
async function loadMenuData() {
    console.log("Fetching menu data...");
    try {
        const querySnapshot = await getDocs(collection(db, "menuItems"));
        querySnapshot.forEach((doc) => {
            menuItemsMap[doc.id] = doc.data();
        });
        console.log("Menu data loaded.", menuItemsMap);
    } catch (error) {
        console.error("Error loading menu:", error);
    }
}


// --- 5. DELETE ORDER ---
// UPDATED: Now requires 'orderId' (the Firestore document ID) AND 'orderNumber' (for the alert)
async function deleteOrder(orderId, orderNumber) {
     if (!confirm(`Mark Order #${orderNumber} as Completed?`)) return;
        const cardToRemove = document.getElementById(`card-${orderId}`);
    if (cardToRemove) {
        cardToRemove.remove();
    }

    try {
        const orderRef = doc(db, "orders", orderId);
        
        // INSTEAD OF DELETING, WE UPDATE THE STATUS
        await updateDoc(orderRef, {
            status: 'resolved'
        });
        
        console.log(`Order #${orderNumber} marked as completed.`);
        // The onSnapshot listener in this file will automatically remove it 
        // because your query should filter out 'completed' items.
        
    } catch (error) {
        console.error("Error completing order:", error);
        alert("Error updating order. Check permissions.");
    }
}


function renderCustomizationsFromObject(item) { 
    const customizationContainer = document.createElement('div');
    customizationContainer.className = 'item-customizations';
    
    // Check if the customizations object exists and has keys
    if (!item.customizations || Object.keys(item.customizations).length === 0) {
        const span = document.createElement('span');
        span.textContent = 'No customizations'; 
        customizationContainer.appendChild(span);
        return customizationContainer;
    }
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



// --- MAIN LISTENER ---

// --- CARD CREATOR (Async) ---
async function createOrderCard(orderId, order, container) {
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';
    orderCard.setAttribute('data-status', order.status.toLowerCase());
    orderCard.id = `card-${orderId}`;

    // --- 1. HEADER & BUTTONS ---
    const headerContainer = document.createElement('div');
    headerContainer.className = 'order-header-container';

    const h2 = document.createElement('h2');
    h2.textContent = `Order #${order.orderNumber} `;
    const statusSpan = document.createElement('span');
    statusSpan.className = 'status';
    statusSpan.textContent = order.status;
    h2.appendChild(statusSpan);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'action-buttons';
    
    const doneBtn = document.createElement('button');
    doneBtn.textContent = '✔ Entered in POS (Clear)'; 
    doneBtn.className = 'btn-action btn-ready';
    doneBtn.onclick = () => deleteOrder(orderId, order.orderNumber); 

    buttonContainer.appendChild(doneBtn);
    headerContainer.appendChild(h2);
    headerContainer.appendChild(buttonContainer);

    // --- 2. CUSTOMER DETAILS ---
    const detailsDiv = document.createElement('div');

    // A. Handle Date/Time Strings
    let dateString = "Unknown Date";
    let timeString = "Unknown Time";
    
    if(order.orderDate && order.orderDate.seconds) {
        const jsDate = new Date(order.orderDate.seconds * 1000);
        dateString = jsDate.toLocaleDateString();
        timeString = jsDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }


    // 1. Extract the time safely
    let displayTime = "ASAP"; 
    if (order.pickupTime && order.pickupTime.trim() !== "") {
        displayTime = order.pickupTime;
    }

    // --- C. NEW: PAYMENT STATUS BADGE ---
    // We check paymentStatus because your security rules guarantee this is accurate.
    let paymentHtml = "";
    
    if (order.paymentStatus === 'paid') {
        // CLEAN GREEN LOOK
        paymentHtml = `
            <div class="payment-status-strip paid">
                <span>✔ PAID ONLINE</span>
            </div>
        `;
    } else {
        // URGENT RED LOOK (With Money Icon)
        paymentHtml = `
            <div class="payment-status-strip unpaid">
                <span>UNPAID - COLLECT CASH</span>
            </div>
        `;
    }

    // 2. Generate the HTML (Updated to remove the wrapping div style you had before)
    detailsDiv.innerHTML = `
        ${paymentHtml}
        <p><strong>Customer:</strong> ${order.customerName}</p>
        <p><strong>Phone:</strong> <a href="tel:${order.phoneNumber}">${order.phoneNumber}</a></p>
        <p><strong>Date:</strong> ${dateString}</p>
        <p><strong>Time Placed:</strong> ${timeString}</p>        
        <p style="font-size: 1.1em; color: #000;"><strong>Pickup Time:</strong> ${displayTime}</p>
        <hr>
        <h3>Items:</h3>
    `;

    // --- 3. ITEMS CONTAINER ---
    const itemsUl = document.createElement('ul');
    itemsUl.className = 'order-items-list';
    itemsUl.innerHTML = "<em>Loading items...</em>";

    // --- 4. TOTALS CONTAINER ---
    const totalsContainer = document.createElement('div');
    totalsContainer.className = 'totals-container';

    // Append everything to card
    orderCard.appendChild(headerContainer);
    orderCard.appendChild(detailsDiv);
    orderCard.appendChild(itemsUl);
    orderCard.appendChild(totalsContainer);
    
    container.appendChild(orderCard);

    // --- PROCESS ITEMS ---
    try {
        const itemsArray = order.items || []; 

        if (itemsArray.length === 0) {
            itemsUl.innerHTML = "<li>No items found in this order.</li>";
            return; 
        }
        
        itemsUl.innerHTML = ""; 
        
        let subtotal = 0;
        const HST_RATE = 0.13;

        itemsArray.forEach((item) => {
            const li = document.createElement('li');
            
            // 1. GET DATA FROM LOCAL MAP
            // We use this to get the English Name, Chinese Name, and Pricing Rules
            const menuItem = menuItemsMap[item.itemId];
            
            // 2. CALCULATE PRICE 
            // We are not "verifying" against the client anymore. 
            // We are simply calculating the cost based on the trusted rules in your DB.
            let unitPrice = 0;
            if (menuItem) {
                // We reuse your existing helper function just to do the math
                const calculated = calculateVerifiedItemPrice(menuItem, item);
                unitPrice = calculated !== null ? calculated : 0;
            } else {
                console.warn(`Item ID ${item.itemId} not found in menu cache.`);
            }

            const lineTotal = unitPrice * item.quantity;
            subtotal += lineTotal;

            // 3. RENDER CLEAN HTML (No Red/Green checks)
            li.innerHTML = `
                <div class="item-details">${item.quantity} x ${menuItem ? menuItem.name_english : 'Unknown Item'}</div>
                <div class="item-chinese-name">${menuItem ? menuItem.name_chinese : ''}</div>
                <div class="item-price">$${lineTotal.toFixed(2)}</div>
                <div class="item-id-code">ID: <strong>${item.itemId}</strong></div>
            `;
            
            li.appendChild(renderCustomizationsFromObject(item));
            itemsUl.appendChild(li);
        });

        const hst = subtotal * HST_RATE;
        const total = subtotal + hst;

        totalsContainer.innerHTML = `
            <p class="total-line subtotal"><span>Subtotal:</span> <span>$${subtotal.toFixed(2)}</span></p>
            <p class="total-line hst"><span>HST (13%):</span> <span>$${hst.toFixed(2)}</span></p>
            <p class="total-line total"><strong>Total:</strong> <strong>$${total.toFixed(2)}</strong></p>
        `;

    } catch (err) {
        console.error("Error rendering items for order", orderId, err);
        itemsUl.innerHTML = "<li style='color:red'>Error displaying items. Check console.</li>";
    }
}
function listenForLiveOrders() {
    const ordersContainer = document.getElementById('live-orders-container');
    
    // CHANGE: Only fetch orders that aren't resolved
    const q = query(
        collection(db, "orders"), 
        where("status", "!=", "resolved"), // Only active orders
        orderBy("status"), // Required when using != operator
        orderBy("orderDate", "desc"),
        limit(50)
    );

    onSnapshot(q, (snapshot) => {
        
        // --- SOUND LOGIC (Timestamp Check) ---
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const orderData = change.doc.data();

                let orderDateObj = new Date(0);
                if (orderData.orderDate && orderData.orderDate.seconds) {
                    orderDateObj = new Date(orderData.orderDate.seconds * 1000);
                }

                if (orderDateObj > pageLoadTime) {
                    console.log("New order detected!");
                    playNewOrderSound();
                }
            }
        });

        // --- RENDERING LOGIC ---
        ordersContainer.innerHTML = ""; 
        
        if (snapshot.empty) {
            ordersContainer.innerHTML = "<p>No active orders.</p>";
            return;
        }

        snapshot.forEach((docSnapshot) => {
            const orderData = docSnapshot.data();
            const orderId = docSnapshot.id; 
            // No need to filter anymore, query already does it
            createOrderCard(orderId, orderData, ordersContainer);
        });
    });
}