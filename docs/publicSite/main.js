import { Cart } from './cart.js';  
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js";



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
enableIndexedDbPersistence(db)
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          console.warn('Firebase persistence enabled in another tab already.');
      } else if (err.code == 'unimplemented') {
          console.warn('Current browser does not support persistence.');
      }
  });


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
  const menuNavSlider = document.getElementById('menuNav');
  
  // --- State variables ---
  let currentItem = null; // Store the whole item object
  let currentPrice = 0;
  let amount = 0;
  let menuInventory = [];
  const savedCartStr = localStorage.getItem('cart');
    

  function handleCartUpdate() {
    console.log("🔄 Cart Update Event Detected - Syncing UI...");

    // A. Re-load data from storage to ensure we have the latest version
    const freshItems = JSON.parse(localStorage.getItem('cart')) || [];
    cart.loadFromStorage(freshItems); 

    // B. Update the Red Badge
    updateCartQuantityDisplay(cart);

    // C. Update the Sidebar Preview HTML
    if (typeof renderSidebarCart === "function") {
        renderSidebarCart();
    }

    // D. Update Checkout HTML (If we are on the checkout page)
    // Assuming your checkout render function is named 'renderCartItems'
    if (typeof renderCartItems === "function") {
        renderCartItems();
    }
    
    // E. Update Checkout Totals (If function exists)
    if (typeof updateTotals === "function") {
        updateTotals();
    }
}

// 2. LISTEN FOR THE EVENT
// This listens for our custom 'cartUpdated' signal
window.addEventListener('cartUpdated', handleCartUpdate);

// Also listen for 'storage' events (fixes sync if you have multiple tabs open)
window.addEventListener('storage', () => {
    handleCartUpdate();
});
  // Checking if a cart already exists
  if (savedCartStr) {
      const savedCartItems = JSON.parse(savedCartStr);
      cart.loadFromStorage(savedCartItems);
  }
  updateCartQuantityDisplay(cart); 

  if(modalContent) modalContent.addEventListener('click', (e) => e.stopPropagation());

// --- Optimized Fetch Logic ---
// --- ROBUST FETCH: HANDLES WRAPPERS & NAME MAPPING ---
async function fetchMenuData() {
    if (!menuContainer) return;

    try {
        console.log("Loading complex menu.json...");
        const response = await fetch('./menu.json');
        
        if (!response.ok) throw new Error("menu.json not found");

        const rawData = await response.json();
        let flatList = [];
        let categoryGroups = [];

        // --- STEP 1: DETECT STRUCTURE ---
        if (Array.isArray(rawData)) {
            categoryGroups = rawData;
        } 
        else if (rawData.menu && Array.isArray(rawData.menu)) {
            categoryGroups = rawData.menu;
        }
        else if (rawData.categories && Array.isArray(rawData.categories)) {
            categoryGroups = rawData.categories;
        }
        else if (rawData.items && Array.isArray(rawData.items)) {
            categoryGroups = [rawData];
        } 
        else {
            const values = Object.values(rawData);
            if (values.length > 0 && Array.isArray(values[0])) {
                 categoryGroups = values[0];
            } else {
                 categoryGroups = values;
            }
        }

        console.log(`Structure detection found ${categoryGroups.length} category groups.`);

        // --- STEP 2: FLATTEN DATA ---
        categoryGroups.forEach(group => {
            const catName = group.category_name_english || group.category_name_chinese || "Misc";

            if (group.items && Array.isArray(group.items)) {
                group.items.forEach(item => {
                    // A. Ensure ID
                    if (!item.id) item.id = `${catName}_${Math.random().toString(36).substr(2, 9)}`;

                    // B. Ensure Tags
                    if (!item.tags) item.tags = [];

                    // C. Auto-Tag Category
                    const alreadyTagged = item.tags.some(t => t.type && t.type.toLowerCase() === catName.toLowerCase());
                    if (!alreadyTagged) {
                        item.tags.push({ type: catName });
                    }

                    // D. Set property
                    item.category = catName; 

                    // E. Ensure Chinese Name exists
                    if (!item.name_chinese) item.name_chinese = "";

                    // --- F. FIX: MAP 'name_english' TO 'name' ---
                    // This prevents the sort crash
                    if (!item.name) {
                        item.name = item.name_english || item.name_chinese || "Unnamed Item";
                    }

                    // G. Add to list
                    flatList.push(item);
                });
            }
        });

        console.log(`Successfully flattened ${flatList.length} items.`);
        menuInventory = flatList;

        // --- STEP 3: OPTIONAL FIRESTORE STATUS CHECK ---
        if (db) {
            try {
                const metadataRef = doc(db, "metadata", "menuInfo"); 
                const metadataSnap = await getDoc(metadataRef);
                
                if (metadataSnap.exists()) {
                    const data = metadataSnap.data();
                    const soldOutMap = data.soldOut || {};
                    
                    menuInventory.forEach(item => {
                        if (soldOutMap[item.id] === true) {
                            item.isSoldOut = true; 
                        }
                    });
                }
            } catch (e) {
                console.warn("Could not check inventory status.", e);
            }
        }

        // --- STEP 4: RENDER ---
        // Now this works because every item is guaranteed to have a .name property
        menuInventory.sort((a, b) => a.name.localeCompare(b.name));
        
        initMenu();

    } catch (error) {
        console.error("Error parsing menu:", error);
        
        // Fallback
        const cachedMenu = localStorage.getItem('menuData');
        if (cachedMenu) {
            menuInventory = JSON.parse(cachedMenu);
            initMenu();
        } else {
            menuContainer.innerHTML = "<h1>Error loading menu data.</h1>";
        }
    }
}

