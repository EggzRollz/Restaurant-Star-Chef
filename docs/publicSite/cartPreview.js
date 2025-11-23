import { Cart } from './cart.js';  
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

// Helper function to update the red number badge on the cart icon
export function updateCartQuantityDisplay(cart) {
    const cartQuantityDisplay = document.getElementById('cartQuantityDisplay');
    if(cartQuantityDisplay) {
        cartQuantityDisplay.textContent = cart.cartLength(); 
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // 1. INITIALIZE CART
    const cart = new Cart();
    const savedItems = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Load initial state
    if (cart.loadFromStorage) {
        cart.loadFromStorage(savedItems);
    }
    
    // Update badge immediately
    updateCartQuantityDisplay(cart);

    function handleSync() {
        console.log("Sidebar detected update!");
        // 1. Re-read the database (LocalStorage)
        const freshItems = JSON.parse(localStorage.getItem('cart')) || [];
        cart.loadFromStorage(freshItems);
        
        // 2. Re-draw the Sidebar and Badge
        renderSidebarCart();
        updateCartQuantityDisplay(cart);
    }

    // Listen for the custom signal from the Menu/Checkout
    window.addEventListener('cartUpdated', handleSync);
    
    // Listen for changes from other tabs
    window.addEventListener('storage', handleSync);
    // =======================================================


    // 2. SELECT ELEMENTS
    const overlay = document.querySelector('.overlay');
    const cartButton = document.querySelector('.cart-button');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const menuToggle = document.querySelector('.menu-toggle');
    const cartPreview = document.querySelector('.cart-preview');
    const navLinks = document.querySelector('.nav-links');
    
    
    // Sidebar Elements
    const sidebarContainer = document.getElementById('cart-items-container');
    const sidebarTotalEl = document.getElementById('sidebar-cart-total');
    const sidebarEmptyMsg = document.getElementById('cartEmptyMessage') || document.querySelector('.empty-cart-text');

    // 3. RENDER FUNCTION
    function renderSidebarCart() {
        // Get fresh items from the cart object
        const items = cart.getItems(); 
        const template = document.getElementById('cart-item-template');

        if (!sidebarContainer || !template) return;

        // Clear the current HTML to prevent duplicates
        sidebarContainer.innerHTML = ''; 
        let totalAmount = 0; 

        // --- Handle Empty State ---
        if (items.length === 0) {
            if (sidebarEmptyMsg) sidebarEmptyMsg.style.display = 'block';
            if (sidebarTotalEl) sidebarTotalEl.textContent = '$0.00';
            updateCartQuantityDisplay(cart); 
        } else {
            if (sidebarEmptyMsg) sidebarEmptyMsg.style.display = 'none';
        }

        // --- Loop through items ---
        items.forEach((item, index) => {
            // Calculate Total
            totalAmount += (item.price * item.quantity);
            
            const clone = template.content.cloneNode(true);
            
            // Fill in basic data
            clone.querySelector('.cart-item-name').textContent = item.name;
            clone.querySelector('.cart-item-defaultPrice').textContent = `$${item.price.toFixed(2)}`;
            clone.querySelector('.quantity-value').textContent = item.quantity;
            clone.querySelector('.cart-item-total-price').textContent = `$${(item.price * item.quantity).toFixed(2)}`;

            // --- Customization Display Logic ---
            const customizationEl = clone.querySelector('.cart-item-customization');
            if (customizationEl) {
                if (item.customizations && Object.keys(item.customizations).length > 0) {
                    const customizationValues = Object.values(item.customizations);
                    const validValues = customizationValues.filter(value => value && value !== 'default');
                    
                    if (validValues.length > 0) {
                        const formattedValues = validValues.map(v => Array.isArray(v) ? v.join(', ') : v);
                        customizationEl.innerHTML = formattedValues.join(', ');
                    } else {
                        customizationEl.remove();
                    }
                } else {
                    customizationEl.remove();
                }
            }

            // --- BUTTON LOGIC ---
            const decreaseBtn = clone.querySelector('.decrease-buttn');
            const increaseBtn = clone.querySelector('.increase-buttn');

            if(increaseBtn) increaseBtn.addEventListener("click", () => {
                items[index].quantity++;
                
                // 1. Update Storage
                localStorage.setItem('cart', JSON.stringify(items));
                
                // 2. Shout to everyone (including self) that cart changed
                window.dispatchEvent(new CustomEvent('cartUpdated'));
            });

            if(decreaseBtn) decreaseBtn.addEventListener("click", () => {
                items[index].quantity--; 
                if (items[index].quantity <= 0) items.splice(index, 1);
                
                // 1. Update Storage
                localStorage.setItem('cart', JSON.stringify(items));
                
                // 2. Shout to everyone (including self) that cart changed
                window.dispatchEvent(new CustomEvent('cartUpdated'));
            });

            sidebarContainer.appendChild(clone);
        });

        // Update Final Totals
        if (sidebarTotalEl) sidebarTotalEl.textContent = `$${totalAmount.toFixed(2)}`;
    }

    // Initial Render
    renderSidebarCart();

    if (cartButton && cartPreview && overlay && navLinks && menuToggle) {
        
        // Helper to close everything (used for Overlay click)
        const closeAll = () => {
            navLinks.classList.remove('active');
            menuToggle.classList.remove('active');
            cartPreview.classList.remove('active');
            overlay.classList.remove('active');
            document.body.classList.remove('no-scroll');
        };

        // --- 1. CART OPEN LOGIC ---
        cartButton.addEventListener('click', (e) => {
            e.stopPropagation();
            renderSidebarCart(); 
            
            // REMOVED: closeMobileMenu() call to stop the "either/or" behavior
            
            cartPreview.classList.add('active'); // Directly add active
            overlay.classList.add('active');
            document.body.classList.add('no-scroll');
        });

        // --- 2. HAMBURGER MENU OPEN LOGIC ---
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // REMOVED: closeCart() call to stop the "either/or" behavior
            
            navLinks.classList.add('active'); // Directly add active
            menuToggle.classList.add('active');
            overlay.classList.add('active');
            document.body.classList.add('no-scroll');
        });

        // --- 3. "X" BUTTON LOGIC FOR CART ---
        if (closeCartBtn) {
            closeCartBtn.addEventListener('click', () => {
                cartPreview.classList.remove('active');
                // Only remove overlay if the Menu isn't also open (optional safety check)
                if (!navLinks.classList.contains('active')) {
                    overlay.classList.remove('active');
                    document.body.classList.remove('no-scroll');
                }
            });
        }

        // --- 4. "X" BUTTON LOGIC FOR MENU ---
        if (closeMenuBtn) {
            closeMenuBtn.addEventListener('click', () => {
                navLinks.classList.remove('active');
                menuToggle.classList.remove('active');
                // Only remove overlay if the Cart isn't also open (optional safety check)
                if (!cartPreview.classList.contains('active')) {
                    overlay.classList.remove('active');
                    document.body.classList.remove('no-scroll');
                }
            });
        }

        // --- 5. OVERLAY CLICK (Closes Everything) ---
        overlay.addEventListener('click', closeAll);
        
        // Close menu when a link is clicked
        document.querySelectorAll('.nav-links a').forEach(link => link.addEventListener('click', closeAll));
    }
});