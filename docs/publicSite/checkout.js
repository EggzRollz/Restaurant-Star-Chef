import {updateCartQuantityDisplay} from './main.js'
import { Cart } from './cart.js'

const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const phone = document.getElementById("phone");
const clientInfoContainer = document.getElementById('client-info-container');
const pickupTimeTrigger = document.getElementById('pickupTimeTrigger');
const selectedPickupTimeInput = document.getElementById('selectedPickupTime');
const formFields = [firstName, lastName, phone];




export function validateCheckoutForm() {
    let firstInvalidField = null;

    // Clear previous errors before re-validating
    formFields.forEach(field => field.classList.remove('input-error'));
    if (pickupTimeTrigger) {
        pickupTimeTrigger.classList.remove('pickup-time-trigger-error');
    }
    // Check each field individually
    const isFirstNameEmpty = firstName.value.trim() === '';

    if (isFirstNameEmpty) {
        firstName.classList.add('input-error');
        if (!firstInvalidField) {
            firstInvalidField = firstName;
        }
    }

    const isLastNameEmpty = lastName.value.trim() === '';
    if (isLastNameEmpty) {
        lastName.classList.add('input-error');
        if (!firstInvalidField) {
            firstInvalidField = lastName;
        }
    }

    const phoneDigits = phone.value.replace(/\D/g, ''); // Remove all non-digits
    const isPhoneInvalid = phoneDigits.length !== 10;
    
    if (isPhoneInvalid) {
        phone.classList.add('input-error');
        if (!firstInvalidField) {
            firstInvalidField = phone;
        }
    }
    const isPickupTimeEmpty = !selectedPickupTimeInput || selectedPickupTimeInput.value.trim() === '';
    if (isPickupTimeEmpty) {
        // Store the original text to restore later
        const originalText = pickupTimeTrigger.textContent;
        
        // Add error styling to the button
        pickupTimeTrigger.classList.add('pickup-time-trigger-error');
        
       
        
        // Restore original text after 3 seconds
        setTimeout(() => {
            if (pickupTimeTrigger.classList.contains('pickup-time-trigger-error')) {
                pickupTimeTrigger.textContent = originalText;
            }
        }, 3000);
        
        if (!firstInvalidField) {
            firstInvalidField = pickupTimeTrigger;
        }
    }

    const areAnyFieldsEmpty = isFirstNameEmpty || isLastNameEmpty || isPhoneInvalid || isPickupTimeEmpty;

    if (areAnyFieldsEmpty) {
        if (clientInfoContainer) {
            clientInfoContainer.classList.add('highlight-error');
            setTimeout(() => {
                clientInfoContainer.classList.remove('highlight-error');
            }, 2500);
        }
        return { isValid: false, firstInvalidField: firstInvalidField };
    }

    return { isValid: true, firstInvalidField: null };
}

