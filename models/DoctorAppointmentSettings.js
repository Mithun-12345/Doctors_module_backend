const mongoose = require("mongoose");

const doctordetails = new mongoose.Schema({
    price : {
        type : Number,
        default : 0
    },
    timeslot : {
        type : String,
        default : ""
    },
    available : {
        type : Boolean,
        default : true
    }
})

const appointmentSettingsSchema = new mongoose.Schema({
    doctorId : {
        type : mongoose.Schema.Types.ObjectId,
        unique :true
    },
    sunday : {
        type : doctordetails
    },
    monday : {
        type : doctordetails
    },
    tuesday : {
        type : doctordetails
    },
    wednesday : {
        type : doctordetails
    },
    thursday : {
        type : doctordetails
    },
    friday : {
        type : doctordetails
    },
    saturday : {
        type : doctordetails
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

module.exports = new mongoose.model("DoctorAppointmentSettings",appointmentSettingsSchema);