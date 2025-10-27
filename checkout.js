import { Cart } from './cart.js';  
import { db } from './main.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const names = document.querySelectorAll('.cart-item-name');
const quantities = document.querySelectorAll('.cart-item-quantity');
const prices = document.querySelectorAll('.cart-item-price');



async function fetchCartData() {
    const cartCollection = collection(db, 'cartItems');
    const snapshot = await getDocs(cartCollection);
    snapshot.forEach(doc => console.log(doc.id, doc.data()));
    }
document.addEventListener("DOMContentLoaded", () => {
    const cartContainer = document.getElementById('checkoutItemContainer')
    const cartStr = localStorage.getItem('cart');
    const savedCart = cartStr ? JSON.parse(cartStr) : [];
    console.log(savedCart);
    savedCart.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('cart-item');

        const subInfoDiv = document.createElement('div');
        subInfoDiv.classList.add('cart-item-subinfo');


        const nameDiv = document.createElement('div');
        nameDiv.classList.add('cart-item-name');
        nameDiv.textContent = item.name;


        
        const quantityDiv = document.createElement('div');
        quantityDiv.classList.add('cart-item-quantity');
        quantityDiv.textContent = "  $" + item.price.toFixed(2) + '\u00A0\u00A0\u00A0x' + item.quantity;

        subInfoDiv.append(nameDiv,quantityDiv);



        const customizationDiv = document.createElement('div');
        customizationDiv.classList.add('cart-item-customization');
        customizationDiv.textContent = Object.entries(item.customizations)
        .map(([key, value]) => `${value}`)
        .join(',\u00A0');

        const priceDiv = document.createElement('div');
        priceDiv.classList.add('cart-item-price');
        priceDiv.textContent = `$${(item.price * item.quantity).toFixed(2)}`;
        
        itemDiv.append(subInfoDiv, customizationDiv, priceDiv);
        cartContainer.appendChild(itemDiv);
    });
});