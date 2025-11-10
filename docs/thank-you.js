document.addEventListener('DOMContentLoaded', () => {

    const timeElement = document.getElementById('ready-time');
    const confElement = document.getElementById('conf-number');

    // --- Part 2 is moved up because we need the order number first ---
    let orderNumber = null; // Declare orderNumber here to use it in both parts
    if (confElement) {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        orderNumber = urlParams.get('order'); // Assign the value

        if (orderNumber) {
            confElement.textContent = `#${orderNumber}`;
        } else {
            confElement.textContent = '#N/A';
        }
    }

    // --- Part 1: Set the PERMANENT readiness time ---
    if (timeElement && orderNumber) { // Only run this if we have a time element AND an order number
        
        // Create a unique key for this specific order's ready time
        const storageKey = `readyTimeForOrder_${orderNumber}`;
        
        // 1. Check if a ready time is already stored for this order
        let readyTime = sessionStorage.getItem(storageKey);

        if (!readyTime) {
            // 2a. If NO time is stored, this is the first visit.
            // So, we calculate, format, and SAVE the time.
            console.log("No saved time found for this order. Generating a new one.");
            
            const now = new Date();
            now.setMinutes(now.getMinutes() + 30);
            const options = { hour: 'numeric', minute: 'numeric', hour12: true };
            
            readyTime = now.toLocaleTimeString('en-US', options); // Assign to our variable
            
            // Save this newly created time to sessionStorage
            sessionStorage.setItem(storageKey, readyTime);

        } else {
            // 2b. If a time IS stored, we'll just use it.
            console.log("Found a saved time in sessionStorage:", readyTime);
        }

        // 3. Display the time (either the one we just made or the one we found)
        timeElement.textContent = readyTime;
    }
});