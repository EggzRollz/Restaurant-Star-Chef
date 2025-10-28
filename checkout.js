document.addEventListener("DOMContentLoaded", () => {
    // Get the main container and the element for the total price
    const cartContainer = document.getElementById('checkoutItemContainer');
    // You'll need an element in your HTML to show the total, e.g., <div id="cart-total"></div>
    const cartSubTotalElement = document.getElementById('cart-subtotal');
    const cartHST = document.getElementById('hst'); 
    const cartTotalElement = document.getElementById('cart-total'); 

    // Load the cart from localStorage
    let savedCart = [];
    const cartStr = localStorage.getItem('cart');
    if (cartStr) {
        savedCart = JSON.parse(cartStr);
    }

    // --- Function to update the total price display ---
    function updateTotals() {

        
        const subtotal = savedCart.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);
        const hstAmount = subtotal * 0.13;
        const finalTotal = subtotal + hstAmount;
        // Update the HTML element with the formatted total
        if (cartSubTotalElement) {
        // Format the subtotal number to a string
            cartSubTotalElement.textContent = `$${subtotal.toFixed(2)}`;

        }
        if (cartHST) {
            // Format the HST number to a string
            cartHST.textContent = `$${hstAmount.toFixed(2)}`;
        }
        if (cartTotalElement) {
            // Format the final total number to a string
            cartTotalElement.textContent = `$${finalTotal.toFixed(2)}`;
        }
        
    }
    

    // --- Function to save the cart and update the total ---
    function saveCartAndRender() {
        // Save the updated cart array back to localStorage
        localStorage.setItem('cart', JSON.stringify(savedCart));
        // Rerender the cart display to reflect all changes
        renderCartItems();
    }
    
    // --- Main function to render all cart items ---
    function renderCartItems() {
        // Clear the container before re-rendering to avoid duplicates
        cartContainer.innerHTML = '';
        
        // If the cart is empty, show a message
        if (savedCart.length === 0) {
            cartContainer.innerHTML = '<p>Your cart is empty.</p>';
            updateTotals(); // Ensure total shows $0.00
            return;
        }

        savedCart.forEach((item, index) => {
            // Create all the elements for a single cart item
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('cart-item');

            const subInfoDiv = document.createElement('div');
            subInfoDiv.classList.add('cart-item-subinfo');

            const nameDiv = document.createElement('div');
            nameDiv.classList.add('cart-item-name');
            nameDiv.textContent = item.name;
            
            const defaultPriceDiv = document.createElement('div');
            defaultPriceDiv.classList.add('cart-item-defaultPrice');
            defaultPriceDiv.textContent = "  $" + item.price.toFixed(2);

            const customizationDiv = document.createElement('div');
            customizationDiv.classList.add('cart-item-customization');
            customizationDiv.textContent = Object.values(item.customizations).join(',\u00A0');

            const quantityModContainer = document.createElement('div');
            quantityModContainer.classList.add('quantity-mod-container'); // Corrected class add

            const priceDiv = document.createElement('div');
            priceDiv.classList.add('cart-item-price');
            priceDiv.textContent = `$${(item.price * item.quantity).toFixed(2)}`;
            
            const decreaseBttn = document.createElement('button');
            decreaseBttn.classList.add('decrease-buttn');
            decreaseBttn.textContent = "-";

            const quantitySpan = document.createElement('span');
            quantitySpan.classList.add('quantity-value');
            quantitySpan.textContent = item.quantity;

            const increaseBttn = document.createElement('button');
            increaseBttn.classList.add('increase-buttn');
            increaseBttn.textContent = "+";
            
            // *** THE IMPORTANT PART: ADDING EVENT LISTENERS INSIDE THE LOOP ***

            increaseBttn.addEventListener("click", () => {
                // Increase the quantity for this specific item
                console.log('Increase button clicked for item:', item.name); 
                item.quantity++;
                // Save the changes and re-render the entire cart
                saveCartAndRender();
            });
        
            decreaseBttn.addEventListener("click", () => {
                // Decrease the quantity
                item.quantity--;
                console.log('Decrease button clicked for item:', item.name);
                // If quantity drops to 0, remove the item from the cart array
                if (item.quantity <= 0) {
                    // The 'index' comes from the forEach loop's second argument
                    savedCart.splice(index, 1);
                }
                
                // Save the changes (either updated quantity or removed item) and re-render
                saveCartAndRender();
            });

            // Append all the created elements to the DOM
            quantityModContainer.append(decreaseBttn, quantitySpan, increaseBttn);
            subInfoDiv.append(nameDiv, defaultPriceDiv, quantityModContainer);
            itemDiv.append(subInfoDiv, customizationDiv, priceDiv);
            cartContainer.appendChild(itemDiv);
        });

        // After the loop, update the grand total
        updateTotals();
    }

    // Initial call to render the cart when the page loads
    renderCartItems();
});