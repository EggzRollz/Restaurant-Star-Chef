// Replace your entire checkout.js file with this.

document.addEventListener("DOMContentLoaded", () => {
    // Select elements
    const cartContainer = document.getElementById('checkoutItemContainer');
    const cartSubTotalElement = document.getElementById('cart-subtotal');
    const cartHST = document.getElementById('hst');
    const cartTotalElement = document.getElementById('cart-total');
    const placeOrderBttn = document.getElementById("place-order-button");
    const summaryBox = document.querySelector('.cart-total-summary');
    const wrapper = document.querySelector('.checkout-content-wrapper');
    const firstName = document.getElementById("firstName")
    const lastName = document.getElementById("lastName")
    const phone = document.getElementById("phone")
    let savedCart = JSON.parse(localStorage.getItem('cart')) || [];




    function updateButtonState() {
        // Trim the values to ensure fields with only spaces are considered empty
        const isFirstNameEmpty = firstName.value.trim() === '';
        const isLastNameEmpty = lastName.value.trim() === '';
        const isPhoneEmpty = phone.value.trim() === '';
        const areAnyFieldsEmpty = isFirstNameEmpty || isLastNameEmpty || isPhoneEmpty;
        const isCartEmpty = savedCart.length === 0;

        placeOrderBttn.disabled = areAnyFieldsEmpty || isCartEmpty;
    }

    const formFields = [firstName, lastName, phone];
    formFields.forEach(field => {
        if (field) { 
            field.addEventListener('input', updateButtonState);
        }
    });

    function updateTotals() {
        const subtotal = savedCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const hstAmount = subtotal * 0.13;
        const finalTotal = subtotal + hstAmount;

        if (cartSubTotalElement) cartSubTotalElement.textContent = `$${subtotal.toFixed(2)}`;
        if (cartHST) cartHST.textContent = `$${hstAmount.toFixed(2)}`;
        if (cartTotalElement) cartTotalElement.textContent = `$${finalTotal.toFixed(2)}`;
        updateButtonState();
    }

    function renderCartItems() {
        if (!cartContainer) return;
        cartContainer.innerHTML = '';
        if (savedCart.length === 0) {
            cartContainer.innerHTML = '<p>Your cart is empty.</p>';
            updateTotals();
            return;
        }
        savedCart.forEach((item, index) => {
            console.log("Data for cart item being rendered:", item.customizations);
            let customizationText = '';
            if (item.customizations) { // Make sure customizations exist
                if (item.customizations.temp && item.customizations.temp !== 'default') {
                    customizationText = item.customizations.temp;
                } else if (item.customizations.size && item.customizations.size !== 'default') {
                    customizationText = item.customizations.size;
                }
            }

            // 2. Create the HTML for the customization line only if there's text to show.
            const customizationHTML = customizationText 
                ? `<div class="cart-item-customization">${customizationText}</div>` 
                : '';
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('cart-item');
            itemDiv.innerHTML = `
                <div class="cart-item-subinfo">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-defaultPrice">$${item.price.toFixed(2)}</div>
                    <div class="quantity-mod-container">
                        <button class="decrease-buttn" data-index="${index}">-</button>
                        <span class="quantity-value">${item.quantity}</span>
                        <button class="increase-buttn" data-index="${index}">+</button>
                    </div>
                </div>
                <div class="cart-item-customization">${Object.values(item.customizations).join(', ')}</div>
                <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
            `;
            cartContainer.appendChild(itemDiv);
        });
        updateTotals();
    }
    
    function saveCartAndRender() {
        localStorage.setItem('cart', JSON.stringify(savedCart));
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
                savedCart[index].quantity++;
            } else if (target.matches('.decrease-buttn')) {
                savedCart[index].quantity--;
                if (savedCart[index].quantity <= 0) {
                    savedCart.splice(index, 1);
                }
            }
            saveCartAndRender();
        });
    }

    window.addEventListener('scroll', handleStickySummary);
    window.addEventListener('resize', handleStickySummary);

    // Initialize Page
    renderCartItems();
    handleStickySummary();
});