// main.js

// --- Import functions from your existing files ---
import { Cart } from './cart.js';  
import { mergeSort, filterBy } from './algorithms.js';

// --- Import the V9 Firebase modules ---
// We will import directly from the Firebase CDN for simplicity
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- STEP 1: ADD YOUR FIREBASE CONFIGURATION HERE ---
// Replace with your actual config object from the Firebase console
const firebaseConfig = {
  apiKey: "AIzaSyAd-LuABfQtKfugGXYY20_S1uwwyNV6ZVw",
  authDomain: "star-chef-restaurant.firebaseapp.com",
  projectId: "star-chef-restaurant",
  storageBucket: "star-chef-restaurant.firebasestorage.app",
  messagingSenderId: "924721320321",
  appId: "1:924721320321:web:41644950fe66ee58eed880",
  measurementId: "G-BKD21L9889"
};


// --- Initialize Firebase and Firestore ---
let db; // Declare db here in the global scope
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app); // Assign the database connection to the global db variable
  console.log("Firebase Initialized Successfully!");
} catch (error) {
  console.error("Error initializing Firebase:", error);
  const container = document.getElementById('menu-items-container');
  if(container) container.innerHTML = "<h1>Error: Could not connect to the menu database.</h1>";
}
export { db };

// --- Main Application Logic ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM content loaded. Starting application.");
  // --- Get references to all necessary DOM elements ---
  const cart = new Cart();
  const increaseBttn = document.getElementById("increaseBttn");
  const decreaseBttn = document.getElementById("decreaseBttn");
  const submitBttn = document.getElementById("submitBttn");
  const customizeModal = document.getElementById('customize');
  const modalContent = document.querySelector('.modal-content');
  const menuContainer = document.getElementById('menu-items-container');
  const cartButton = document.querySelector('.cart-button');
  // --- State variables ---
  let currentItem = null; // Store the whole item object
  let currentPrice = 0;
  let amount = 0;
  let menuInventory = [];
  const savedCartStr = localStorage.getItem('cart');
    
    
  if (savedCartStr) {
      const savedCartItems = JSON.parse(savedCartStr);
      cart.loadFromStorage(savedCartItems);
  }
  updateCartQuantityDisplay(); 

  if(modalContent) modalContent.addEventListener('click', (e) => e.stopPropagation());

  // --- Fetch data from Firebase ---
  async function fetchMenuData() {
    if (!menuContainer) {
      console.log("Not on menu page, skipping menu data fetch.");
      return;
    }
    console.log("Attempting to fetch menu data from Firestore...");
    if (!db) {
        console.error("Firestore database is not available.");
        return;
    }
    try {
      const menuCollectionRef = collection(db, 'menuItems');
      const querySnapshot = await getDocs(menuCollectionRef);
      console.log(`Found ${querySnapshot.docs.length} documents in Firestore.`);

      menuInventory = querySnapshot.docs.map(doc => {
        const data = doc.data();
        
        // --- Data Validation and Transformation (Important!) ---
        // This prevents errors if a document has missing fields.
        return {
          id: doc.id,
          name: data.name_english || "Unnamed Item",
          price: data.pricing?.[0]?.price || 0.00, // Safely access nested price
          tags: [data.category_english, ...(data.tags?.map(t => t.type) || [])],
          options: data.options || [],
          pricing: data.pricing || [],
        };
      });

      

      if (menuInventory.length > 0) {
        setupCategoryButtons();
        handleCategoryClick('All');
      } else {
        menuContainer.innerHTML = "<h2>Menu is currently empty.</h2>";
      }
    } catch (error) {
      console.error("Error fetching menu data from Firestore:", error);
      menuContainer.innerHTML = "<h1>Error loading menu. Please try again later.</h1>";
    }
  }

  // --- Start fetching the data ---
  fetchMenuData();

  // --- Rendering Logic (largely the same as before) ---
  
  function setupCategoryButtons() {
    document.querySelectorAll('[data-category]').forEach(link => {
      link.addEventListener("click", event => {
        event.preventDefault(); 
        handleCategoryClick(link.dataset.category);
      });
    });
  }

  function handleCategoryClick(tag) {
    console.log(`Category clicked: ${tag}`);
    const activeLink = document.querySelector('.menu-nav a.active');
    if (activeLink) activeLink.classList.remove('active');
    const newActiveLink = document.querySelector(`[data-category="${tag}"]`);
    if (newActiveLink) newActiveLink.classList.add('active');

    if (tag === 'All') {
      renderAllItemsByCategory();
    } else {
      const sorted = mergeSort(menuInventory, item => item.price);
      // Ensure filterBy is case-insensitive
      const filtered = filterBy(tag.toLowerCase(), sorted.map(item => ({...item, tags: item.tags.map(t => t.toLowerCase())})));
      renderItems(filtered);
    }
  }

  function createMenuItemElement(item) {
    const itemEl = document.createElement('li');
    itemEl.classList.add('menu-item');
  
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = `${item.name} - $${item.price.toFixed(2)}`;
  
    link.addEventListener('click', e => {
      e.preventDefault();
      openCustomizeModal(item);
    });
  
    itemEl.appendChild(link);
    return itemEl;
  }
  
  function renderItems(items) {
    if (!menuContainer) return;
    menuContainer.innerHTML = '';
    const list = document.createElement('ul');
    items.forEach(item => list.appendChild(createMenuItemElement(item)));
    menuContainer.appendChild(list);
  }
  
  // main.js - FINAL REPLACEMENT FUNCTION

