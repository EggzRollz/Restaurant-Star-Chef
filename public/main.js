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
export {firebaseConfig};

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
  const menuContainer = document.querySelector('.menu-grid');
  const cartButton = document.querySelector('.cart-button');
  const menuNavSlider = document.getElementById('menuNav');
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
          name_chinese: data.name_chinese || "Unnamed Item",
          image: data.image,
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
        
        // --- NEW: Add the centering logic here ---
        if (menuNavSlider) {
            const sliderWidth = menuNavSlider.offsetWidth;
            // The link is inside an <li>, which is what we need to measure.
            const linkListItem = link.parentElement;
            
            // Calculate the target scroll position to center the clicked list item.
            const targetScrollLeft = linkListItem.offsetLeft + (linkListItem.offsetWidth / 2) - (sliderWidth / 2);
    
            // Animate the scroll
            menuNavSlider.scrollTo({
              left: targetScrollLeft,
              behavior: 'smooth'
            });
        }
        // --- END of new logic ---

        // The original logic continues as before
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
    // This function already creates all the titles, so it's perfect.
    renderAllItemsByCategory();

  } else {
    // For any other category, call our new function that creates a single title.
    renderSingleCategory(tag);

  }
  }

// --- In main.js ---

function createMenuItemElement(item) {
    // 1. DEFINE ALL POSSIBLE MODIFIERS HERE
    // This is our "dictionary". Key is the tag to look for (lowercase).
    // Value is an object with the emoji and the hover-text.
    const MODIFIERS = {
        spicy: { emoji: '🌶️', title: 'Spicy' },
        cold: { emoji: '❄️', title: 'Cold/Iced' },
        popular: { emoji: '⭐', title: 'Popular' }
        // Add more here easily! e.g., gluten-free: { emoji: '🚫🌾', title: 'Gluten-Free'}
    };

    // --- The rest of your function structure ---
    const itemEl = document.createElement('li');
    itemEl.classList.add('menu-item');

    const link = document.createElement('a');
    link.href = '#';
    link.classList.add('item-container-link');

    const itemContainer = document.createElement('div');
    itemContainer.classList.add('item-container');

    const itemInfo = document.createElement('div');
    itemInfo.classList.add("item-info");

    const itemNameDiv = document.createElement('div');
    itemNameDiv.classList.add("item-name");
    itemNameDiv.textContent = `${item.name}`;

    const itemChineseNameDiv = document.createElement('div');
    itemChineseNameDiv.classList.add("item-name");
    itemChineseNameDiv.textContent = `${item.name_chinese}`;

 
    const lowerCaseTags = item.tags.map(tag => tag.toLowerCase());

    

    
    // --- The rest of your function continues as normal ---
    const itemPriceDiv = document.createElement('div');
    itemPriceDiv.classList.add("item-price");
    itemPriceDiv.textContent = `$${item.pricing[0].price.toFixed(2)}`;

    const itemImg = document.createElement('img');
    itemImg.classList.add("item-img");
    if (item.image) {
        itemImg.src = 'graphics/' + item.image;
        itemImg.alt = item.name;
    }


    
    
    // IMPORTANT: We now add the name and price divs to itemInfo
    itemInfo.appendChild(itemNameDiv);
    itemInfo.appendChild(itemChineseNameDiv);
    itemInfo.appendChild(itemPriceDiv);
    for (const modifierKey in MODIFIERS) {
        if (lowerCaseTags.includes(modifierKey)) {
            // If it's a match, create the icon!
            const icon = document.createElement('span');
            icon.classList.add('icon-indicator'); // Use a generic class for all icons
            
            // Get the emoji and title from our dictionary
            icon.textContent = MODIFIERS[modifierKey].emoji;
            icon.title = MODIFIERS[modifierKey].title;
            
            // Add the icon to the name div
            itemInfo.appendChild(icon);
        }
    }
    itemContainer.appendChild(itemInfo);
    itemContainer.appendChild(itemImg);
    link.appendChild(itemContainer);
    itemEl.appendChild(link);

    link.addEventListener('click', e => {
        e.preventDefault();
        openCustomizeModal(item);
    });

    return itemEl;
}
function renderSingleCategory(categoryName) {
  // 1. Get and clear the main container
  if (!menuContainer) return;
  menuContainer.innerHTML = '';

  // --- Filtering Logic (This part is already perfect and doesn't need to change) ---
  let filteredItems;
  const lowerCaseCategory = categoryName.toLowerCase();

  if (lowerCaseCategory === 'soup / noodles') {
    filteredItems = menuInventory.filter(item => {
        const primaryTag = (item.tags[0] || '').toLowerCase();
        return primaryTag === 'soup' || primaryTag === 'soup noodle';
    });
  } else {
    filteredItems = menuInventory.filter(item => 
        item.tags.some(tag => tag.toLowerCase() === lowerCaseCategory)
    );
  }

  // --- Rendering Logic (This is where we make the change) ---
  // Only proceed to render if we actually found items for this category
  if (filteredItems.length > 0) {
      
      // 2. NEW: Create the section wrapper, just like in the 'All Items' function
      const section = document.createElement('section');
      section.classList.add('menu-group');

      // 3. Create the title element
      const header = document.createElement('h2');
      header.textContent = categoryName; 
      header.classList.add('menu-group-title');
      
      

      // 4. Create the list of items
      const list = document.createElement('ul');
      list.classList.add('item-list-grid');
      
      // Sort items for consistency (optional but good practice)
      filteredItems.sort((a, b) => a.name.localeCompare(b.name));

      filteredItems.forEach(item => list.appendChild(createMenuItemElement(item)));

      // 5. NEW: Append the t itle AND list to the new section wrapper
      section.appendChild(header);
      section.appendChild(list);

      // 6. NEW: Finally, append the entire completed section to the main container
      menuContainer.appendChild(section);

  } else {
      // If no items were found, display a message directly in the container
      menuContainer.innerHTML = `<p>No items found in the "${categoryName}" category.</p>`;
  }
}



  
// In main.js