document.addEventListener("DOMContentLoaded", () => {
    // Select elements
    const cartContainer = document.getElementById('checkoutItemContainer');
    const cartSubTotalElement = document.getElementById('cart-subtotal');
    const cartHST = document.getElementById('hst');
    const cartTotalElement = document.getElementById('cart-total');
    const placeOrderBttn = document.getElementById("place-order-button");
    const pickupTimeElement = document.getElementById('pickup-time');
    const timeBoxElement = document.getElementById('time-box');
    const pickupDropdown = document.getElementById('pickupTimeDropdown');
    const pickupDropdownContainer = document.getElementById('pickupTimeDropdownContainer');
    const pickupTimeTrigger = document.getElementById('pickupTimeTrigger');
    const pickupTimeOptions = document.getElementById('pickupTimeOptions');
    const selectedPickupTimeInput = document.getElementById('selectedPickupTime');
    const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
    const onlinePaymentContainer = document.getElementById('online-payment-container');
    let choices = null;
    const cart = new Cart();
    const savedItems = JSON.parse(localStorage.getItem('cart')) || [];
    const stripe = Stripe("pk_test_51SWctgGoQxdZDWdoSxxfc3aRRgygJUc69RP9vTzMQBCQrdkdmN0LZQS9iQxrkNsLZNciuqr4yJH7yP9v5O6Kg0b600lqhXMv4f"); 

    let elements;
    let paymentElement;

    

    function handleCheckoutSync() {
        console.log("Checkout page detected cart update!");
        
        // 1. Reload from storage
        const freshItems = JSON.parse(localStorage.getItem('cart')) || [];
        cart.loadFromStorage(freshItems);
        
        // 2. Re-render everything
        renderCartItems();
        updateTotals();
        updateButtonState();
        updateCartQuantityDisplay(cart);
    }
    
    // Listen for updates from other parts of the app
    window.addEventListener('cartUpdated', handleCheckoutSync);
    window.addEventListener('storage', handleCheckoutSync);
    cart.loadFromStorage(savedItems);
    if (pickupTimeTrigger) {
        pickupTimeTrigger.addEventListener('click', () => {
            updatePickupTime(); // Recalculate times immediately before opening
            pickupDropdownContainer.classList.toggle('open');
        });
    }

    if (pickupTimeOptions) {
        pickupTimeOptions.addEventListener('click', (e) => {
            const option = e.target.closest('.custom-option');
            if (option) {
                const selectedValue = option.getAttribute('data-value');
                
                // This will display the calculated time (e.g., "7:45 PM") in the box
                pickupTimeTrigger.textContent = selectedValue; 
                selectedPickupTimeInput.value = selectedValue;
                
                pickupDropdownContainer.classList.remove('open');
            }
        });
    }
    formFields.forEach(field => {
        if (field) {
            // This listener handles real-time input cleanup and length limiting
            field.addEventListener('input', (e) => {
                field.classList.remove('input-error');

                if (field === phone) {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 10);
                } else if (field === firstName || field === lastName) {
                    e.target.value = e.target.value.replace(/[^a-zA-Z\s'-]/g, '').substring(0, 35);
                }
            });

            // This listener prevents invalid keystrokes
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

            // This 'blur' listener formats the number when the user leaves the field
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

    // SINGLE SOURCE OF TRUTH for button state
    function updateButtonState() {
        const isCartEmpty = cart.getItems().length === 0;
        const now = new Date();
 
        const isStoreClosed = false;
        //const isStoreClosed = (currentHour < 11) || (currentHour === 21 && currentMinute >= 30) || (currentHour > 21);

        // The button should be disabled if the store is closed OR if the cart is empty
        placeOrderBttn.disabled = isStoreClosed || isCartEmpty;
    }

 
// 3. (Optional but recommended) Close when clicking outside
window.addEventListener('click', (e) => {
    if (!pickupDropdownContainer.contains(e.target)) {
        pickupDropdownContainer.classList.remove('open');
    }
});

    function formatTime(dateObj) {
        let hours = dateObj.getHours();
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
        return `${hours}:${minutes} ${ampm}`;
    }

    function updatePickupTime() {
    const previouslySelectedTime = selectedPickupTimeInput.value;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const isBeforeOpening = currentHour < 11;
    const isAfterClosing = (currentHour === 21 && currentMinute >= 30) || (currentHour > 21);

    // This logic seems reversed, I've flipped it to what I think you intend:
    // This block should run if the store is OPEN.
    if (!(isBeforeOpening || isAfterClosing)) {
        if (timeBoxElement) timeBoxElement.classList.remove('store-closed');
        if (pickupDropdownContainer) pickupDropdownContainer.classList.remove('hidden');
        
     
        const asapDate = new Date(now.getTime() + 25 * 60000);
        const asapTimeString = formatTime(asapDate);
        const closingTime = new Date();
        closingTime.setHours(21, 30, 0, 0); // Set closing time to 9:30 PM
        const firstAvailablePickup = new Date(now.getTime() + 30 * 60000);
        const firstMinutes = firstAvailablePickup.getMinutes();

        const remainder = firstMinutes % 15;
        if (remainder !== 0) {
            firstAvailablePickup.setMinutes(firstMinutes + (15 - remainder));
        }
        firstAvailablePickup.setSeconds(0, 0);

        const remainingTimeOptionsArr = [];
        let currentTimeSlot = new Date(firstAvailablePickup.getTime());

        while (currentTimeSlot < closingTime) {
                remainingTimeOptionsArr.push(formatTime(currentTimeSlot));
                currentTimeSlot.setMinutes(currentTimeSlot.getMinutes() + 15);
            }
        const optionsContainer = document.getElementById('pickupTimeOptions');
            if (!optionsContainer) return; // Safety check
        optionsContainer.innerHTML = ''; // Clear previous options

        if (remainingTimeOptionsArr.length > 0) {
            const asapDiv = document.createElement('div');
                asapDiv.classList.add('custom-option');

                asapDiv.innerHTML = `ASAP <span style="font-size: 0.85em; opacity: 0.7;">(${asapTimeString})</span>`; 
                asapDiv.setAttribute('data-value', asapTimeString); 
                optionsContainer.appendChild(asapDiv);
            remainingTimeOptionsArr.forEach(time => {
                    const optionDiv = document.createElement('div');
                    optionDiv.classList.add('custom-option');
                    optionDiv.textContent = time;
                    optionDiv.setAttribute('data-value', time);
                    optionsContainer.appendChild(optionDiv);
                });
              const isValidSelection = (previouslySelectedTime === asapTimeString) || 
                                         (remainingTimeOptionsArr.includes(previouslySelectedTime));

                if (previouslySelectedTime && isValidSelection) {
                    pickupTimeTrigger.textContent = previouslySelectedTime;
                    selectedPickupTimeInput.value = previouslySelectedTime; 
                } else {
                    pickupTimeTrigger.textContent = "Select a Time";
                    selectedPickupTimeInput.value = ""; 
                }
            } else {
                pickupTimeTrigger.textContent = "No more pickup times available for today";
            }
        } else { 
            // Store Closed Logic
            if(pickupTimeElement) pickupTimeElement.textContent = "No more orders are being processed tonight. Please try again tomorrow.";
            if(timeBoxElement) timeBoxElement.classList.add('store-closed');
            if (pickupDropdownContainer) pickupDropdownContainer.classList.add('hidden');
        }

        updateButtonState();
    }





 
 function updateTotals() {
    // 1. Get items (Fast, local memory access)
    const currentCartItems = cart.getItems();
    
    // 2. Calculate
    const subtotal = currentCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const hstAmount = subtotal * 0.13;
    const finalTotal = subtotal + hstAmount;

    // 3. Update DOM (Visuals)
    if (cartSubTotalElement) cartSubTotalElement.textContent = `$${subtotal.toFixed(2)}`;
    if (cartHST) cartHST.textContent = `$${hstAmount.toFixed(2)}`;
    if (cartTotalElement) cartTotalElement.textContent = `$${finalTotal.toFixed(2)}`;

    // 4. *** NEW: Return the value so other functions can use it ***
    return finalTotal;
}

    function renderCartItems() {
        // Get references to the template and the container
        const template = document.getElementById('cart-item-template');
        const cartContainer = document.getElementById('checkoutItemContainer');
        const emptyMessageEl = document.getElementById('checkoutEmptyMessage');

        if (!cartContainer || !template || !emptyMessageEl) {
            console.error("Cart container or template not found!");
            return;
        }

        cartContainer.innerHTML = ''; // Clear previous items
        const itemsToRender = cart.getItems();

        // Handle empty cart
        if (itemsToRender.length === 0) {
            emptyMessageEl.classList.remove('hidden');
            updateTotals();
            updateButtonState(); // Let updateButtonState handle the button
            return;
        } else {
            emptyMessageEl.classList.add('hidden');
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
            const customizations = item.customizations || {};
            const customizationValues = Object.values(customizations);

            // 3. Fill the placeholders with the item's data
            nameEl.textContent = item.name;
            nameChineseEl.textContent = item.name_chinese;
            defaultPriceEl.textContent = `$${item.price.toFixed(2)}`;
            quantityEl.textContent = item.quantity;
            totalPriceEl.textContent = `$${(item.price * item.quantity).toFixed(2)}`;
            
            // Set the data-index for the buttons so they know which item to modify
            decreaseBtn.dataset.index = index;
            increaseBtn.dataset.index = index;

            // 4. Handle customizations (only show the div if customizations exist)
            // Filter out any default or empty values
            const validValues = customizationValues.filter(value => value && value !== 'default');

                if (validValues.length > 0) {
 
    const fullCustomizationText = validValues.join(', ');
    const htmlWithBreaks = fullCustomizationText.replace(/, /g, ',<br>');

    // Set the HTML of the container. We use .innerHTML because it understands the <br> tag.
    customizationEl.innerHTML = htmlWithBreaks;

    // --- END OF THE NEW CODE ---

} else {
    // If there are no customizations, remove the container entirely
    customizationEl.remove();
}

            // 5. Append the finished clone to the cart container in the DOM
            cartContainer.appendChild(clone);
        });

        updateTotals();
        updateButtonState(); // Let updateButtonState handle the button
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

        const currentCartItems = cart.getItems();
        const itemToModify = currentCartItems[index];

        if (!itemToModify) {
            console.error(`Could not find item at index ${index} to modify.`);
            return;
        }

        if (target.matches('.increase-buttn')) {
            itemToModify.quantity++;
        } 
        else if (target.matches('.decrease-buttn')) {
            itemToModify.quantity--;
            if (itemToModify.quantity <= 0) {
                currentCartItems.splice(index, 1);
            }
        }
        
        // ⭐ ONLY SAVE ONCE AND SIGNAL ⭐
        localStorage.setItem('cart', JSON.stringify(cart.getItems()));
        window.dispatchEvent(new CustomEvent('cartUpdated'));
        
        // Don't call saveCartAndRender() here - let the event handler do it
        // The 'cartUpdated' event will trigger handleCheckoutSync() which re-renders everything
    });
}

    window.addEventListener('scroll', handleStickySummary);
    window.addEventListener('resize', handleStickySummary);

    // Initialize Page
    renderCartItems();
    handleStickySummary();
    updatePickupTime();
    updateButtonState();
    togglePaymentSection();
    setInterval(updatePickupTime, 60000);


    window.addEventListener('pageshow', function(event) {
        if (cart) {
            cart.loadFromStorage();
            updateCartQuantityDisplay(cart);
            console.log("Page restored. Cart re-synced from storage.");
        }
    });
});