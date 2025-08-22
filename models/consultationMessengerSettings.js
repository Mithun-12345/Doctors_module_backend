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


const shipmentPanelSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true }, // e.g. enableImageUpload
        status: { type: Boolean, default: true },             // true/false toggle
      },
      { timestamps: true }
);




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

const paymentIntimationPanelEnableSchema = new mongoose.Schema(
    {
      name: { type: String, required: true, unique: true }, 
      status: { type: Boolean, default: true },            
    },
    { timestamps: true }
  );

const paymentIntimationPanelSchema2 = new mongoose.Schema(
    {
      Interval: { type: Number }, 
      Followupmsgtemp: { type: String},            
    },
    { timestamps: true }
  );

const paymentMsgTempSchema = new mongoose.Schema(
    {
      Description: { type: String }, 
      Placeholder: { type: [String] },            
    },
    { timestamps: true }
  );

const DoctorfeedbackSettings = new mongoose.model("DoctorfeedbackSettings",feedbackPanel);
const DoctorQuestionMapWithQuery = new mongoose.model("DoctorQuestionMapWithQuery",questionsMapWithQuery);


const ShipmentPanel = new mongoose.model("ShipmentPanelSettings", shipmentPanelSchema);

const PaymentIntimationPanelEnableSchema = new mongoose.model("paymentIntimationPanelEnableSchema",paymentIntimationPanelEnableSchema);
const PaymentIntimationPanelSchema2 = new mongoose.model("paymentIntimationPanelSchema2",paymentIntimationPanelSchema2);
const PaymentMsgTempSchema = new mongoose.model("paymentMsgTempSchema",paymentMsgTempSchema);

const ClinicOperationHours = new mongoose.model("ClinicOperationHours",appointmentSettingsSchema);
const AppointmentSlotTypes = new mongoose.model("AppointmentSlotTypes",appointmentslottype);
const ConsultationPriorityMapping = new mongoose.model("ConsultationPriorityMapping",consultationPriorityMapping);
const RescheduleAndRefund = new mongoose.model("rescheduleAndRefund",rescheduleAndRefund);

module.exports = {PaymentMsgTempSchema,PaymentIntimationPanelSchema2,PaymentIntimationPanelEnableSchema,RescheduleAndRefund,DoctorQuestionMapWithQuery,DoctorfeedbackSettings,ClinicOperationHours,AppointmentSlotTypes,ConsultationPriorityMapping,ShipmentPanel};