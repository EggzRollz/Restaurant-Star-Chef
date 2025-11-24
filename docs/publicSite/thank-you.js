const selectedPickupTimeInput = document.getElementById('selectedPickupTime');

document.addEventListener('DOMContentLoaded', () => {
    // Both of these lines must be INSIDE this block.
    
    // 1. Get the order number from the URL and display it.
    const orderNumber = displayOrderNumber();
    displayPickupTime();
    displayPhoneNumber()
    
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
function displayPickupTime() {
    const timeElement = document.getElementById('ready-time');
    if (!timeElement) return; 

    const urlParams = new URLSearchParams(window.location.search);
    const timeParam = urlParams.get('time'); 

    // Check if timeParam exists AND is not an empty string
    if (timeParam && timeParam.trim() !== "") {
        timeElement.textContent = decodeURIComponent(timeParam);
    } else {
        // If the URL says &time= (empty) or isn't there, default to ASAP
        timeElement.textContent = "ASAP"; 
        console.log("No time found in URL, defaulting to ASAP");
    }
}

function displayPhoneNumber() {
    const phoneNumberElement = document.getElementById('conf-phoneNumber');
    if (!phoneNumberElement) return;

    const urlParams = new URLSearchParams(window.location.search);
    const rawPhone = urlParams.get('phone');
    const cleanPhone = decodeURIComponent(rawPhone || "").trim();
    if (cleanPhone) {
        phoneNumberElement.innerHTML = `Confirmation Text Sent To:<br><strong>${cleanPhone}</strong>`
        console.log("Phone number displayed:", cleanPhone);
    } else {
        console.error("Phone number not found in URL parameters. (URL should be like '...?phone=1234')");
        phoneNumberElement.textContent = '#N/A';
    }
}