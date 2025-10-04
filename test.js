// test.js

// 1. Load environment variables from .env file
require('dotenv').config();

// --- ADD THIS DEBUGGING BLOCK ---
console.log("--- DEBUGGING .env VALUES ---");
console.log("App ID:", process.env.INSTAGRAM_APP_ID);
console.log("App Secret (first 5 chars):", process.env.INSTAGRAM_APP_SECRET?.substring(0, 5));
console.log("Access Token (first 5 chars):", process.env.INSTAGRAM_ACCESS_TOKEN?.substring(0, 5));
console.log("-----------------------------\n");
// --------------------------------

// 2. Import the function you want to test
const { exchangeForLongLivedToken } = require('./utils/InstaExchangeToken');

// 3. Create a simple async function to run the test
const runTest = async () => {
  console.log("🚀 Starting token exchange test...");
  const result = await exchangeForLongLivedToken();

  if (result.success) {
    console.log("\n🎉 Test Succeeded!");
    console.log("   New Long-Lived Token:", result.longLivedToken);
  } else {
    console.log("\n🔥 Test Failed.");
    console.log("   Error:", result.error);
  }
};

// 4. Execute the test
runTest();
// 2. Import the function you want to test


