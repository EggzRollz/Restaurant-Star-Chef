document.addEventListener('DOMContentLoaded', () => {
    // Both of these lines must be INSIDE this block.
    
    // 1. Get the order number from the URL and display it.
    const orderNumber = displayOrderNumber();
    
    // 2. Use that number to calculate and display the pickup time.
    displayPickupTime(orderNumber);
});

/**
 * Reads the 'order' parameter from the URL and displays it in the '#conf-number' element.
 * @returns {string|null} The order number found in the URL, or null if not found.
 */
function displayOrderNumber() {
    const confElement = document.getElementById('conf-number');
    if (!confElement) {
        console.error("HTML element with ID 'conf-number' was not found.");
        return null;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderNumber = urlParams.get('order');

    if (orderNumber) {
        confElement.textContent = `#${orderNumber}`;
    } else {
        console.error("Order number not found in URL parameters. (URL should be like '...?order=1234')");
        confElement.textContent = '#N/A';
    }

    return orderNumber;
}

/**
 * Calculates, stores, and displays the pickup time in the '#ready-time' element.
 * It uses the order number to create a unique key for sessionStorage.
 * @param {string|null} orderNumber - The order number to associate with the pickup time.
 */
function displayPickupTime(orderNumber) {
    const timeElement = document.getElementById('ready-time');
    if (!timeElement) {
        console.error("HTML element with ID 'ready-time' was not found.");
        return;
    }
    
    // If there's no order number, we can't proceed.
    if (!orderNumber) {
        timeElement.textContent = "--:--";
        return;
    }

    const storageKey = `pickupTimeForOrder_${orderNumber}`;
    let pickupTime = sessionStorage.getItem(storageKey);

    // If a pickup time is NOT already stored for this order, create one.
    if (!pickupTime) {
        const prepTimeMinutes = 30; // Set estimated preparation time
        const futureTime = new Date(Date.now() + prepTimeMinutes * 60000);

        // Format the time into a user-friendly string (e.g., "4:35 PM")
        pickupTime = futureTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Save the newly generated time to sessionStorage
        sessionStorage.setItem(storageKey, pickupTime);
    }

    // Display the final pickup time (either newly created or retrieved from storage)
    timeElement.textContent = pickupTime;
}