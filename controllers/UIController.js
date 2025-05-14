const Appointment = require("../models/appointmentModel");
const Patient = require("../models/patientModel");
const Referral = require("../models/referralModel");

exports.pendingAppointment = async (req, res) => {
  try {
    const phone = req.user.phone;
    const user = await Patient.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "Patient not found" });
    }
    const pendingCount = await Appointment.countDocuments({
      patient: user._id,
      status: "pending",
    });
    return res.status(200).json({ pendingAppointments: pendingCount });
  } catch (error) {
    console.error("Error fetching pending appointments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.pendingCoupons = async (req, res) => {
  try {
    const phone = req.user.phone;
    const user = await Patient.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "Patient not found" });
    }
    const availableCoupons = await Referral.countDocuments({
      referrerId: user._id,
      firstAppointmentDone: true,
      isUsed: false,
    });
    return res.status(200).json({ availableCoupons: availableCoupons });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
