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
  const keys = ['Size', 'Spice Level', 'Protein']; // all possible keys
  const codes = keys
    .map(key => `${key[0]}${this.abbreviationMap[customizations[key]] || ''}`)
    .join('');
  return `${baseId}${codes}`;
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