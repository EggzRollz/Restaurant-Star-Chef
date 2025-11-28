import { Cart } from './cart.js';

// Helper function to update the red number badge on the cart icon
export function updateCartQuantityDisplay(cart, element = null) {
    const displayEl = element || document.getElementById('cartQuantityDisplay');
    if(displayEl) {
        displayEl.textContent = cart.cartLength(); 
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // 1. CACHE ALL ELEMENTS (This was missing in your snippet)
    const elements = {
        badge: document.getElementById('cartQuantityDisplay'),
        overlay: document.querySelector('.overlay'),
        cartButton: document.querySelector('.cart-button'),
        closeMenuBtn: document.getElementById('closeMenuBtn'),
        closeCartBtn: document.getElementById('closeCartBtn'),
        menuToggle: document.querySelector('.menu-toggle'),
        cartPreview: document.querySelector('.cart-preview'),
        navLinks: document.querySelector('.nav-links'),
        sidebarContainer: document.getElementById('cart-items-container'),
        sidebarTotalEl: document.getElementById('sidebar-cart-total'),
        sidebarEmptyMsg: document.getElementById('cartEmptyMessage') || document.querySelector('.empty-cart-text'),
        template: document.getElementById('cart-item-template'),
        navLinksAnchors: document.querySelectorAll('.nav-links a')
    };

    // 2. INITIALIZE CART
    const cart = new Cart();
    const savedItems = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Load initial state
    if (cart.loadFromStorage) {
        cart.loadFromStorage(savedItems);
    }
    
    // Update badge immediately
    updateCartQuantityDisplay(cart, elements.badge);

    // 3. EVENT DELEGATION (Optimized)
    if (elements.sidebarContainer) {
        elements.sidebarContainer.addEventListener('click', (e) => {
            const target = e.target;
            const button = target.closest('button');
            
            if (!button) return;

            // Get the index from the button's data attribute
            const index = parseInt(button.dataset.index, 10);
            if (isNaN(index)) return;

            const items = cart.getItems();
            let hasChanged = false;

            if (button.classList.contains('increase-buttn')) {
                items[index].quantity++;
                hasChanged = true;
            } else if (button.classList.contains('decrease-buttn')) {
                items[index].quantity--;
                if (items[index].quantity <= 0) {
                    items.splice(index, 1);
                }
                hasChanged = true;
            }

            if (hasChanged) {
                // Update Storage
                localStorage.setItem('cart', JSON.stringify(items));
                // Dispatch event
                window.dispatchEvent(new CustomEvent('cartUpdated'));
            }
        });
    }

    // 4. SYNC LOGIC
    function handleSync() {
        console.log("Sidebar detected update!");
        // 1. Re-read the database (LocalStorage)
        const freshItems = JSON.parse(localStorage.getItem('cart')) || [];
        cart.loadFromStorage(freshItems);
        
        // 2. Re-draw the Sidebar and Badge
        renderSidebarCart();
        updateCartQuantityDisplay(cart, elements.badge);
    }

    // Listen for the custom signal from the Menu/Checkout
    window.addEventListener('cartUpdated', handleSync);
    // Listen for changes from other tabs
    window.addEventListener('storage', handleSync);

    // 5. RENDER FUNCTION
    function renderSidebarCart() {
        // Use the cached elements object
        const { sidebarContainer, template, sidebarEmptyMsg, sidebarTotalEl } = elements;
        
        if (!sidebarContainer || !template) return;

        const items = cart.getItems();
        let totalAmount = 0;

        // Use a Fragment to minimize reflows
        const fragment = document.createDocumentFragment();

        // Handle Empty State
        if (items.length === 0) {
            if (sidebarEmptyMsg) sidebarEmptyMsg.style.display = 'block';
            if (sidebarTotalEl) sidebarTotalEl.textContent = '$0.00';
            sidebarContainer.innerHTML = '';
            updateCartQuantityDisplay(cart, elements.badge);
            return; 
        } else {
            if (sidebarEmptyMsg) sidebarEmptyMsg.style.display = 'none';
        }

        items.forEach((item, index) => {
            totalAmount += (item.price * item.quantity);
            const clone = template.content.cloneNode(true);

            // Set Text Content
            clone.querySelector('.cart-item-name').textContent = item.name;
            clone.querySelector('.cart-item-defaultPrice').textContent = `$${item.price.toFixed(2)}`;
            clone.querySelector('.quantity-value').textContent = item.quantity;
            clone.querySelector('.cart-item-total-price').textContent = `$${(item.price * item.quantity).toFixed(2)}`;

            // Set Data-Index for Event Delegation (Crucial!)
            const incBtn = clone.querySelector('.increase-buttn');
            const decBtn = clone.querySelector('.decrease-buttn');
            if (incBtn) incBtn.dataset.index = index;
            if (decBtn) decBtn.dataset.index = index;

            // Customization Logic
            const customizationEl = clone.querySelector('.cart-item-customization');
            if (customizationEl) {
                const customizationValues = item.customizations ? Object.values(item.customizations) : [];
                const validValues = customizationValues.filter(value => value && value !== 'default');

                if (validValues.length > 0) {
                    // Flatten arrays if any, then join
                    const formattedValues = validValues.map(v => Array.isArray(v) ? v.join(', ') : v);
                    customizationEl.innerHTML = formattedValues.join(', ');
                } else {
                    customizationEl.remove();
                }
            }

            fragment.appendChild(clone);
        });

        // Single DOM update
        sidebarContainer.innerHTML = '';
        sidebarContainer.appendChild(fragment);

        if (sidebarTotalEl) sidebarTotalEl.textContent = `$${totalAmount.toFixed(2)}`;
    }
    
    // Initial Render
    renderSidebarCart();

    // 6. UI INTERACTION LOGIC
    if (elements.cartButton && elements.cartPreview && elements.overlay && elements.navLinks && elements.menuToggle) {
        
        // Helper to close everything
        const closeAll = () => {
            elements.navLinks.classList.remove('active');
            elements.menuToggle.classList.remove('active');
            elements.cartPreview.classList.remove('active');
            elements.overlay.classList.remove('active');
            document.body.classList.remove('no-scroll');
        };

        // --- CART OPEN LOGIC ---
        elements.cartButton.addEventListener('click', (e) => {
            e.stopPropagation();
            renderSidebarCart(); 
            elements.cartPreview.classList.add('active');
            elements.overlay.classList.add('active');
            document.body.classList.add('no-scroll');
        });

        // --- HAMBURGER MENU OPEN LOGIC ---
        elements.menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.navLinks.classList.add('active');
            elements.menuToggle.classList.add('active');
            elements.overlay.classList.add('active');
            document.body.classList.add('no-scroll');
        });

        // --- "X" BUTTON LOGIC FOR CART ---
        if (elements.closeCartBtn) {
            elements.closeCartBtn.addEventListener('click', () => {
                elements.cartPreview.classList.remove('active');
                if (!elements.navLinks.classList.contains('active')) {
                    elements.overlay.classList.remove('active');
                    document.body.classList.remove('no-scroll');
                }
            });
        }

        // --- "X" BUTTON LOGIC FOR MENU ---
        if (elements.closeMenuBtn) {
            elements.closeMenuBtn.addEventListener('click', () => {
                elements.navLinks.classList.remove('active');
                elements.menuToggle.classList.remove('active');
                if (!elements.cartPreview.classList.contains('active')) {
                    elements.overlay.classList.remove('active');
                    document.body.classList.remove('no-scroll');
                }
            });
        }

        // --- OVERLAY CLICK ---
        elements.overlay.addEventListener('click', closeAll);
        
        // --- CLOSE ON LINK CLICK ---
        if (elements.navLinksAnchors) {
            elements.navLinksAnchors.forEach(link => link.addEventListener('click', closeAll));
        }
    }
});