// Helper function to initialize the UI (prevents code duplication)
function initMenu() {
    if (menuInventory.length > 0) {
        setupCategoryButtons();
        handleCategoryClick('All');
    }
}
  // --- Start fetching the data ---
  if (menuContainer) {
      fetchMenuData();
  }

  
  // --- Rendering Logic ---
  
  function setupCategoryButtons() {
    const scrollContainer = document.querySelector('.parallax-container') || window;

    document.querySelectorAll('[data-category]').forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            event.stopImmediatePropagation();

            // 1. Render items
            handleCategoryClick(link.dataset.category);

            // 2. HARDCODED SCROLL (Phone vs Desktop)
            setTimeout(() => {
                if (scrollContainer) {
                    scrollContainer.scrollTo({
                        // clientHeight of the container is exactly equal to 100vh
                        top: scrollContainer.clientHeight -30, 
                        behavior: 'smooth'
                    });
                }
            }, 10);

            // 3. Slider Animation
            const menuNavSlider = document.getElementById('menuNav');
            if (menuNavSlider) {
                const sliderWidth = menuNavSlider.offsetWidth;
                const linkListItem = link.parentElement;
                const targetScrollLeft = linkListItem.offsetLeft + (linkListItem.offsetWidth / 2) - (sliderWidth / 2);
                menuNavSlider.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
            }
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
    renderSingleCategory(tag);
  }
}

