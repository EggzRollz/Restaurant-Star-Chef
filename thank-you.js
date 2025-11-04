


document.addEventListener('DOMContentLoaded', () => {

    const timeElement = document.getElementById('ready-time');
    const confElement = document.getElementById('conf-number');

    // --- Part 1: Set the readiness time ---
    if (timeElement) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 30);
        const options = { hour: 'numeric', minute: 'numeric', hour12: true };
        const dynamicReadyTime = now.toLocaleTimeString('en-US', options);
        timeElement.textContent = dynamicReadyTime;
    }

    // --- Part 2: Get the Order Number from the URL ---
    if (confElement) {
        // Get the full query string from the URL (e.g., "?order=1005")
        const queryString = window.location.search;

        // Create a URLSearchParams object to easily parse it
        const urlParams = new URLSearchParams(queryString);

        // Get the value of the 'order' parameter
        const orderNumber = urlParams.get('order');

        // Update the HTML element with the retrieved order number
        if (orderNumber) {
            confElement.textContent = `#${orderNumber}`;
        } else {
            // A fallback in case someone visits the page without an order number
            confElement.textContent = '#N/A';
        }
    }
});