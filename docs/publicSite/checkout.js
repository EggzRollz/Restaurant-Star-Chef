import {updateCartQuantityDisplay} from './main.js'
import { Cart } from './cart.js'



const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const phone = document.getElementById("phone");
const clientInfoContainer = document.getElementById('client-info-container');
const formFields = [firstName, lastName, phone];

// MOVED & CHANGED: This is now an exported function for validation
// MODIFIED to highlight ALL errors but still track the FIRST for scrolling
export function validateCheckoutForm() {
    
    let firstInvalidField = null; // This will store the first error field we find

    // Clear previous errors before re-validating
    formFields.forEach(field => field.classList.remove('input-error'));

    // Check each field individually
    const isFirstNameEmpty = firstName.value.trim() === '';
    if (isFirstNameEmpty) {
        firstName.classList.add('input-error');
        // If this is the first error we've found, save this element
        if (!firstInvalidField) {
            firstInvalidField = firstName;
        }
    }

    const isLastNameEmpty = lastName.value.trim() === '';
    if (isLastNameEmpty) {
        lastName.classList.add('input-error');
        // If this is the first error we've found, save this element
        if (!firstInvalidField) {
            firstInvalidField = lastName;
        }
    }

    const isPhoneEmpty = phone.value.trim() === '';
    if (isPhoneEmpty) {
        phone.classList.add('input-error');
        // If this is the first error we've found, save this element
        if (!firstInvalidField) {
            firstInvalidField = phone;
        }
    }

    const areAnyFieldsEmpty = isFirstNameEmpty || isLastNameEmpty || isPhoneEmpty;

    if (areAnyFieldsEmpty) {
        // This part still runs if any field failed
        if (clientInfoContainer) {
            clientInfoContainer.classList.add('highlight-error');
            setTimeout(() => {
                clientInfoContainer.classList.remove('highlight-error');
            }, 2500);
        }
        // Return failure status and the first invalid field we found
        return { isValid: false, firstInvalidField: firstInvalidField };
    }

    // If we get here, no fields were empty
    return { isValid: true, firstInvalidField: null };
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
    const emptyMessageEl = document.getElementById('cartEmptyMessage');
    const pickupTimeElement = document.getElementById('pickup-time');
    const timeBoxElement = document.getElementById('time-box');
    const cart = new Cart();
    const now = new Date();
    const savedItems = JSON.parse(localStorage.getItem('cart')) || [];

    cart.loadFromStorage(savedItems);
   
    formFields.forEach(field => {
    if (field) {
        // This listener handles real-time input cleanup and length limiting
        field.addEventListener('input', (e) => {
            field.classList.remove('input-error');

            if (field === phone) {
                // --- THIS IS THE MODIFIED LINE ---
                // 1. Remove non-numbers, then 2. limit the result to 10 characters.
                e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 10);
                
            } else if (field === firstName || field === lastName) {
                e.target.value = e.target.value.replace(/[^a-zA-Z\s'-]/g, '');
            }
        });

        // This listener still prevents invalid keystrokes
        field.addEventListener('keydown', (event) => {
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
            const isShortcut = (event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase());

            if (allowedKeys.includes(event.key) || isShortcut) {
                return;
            }

            let isKeyAllowed = false;
            if (field === phone) {
                isKeyAllowed = event.key >= '0' && event.key <= '9';
            } else if (field === firstName || field === lastName) {
                const isLetter = /^[a-zA-Z]$/.test(event.key);
                const isAllowedChar = [' ', '-', '\''].includes(event.key);
                isKeyAllowed = isLetter || isAllowedChar;
            }

            if (!isKeyAllowed) {
                event.preventDefault();
            }
        });

        // This 'blur' listener still formats the number when the user leaves the field
        if (field === phone) {
            field.addEventListener('blur', (e) => {
                const digits = e.target.value;

                if (digits.length === 10) {
                    const formatted = digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
                    e.target.value = formatted;
                }
            });
        }
    }
});

        function updatePickupTime() {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            const isBeforeOpening = currentHour < 11;
            const isAfterClosing = (currentHour === 21 && currentMinute >= 30) || (currentHour > 21);

            if (isBeforeOpening || isAfterClosing) {
                // If store is closed, the button is ALWAYS disabled.
                pickupTimeElement.textContent = ("No more orders are being processed tonight. Please try again tomorrow.");
                timeBoxElement.classList.add('store-closed');
                placeOrderBttn.disabled = true;

            } else {
                // If store is open, the button is disabled ONLY if the cart is empty.
                timeBoxElement.classList.remove('store-closed');
                const isCartEmpty = cart.getItems().length === 0;
                placeOrderBttn.disabled = isCartEmpty;
                
                const pickupTime = new Date(); 
                pickupTime.setMinutes(pickupTime.getMinutes() + 30);
                const minutes = pickupTime.getMinutes();
                let hours24 = pickupTime.getHours();
                const ampm = hours24 >= 12 ? 'PM' : 'AM';
                let hours12 = hours24 % 12;
                if (hours12 === 0) { hours12 = 12; }
                const paddedMinutes = String(minutes).padStart(2, '0');
                const displayTime = `Estimated pickup time ${hours12}:${paddedMinutes} ${ampm}`;
                pickupTimeElement.textContent = displayTime;
            }
        }

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
        cartContainer.innerHTML = '';
        emptyMessageEl.classList.remove('hidden');
        if (placeOrderBttn) placeOrderBttn.disabled = true;
        updateTotals();
        return;
    } else {
        emptyMessageEl.classList.add('hidden'); // Hide the empty message
        cartContainer.innerHTML = '';
    }

    // Loop through each item and render it using the template
    itemsToRender.forEach((item, index) => {
        // 1. Clone the template's content
        const clone = template.content.cloneNode(true);

        // 2. Find the placeholder elements within the cloned node
        const nameEl = clone.querySelector('.cart-item-name');
        const nameChineseEl = clone.querySelector('.cart-item-name-chinese');
        const defaultPriceEl = clone.querySelector('.cart-item-defaultPrice');
        const quantityEl = clone.querySelector('.quantity-value');
        const totalPriceEl = clone.querySelector('.cart-item-total-price');
        const customizationEl = clone.querySelector('.cart-item-customization');
        const decreaseBtn = clone.querySelector('.decrease-buttn');
        const increaseBtn = clone.querySelector('.increase-buttn');

        // 3. Fill the placeholders with the item's data
        nameEl.textContent = item.name;
        nameChineseEl.textContent = item.name_chinese;
        console.log(item.name_chinese)
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
    updatePickupTime();
    setInterval(updatePickupTime, 1000);
});


