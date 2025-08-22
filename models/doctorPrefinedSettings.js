
const mongoose = require("mongoose")

const doctorPrefinedAppointmentDetails = new mongoose.Schema({
  doctorId : {
    type : mongoose.Schema.Types.ObjectId,
    unique : true
  },
  consultationTime : {
    type : Number
  },
  totalslotPerday : {
    type : Number
  }
},
{timestamps : true}
);

const DoctorPrefinedAppointmentDetails = new mongoose.model("doctorPrefinedAppointmentDetails",doctorPrefinedAppointmentDetails);

module.exports = {DoctorPrefinedAppointmentDetails};