function renderAllItemsByCategory() {
  if (!menuContainer) return;
  menuContainer.innerHTML = ''; // Clear the container first

  // This is our desired display order and the source for our titles.
  const categoryOrder = [
    "Popular", 
    "Specials", 
    "StirFry",
    "Fried Noodle",
    "Rice", 
    "Soup / Noodles",
    "Congee", 
    "Sides", 
    "Desserts", 
    "Beverages"
  ];

  // Loop through each category we want to display.
  categoryOrder.forEach(displayCategory => {
    const lowerCaseCategory = displayCategory.toLowerCase();
    let filteredItems;

    // --- Filtering Logic (similar to renderSingleCategory) ---
    // Handle our special combined category first.
    if (lowerCaseCategory === 'soup / noodles') {
      filteredItems = menuInventory.filter(item => {
          const primaryTag = (item.tags[0] || '').toLowerCase();
          return primaryTag === 'soup' || primaryTag === 'soup noodle';
      });
    } else {
      // For all other categories, check if the tag exists anywhere in the item's tags array.
      filteredItems = menuInventory.filter(item => 
          item.tags.some(tag => tag.toLowerCase() === lowerCaseCategory)
      );
    }

    // --- Rendering Logic ---
    // If we found any items for this category, create the title and the list.
    if (filteredItems.length > 0) {
      const section = document.createElement('section');
      section.classList.add('menu-group');
      
      const header = document.createElement('h2');
      header.textContent = displayCategory; // Use the nicely formatted name
      header.classList.add('menu-group-title');
      section.appendChild(header);
      
      const list = document.createElement('ul');
      list.classList.add('item-list-grid');
      
      // Sort items alphabetically within their category for consistency
      filteredItems.sort((a, b) => a.name.localeCompare(b.name));

      filteredItems.forEach(item => {
        list.appendChild(createMenuItemElement(item));
      });
      
      section.appendChild(list);
      menuContainer.appendChild(section);
    }
  });
}

function openCustomizeModal(item) {
  console.log("Opening modal for item:", item);
  currentItem = item;
  // currentPrice will be set by the radio buttons, so we don't need to set a default here.
  amount = 1;
  updateQuantityDisplay();

  // --- GET HTML ELEMENTS ---
  const title = document.getElementById('customize-title');
  const optionsContainer = document.getElementById('customOptions');
  const defaultPrice = document.getElementById('default-price');
  const modalImage = document.getElementById('modal-image'); // Get the existing <img> element from HTML
  const orderNotesTextarea = document.getElementById('order-notes');

  // --- RESET AND POPULATE MODAL ---
  title.textContent = item.name;
  optionsContainer.innerHTML = ''; // Clear old options
  defaultPrice.textContent = ''; // Clear the old default price, as sizes will show prices

  if (orderNotesTextarea) {
      orderNotesTextarea.value = '';
  }

  // --- HANDLE THE IMAGE --- (The corrected part)
  if (item.image) {
    modalImage.src = 'graphics/' + item.image; // Set the src of the HTML element
    modalImage.alt = item.name; // Set the alt text for accessibility
    modalImage.style.display = 'block'; // Make sure it's visible if it was hidden
  } else {
    modalImage.style.display = 'none'; // Hide the image element if there's no image
  }

  // --- HANDLE PRICING (SIZES) ---
  if (item.pricing.length === 1) {
    // If there's only one price, display it and set it
    defaultPrice.textContent = "$ " + item.pricing[0].price.toFixed(2);
    currentPrice = item.pricing[0].price;
  } else if (item.pricing && item.pricing.length > 0) {
    const pricingGroup = document.createElement('div');
    pricingGroup.className = 'option-group';
    
    const pricingTitle = document.createElement('h4');
    // We assume the title is 'Temperature' for this structure, 
    // but you could make this more dynamic if needed.
    pricingTitle.textContent = 'Temperature'; 
    pricingGroup.appendChild(pricingTitle);

    // This will hold the price of the first option as the default
    let isFirstOption = true; 

    item.pricing.forEach(priceOption => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'Temperature'; // Group them together
        
        // THIS IS THE KEY FIX: Use the 'temp' from your data as the value
        radio.value = priceOption.temp; 
        
        // Store the price in a data attribute for easy access
        radio.dataset.price = priceOption.price;

        // Check the first option by default
        if (isFirstOption) {
            radio.checked = true;
            currentPrice = priceOption.price; // Set the initial price
            isFirstOption = false;
        }

        label.appendChild(radio);
        // Display the temp and price to the user
        label.append(` ${priceOption.temp} ($${priceOption.price.toFixed(2)})`); 
        pricingGroup.appendChild(label);
    });

    // Add an event listener to update the price when the user changes temperature
    pricingGroup.addEventListener('change', (event) => {
        if (event.target.type === 'radio' && event.target.checked) {
            // Get the price from the selected option's data attribute
            currentPrice = parseFloat(event.target.dataset.price);
            updateCartButtonPrice(); // Update the price on the button
        }
    });

    optionsContainer.appendChild(pricingGroup);
}


  // --- HANDLE OTHER OPTIONS ---
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

  updateCartButtonPrice(); // Update button with initial price
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
      
      const orderNotes = document.getElementById('order-notes').value.trim();
      if (orderNotes) {
        customizations['Special Instructions'] = orderNotes;
      }
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
