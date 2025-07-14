// utils/instagramUtils.js
const axios = require("axios");

const exchangeForLongLivedToken = async () => {
  try {
    const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_ACCESS_TOKEN } = process.env;

    if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET || !INSTAGRAM_ACCESS_TOKEN) {
      throw new Error("Missing environment variables. Check your .env");
    }

    const response = await axios.get(
      `https://graph.facebook.com/v19.0/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: INSTAGRAM_APP_ID,
          client_secret: INSTAGRAM_APP_SECRET,
          fb_exchange_token: INSTAGRAM_ACCESS_TOKEN,
        },
      }
    );

    const longLivedToken = response.data.access_token;
    const expiresIn = response.data.expires_in;

    console.log("✅ Long-lived token:", longLivedToken);
    console.log("⏳ Expires in:", expiresIn);

    return {
      success: true,
      longLivedToken,
      expiresIn,
    };
  } catch (error) {
    console.error("❌ Token exchange failed:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
};

module.exports = {
  exchangeForLongLivedToken,
};
