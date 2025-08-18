const admin = require("firebase-admin");
const serviceAccount = require("./google-services.json"); // your JSON key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
