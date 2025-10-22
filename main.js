import { Cart } from './cartFunctions.js';  
import { mergeSort } from './algorithms.js';
import { filterBy } from './algorithms.js';
const cart = new Cart();
const increaseBttn = document.getElementById("increaseBttn");
const decreaseBttn = document.getElementById("decreaseBttn");
const submitBttn = document.getElementById("submitBttn")

let currentName = '';
let currentPrice = 0;
let ammount = 0;
let currentTag = ''
let inventory = []

updateQuantityDisplay();


fetch('inventory.txt')
  .then(res => res.text())  
  .then(text => {          
    inventory = text.trim().split(/\r?\n/).map(line => {
  const parts = line.split(",");
  const nameRaw = parts[0];
  const priceStrRaw = parts[1];
  const tagsRaw = parts.slice(2);  

  return {
    name: nameRaw.trim(),
    price: parseFloat(priceStrRaw.trim()),
    tags: tagsRaw.map(tag => tag.trim())  
  };
});
    
    if (inventory.length > 0) {
      currentName = inventory[0].name;
      currentPrice = inventory[0].price;
      currentTag = inventory[0].tag;
    }
    setupCategoryButtons();
  }); 

  
function setupCategoryButtons() {
  const categoryLinks = document.querySelectorAll('[data-category]');
  categoryLinks.forEach(link => {
    const tag = link.getAttribute('data-category');
    link.addEventListener("click", event => {
      event.preventDefault(); 
      handleCategoryClick(tag);
    });
  });
}
function renderItems(items) {
  const container = document.getElementById('menu-items-container');
  
  // Clear existing items
  container.innerHTML = '';

  if (items.length === 0) {
    container.textContent = "No items found.";
    return;
  }

  // Create and append elements for each item
  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('menu-item'); // add a class for styling
    
    // Build item content — name and price for example
    itemDiv.textContent = `${item.name} - $${item.price.toFixed(2)}`;
    
    container.appendChild(itemDiv);
  });
}
function renderAllItemsByFirstTag() {
  const container = document.getElementById('menu-items-container');
  container.innerHTML = '';

  // Define the order explicitly
  const categoryOrder = [
    "Popular",
    "Specials",
    "Noodles",
    "Rice",
    "StirFry",
    "Soup",
    "Congee",
    "Sides",
    "Desserts",
    "Beverages"
  ];

  // Group items by first tag
  const groups = {};
  inventory.forEach(item => {
    const firstTag = item.tags[0];
    if (!groups[firstTag]) {
      groups[firstTag] = [];
    }
    groups[firstTag].push(item);
  });

  // Render groups in order
  categoryOrder.forEach(tag => {
    if (groups[tag]) {
      const section = document.createElement('section');
      section.classList.add('menu-group');

      const header = document.createElement('h2');
      header.textContent = tag;
      section.appendChild(header);

      groups[tag].forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('menu-item');
        itemDiv.textContent = `${item.name} - $${item.price.toFixed(2)}`;
        section.appendChild(itemDiv);
      });

      container.appendChild(section);
    }
  });
}


function handleCategoryClick(tag) {
  if (tag === 'All') {
    renderAllItemsByFirstTag();
  } else {
    const sorted = mergeSort(inventory, item => item.price);
    const filtered = filterBy(tag, sorted);
    renderItems(filtered);
  }
}

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

});



