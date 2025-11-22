import { Cart } from './cart.js';  
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, enableIndexedDbPersistence, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
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
          console.log("Persistence failed: Multiple tabs open");
      } else if (err.code == 'unimplemented') {
          console.log("Persistence not available in this browser");
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
async function fetchMenuData() {
    if (!menuContainer) return;
    if (!db) {
        console.error("Firestore database is not available.");
        return;
    }
    try {
        // 1. Check for a server update (Costs 1 Read)
        const metadataRef = doc(db, "metadata", "menuInfo");
        let serverVersion = null;
        
        try {
            const metadataSnap = await getDoc(metadataRef);
            if (metadataSnap.exists()) {
                const data = metadataSnap.data();
                // Convert Firestore Timestamp to milliseconds for comparison
                serverVersion = data.lastUpdated?.toMillis?.() || data.lastUpdated;
            }
        } catch (e) {
            console.warn("Could not fetch metadata, defaulting to full fetch.");
        }
        
        // 2. Check Local Storage
        const localVersion = localStorage.getItem('menuVersion');
        const cachedMenu = localStorage.getItem('menuData');
        
        // 3. If versions match and we have data, USE CACHE (Costs 0 extra Reads)
        if (serverVersion && localVersion === String(serverVersion) && cachedMenu) {
            console.log(`Menu version ${serverVersion} is up to date. Loading from local cache.`);
            try {
                menuInventory = JSON.parse(cachedMenu);
                initMenu(); // Run setup
                return; 
            } catch (e) {
                console.error("Cache parse error, refetching...");
            }
        }
        
        // 4. Versions didn't match (or first visit), Fetch EVERYTHING
        console.log("New menu version detected. Fetching from Firestore...");
        const menuCollectionRef = collection(db, 'menuItems');
        const querySnapshot = await getDocs(menuCollectionRef);
        
        menuInventory = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name_english || "Unnamed Item",
                name_chinese: data.name_chinese || "Unnamed Item",
                image: data.image,
                price: data.pricing?.[0]?.price || 0.00,
                category: data.category_english || "Misc",
                tags: [data.category_english, ...(data.tags?.map(t => t.type) || [])],
                addOns: data.addOns || [],
                pricing: data.pricing || [],
            };
        });
        
        // 5. Save Data AND the new Version to cache
        if (menuInventory.length > 0) {
            // Sort immediately to save processing later
            menuInventory.sort((a, b) => a.name.localeCompare(b.name));
            
            localStorage.setItem('menuData', JSON.stringify(menuInventory));
            
            // Only save version if we successfully got one from server
            if (serverVersion) {
                localStorage.setItem('menuVersion', String(serverVersion)); 
            }
            
            initMenu();
        }
    } catch (error) {
        console.error("Error fetching menu data from Firestore:", error);
        // Fallback: Try to load stale cache if network fails
        const cachedMenu = localStorage.getItem('menuData');
        if (cachedMenu) {
            console.log("Using stale cache due to network error");
            menuInventory = JSON.parse(cachedMenu);
            initMenu();
        } else {
            menuContainer.innerHTML = "<h1>Error loading menu. Please try again later.</h1>";
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
                // --- SETTINGS START ---
                const mobileBreakpoint = 900; // Pixel width for "Mobile"
                const desktopScrollPos = 600; // Scroll amount for Desktop
                const mobileScrollPos = 500;  // Scroll amount for Phones
                // --- SETTINGS END ---

                // Check if screen width is less than or equal to 768px
                const targetScroll = window.innerWidth <= mobileBreakpoint 
                    ? mobileScrollPos 
                    : desktopScrollPos;

                scrollContainer.scrollTo({
                    top: targetScroll,
                    behavior: 'smooth'
                });
            }, 20);

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
        itemImg.src = 'graphics/' + item.image.replace(/\.(png|jpg|jpeg)$/, '.webp')
        itemImg.src = 'graphics/' + item.image;
        itemImg.alt = item.name;
    } else {
      const categoryFileName = item.category.replace(/ \/ /g, '-');
      itemImg.src = `graphics/category_fallback/${categoryFileName}.png`; 
      itemImg.alt = `A placeholder image for the ${item.category} category`
    }

       itemInfo.appendChild(itemNameDiv);
    itemInfo.appendChild(itemChineseNameDiv);
    itemInfo.appendChild(itemPriceDiv);
    const modifierContainer = document.createElement('div');
    modifierContainer.classList.add('modifier-container');

    for (const modifierKey in MODIFIERS) {
        if (lowerCaseTags.includes(modifierKey)) {
            const icon = document.createElement('img');
            icon.classList.add('modifier-icon');
            icon.src = `${MODIFIERS[modifierKey].iconFile}`;
            icon.alt = MODIFIERS[modifierKey].title;
            icon.title = MODIFIERS[modifierKey].title;
            
            // 2. Add the icon to our new container, NOT to itemInfo
            modifierContainer.appendChild(icon);
        }
    }
    if (modifierContainer.hasChildNodes()) {
        itemInfo.appendChild(modifierContainer);
    }

   itemContainer.appendChild(itemInfo);
    itemContainer.appendChild(itemImg);
    link.appendChild(itemContainer);
    
    // --- RETURN THE LINK DIRECTLY, NOT THE <li> ---
    // itemEl.appendChild(link);
    // return itemEl;

    link.addEventListener('click', e => {
        e.preventDefault();
        
        openCustomizeModal(item);
    });

    return link; // Return the link directly as the grid item
}

