import { Cart } from './cartFunctions.js';  
import { mergeSort } from './algorithms.js';
import { filterBy } from './algorithms.js';
document.addEventListener("DOMContentLoaded", () => {
const cart = new Cart();
const increaseBttn = document.getElementById("increaseBttn");
const decreaseBttn = document.getElementById("decreaseBttn");
const submitBttn = document.getElementById("submitBttn");
const customize = document.getElementById('customize');
const modalContent = document.querySelector('.modal-content');



let currentName = '';
let currentPrice = 0;
let ammount = 0;
let currentTag = '';
let inventory = [];



modalContent.addEventListener('click', (e) => {
  e.stopPropagation();
});
fetch('inventory.txt')
  .then(res => res.text())  
  .then(text => {         
    inventory = text.trim().split(/\r?\n/).map(line => {
      const parts = line.split(",");
      const name = parts[0].trim();
      const price = parseFloat(parts[1].trim().replace(/^\$/, ''));
      const tags = [];
      const options = {};
      //const img = null;
      
      for(let i = 2; i < parts.length; i++){
        const part = parts[i].trim();
        if (part.includes(':')) {
          const [optName, optValues] = part.split(':');
          options[optName.trim()] = optValues.split('|').map(v => {
          const match = v.match(/(.+?)(\(([\d.]+)\))?$/); // capture name and optional price
          return {
            name: match[1].trim(),
            price: match[3] ? parseFloat(match[3]) : price // fallback to base price
            };
          });
        } else {
            tags.push(part);
          }
        }

        return{
          name, price, tags, options
        };
      });

    if (inventory.length > 0) {
      currentName = inventory[0].name;
      currentPrice = inventory[0].price;
      currentTag = inventory[0].tags[0];
    }
    setupCategoryButtons();
    handleCategoryClick('All');
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

function handleCategoryClick(tag) {
  if (tag === 'All') {
    renderAllItemsByFirstTag();
  } else {
    const sorted = mergeSort(inventory, item => item.price);
    const filtered = filterBy(tag, sorted);
    renderItems(filtered);
  }
}

// Reusable function to create a clickable menu item element
function createMenuItemElement(item) {
  const itemEl = document.createElement('li');
  itemEl.classList.add('menu-item');

  const link = document.createElement('a');
  link.href = '#';
  link.textContent = `${item.name} - $${item.price.toFixed(2)}`;

  link.addEventListener('click', e => {
    e.preventDefault();
    currentName = item.name;
    currentPrice = item.price;
    currentTag = item.tags[0] || '';
    submitBttn.textContent = 'ADD TO CART - $' + (currentPrice * ammount).toFixed(2);

    // TODO: Add customization popup trigger here later
    openCustomizeModal(item);

  });

  itemEl.appendChild(link);
  return itemEl;
}


function renderItems(items) {
  const container = document.getElementById('menu-items-container');
  container.innerHTML = '';

  const list = document.createElement('ul');
  list.id = 'menu-items-list';  // Optional: for styling or debugging

  items.forEach(item => {
    const itemEl = createMenuItemElement(item);
    list.appendChild(itemEl);
  });

  container.appendChild(list);
}

function renderAllItemsByFirstTag() {
  const container = document.getElementById('menu-items-container');
  container.innerHTML = '';

  const categoryOrder = [
    "Popular", "Specials", "Noodles", "Rice", "StirFry",
    "Soup", "Congee", "Sides", "Desserts", "Beverages"
  ];

  const groups = {};
  inventory.forEach(item => {
    const firstTag = item.tags[0];
    if (!groups[firstTag]) groups[firstTag] = [];
    groups[firstTag].push(item);
  });

  categoryOrder.forEach(tag => {
    if (groups[tag]) {
      const section = document.createElement('section');
      section.classList.add('menu-group');

      const header = document.createElement('h2');
      header.textContent = tag;
      section.appendChild(header);

      const list = document.createElement('ul');
      groups[tag].forEach(item => {
        const itemEl = createMenuItemElement(item);
        list.appendChild(itemEl);
      });
      section.appendChild(list);

      container.appendChild(section);
    }
  });
}


// Increase Decre

increaseBttn.addEventListener("click", () => {
  ammount++;
  submitBttn.textContent = 'ADD TO CART - $' + (currentPrice * ammount).toFixed(2);
  updateQuantityDisplay();
});

decreaseBttn.addEventListener("click", () => {
  if (ammount > 0) {
    ammount--;
  }
  submitBttn.textContent = 'ADD TO CART - $' + (currentPrice * ammount).toFixed(2);
  updateQuantityDisplay();
});

function renderCart() {
  // your cart rendering code here
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
    
  });
}


submitBttn.addEventListener("click", () => {
  if (ammount > 0) {
    cart.addItem(currentName, currentPrice, ammount);
    printCartContents();
  }
  ammount = 0;
  updateQuantityDisplay();
  renderCart();
  submitBttn.textContent = 'ADD TO CART - $0.00';
});

function openCustomizeModal(item) {
  currentPrice = item.price;  
  ammount = 0;
  updateQuantityDisplay();
  submitBttn.textContent = 'ADD TO CART - $0.00';
  const title = document.getElementById('customize-title');
  const modal = document.getElementById('modal-content');
  title.textContent = `${item.name}`;
  const optionsContainer = document.getElementById('customOptions');
  title.textContent = item.name;
  optionsContainer.innerHTML = '';
  const modalPrice = document.createElement('div');
  modalPrice.textContent =  `$${item.price.toFixed(2)}`;
  modalPrice.classList.add('modal-price')

  console.log(`${item.name}` + `$${item.price.toFixed(2)}` + item.options["Size"][1].name);
  console.log("here");



  title.appendChild(modalPrice);
  customize.classList.remove('hidden');
}
function closeCustomizeModal() {
  const closeCustomize = document.getElementById('customize');
  closeCustomize.classList.add('hidden');
}
function updateQuantityDisplay() {
  const quantityDisplay = document.getElementById('quantity-display');
  quantityDisplay.textContent = ammount; 
}
document.getElementById('close-modal').addEventListener('click', closeCustomizeModal);
customize.addEventListener('click', () => {
  ammount = 0;
  updateQuantityDisplay()
  closeCustomizeModal();
});


});
