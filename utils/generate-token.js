// generate-token.js
const { exchangeForLongLivedToken } = require('./InstaExchangeToken');

const setup = async () => {
  console.log('Attempting to get long-lived token...');
  const result = await exchangeForLongLivedToken();

  if (result.success) {
    console.log('\n--- SUCCESS! ---');
    console.log('✅ Your new LONG-LIVED token is:');
    console.log(result.longLivedToken);
    console.log(`\nIt expires in about ${Math.floor(result.expiresIn / 86400)} days.`);
    console.log('--- SAVE THIS TOKEN IN YOUR DATABASE ---');
  } else {
    console.error('\n--- FAILED ---');
    console.error(result.error);
  }
};

setup();