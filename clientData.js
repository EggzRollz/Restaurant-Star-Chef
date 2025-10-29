import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./main.js";


const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function writeCartData(itemIdArr, name, email, phonenumbe, time, orderNumber) {
  set(ref(db, 'orders/' + orderNumber), {
    itemIdArr: itemIdArr,
    name: name,
    email: email,
    phonenumber: phonenumber,
    time: time,
    orderNumber: orderNumber,
  });
}

const link = document.getElementById("place-order-button");
link.addEventListener("click", event => {
    console.log("dylans a predator")
    writeCartData(["R1","B3221C","DICK"], "Dylan", "masterbatez@gmail.com", "6479187917","12:30", "1234")
    
});

function test(data){
    console.log(data)
    console.log("hi")
}

const ordersReceived = ref(db, 'orders/');
onValue(ordersReceived, (snapshot) => {

  const data = snapshot.val();
    test(data)
});