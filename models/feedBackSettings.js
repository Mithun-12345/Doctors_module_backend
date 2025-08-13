const mongoose = require("mongoose");

const feedbackSettingsschema =  new mongoose.Schema({
    doctorId : {
        type: mongoose.Schema.Types.ObjectId,
        required : true
    },
    // patientId : {
    //     type : mongoose.Schema.Types.ObjectId,
    //     required : true
    // },
    generalQuery :{
        type : Boolean,
        default : true
    },
    newConsulation : {
        type : Boolean,
        default : true
    },
    opinionConsultation : {
        type : Boolean,
        default : true
    },
    existingConsultation : {
        type : Boolean,
        default : true
    },
    messengerUsecase : {
        type : String,
        default : ""
    },
    afterXhours : {
        type : Number,
        default : 0

    },
    purpose : {
        type : String,
        default : ""
    },
    totalQuestions : {
        type : Number,
        default : 0
    },
    questions : {
        type : [String],
        default : []
    },
    createdAt : {
        type : Date,
        default : Date.now()
    },
    updatedAt : {
        type : Date,
        default : Date.now()
    }

});

module.exports = new mongoose.model("feedbackSettings",feedbackSettingsschema);