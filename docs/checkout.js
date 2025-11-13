import {updateCartQuantityDisplay} from './main.js'
import { Cart } from './cart.js'



const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const phone = document.getElementById("phone");
const clientInfoContainer = document.getElementById('client-info-container');
const formFields = [firstName, lastName, phone];

// MOVED & CHANGED: This is now an exported function for validation
export function validateCheckoutForm() {
    
    // Clear previous errors before re-validating
    formFields.forEach(field => field.classList.remove('input-error'));

    const isFirstNameEmpty = firstName.value.trim() === '';
    const isLastNameEmpty = lastName.value.trim() === '';
    const isPhoneEmpty = phone.value.trim() === '';
    const areAnyFieldsEmpty = isFirstNameEmpty || isLastNameEmpty || isPhoneEmpty;

    if (areAnyFieldsEmpty) {
      
        if (isFirstNameEmpty) firstName.classList.add('input-error');
        if (isLastNameEmpty) lastName.classList.add('input-error');
        if (isPhoneEmpty) phone.classList.add('input-error');
        
        if (clientInfoContainer) {
            clientInfoContainer.classList.add('highlight-error');
            setTimeout(() => {
                clientInfoContainer.classList.remove('highlight-error');
            }, 2500);
        }
        return false; // Validation FAILED
    }

    return true; // Validation SUCCEEDED
}


