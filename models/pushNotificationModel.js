const mongoose = require("mongoose");

const pushnotificationtableSchema = new mongoose.Schema({
    patientId : {
      type : mongoose.Schema.Types.ObjectId,
      required : true,
      unique : true
    },
    token : {
      type : String,
      required : true
    },
    title : {
        type : String,
        default : ""
    },
    body : {
    type : String,
    default : ""
    },
    status : {
      type : Boolean,
      default : true
    }
  
  });

  const pushnotificationModel = new mongoose.model("PushNotification",pushnotificationtableSchema);

  module.exports = {pushnotificationModel};