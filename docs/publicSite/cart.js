export class Cart {
  
  constructor() {
    // Initialize with an empty array. We will load from storage right after creation.
    this.shoppingCart = []; 
    
    // Your abbreviation map is perfect, no changes needed here.
    this.abbreviationMap = {
      // Sizes
      'S': 's',
      'M': 'm',
      'L': 'l',
      // Spice Levels
      'Mild': 'M',
      'Spicy': 'S',
      'Hot': 'H',
      // Proteins
      'Chicken': 'C',
      'Beef': 'B',
      'Pork': 'P',
    };
  }
  
  // This function is fine, no changes needed.
  _generateItemId(baseId, customizations) {
    const customizationKeys = Object.keys(customizations);
    customizationKeys.sort();

    const customizationString = customizationKeys.map(key => {
      const value = customizations[key];
      // A small fix here to handle values not in the map gracefully
      const valueAbbreviation = this.abbreviationMap[value] || String(value).replace(/\s+/g, ''); 
      const keyAbbreviation = key.substring(0, 2).toUpperCase();
      return `${keyAbbreviation}-${valueAbbreviation}`;
    }).join('_');

    // Prevents adding a trailing underscore if there are no customizations
    return customizationString ? `${baseId}_${customizationString}` : baseId;
  }

  // --- MODIFIED addItem METHOD ---
  addItem(item, name_chinese, id, finalPrice, quantity, customizations = {}) {
    const baseId = id; // The original ID, e.g., "B13"
    const cartId = this._generateItemId(baseId, customizations);
    
    const existingItem = this.shoppingCart.find(cartItem => cartItem.id === cartId);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      const newItem = {
        id: cartId, // The complex ID, e.g., "B13_SI-S"
        baseId: baseId, // The simple ID, needed for the admin panel lookup
        name: item,
        name_chinese: name_chinese, 
        price: finalPrice,
        quantity: quantity,
        customizations: customizations // The critical object
      };
      this.shoppingCart.push(newItem);
    }
    
    // --- THIS IS THE MOST IMPORTANT CHANGE ---
    // Every time an item is added or updated, save the entire cart to localStorage.
    this.save();
    
    console.log("--- Cart Updated and Saved ---", this.shoppingCart);
  }
  
  updateQuantity(index, newQuantity) {
    const items = this.getItems();
    if (items[index]) {
        // 1. Update the quantity
        items[index].quantity = newQuantity;

        // 2. If quantity is 0 or less, remove the item
        if (items[index].quantity <= 0) {
            items.splice(index, 1);
        }

        // 3. Save to local storage
        this.save(); 
    }
}

  // --- NEW save() METHOD ---
  save() {
    localStorage.setItem('cart', JSON.stringify(this.shoppingCart));
  }

  
  // --- No changes to the methods below ---
  cartLength() {
    return this.shoppingCart.reduce((total, item) => total + item.quantity, 0);
  }

  getItems() {
    return this.shoppingCart;
  }

  loadFromStorage() {
    const savedItems = JSON.parse(localStorage.getItem('cart'));
    if (savedItems && Array.isArray(savedItems)) {
        this.shoppingCart = savedItems;
        console.log('Cart has been hydrated from localStorage.');
    }
  }
}