function renderSingleCategory(categoryName) {
  // Guard clause - Perfect.
  if (!menuContainer) return;

  // 1. Clear the container efficiently - You did this correctly!
  while (menuContainer.firstChild) {
    menuContainer.removeChild(menuContainer.firstChild);
  }

  const lowerCaseCategory = categoryName.toLowerCase();
  
  // 2. Filter just for the single category that was clicked. No loop needed.
  const filteredItems = menuInventory.filter(item => 
    item.tags.some(tag => tag.toLowerCase() === lowerCaseCategory)
  );

  // 3. Check if any items were found AFTER filtering.
  if (filteredItems.length > 0) {
    // Use a fragment for performance - You did this correctly!
    const fragment = document.createDocumentFragment();

    const section = document.createElement('section');
    section.classList.add('menu-group');

    const header = document.createElement('h2');
    header.textContent = categoryName; 
    header.classList.add('menu-group-title');

    const list = document.createElement('ul');
    list.classList.add('item-list-grid');
    
    filteredItems.sort((a, b) => a.name.localeCompare(b.name));
    filteredItems.forEach(item => list.appendChild(createMenuItemElement(item)));

    // IMPORTANT: Add the header to the section first!
    section.appendChild(header);
    section.appendChild(list);

    // Add the fully built section to the fragment
    fragment.appendChild(section);

    // Append the entire fragment to the DOM in one operation.
    menuContainer.appendChild(fragment);

  } else {
    // If no items are found, display the message.
    menuContainer.innerHTML = `<p>No items found in the "${categoryName}" category.</p>`;
  }
}
// In main.js

function renderAllItemsByCategory() {
  if (!menuContainer) return;
  menuContainer.innerHTML = '';

  // Display order - these should match your tag names
  const categoryOrder = [
    "Popular",      // Tag: popular
    "Fish Soup Noodle",        // Tag: sides
    "Congee",       // Tag: congee
    "Fried Noodle", // Tag: fried noodle
    "Rice",         // Tag: rice
    "Soup",         // Tag: soup (simplified from "Soup / Noodles")
    "Soup Noodle",  // Tag: soup noodle
    "Stir Fry",     // Tag: stir fry
    "Beverages"     // Tag: beverages
  ];

  categoryOrder.forEach(displayCategory => {
    const lowerCaseCategory = displayCategory.toLowerCase();
    
    // Same simple filtering for everything
    const filteredItems = menuInventory.filter(item => 
      item.tags.some(tag => tag.toLowerCase() === lowerCaseCategory)
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
      
      filteredItems.sort((a, b) => a.name.localeCompare(b.name));
      filteredItems.forEach(item => list.appendChild(createMenuItemElement(item)));
      
      section.appendChild(list);
      menuContainer.appendChild(section);
    }
  });
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
  
  // --- FIX: Select by CLASS instead of ID, and include fallback ---
  const scrollArea = document.querySelector('.scroll-area') || document.querySelector('.modal-content');

  let selectedAddOnPrices = {};

  // --- RESET AND POPULATE MODAL ---
  title.textContent = item.name;
  chineseTitle.textContent = item.name_chinese;
  optionsContainer.innerHTML = ''; 
  defaultPrice.textContent = ''; 

  if (orderNotesTextarea) {
      orderNotesTextarea.value = '';
  }
  
  // --- (Image and Pricing sections) ---
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
    updateCartButtonPrice(); 
  };

  if (item.pricing.length === 1) {
    defaultPrice.textContent = "$ " + item.pricing[0].price.toFixed(2);
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
    item.pricing.forEach(priceOption => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio'; radio.name = optionGroupTitle;
        radio.value = priceOption[optionTypeKey]; radio.dataset.price = priceOption.price;
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
    const isComboItem = item.tags && item.tags.some(tag => tag.toLowerCase() === 'combo');

    item.addOns.forEach(addOnGroupData => {
        const addOnGroup = document.createElement('div');
        addOnGroup.className = 'option-group';

        let headerContainer;
        let optionsListContainer;
        let titleGroup;
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
              extraCostDisplay.textContent = `+$${postLimitPrice.toFixed(2)} for additional selections.`;
              titleGroup.appendChild(extraCostDisplay);
            }

            headerContainer.appendChild(titleGroup);
            headerContainer.appendChild(toggleIcon);
            
            optionsListContainer = document.createElement('div');
            optionsListContainer.className = 'accordion-content';

            headerContainer.addEventListener('click', () => {
            // 1. Find all other accordions that are currently open
            const allAccordions = optionsContainer.querySelectorAll('.option-group.is-accordion');

            // 2. Loop through them and close any that aren't the one currently being clicked
            allAccordions.forEach(acc => {
                if (acc !== addOnGroup) {
                    acc.classList.remove('is-open');
                }
            });

            // 3. Toggle the state of the clicked accordion
            addOnGroup.classList.toggle('is-open');
        });
            
            addOnGroup.appendChild(headerContainer);
            addOnGroup.appendChild(optionsListContainer); 

        } else {
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

  // --- FIX: Reset Scroll Position Logic ---
  // Using requestAnimationFrame ensures this runs AFTER the modal is rendered and visible
  requestAnimationFrame(() => {
    if (scrollArea) {
      console.log("Resetting scroll position to top");
      scrollArea.scrollTop = 0;
    } else {
        console.warn("Could not find .scroll-area to reset scroll position");
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
    

    // 2. Fire the Signal! 
    // This tells the Preview and Checkout to update themselves immediately.
    window.dispatchEvent(new CustomEvent('cartUpdated'));

    closeCustomizeModal();
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
