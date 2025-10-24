
export class Cart {
  
  constructor() {
    this.items = [];
    
  }
  getName(item){
    return item[0]
  }
  getPrice(item){
    return item[1]
  }
  getQuantity(item){
    return item[2]
  }


  increase(){
    let ammount = 0;


  }
  addItem(name,price,quantity = 1){
    let found = false;
    for(let i = 0; i < this.items.length; i++){
      if(this.items[i][0] === name){
        this.items[i][2] += quantity
        found = true
        break;
      }
    }
    if(!found){
      this.items.push([name,price,quantity])
    }
  } 
  
  

} 
