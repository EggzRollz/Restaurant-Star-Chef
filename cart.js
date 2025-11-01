export class Cart {
  
  constructor() {
    this.shoppingCart = [];
    this.abbreviationMap = {
    // Sizes - use the actual values from Firebase
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
  
  _generateItemId(baseId, customizations) {
  const customizationKeys = Object.keys(customizations); // Gets ONLY the keys that exist
  customizationKeys.sort(); // Important for consistency

  const customizationString = customizationKeys.map(key => {
    const value = customizations[key];
    const keyAbbreviation = key.substring(0, 2).toUpperCase(); // 'PR'
    const valueAbbreviation = this.abbreviationMap[value] || value; // 'C' or 'B'
    return `${keyAbbreviation}-${valueAbbreviation}`;
  }).join('_');

  return `${baseId}_${customizationString}`;
}

  
  addItem(item, id, finalPrice, quantity, customizations = {}) {
    const cartId = this._generateItemId(id, customizations);
    const existingItem = this.shoppingCart.find(cartItem => cartItem.id === cartId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      const newItem = {
        id: cartId,          
        name: item,
        price: finalPrice,
        quantity: quantity,
        customizations: customizations 
      };
      this.shoppingCart.push(newItem);
    }
    console.log("--- Current Cart ---", this.shoppingCart);
  }


  cartLength(){
    let count = 0;
    for(let i = 0; i < this.shoppingCart.length; i++){
      count = count + this.shoppingCart[i].quantity;
    }
    return count;
  }

  getItems(){
    return this.shoppingCart;
  }

  loadFromStorage(savedItems) {
    if (savedItems && Array.isArray(savedItems)) {
        this.shoppingCart = savedItems;
        console.log('Cart has been hydrated from localStorage.');
    }
  }
}