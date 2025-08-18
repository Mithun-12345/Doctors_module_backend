const admin = require("../configs/firebase");

exports.sendNotification = async (req , res)=>{
    
    try {
        const {token, title, body } = req.body;
    
        if (!token || !title || !body) {
          return res.status(400).json({ error: "token, title, and body are required" });
        }
    
        const message = {
          notification: {
            title,
            body,
          },
          token, // FCM device token
        };
    
        const response = await admin.messaging().send(message);
        res.json({ success: true, response });
      } catch (error) {
        console.error("Error sending notification:", error);
        res.status(500).json({ success: false, error: error.message });
      }
};