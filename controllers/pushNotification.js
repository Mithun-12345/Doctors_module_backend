const admin = require("../configs/firebase");

  const {pushnotificationModel} = require("../models/pushNotificationModel");

exports.sendToken = async (req , res)=>{
    const patientId = req.user._id;
    try {
        const {token, title, body } = req.body;
    
        if (!token || !title || !body) {
          return res.status(400).json({ error: "token, title, and body are required" });
        }
    
        // const message = {
        //   notification: {
        //     title,
        //     body,
        //   },
        //   token, // FCM device token
        // };

        const data = {
          patientId : patientId,
          token : token,
          title : title,
          body : body,

        }
    
        
        const response = await pushnotificationModel.create(data);
        console.log("token data inserted in database");
        return res.json({ success: true, response });
      } 
      catch (error) {
        console.error("Error sending notification:", error);
        return res.status(500).json({ success: false, error: error.message });
      }
};

exports.sendNotification = async (req, res) => {
  try {
    const results = await pushnotificationModel.find({});

    if (!results || results.length === 0) {
      console.log("not found in mongodb");
      return res.json({ message: "not found" });
    }

    for (const item of results) {
      const message = {
        notification: {
          title: item.title,
          body: item.body,
        },
        token: item.token, // each doc should have its own token
      };

      console.log("token : ",item.token);

      const response = await admin.messaging().send(message);
      console.log(` Message sent successfully to ${item.token}`);
    }

    return res.json({ success: true, message: "All notifications sent" });

  } catch (error) {
    console.log("error : ", error);
    return res.json({ success: false, message: "error", error: error.message });
  }
};