function renderAllItemsByCategory() {
  if (!menuContainer) return;
  menuContainer.innerHTML = ''; // Clear the container first

  // Human-readable display order. The case here is for display only.
  const categoryOrder = [
    "Popular", 
    "Specials", 
    "StirFry",
    "Fried Noodle", // Matches your data "FRIED NOODLE"
    "Rice", 
    "Soup / Noodles", // We will combine SOUP and SOUP NOODLE here
    "Congee", 
    "Sides", 
    "Desserts", 
    "Beverages"
  ];
  
  // Group all items by their primary category, STANDARDIZING TO UPPERCASE.
  const groups = menuInventory.reduce((acc, item) => {
    let category = item.tags[0] ? item.tags[0].trim().toUpperCase() : 'OTHER';
    
    // Combine SOUP and SOUP NOODLE into one group for cleaner display
    if (category === 'SOUP' || category === 'SOUP NOODLE') {
        category = 'SOUP / NOODLES';
    }

    if (!acc[category]) {
      acc[category] = [];
    }
    
    acc[category].push(item);
    return acc;
  }, {});

  console.log("Grouped items by standardized category:", groups);

  // Loop through our display order and look for matches in our standardized groups.
  categoryOrder.forEach(displayCategory => {
    // Standardize the display category to UPPERCASE for the lookup
    const lookupKey = displayCategory.toUpperCase();

    if (groups[lookupKey] && groups[lookupKey].length > 0) {
      const section = document.createElement('section');
      section.classList.add('menu-group');
      
      const header = document.createElement('h2');
      header.textContent = displayCategory; // Use the nicely formatted name for the header
      section.appendChild(header);
      
      const list = document.createElement('ul');
      groups[lookupKey].sort((a, b) => a.name.localeCompare(b.name));

      groups[lookupKey].forEach(item => {
        list.appendChild(createMenuItemElement(item));
      });
      
      section.appendChild(list);
      menuContainer.appendChild(section);
    }
  });
}
  
  // --- Modal and Cart Logic ---
  // (Your existing modal and cart logic can go here)
  // I have included the fixed version from the previous step.

  function openCustomizeModal(item) {
    console.log("Opening modal for item:", item);
    currentItem = item;
    currentPrice = item.price; 
    amount = 1; 
    updateQuantityDisplay();
    
    const title = document.getElementById('customize-title');
    const optionsContainer = document.getElementById('customOptions');
    const defaultPrice = document.getElementById('default-price');

    defaultPrice.textContent = ("$ " + item.price);
    title.textContent = item.name;
    optionsContainer.innerHTML = '';
    
    if (item.pricing.length === 1) {
      currentPrice = item.pricing[0].price;
    }
    else if (item.pricing && item.pricing.length > 0) {
      const pricingGroup = document.createElement('div');
      pricingGroup.className = 'option-group';
      const pricingTitle = document.createElement('h4');
      pricingTitle.textContent = "Size";
      pricingGroup.appendChild(pricingTitle);

      item.pricing.forEach((p, index) => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'priceOption';
        radio.value = p.size; // store the size name

        if (index === 0) {
          radio.checked = true;
          currentPrice = p.price; // price is a number
        }

        radio.addEventListener('change', () => {
          currentPrice = p.price; // update the price when selected
          updateCartButtonPrice();
        });

        label.appendChild(radio);
        label.append(` ${p.size} - $${p.price.toFixed(2)}`);
        pricingGroup.appendChild(label);
      });

      optionsContainer.appendChild(pricingGroup);
    }
    
    if (item.options && item.options.length > 0) {
      item.options.forEach(opt => {
        const optionGroup = document.createElement('div');
        optionGroup.className = 'option-group';
        const optionTitle = document.createElement('h4');
        optionTitle.textContent = opt.title;
        optionGroup.appendChild(optionTitle);
        opt.choices.forEach((choice, index) => {
          const label = document.createElement('label');
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = opt.title;
          radio.value = choice;
          if (index === 0) radio.checked = true;
          label.appendChild(radio);
          label.append(` ${choice}`);
          optionGroup.appendChild(label);
        });
        optionsContainer.appendChild(optionGroup);
      });
    }
    
    updateCartButtonPrice();
    customizeModal.classList.remove('hidden');
  }

  function updateCartButtonPrice() {
    if(submitBttn) submitBttn.textContent = `ADD TO CART - $${(currentPrice * amount).toFixed(2)}`;
  }

  if(increaseBttn) increaseBttn.addEventListener("click", () => {
    amount++;
    updateCartButtonPrice();
    updateQuantityDisplay();
  });
  
  if(decreaseBttn) decreaseBttn.addEventListener("click", () => {
    if (amount > 1) amount--; // Don't let amount go below 1 in the modal
    updateCartButtonPrice();
    updateQuantityDisplay();
  });
  
  if(submitBttn) submitBttn.addEventListener("click", () => {
    if (amount > 0 && currentItem) {  
      const customizations = {};
      // Find all the option groups within the modal
      const optionGroups = document.querySelectorAll('#customOptions .option-group');

      optionGroups.forEach(group => {
        // Find the title (h4) of the group
        const groupTitle = group.querySelector('h4').textContent;
        // Find the checked radio button WITHIN that group
        const selectedOption = group.querySelector('input[type="radio"]:checked');
        
        if (selectedOption) {
            // Store the selected value using the group title as the key
            customizations[groupTitle] = selectedOption.value;
        }
      });
      
      console.log("User's full customization choices:", customizations);
      cart.addItem(currentItem.name, currentItem.id, currentPrice, amount, customizations);
      console.log(`${amount} of ${currentItem.name} added to cart.`);
      localStorage.setItem('cart', JSON.stringify(cart.getItems()));
      
      updateCartQuantityDisplay()
    }
    closeCustomizeModal();

});
  if (cartButton) {
    cartButton.addEventListener('click', () => {
      window.location.href = 'checkout.html'; // Change to your cart page filename
    });
  }
  function closeCustomizeModal() {
    if(customizeModal) customizeModal.classList.add('hidden');
  }
  
  function updateQuantityDisplay() {
    const quantityDisplay = document.getElementById('quantity-display');
    if(quantityDisplay) quantityDisplay.textContent = amount; 
  }

  function updateCartQuantityDisplay() {
    const cartQuantityDisplay = document.getElementById('cartQuantityDisplay');
    if(cartQuantityDisplay) cartQuantityDisplay.textContent = cart.cartLength(); 
  }

  document.getElementById('close-modal')?.addEventListener('click', closeCustomizeModal);
  if(customizeModal) customizeModal.addEventListener('click', (e) => {
      if (e.target === customizeModal) closeCustomizeModal();
  });

});
