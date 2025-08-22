const admin = require("firebase-admin");
const serviceAccount = require("./exponotification-fcf08-firebase-adminsdk-fbsvc-867594cd7e.json"); // your JSON key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