document.addEventListener("DOMContentLoaded", () => {
    // Select elements
    const cartContainer = document.getElementById('checkoutItemContainer');
    const cartSubTotalElement = document.getElementById('cart-subtotal');
    const cartHST = document.getElementById('hst');
    const cartTotalElement = document.getElementById('cart-total');
    const placeOrderBttn = document.getElementById("place-order-button");
    const summaryBox = document.querySelector('.cart-total-summary');
    const wrapper = document.querySelector('.checkout-content-wrapper');
    const cart = new Cart();
    const savedItems = JSON.parse(localStorage.getItem('cart')) || [];

    cart.loadFromStorage(savedItems);

   

    const formFields = [firstName, lastName, phone];
    formFields.forEach(field => {
        if (field) {
            field.addEventListener('input', () => {
                field.classList.remove('input-error');
            });
        }
    });

    function updateTotals() {
        const subtotal = savedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const hstAmount = subtotal * 0.13;
        const finalTotal = subtotal + hstAmount;

        if (cartSubTotalElement) cartSubTotalElement.textContent = `$${subtotal.toFixed(2)}`;
        if (cartHST) cartHST.textContent = `$${hstAmount.toFixed(2)}`;
        if (cartTotalElement) cartTotalElement.textContent = `$${finalTotal.toFixed(2)}`;
    }

   function renderCartItems() {
    // Get references to the template and the container
    const template = document.getElementById('cart-item-template');
    const cartContainer = document.getElementById('checkoutItemContainer');
    
    if (!cartContainer || !template) {
        console.error("Cart container or template not found!");
        return;
    }

    cartContainer.innerHTML = ''; // Clear previous items
    const itemsToRender = cart.getItems();

    // Handle empty cart
    if (itemsToRender.length === 0) {
        cartContainer.innerHTML = '<p>Your cart is empty.</p>';
        if (placeOrderBttn) placeOrderBttn.disabled = true;
        updateTotals();
        return;
    } else {
        if (placeOrderBttn) placeOrderBttn.disabled = false;
    }

    // Loop through each item and render it using the template
    itemsToRender.forEach((item, index) => {
        // 1. Clone the template's content
        const clone = template.content.cloneNode(true);

        // 2. Find the placeholder elements within the cloned node
        const nameEl = clone.querySelector('.cart-item-name');
        const defaultPriceEl = clone.querySelector('.cart-item-defaultPrice');
        const quantityEl = clone.querySelector('.quantity-value');
        const totalPriceEl = clone.querySelector('.cart-item-total-price');
        const customizationEl = clone.querySelector('.cart-item-customization');
        const decreaseBtn = clone.querySelector('.decrease-buttn');
        const increaseBtn = clone.querySelector('.increase-buttn');

        // 3. Fill the placeholders with the item's data
        nameEl.textContent = item.name;
        defaultPriceEl.textContent = `$${item.price.toFixed(2)}`;
        quantityEl.textContent = item.quantity;
        totalPriceEl.textContent = `$${(item.price * item.quantity).toFixed(2)}`;

        // Set the data-index for the buttons so they know which item to modify
        decreaseBtn.dataset.index = index;
        increaseBtn.dataset.index = index;

        // 4. Handle customizations (only show the div if customizations exist)
        let customizationText = Object.values(item.customizations)
            .filter(value => value && value !== 'default')
            .join(', ');

        if (customizationText) {
            customizationEl.textContent = customizationText;
        } else {
            customizationEl.remove(); // If no customizations, remove the element entirely
        }

        // 5. Append the finished clone to the cart container in the DOM
        cartContainer.appendChild(clone);
    });

    updateTotals();
}
    function saveCartAndRender() {
    const itemsArray = cart.getItems();
    const jsonStringToSave = JSON.stringify(itemsArray);

    // THIS IS THE MOST IMPORTANT DEBUGGING STEP
    console.log("CORRECTLY SAVING to cart:", jsonStringToSave); 
        localStorage.setItem('cart', JSON.stringify(cart.getItems()));
        renderCartItems();
    }

    function handleStickySummary() {
        const summaryBox = document.querySelector('.cart-total-summary');
        const wrapper = document.querySelector('.checkout-content-wrapper');
        const summaryColumn = document.querySelector('.summary-column');

        if (window.innerWidth <= 768) {
            if (summaryBox) {
                // Remove ALL classes and inline styles
                summaryBox.classList.remove('is-sticky', 'is-at-bottom');
                summaryBox.style.position = '';
                summaryBox.style.width = '';
                summaryBox.style.left = '';
                summaryBox.style.top = '';
            }
            return; 
        }

        // Desktop-only sticky logic below this point
        if (!summaryBox || !wrapper || !summaryColumn) {
            return;
        }

        const topOffset = 200;
        const wrapperRect = wrapper.getBoundingClientRect();
        const summaryColumnRect = summaryColumn.getBoundingClientRect();
        const summaryHeight = summaryBox.offsetHeight;
        const bottomStickPoint = wrapperRect.bottom - summaryHeight - topOffset;

        if (bottomStickPoint <= 0) {
            summaryBox.classList.remove('is-sticky');
            summaryBox.classList.add('is-at-bottom');
            summaryBox.style.width = '';
            summaryBox.style.left = '';
        } else if (summaryColumnRect.top <= topOffset) {
            summaryBox.classList.remove('is-at-bottom');
            summaryBox.classList.add('is-sticky');
            summaryBox.style.width = `${summaryColumnRect.width}px`;
            summaryBox.style.left = `${summaryColumnRect.left}px`;
        } else {
            summaryBox.classList.remove('is-sticky', 'is-at-bottom');
            summaryBox.style.width = '';
            summaryBox.style.left = '';
        }
    }
    
  
    // Event Listeners
    if (cartContainer) {
        cartContainer.addEventListener('click', (event) => {
            const target = event.target;
            const index = target.dataset.index;
            if (index === undefined) return;
            if (target.matches('.increase-buttn')) {
                savedItems[index].quantity++;
            } else if (target.matches('.decrease-buttn')) {
                savedItems[index].quantity--;
                if (savedItems[index].quantity <= 0) {
                    savedItems.splice(index, 1);
                }
            }
            
            saveCartAndRender();
            updateCartQuantityDisplay(cart);
            console.log(savedItems[index].quantity)
        });
    }

    window.addEventListener('scroll', handleStickySummary);
    window.addEventListener('resize', handleStickySummary);

    // Initialize Page
    renderCartItems();
    handleStickySummary();
});


