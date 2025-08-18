const mongoose = require("mongoose");

const workinghours = new mongoose.Schema({
    startTime : {
        type : String,
        default : "10:00 AM"
    },
    endTime : {
        type : String,
        default : "01:00 PM"
    },
    isAvailable : {
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
        type : workinghours,
        default : ()=>({})
    },
    monday : {
        type : workinghours,
        default : () => ({})
    },
    tuesday : {
        type : workinghours,
        default : ()=>({})
    },
    wednesday : {
        type : workinghours,
        default : ()=>({})
    },
    thursday : {
        type : workinghours,
        default : ()=>({})
    },
    friday : {
        type : workinghours,
        default : ()=>({})
    },
    saturday : {
        type : workinghours,
        default : ()=>({})
    },

    createdAt : {
        type : Date,
    },
    updatedAt : {
        type : Date,
        default : Date.now
    }
});

const appointmentslottype = mongoose.Schema({
    doctorId : {
        type : mongoose.Schema.Types.ObjectId,
        required :true
    },
    Normal : {
        price : {
            type : Number,
            default : 500
        },
        startTime : {
            type : String,
            default : "03:00 AM"
        },
        endTime : {
            type : String,
            default : "10:00 PM"
        },
        isAvailable : {
            type : Boolean,
            default : true
        }
    },
    PostWorkingHours : {
        price : {
            type : Number,
            default : 700
        },
        startTime : {
            type : String,
            default : "03:00 AM"
        },
        endTime : {
            type : String,
            default : "10:00 PM"
        },
        isAvailable : {
            type : Boolean,
            default : true
        }
    },
    Weekend : {
        days:{
            type : [String],
            default : ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
        },
        price : {
            type : Number,
            default : 600
        },
        startTime : {
            type : String,
            default : "03:00 AM"
        },
        endTime : {
            type : String,
            default : "10:00 PM"
        },
        isAvailable : {
            type : Boolean,
            default : true
        }
    },
    OpinionConsultation : {
        price : {
            type : Number,
            default : 400
        },
        startTime : {
            type : String,
            default : "03:00 AM"
        },
        endTime : {
            type : String,
            default : "10:00 PM"
        },
        isAvailable : {
            type : Boolean,
            default : true
        }
    },
    createdAt : {
        type : Date
    },
    updatedAt : {
        type : Date,
        default : Date.now
    }
});



const consultationPriorityMapping = new mongoose.Schema({
    Acute : {
        type : String,
        default : "70%"
    },
    Chronic : {
        type : String,
        default : "20%"
    },
    OpinionConsultation : {
        type : String,
        default : "10%"
    },
    AllowRescheduling : {
        type : Boolean,
        default : true
    },
    RefundAdjustmentOnRescheduling : {
        type : Boolean,
        default : true
    },
    createdAt : {
        type : Date
    },
    updatedAt : {
        type : Date,
        default : Date.now
    }
})

const ClinicOperationHours = new mongoose.model("ClinicOperationHours",appointmentSettingsSchema);
const AppointmentSlotTypes = new mongoose.model("AppointmentSlotTypes",appointmentslottype);
const ConsultationPriorityMapping = new mongoose.model("ConsultationPriorityMapping",consultationPriorityMapping);

module.exports = {ClinicOperationHours,AppointmentSlotTypes,ConsultationPriorityMapping};