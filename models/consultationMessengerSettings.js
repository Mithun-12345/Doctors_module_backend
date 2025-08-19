const mongoose = require("mongoose");

const appointmentSettingsSchema = new mongoose.Schema({
    day : {
        type : String
    },
    startingTime : {
        type : String
    },
    endingTime : {
        type : String
    },
    status : {
        type : Boolean,
        default : true
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
    slotType : {
        type : String
    },
    startingTime : {
        type : String
    },
    endingTime : {
        type : String
    },
    price:{
        type : Number
    },
    allowBooking :{
        type : Boolean,
        default : true
    },
    createdAt :{
        type : Date
    },
    UpdatedAt : {
        type : Date,
        default : Date.now
    }
});



const consultationPriorityMapping = new mongoose.Schema({
    priority : {
        type : String
    },
    percentage : {
        type : String
    },
    createdAt : {
        type : Date
    },
    updatedAt : {
        type : Date,
        default : Date.now
    }
});

const rescheduleAndRefund = new mongoose.Schema({
    name : {
        type : String
    },
    status : {
        type : Boolean,
        default : true
    }
})


const shipmentPanelSchema = new mongoose.Schema({
  enableImageUpload: { type: Boolean, default: true },
  allowTextInstructions: { type: Boolean, default: true },
  enableMarkAsReceived: { type: Boolean, default: true },
  customerAcknowledgement: { type: Boolean, default: true },
  markAsLostInTransit: { type: Boolean, default: true },
  createdAt : {type: Date},
  updatedAt : {type : Date , default : Date.now}
}, { timestamps: true });

const enableChargeSummaryPreviewsub = new mongoose.Schema({
    isAvailable : {type : Boolean,default : true},
    patientId : {type : String , default : "P1234"},
    charges : {
        type : {
            consultationCharge : {
                type : Number,
                default : 500
            },
            medicineCharge : {
                type : Number,
                default : 400
            },
            shipmentCharge : {
                type : Number,
                default : 40
            },
            total : {
                type : Number,
                default : 940
            }

        }
    },
    
});

const paymentIntimationPanel = new mongoose.Schema({
    enablePaymentIntimation : {
        type : Boolean,
        default : true
    },
    enableChargeSummaryPreview : {
        type : enableChargeSummaryPreviewsub,
        default : ()=>({})
    },
    enableFollowUps : {
        type : Boolean,
        default : true
    },
    message : {
        type :{
            interval : {
                type : Number,
                default : 2
            },
            followUpMessage : {
                type : String,
                default : "Gentle remainder. Your payment is pending "
            }
        },
        default : ()=>({})
    },
    createdAt : {
        type : Date,
        default : Date.now
    },
    updatedAt : {
        type : Date,
        default : Date.now
    }

});

const paymentmessagetemplate = new mongoose.Schema({
    description : {
        type : String,
        default : "Hello your total bill is {total_amount} Please click below to pay and confirm your order "
    },
    placeholders : {
        type : [String],
        default : ["medicine_amount","shipment_amount","total_amount"]
    }
});

const feedbackPanel = new mongoose.Schema({
    doctorId : {
        type : mongoose.Schema.Types.ObjectId,
        required : true
    },
    msgUseCase : {
        type : String
    },
    isAvailable : {
        type : Boolean,
        default : true
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
});

const DoctorfeedbackSettings = new mongoose.model("DoctorfeedbackSettings",feedbackPanel);
const DoctorQuestionMapWithQuery = new mongoose.model("DoctorQuestionMapWithQuery",questionsMapWithQuery);


const ShipmentPanelSettings = new mongoose.model("ShipmentPanelSettings", shipmentPanelSchema);
const PaymentIntimationPanel = new mongoose.model("PaymentIntimationPanel",paymentIntimationPanel);
const PaymentMessageTemplate = new mongoose.model("PaymentMessageTemplate",paymentmessagetemplate);

const ClinicOperationHours = new mongoose.model("ClinicOperationHours",appointmentSettingsSchema);
const AppointmentSlotTypes = new mongoose.model("AppointmentSlotTypes",appointmentslottype);
const ConsultationPriorityMapping = new mongoose.model("ConsultationPriorityMapping",consultationPriorityMapping);
const RescheduleAndRefund = new mongoose.model("rescheduleAndRefund",rescheduleAndRefund);

module.exports = {RescheduleAndRefund,DoctorQuestionMapWithQuery,DoctorfeedbackSettings,ClinicOperationHours,AppointmentSlotTypes,ConsultationPriorityMapping,ShipmentPanelSettings,PaymentIntimationPanel};