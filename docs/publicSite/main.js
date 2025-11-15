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
export { db, firebaseConfig };

export function updateCartQuantityDisplay(cart) {
    const cartQuantityDisplay = document.getElementById('cartQuantityDisplay');
    if(cartQuantityDisplay) cartQuantityDisplay.textContent = cart.cartLength(); 
  }

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
    
  // Checking if a cart already exists
  if (savedCartStr) {
      const savedCartItems = JSON.parse(savedCartStr);
      cart.loadFromStorage(savedCartItems);
  }
  updateCartQuantityDisplay(cart); 

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
          category: data.category_english || "Misc",
          tags: [data.category_english, ...(data.tags?.map(t => t.type) || [])],
          options: data.options || [],
          addOns: data.addOns || [],
          pricing: data.pricing || [],
        };
      });

      

      if (menuInventory.length > 0) {
        setupCategoryButtons();
        handleCategoryClick('All');
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
    itemImg.loading = 'lazy'; 
    if (item.image) {
        itemImg.src = 'graphics/' + item.image;
        itemImg.alt = item.name;
    } else {
      const categoryFileName = item.category.replace(/ \/ /g, '-');
      console.log(`Fallback for category: "[${item.category}]"`); 
      itemImg.src = `graphics/category_fallback/${categoryFileName}.png`; 
      itemImg.alt = `A placeholder image for the ${item.category} category`
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
    "Sides", 
    "Congee",
    "Fried Noodle",
    "Rice", 
    "Soup / Noodles", 
    "Stir Fry",
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
    console.log(`Category: "${displayCategory}" | Found ${filteredItems.length} items.`);
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
  // currentPrice will be set by the radio buttons
  amount = 1;
  updateQuantityDisplay();
  let basePrice = 0;
  let addOnPrice = 0;
  // --- GET HTML ELEMENTS ---
  const title = document.getElementById('customize-title');
  const chineseTitle = document.getElementById('customize-chinese-title');
  const optionsContainer = document.getElementById('customOptions');
  const defaultPrice = document.getElementById('default-price');
  const modalImage = document.getElementById('modal-image');
  const orderNotesTextarea = document.getElementById('order-notes');
  const scrollArea = document.getElementById('modal-scroll-area');

  // --- RESET AND POPULATE MODAL ---
  title.textContent = item.name;
  chineseTitle.textContent = item.name_chinese;
  optionsContainer.innerHTML = ''; // Clear old options
  defaultPrice.textContent = ''; // Clear the old default price

  if (orderNotesTextarea) {
      orderNotesTextarea.value = '';
  }

  // --- HANDLE THE IMAGE ---
  if (item.image) {
    modalImage.src = 'graphics/' + item.image;
    modalImage.alt = item.name;
  } else {
    const categoryFileName = item.category.replace(/ \/ /g, '-');
    modalImage.src = `graphics/category_fallback/${categoryFileName}.png`; 
    modalImage.alt = `A placeholder image for the ${item.category} category`
  }
  modalImage.style.display = 'block';
  const updateTotalPrice = () => {
    currentPrice = basePrice + addOnPrice;
    // This function should update the 'Add to Cart' button's price display
    updateCartButtonPrice(); 
  };
  // --- HANDLE PRICING (SIZES / TEMPERATURES) ---
  if (item.pricing.length === 1) {
    // If there's only one price, display it and set it
    defaultPrice.textContent = "$ " + item.pricing[0].price.toFixed(2);
    basePrice = item.pricing[0].price;

  } else if (item.pricing && item.pricing.length > 0) {
    const pricingGroup = document.createElement('div');
    pricingGroup.className = 'option-group';
    
    // --- FIX: Determine the type of option (Size or Temperature) ---
    let optionTypeKey = 'temp'; // Default to 'temp'
    let optionGroupTitle = 'Temperature'; // Default title

    // Check the first pricing option to see if it's based on size
    if (item.pricing[0].size && item.pricing[0].size !== 'default') {
        optionTypeKey = 'size';
        optionGroupTitle = 'Size';
    }

    
    // --- END FIX ---

    const pricingTitle = document.createElement('h4');
    // FIX: Use the dynamic title we just determined
    pricingTitle.textContent = optionGroupTitle;
    pricingGroup.appendChild(pricingTitle);

    item.pricing.forEach(priceOption => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        // FIX: Use the dynamic group title for the name
        radio.name = optionGroupTitle;
        radio.value = priceOption[optionTypeKey]; 
        radio.dataset.price = priceOption.price;

        

        label.appendChild(radio);
        // FIX: Display the correct option value (size or temp) to the user
        label.append(` ${priceOption[optionTypeKey]}`);

          // 2. Then, create and add the styled price span.
          const priceSpan = document.createElement('span');
          priceSpan.className = 'price-modifier'; // Use the same CSS class
          priceSpan.textContent = `($${priceOption.price.toFixed(2)})`;
          label.appendChild(priceSpan); 
                  pricingGroup.appendChild(label);
        });

    pricingGroup.addEventListener('change', (event) => {
        if (event.target.type === 'radio' && event.target.checked) {
            basePrice = parseFloat(event.target.dataset.price);
            updateTotalPrice();
        }
    });

    optionsContainer.appendChild(pricingGroup);
  }

  if (item.addOns && item.addOns.length > 0) {
    item.addOns.forEach(addOnGroupData => {
        const addOnGroup = document.createElement('div');
        addOnGroup.className = 'option-group';

        const addOnTitle = document.createElement('h4');
        addOnTitle.textContent = addOnGroupData.title;
        addOnGroup.appendChild(addOnTitle);

        addOnGroupData.choices.forEach(choice => {
            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = addOnGroupData.title; // Group add-ons
            radio.value = choice.addOnName;
            // Use 0 if price is not specified (free add-on)
            radio.dataset.price = choice.price || 0; 

            label.appendChild(radio);

            label.append(` ${choice.addOnName}`);

            // 2. If there's a price, create a separate span for it.
            if (choice.price && choice.price > 0) {
                const priceSpan = document.createElement('span');
                priceSpan.className = 'price-modifier'; // Apply our new CSS class
                priceSpan.textContent = `(+$${choice.price.toFixed(2)})`;
                label.appendChild(priceSpan); // Add the styled span to the label
            }
            addOnGroup.appendChild(label);
        });

        // Add an event listener to this specific group
        addOnGroup.addEventListener('change', (event) => {
            if (event.target.type === 'radio' && event.target.checked) {
                // When an add-on is selected, update the addOnPrice and recalculate total
                // This assumes only one add-on group for now, but can be expanded
                addOnPrice = parseFloat(event.target.dataset.price);
                updateTotalPrice();
            }
        });

        optionsContainer.appendChild(addOnGroup);
    });
  }
  updateTotalPrice();
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
        label.appendChild(radio);
        label.append(` ${choice}`);
        optionGroup.appendChild(label);
      });
      optionsContainer.appendChild(optionGroup);
    });
    
}


  updateCartButtonPrice(); // Update button with initial price
  customizeModal.classList.remove('hidden');
  requestAnimationFrame(() => {
    if (scrollArea) {
      scrollArea.scrollTop = 0;
    }
  });
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
  if (submitBttn) {
  submitBttn.addEventListener("click", () => {
    if (amount <= 0 || !currentItem) {
      return; 
    }

    // --- First, remove any old error messages from the previous attempt ---
    const oldErrors = document.querySelectorAll('#customOptions .validation-error');
    oldErrors.forEach(error => error.remove());

    const customizations = {};
    const optionGroups = document.querySelectorAll('#customOptions .option-group');
    let isFormValid = true; 
    
    // --- NEW: Variable to store a reference to the first error element ---
    let firstErrorElement = null;

    // --- VALIDATION AND DATA GATHERING LOOP ---
    optionGroups.forEach(group => {
      const titleElement = group.querySelector('h4');
      const groupTitle = titleElement.textContent;
      const selectedOption = group.querySelector('input[type="radio"]:checked');
      
      if (selectedOption) {
        // A selection was made for this group.
        customizations[groupTitle] = selectedOption.value;
      } else {
        // NO selection was made, the form is invalid.
        isFormValid = false; 
        
        // --- Create and insert the error message div ---
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error'; // Apply our CSS style
        errorDiv.textContent = 'You must select an option.';
        
        titleElement.insertAdjacentElement('afterend', errorDiv);
        
        // --- NEW: If this is the first error we've found, save it for scrolling ---
        if (!firstErrorElement) {
          firstErrorElement = errorDiv;
        }
      }
    });

    // --- MODIFIED: STOP AND SCROLL IF VALIDATION FAILED ---
    if (!isFormValid) {
      // Check if we have an element to scroll to
      if (firstErrorElement) {
        // Scroll that first error into the user's view
        firstErrorElement.scrollIntoView({
          behavior: 'smooth', // Use a smooth animation
          block: 'center'     // Try to center the error vertically
        });
      }
      return; // Stop the function here.
    }

    // --- If we get here, the form was valid. Proceed as normal. ---
    const orderNotes = document.getElementById('order-notes').value.trim();
    if (orderNotes) {
      customizations['Special Instructions'] = orderNotes;
    }

    cart.addItem(currentItem.name, currentItem.name_chinese, currentItem.id, currentPrice, amount, customizations);
    localStorage.setItem('cart', JSON.stringify(cart.getItems()));
    
    updateCartQuantityDisplay(cart);
    closeCustomizeModal();
  });
}


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


  document.getElementById('close-modal')?.addEventListener('click', closeCustomizeModal);
  if(customizeModal) customizeModal.addEventListener('click', (e) => {
      if (e.target === customizeModal) closeCustomizeModal();
  });

});
