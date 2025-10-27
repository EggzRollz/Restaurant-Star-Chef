export class Cart {
  
  constructor() {
    this.shoppingCart = [];
    this.abbreviationMap = {
      // Sizes (lowercase)
      'Small': 's',
      'Medium': 'm',
      'Large': 'l',
      // Spice Levels (uppercase)
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
    const chosenValues = Object.values(customizations);
    // Map values to codes, sort them, and join them into a string
    const codes = chosenValues
      .map(value => this.abbreviationMap[value] || '') // Look up the code, return '' if not found
      .sort() // Sorts the codes to ensure consistency (e.g., 'Ss' not 'sS')
      .join(''); // Joins them: ['S', 's'] -> 'Ss'
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
}