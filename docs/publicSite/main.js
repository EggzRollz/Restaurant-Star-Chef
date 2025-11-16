
import { Cart } from './cart.js';  
import { mergeSort, filterBy } from './algorithms.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";



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
          price: data.pricing?.[0]?.price || 0.00, 
          category: data.category_english || "Misc",
          tags: [data.category_english, ...(data.tags?.map(t => t.type) || [])],
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
  
  // --- Rendering Logic ---
  
  function setupCategoryButtons() {
    document.querySelectorAll('[data-category]').forEach(link => {
      link.addEventListener("click", event => {
        event.preventDefault(); 
        
       
        if (menuNavSlider) {
            const sliderWidth = menuNavSlider.offsetWidth;
            const linkListItem = link.parentElement;
            const targetScrollLeft = linkListItem.offsetLeft + (linkListItem.offsetWidth / 2) - (sliderWidth / 2);
    
            // Animate the scroll
            menuNavSlider.scrollTo({
              left: targetScrollLeft,
              behavior: 'smooth'
            });
        }

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
    renderSingleCategory(tag);
  }
}

// --- In main.js ---

function createMenuItemElement(item) {
  console.log(item); 
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
        itemImg.src = 'graphics/' + item.image;
        itemImg.alt = item.name;
    } else {
      const categoryFileName = item.category.replace(/ \/ /g, '-');
      console.log(`Fallback for category: "[${item.category}]"`); 
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
  if (!menuContainer) return;
  menuContainer.innerHTML = '';

  const lowerCaseCategory = categoryName.toLowerCase();
  
  // Simple, unified filtering: just check if the tag exists
  const filteredItems = menuInventory.filter(item => 
    item.tags.some(tag => tag.toLowerCase() === lowerCaseCategory)
  );

  if (filteredItems.length > 0) {
    const section = document.createElement('section');
    section.classList.add('menu-group');

    const header = document.createElement('h2');
    header.textContent = categoryName; 
    header.classList.add('menu-group-title');

    const list = document.createElement('ul');
    list.classList.add('item-list-grid');
    
    filteredItems.sort((a, b) => a.name.localeCompare(b.name));
    filteredItems.forEach(item => list.appendChild(createMenuItemElement(item)));

    section.appendChild(header);
    section.appendChild(list);
    menuContainer.appendChild(section);
  } else {
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
  const scrollArea = document.getElementById('modal-scroll-area');
  let selectedAddOnPrices = {};
  // --- RESET AND POPULATE MODAL ---
  title.textContent = item.name;
  chineseTitle.textContent = item.name_chinese;
  optionsContainer.innerHTML = ''; 
  defaultPrice.textContent = ''; 

  if (orderNotesTextarea) {
      orderNotesTextarea.value = '';
  }
  
  // --- (Image and Pricing sections are unchanged) ---
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
            if (freeLimit !== undefined) {
                const extraCostDisplay = document.createElement('div');
                extraCostDisplay.className = 'extra-cost-display';
                extraCostDisplay.textContent = `+$${postLimitPrice.toFixed(2)} for additional selections.`;
                titleGroup.appendChild(extraCostDisplay);
            }
            

const limit = addOnGroupData.limit;
        if (limit !== undefined) {
            const limitTextDisplay = document.createElement('div');
            limitTextDisplay.className = 'extra-cost-display'; // Re-use existing style
            limitTextDisplay.textContent = `Maximum choice of ${limit}.`;
            titleGroup.appendChild(limitTextDisplay);
        }
        // *** MOVED AND CORRECTED SECTION END ***

        headerContainer.appendChild(titleGroup);
        headerContainer.appendChild(toggleIcon);
        
        optionsListContainer = document.createElement('div');
        optionsListContainer.className = 'accordion-content';

        headerContainer.addEventListener('click', () => {
            addOnGroup.classList.toggle('is-open');
        });
        
        addOnGroup.appendChild(headerContainer);
        addOnGroup.appendChild(optionsListContainer); 

    } else {
        headerContainer = addOnGroup; 
        optionsListContainer = addOnGroup; 
        headerContainer.appendChild(addOnTitle);
        
        const freeLimit = addOnGroupData.freeToppingLimit;
        const postLimitPrice = addOnGroupData.postLimitPrice;
        if (freeLimit !== undefined) {
            const extraCostDisplay = document.createElement('div');
            extraCostDisplay.className = 'extra-cost-display';
            extraCostDisplay.textContent = `Includes 2 free toppings, +$${postLimitPrice.toFixed(2)} for additional selections.`;
            optionsListContainer.appendChild(extraCostDisplay);
        }

        // *** MOVED AND CORRECTED SECTION START (for Non-Combo Items) ***
        const limit = addOnGroupData.limit;
        if (limit !== undefined) {
            const limitTextDisplay = document.createElement('div');
            limitTextDisplay.className = 'extra-cost-display';
            limitTextDisplay.textContent = `Maximum choice of ${limit}.`;
            // Append it right after the title
            optionsListContainer.appendChild(limitTextDisplay);
        }
        // *** MOVED AND CORRECTED SECTION END ***
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
            
            // *** NEW VALIDATION SECTION START ***
            const limit = addOnGroupData.limit;
            
            // This validation only applies to multi-select checkboxes with a defined limit.
            if (input.type === 'checkbox' && limit !== undefined) {
                const checkedCount = groupElement.querySelectorAll('input[type="checkbox"]:checked').length;
                
                // Find or create the error message element for this group
                let errorElement = groupElement.querySelector('.limit-error');
                if (!errorElement) {
                    errorElement = document.createElement('div');
                    errorElement.className = 'limit-error';
                    // Insert it right after the title/header for visibility
                    const header = groupElement.querySelector('h4') || groupElement.querySelector('.accordion-header');
                    if (header) {
                        header.insertAdjacentElement('afterend', errorElement);
                    }
                }
                if (limit !== undefined) {
                  const extraCostDisplay = document.createElement('div');
                  extraCostDisplay.className = 'extra-cost-display';
                  extraCostDisplay.textContent = `Maximum choice of ${limit} side dishes`;
                  titleGroup.appendChild(extraCostDisplay);
                }
                if (checkedCount > limit) {
                    // Prevent the action by un-checking the box
                    input.checked = false; 
                    // Display the error
                    errorElement.textContent = `You can only select up to ${limit} items.`;
                    errorElement.style.display = 'block';
                } else {
                    // If the user is within the limit, hide the error message
                    errorElement.style.display = 'none';
                }
            }
            // *** NEW VALIDATION SECTION END ***

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

    const oldErrors = document.querySelectorAll('#customOptions .validation-error');
    oldErrors.forEach(error => error.remove());

    const customizations = {};
    const optionGroups = document.querySelectorAll('#customOptions .option-group');
    let isFormValid = true; 
    
    // --- NEW: Variable to store a reference to the first error element ---
    let firstErrorElement = null;

    optionGroups.forEach(group => {
    const titleElement = group.querySelector('h4');
    const groupTitle = titleElement.textContent;
    let isValidForThisGroup = true;
    let errorMessage = '';

    // Check for a required minimum selection on checkbox groups
    const requiredMinimum = parseInt(group.dataset.freeLimit, 10);
    if (!isNaN(requiredMinimum) && requiredMinimum > 0) {
        const checkedCount = group.querySelectorAll('input[type="checkbox"]:checked').length;
        if (checkedCount < requiredMinimum) {
            isValidForThisGroup = false;
            errorMessage = `You must select at least ${requiredMinimum} options.`;
        } else {
            // It's valid, so gather the selected checkbox values
            const selectedCheckboxes = group.querySelectorAll('input[type="checkbox"]:checked');
            customizations[groupTitle] = Array.from(selectedCheckboxes).map(cb => cb.value);
        }
    } else {
        // Check for a required selection on radio button groups
        const radioInputs = group.querySelectorAll('input[type="radio"]');
        if (radioInputs.length > 0) { // Only validate if it IS a radio group
            const selectedRadio = group.querySelector('input[type="radio"]:checked');
            if (selectedRadio) {
                customizations[groupTitle] = selectedRadio.value;
            } else {
                isValidForThisGroup = false;
                errorMessage = 'You must select an option.';
            }
        }
    }

    // If validation failed for this group, show the error message
    if (!isValidForThisGroup) {
        isFormValid = false; // Set the overall form validity to false

        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = errorMessage;
        
        titleElement.insertAdjacentElement('afterend', errorDiv);
        
        // Keep track of the first error to scroll to it later
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
