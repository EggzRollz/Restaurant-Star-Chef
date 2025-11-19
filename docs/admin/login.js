import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "../publicSite/main.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);


const loginButton = document.getElementById("login-btn");
const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");

loginButton.addEventListener("click", (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const pass = passInput.value;

    signInWithEmailAndPassword(auth, email, pass)
        .then((userCredential) => {
            // Login Successful!
            console.log("Logged in!");
            // Redirect to the admin dashboard
            window.location.href = "index.html";
        })
        .catch((error) => {
            console.error("Error:", error.message);
            alert("Login failed: " + error.message);
        });
});