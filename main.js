import { Cart } from './cartFunctions.js';  

const cart = new Cart();
const increaseBttn = document.getElementById("increaseBttn");
const decreaseBttn = document.getElementById("decreaseBttn");
const submitBttn = document.getElementById("submitBttn")
let currentName = '';
let currentPrice = 0;
let ammount = 0;
updateQuantityDisplay();


fetch('inventory.txt')
  .then(res => res.text())  // First: convert response to text
  .then(text => {            // Then: work with the text
    console.log("Loaded text:", text);
    console.log("Text length:", text.length);
    
    const lines = text.trim().split(/\r?\n/);
    const [nameRaw, priceStrRaw] = lines[0].split(",");
    const name = nameRaw.trim();
    const price = parseFloat(priceStrRaw.trim());
    
    currentName = name;
    currentPrice = price;

    submitBttn.textContent = 'ADD TO CART - $';
  })
  


function updateQuantityDisplay() {
  const quantityDisplay = document.getElementById('quantity-display');
  quantityDisplay.textContent = ammount; 

}
function renderCart(){

}
function printCartContents() {
  if (cart.items.length === 0) {
    console.log("Cart is empty.");
    return;
  }
  
  cart.items.forEach(item => {
    const name = item[0];
    const price = item[1];
    const quantity = item[2];
    console.log(`${name} - $${price} x ${quantity}`);
  });
}


increaseBttn.addEventListener("click", () => {
    ammount++
    console.log("plus")
    submitBttn.textContent = 'ADD TO CART - $' + (currentPrice*ammount).toFixed(2);
    updateQuantityDisplay();
});


decreaseBttn.addEventListener("click", () => {
    if(ammount>=1){
        ammount--
        console.log("minus")
    }
    else{
        console.log("nothing to decrease")
    }
    submitBttn.textContent = 'ADD TO CART - $' + (currentPrice*ammount).toFixed(2);
    updateQuantityDisplay();
});


submitBttn.addEventListener("click", () => {
    if(ammount>0){
        cart.addItem(currentName,currentPrice,ammount)
        printCartContents();
    }
    ammount = 0 
    updateQuantityDisplay();
    renderCart();

})