// --- In main.js ---
function createMenuItemElement(item) {
    const MODIFIERS = {
        spicy: { iconFile: 'svg/pepper.svg', title: 'Spicy' },
        cold: { iconFile: 'svg/snowflake.svg', title: 'Cold/Iced' },
        nuts: { iconFile: 'svg/peanut.svg', title: 'Peanuts' }
    };

    const link = document.createElement('a');
    link.href = '#';
    link.classList.add('item-container-link');

    // Sold Out Visuals
    if (item.isSoldOut) {
        link.style.pointerEvents = 'none';
        link.style.opacity = '0.6';
        link.style.filter = 'grayscale(100%)'; 
    }

    const itemContainer = document.createElement('div');
    itemContainer.classList.add('item-container');

    const itemInfo = document.createElement('div');
    itemInfo.classList.add("item-info");

    const itemNameDiv = document.createElement('div');
    itemNameDiv.classList.add("item-name");
    itemNameDiv.textContent = item.isSoldOut ? `${item.name} (Sold Out)` : item.name;

    const itemChineseNameDiv = document.createElement('div');
    itemChineseNameDiv.classList.add("item-name");
    itemChineseNameDiv.textContent = `${item.name_chinese}`;

    // --- FIX: Safely convert tags to lowercase strings ---
    const lowerCaseTags = (item.tags || []).map(tag => {
        const val = (typeof tag === 'object' && tag.type) ? tag.type : tag;
        return val ? val.toLowerCase() : "";
    });

    const itemPriceDiv = document.createElement('div');
    itemPriceDiv.classList.add("item-price");
    // Ensure pricing exists to prevent crash
    const priceDisplay = (item.pricing && item.pricing[0]) ? item.pricing[0].price.toFixed(2) : "0.00";
    itemPriceDiv.textContent = `$${priceDisplay}`;

    const itemImg = document.createElement('img');
    itemImg.classList.add("item-img");
    itemImg.loading = 'lazy'; 
    
    if (item.image) {
        itemImg.src = 'graphics/' + item.image;
        itemImg.alt = item.name;
    } else {
        // Safe fallback for category name
        const catName = item.category || "Misc";
        const categoryFileName = catName.replace(/ \/ /g, '-');
        itemImg.src = `graphics/category_fallback/${categoryFileName}.png`; 
        itemImg.alt = `A placeholder image for the ${catName} category`;
    }

    itemInfo.appendChild(itemNameDiv);
    itemInfo.appendChild(itemChineseNameDiv);
    itemInfo.appendChild(itemPriceDiv);
    
    const modifierContainer = document.createElement('div');
    modifierContainer.classList.add('modifier-container');

    if (lowerCaseTags.includes('popular')) {
        const popularBadge = document.createElement('span');
        popularBadge.textContent = "Popular"; // Literally the word
        popularBadge.classList.add('popular-badge'); // Style class
        modifierContainer.appendChild(popularBadge);
    }

    for (const modifierKey in MODIFIERS) {
        if (lowerCaseTags.includes(modifierKey)) {
            const icon = document.createElement('img');
            icon.classList.add('modifier-icon');
            icon.src = `${MODIFIERS[modifierKey].iconFile}`;
            icon.alt = MODIFIERS[modifierKey].title;
            icon.title = MODIFIERS[modifierKey].title;
            modifierContainer.appendChild(icon);
        }
    }
    if (modifierContainer.hasChildNodes()) {
        itemInfo.appendChild(modifierContainer);
    }

    itemContainer.appendChild(itemInfo);
    itemContainer.appendChild(itemImg);
    link.appendChild(itemContainer);

    if (!item.isSoldOut) {
        link.addEventListener('click', e => {
            e.preventDefault();
            openCustomizeModal(item);
        });
    }

    return link; 
}

