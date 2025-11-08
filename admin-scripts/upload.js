// upload.js
const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');
const menuData = require('./menu.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const collectionName = 'menuItems';

async function uploadMenuData() {
  console.log('Starting data upload...');
  const collectionRef = db.collection(collectionName);

  // The top-level object has a "menu" key, which holds an array of categories.
  const categories = menuData.menu;

  if (!categories || !Array.isArray(categories)) {
    console.error('Error: "menu" key not found or is not an array in menu.json');
    return;
  }

  // --- NEW: Outer loop to go through each CATEGORY ---
  for (const category of categories) {
    const categoryName = category.category_name_english;
    const items = category.items;

    if (!items || !Array.isArray(items)) {
      console.warn(`Skipping category "${categoryName}" because it has no 'items' array.`);
      continue; // Move to the next category
    }

    // --- NEW: Inner loop to go through each ITEM within the category ---
    for (const item of items) {
      if (!item.id) {
        console.error('Skipping item without an ID:', item);
        continue; // Move to the next item
      }

      // Create the final object to upload.
      // We start with all the item's properties...
      const dataToUpload = {
        ...item,
        // ...and then we ADD the category info to it!
        // This makes querying by category very easy on your website.
        category_english: category.category_name_english,
        category_chinese: category.category_name_chinese
      };

      // The item's 'id' will be the document ID, so we remove it from the data payload.
      delete dataToUpload.id;

      // Get a reference to the document using the item's unique ID
      const docRef = collectionRef.doc(item.id);
      
      // Upload the data
      await docRef.set(dataToUpload);
      console.log(`Uploaded: [${categoryName}] ${item.id} - ${item.name_english}`);
    }
  }

  console.log('---------------------');
  console.log('All menu items have been uploaded successfully!');
}

uploadMenuData().catch(error => {
  console.error('An error occurred during the upload process:', error);
});