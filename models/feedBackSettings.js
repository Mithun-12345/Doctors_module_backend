const mongoose = require("mongoose");

const foreveryquery = new mongoose.Schema({
    isAvailable : {
        type : Boolean,
        default : true
    }
})

const feedbackSettingsschema =  new mongoose.Schema({
    doctorId : {
        type: mongoose.Schema.Types.ObjectId,
        required : true,
        unique : true
    },
    generalQuery :{
        type : foreveryquery,
        default : () => ({})
    },
    newConsultation : {
        type : foreveryquery,
        default : () => ({})

    },
    opinionConsultation : {
        type : foreveryquery,
        default : () => ({})
    },
    existingConsultation : {
        type : foreveryquery,
        default : () => ({})
    },
    
    createdAt : {
        type : Date
    },
    updatedAt : {
        type : Date,
        default : Date.now()
    }

});

const questionSchema = new mongoose.Schema({
    question : {
        type : String
    }
})

const questionsMapWithQuery = new mongoose.Schema({

    doctorId : {
        type : mongoose.Schema.Types.ObjectId,
        required : true
    },
    queryId : {
        type : mongoose.Schema.Types.ObjectId,
        required : true
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
    questionsName : {
        type: String,
    },
    questions : {
        type : [questionSchema],
        default : []
    },
    createdAt : {
        type : Date
    },
    updatedAt : {
        type : Date,
        default : Date.now()
    }
})

const DoctorfeedbackSettings = new mongoose.model("DoctorfeedbackSettings",feedbackSettingsschema);
const DoctorQuestionMapWithQuery = new mongoose.model("DoctorQuestionMapWithQuery",questionsMapWithQuery);

module.exports = {DoctorQuestionMapWithQuery,DoctorfeedbackSettings};