// In main.js
function renderAllItemsByCategory() {
  if (!menuContainer) return;
  menuContainer.innerHTML = '';
  const fragment = document.createDocumentFragment();
  // Display order - Ensure these match the "category_name_english" in your JSON exactly
  const categoryOrder = [
    "Popular",      
    "Fish Soup Noodle",        
    "Congee",       
    "Fried Noodle", 
    "Rice",         
    "Soup",         
    "Soup Noodle",  
    "Stir Fry",     
    "Beverages"     
  ];

  categoryOrder.forEach(displayCategory => {
    const lowerCaseCategory = displayCategory.toLowerCase();
    
    // --- FIX: Handle Tags as Objects ({type: "..."}) OR Strings ---
    const filteredItems = menuInventory.filter(item => 
      item.tags && item.tags.some(tag => {
        // Extract the string value regardless of format
        const tagValue = (typeof tag === 'object' && tag.type) ? tag.type : tag;
        return tagValue && tagValue.toLowerCase() === lowerCaseCategory;
      })
    );
    
    if (filteredItems.length > 0) {
      const section = document.createElement('section');
      section.classList.add('menu-group');
      
      const header = document.createElement('h2');
      header.textContent = displayCategory;
      header.classList.add('menu-group-title');
      section.appendChild(header);
      
      const list = document.createElement('ul');
      list.classList.add('item-list-grid');
      
      // Sort items alphabetically within the category
      filteredItems.sort((a, b) => a.name.localeCompare(b.name));
      
      filteredItems.forEach(item => list.appendChild(createMenuItemElement(item)));
      
      section.appendChild(list);
      fragment.appendChild(section);
    }
  });
  menuContainer.appendChild(fragment);
}
function renderSingleCategory(categoryName) {
  if (!menuContainer) return;

  // 1. Clear the container
  menuContainer.innerHTML = '';

  const lowerCaseCategory = categoryName.toLowerCase();
  
  // 2. Filter logic (Updated to handle your complex JSON tags)
  const filteredItems = menuInventory.filter(item => 
    item.tags && item.tags.some(tag => {
        // Handle if tag is a string ("spicy") or an object ({type: "spicy"})
        const tagValue = (typeof tag === 'object' && tag.type) ? tag.type : tag;
        return tagValue && tagValue.toLowerCase() === lowerCaseCategory;
    })
  );

  // 3. Render
  if (filteredItems.length > 0) {
    const fragment = document.createDocumentFragment();

    const section = document.createElement('section');
    section.classList.add('menu-group');

    const header = document.createElement('h2');
    header.textContent = categoryName; 
    header.classList.add('menu-group-title');

    const list = document.createElement('ul');
    list.classList.add('item-list-grid');
    
    // Sort A-Z
    filteredItems.sort((a, b) => a.name.localeCompare(b.name));
    
    filteredItems.forEach(item => list.appendChild(createMenuItemElement(item)));

    section.appendChild(header);
    section.appendChild(list);
    fragment.appendChild(section);
    
    menuContainer.appendChild(fragment);
   
  } else {
    menuContainer.innerHTML = `<p>No items found in the "${categoryName}" category.</p>`;
  }
}
function openCustomizeModal(item) {
  console.log("Opening modal for item:", item);
  currentItem = item;
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
  
  // FIX: Select by CLASS instead of ID, and include fallback
  const scrollArea = document.querySelector('.scroll-area') || document.querySelector('.modal-content');

  let selectedAddOnPrices = {};

  // --- RESET AND POPULATE MODAL ---
  title.textContent = item.name;
  chineseTitle.textContent = item.name_chinese;
  optionsContainer.innerHTML = ''; 
  // Ensure pricing exists
  const displayPrice = (item.pricing && item.pricing[0]) ? item.pricing[0].price : 0;
  defaultPrice.textContent = `$${displayPrice.toFixed(2)}`; 

  if (orderNotesTextarea) {
      orderNotesTextarea.value = '';
  }
  
  // --- (Image and Pricing sections) ---
  if (item.image) {
    modalImage.src = 'graphics/' + item.image;
    modalImage.alt = item.name;
  } else {
    // Safe fallback for category name
    const catName = item.category || "Misc";
    const categoryFileName = catName.replace(/ \/ /g, '-');
    modalImage.src = `graphics/category_fallback/${categoryFileName}.png`; 
    modalImage.alt = `A placeholder image for the ${catName} category`;
  }
  
  // Handle Sold Out visual in modal (Grayscale)
  if (item.isSoldOut) {
      modalImage.style.filter = 'grayscale(100%)';
  } else {
      modalImage.style.filter = 'none';
  }
  modalImage.style.display = 'block';

  const updateTotalPrice = () => {
    currentPrice = basePrice + addOnPrice;
    updateCartButtonPrice(); 
  };
  console.log("version 0.4 - Fix Tags");

  // --- PRICING OPTIONS ---
  if (item.pricing.length === 1) {
    basePrice = item.pricing[0].price;
  } else if (item.pricing && item.pricing.length > 0) {
    const pricingGroup = document.createElement('div');
    pricingGroup.className = 'option-group';
    let optionTypeKey = 'temp'; 
    let optionGroupTitle = 'Temperature';
    
    if (item.pricing[0].size && item.pricing[0].size !== 'default') {
        optionTypeKey = 'size';
        optionGroupTitle = 'Size';
    }
    
    const pricingTitle = document.createElement('h4');
    pricingTitle.textContent = optionGroupTitle;
    pricingGroup.appendChild(pricingTitle);
    
    item.pricing.forEach((priceOption,index) => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio'; radio.name = optionGroupTitle;
        radio.value = priceOption[optionTypeKey]; radio.dataset.price = priceOption.price;
        if (index === 0) {
  
            basePrice = priceOption.price; 
        }
        label.appendChild(radio);
        label.append(` ${priceOption[optionTypeKey]}`);
        const priceSpan = document.createElement('span');
        priceSpan.className = 'price-modifier'; priceSpan.textContent = `($${priceOption.price.toFixed(2)})`;
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

  // --- HANDLE ADD-ONS ---
  if (item.addOns && item.addOns.length > 0) {
    
    // --- FIX: Safely check for 'combo' tag ---
    const isComboItem = item.tags && item.tags.some(tag => {
        const val = (typeof tag === 'object' && tag.type) ? tag.type : tag;
        return val && val.toLowerCase() === 'combo';
    });

    item.addOns.forEach(addOnGroupData => {
        const addOnGroup = document.createElement('div');
        addOnGroup.className = 'option-group';

        let headerContainer;
        let optionsListContainer;
        const addOnTitle = document.createElement('h4');
        addOnTitle.textContent = addOnGroupData.title;

        if (isComboItem) {
            addOnGroup.classList.add('is-accordion');
            headerContainer = document.createElement('div');
            headerContainer.className = 'accordion-header';
            const toggleIcon = document.createElement('span');
            toggleIcon.className = 'accordion-toggle-icon';
            const titleGroup = document.createElement('div');
            titleGroup.className = 'accordion-title-group';
            titleGroup.appendChild(addOnTitle);

            const freeLimit = addOnGroupData.freeToppingLimit;
            const postLimitPrice = addOnGroupData.postLimitPrice;
            const limit = addOnGroupData.limit;
            const limitTextDisplay = document.createElement('div');
            limitTextDisplay.className = 'extra-cost-display'; 
            titleGroup.appendChild(limitTextDisplay);

            if (limit !== undefined) {
                limitTextDisplay.textContent = `Select up to ${limit}.`;
            } else if (limit === undefined && freeLimit === undefined) {
              limitTextDisplay.textContent = `Select up to 1.`;
            } else {
              limitTextDisplay.textContent = `Select at least ${freeLimit}.`;
              const extraCostDisplay = document.createElement('div');
              extraCostDisplay.className = 'extra-cost-display';
              extraCostDisplay.id = 'extaCostHighlight'
              extraCostDisplay.textContent = `+$${postLimitPrice ? postLimitPrice.toFixed(2) : "0.00"} for additional selections.`;
              titleGroup.appendChild(extraCostDisplay);
            }

            headerContainer.appendChild(titleGroup);
            headerContainer.appendChild(toggleIcon);
            
            optionsListContainer = document.createElement('div');
            optionsListContainer.className = 'accordion-content';

            headerContainer.addEventListener('click', () => {
                const allAccordions = optionsContainer.querySelectorAll('.option-group.is-accordion');
                allAccordions.forEach(acc => {
                    if (acc !== addOnGroup) {
                        acc.classList.remove('is-open');
                    }
                });
                addOnGroup.classList.toggle('is-open');
            });
            
            addOnGroup.appendChild(headerContainer);
            addOnGroup.appendChild(optionsListContainer); 

        } else {
            // Standard View
            headerContainer = addOnGroup; 
            optionsListContainer = addOnGroup; 
            headerContainer.appendChild(addOnTitle);

            const limit = addOnGroupData.limit;
            if (limit !== undefined) {
                const limitTextDisplay = document.createElement('div');
                limitTextDisplay.className = 'extra-cost-display';
                limitTextDisplay.textContent = `Maximum choice of ${limit}.`;
                optionsListContainer.appendChild(limitTextDisplay);
            }
        }
        
        if (addOnGroupData.freeToppingLimit) {
            addOnGroup.dataset.freeLimit = addOnGroupData.freeToppingLimit;
        }

        const inputType = addOnGroupData.multiSelect ? 'checkbox' : 'radio';
        addOnGroupData.choices.forEach(choice => {
            const choiceName = (typeof choice === 'object') ? choice.addOnName : choice;
            const freeLimit = addOnGroupData.freeToppingLimit;
            const choicePrice = (freeLimit !== undefined) ? 0 : ((typeof choice === 'object' && choice.price) ? choice.price : 0);
            
            const label = document.createElement('label');
            const input = document.createElement('input');
            
            input.type = inputType; 
            input.name = addOnGroupData.title;
            input.value = choiceName;
            input.dataset.price = choicePrice;

            label.appendChild(input);
            label.append(` ${choiceName}`);

            if (choicePrice > 0) {
                const priceSpan = document.createElement('span');
                priceSpan.className = 'price-modifier';
                priceSpan.textContent = `(+$${choicePrice.toFixed(2)})`;
                label.appendChild(priceSpan);
            }
            optionsListContainer.appendChild(label);
        });

        addOnGroup.addEventListener('change', (event) => {
            const input = event.target;
            const groupTitle = input.name;
            const groupElement = input.closest('.option-group');
            const limit = addOnGroupData.limit;
            
            if (input.type === 'checkbox' && limit !== undefined) {
                const checkedCount = groupElement.querySelectorAll('input[type="checkbox"]:checked').length;
                let errorElement = groupElement.querySelector('.limit-error');
                if (!errorElement) {
                    errorElement = document.createElement('div');
                    errorElement.className = 'limit-error';
                    const header = groupElement.querySelector('h4') || groupElement.querySelector('.accordion-header');
                    if (header) {
                        header.insertAdjacentElement('afterend', errorElement);
                    }
                }
                
                if (checkedCount > limit) {
                    input.checked = false; 
                    errorElement.textContent = `You can only select up to ${limit} items.`;
                    errorElement.style.display = 'block';
                } else {
                    errorElement.style.display = 'none';
                }
            }

            const freeLimit = addOnGroupData.freeToppingLimit;
            const postLimitPrice = addOnGroupData.postLimitPrice;

            if (freeLimit !== undefined && postLimitPrice !== undefined && groupElement) {
                const checkedCount = groupElement.querySelectorAll('input[type="checkbox"]:checked').length;
                const extraItems = Math.max(0, checkedCount - freeLimit);
                const groupPrice = extraItems * postLimitPrice;
                selectedAddOnPrices[groupTitle] = groupPrice;
            } else {
                const price = parseFloat(input.dataset.price);
                if (input.type === 'checkbox') {
                    selectedAddOnPrices[groupTitle] = selectedAddOnPrices[groupTitle] || 0;
                    if (input.checked) {
                        selectedAddOnPrices[groupTitle] += price;
                    } else {
                        selectedAddOnPrices[groupTitle] -= price;
                    }
                } else if (input.type === 'radio') {
                    selectedAddOnPrices[groupTitle] = price;
                }
            }

            addOnPrice = Object.values(selectedAddOnPrices).reduce((sum, current) => sum + current, 0);
            updateTotalPrice();
        });
        
        optionsContainer.appendChild(addOnGroup);
    });
  }

  updateTotalPrice();
  updateCartButtonPrice(); 
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
    if (amount > 1) amount--; 
    updateCartButtonPrice();
    updateQuantityDisplay();
  });

  if (submitBttn) {
  submitBttn.addEventListener("click", () => {
    if (amount <= 0 || !currentItem) {
      return;
    }

    // Clear any old validation errors from a previous click
    const oldErrors = document.querySelectorAll('#customOptions .validation-error');
    oldErrors.forEach(error => error.remove());

    const customizations = {};
    const optionGroups = document.querySelectorAll('#customOptions .option-group');
    let isFormValid = true; 
    let firstErrorElement = null;

    optionGroups.forEach(group => {
      
      const titleElement = group.querySelector('h4');
      if (!titleElement) return; // Skip groups without a title (e.g., pricing)
      const groupTitle = titleElement.textContent.trim();

      let errorMessage = '';

      const radioInputs = group.querySelectorAll('input[type="radio"]');
      const checkboxInputs = group.querySelectorAll('input[type="checkbox"]');
      // --- CASE 1: Handle Radio Button Groups ---
      if (radioInputs.length > 0) {
        
        const selectedRadio = group.querySelector('input[type="radio"]:checked');
        if (selectedRadio) {
          customizations[groupTitle] = selectedRadio.value;
        } else {
          // A radio group is always required
          isFormValid = false;
          errorMessage = 'You must select an option.';
        }
      } 
      // --- CASE 2: Handle ALL Checkbox Groups (Combo and Regular) ---
      else if (checkboxInputs.length > 0) {
        const selectedCheckboxes = group.querySelectorAll('input[type="checkbox"]:checked');
        
        // Validation: Check if a minimum is required (for combos)
        const requiredMinimum = parseInt(group.dataset.freeLimit, 10);
        if (!isNaN(requiredMinimum) && selectedCheckboxes.length < requiredMinimum) {
            isFormValid = false;
            errorMessage = `You must select at least ${requiredMinimum} options.`;
        }
        
        // If any checkboxes are selected (and validation passed), add them.
        // This now correctly captures REGULAR checkbox groups too!
        if (selectedCheckboxes.length > 0) {
            customizations[groupTitle] = Array.from(selectedCheckboxes).map(cb => cb.value);
        }
      }

      // If validation failed for this group, create and display the error message
      if (errorMessage) {
          const errorDiv = document.createElement('div');
          errorDiv.className = 'validation-error';
          errorDiv.textContent = errorMessage;
          titleElement.insertAdjacentElement('afterend', errorDiv);
          
          if (!firstErrorElement) {
              firstErrorElement = errorDiv;
          }
      }
    });

    // If the form is invalid, scroll to the first error and stop.
    if (!isFormValid) {
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return; 
    }

    // --- Form is valid, proceed to add to cart ---
    const orderNotes = document.getElementById('order-notes').value.trim();
    if (orderNotes) {
      customizations['Special Instructions'] = orderNotes;
    }

    // Your cart.addItem call is perfect. It will now receive the correct customizations.
    cart.addItem(currentItem.name, currentItem.name_chinese, currentItem.id, currentPrice, amount, customizations);
    
    window.dispatchEvent(new CustomEvent('cartUpdated'));
    // 2. Fire the Signal! 
    // This tells the Preview and Checkout to update themselves immediately.
setTimeout(() => {
    const toast = document.getElementById('toast-notification');
    if (toast) {
        // Optional: Customize message based on amount
        const itemText = amount > 1 ? `${amount}x ${currentItem.name}` : currentItem.name;
        toast.textContent = `Added ${itemText} to cart`;
        
        // Trigger the slide-up
        toast.classList.add('show');
        toast.classList.remove('hidden');

        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            // Allow animation to finish before hiding completely
            setTimeout(() => toast.classList.add('hidden'), 500); 
        }, 3000);
    }
}, 1300); // <--- 400ms DELAY before toast slides up
// 2. Wait 800ms, then close modal (Keep your existing close logic)
setTimeout(() => {
    closeCustomizeModal();
}, 800);
  });
}


  function closeCustomizeModal() {
  const customizeModal = document.getElementById('customize');
  if(!customizeModal) return;

  // 1. Add the specific class to trigger the CSS Fade Out
  customizeModal.classList.add('closing');

  // 2. Wait for the animation to finish (300ms matches the CSS transition)
  setTimeout(() => {
      // 3. Now actually hide it (display: none) and clean up
      customizeModal.classList.add('hidden');
      customizeModal.classList.remove('closing');
      
      // Optional: Reset scroll position when fully closed so it's at top next time
      const scrollArea = document.querySelector('.scroll-area');
      if(scrollArea) scrollArea.scrollTop = 0;
      
  }, 300); 
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
