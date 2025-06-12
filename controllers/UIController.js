const Appointment = require("../models/appointmentModel");
const Patient = require("../models/patientModel");
const Referral = require("../models/referralModel");
const Transaction = require("../models/Transaction");

const moment = require("moment");

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

exports.upComingAppointment = async (req, res) => {
  try {
    const phone = req.user.phone;

    const user = await Patient.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const upcomingAppointment = await Appointment.findOne({
      patient: user._id,
      appointmentDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      status: { $in: ["pending"] },
    })
      .populate("doctor", "name") // only get the name field from the doctor
      .sort({ appointmentDate: 1 }); // earliest upcoming appointment

    if (!upcomingAppointment) {
      return res
        .status(200)
        .json({ message: "No upcoming appointments", appointment: null });
    }

    const result = {
      doctorName: upcomingAppointment.doctor?.name || "Doctor not assigned",
      date: upcomingAppointment.appointmentDate,
      timeSlot: upcomingAppointment.timeSlot,
    };

    return res.status(200).json({ appointment: result });
  } catch (error) {
    console.error("Error fetching upcoming appointment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.transactionHistory = async (req, res) => {
  try {
    const phone = req.user.phone;

    const user = await Patient.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const transactions = await Transaction.find({ patientId: user._id })
      .sort({ createdAt: -1 })
      .limit(2)
      .select("amount service createdAt");

    const formatted = transactions.map((txn) => ({
      service: txn.service,
      date: moment(txn.createdAt).format("DD MMM YYYY"),
      amount: `Rs.${txn.amount}`,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.pendingTransactions = async (req, res) => {
  try {
    const phone = req.user.phone;

    const user = await Patient.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const transaction = await Transaction.sort({ date: 1 }).findOne({
      patientId: user._id,
      status: "pending",
    });

    if (!transaction) {
      return res.status(404).json({ message: "No pending transactions found" });
    }

    return res.status(200).json({
      service: transaction.service,
      date: transaction.date,
      amount: transaction.amount,
    });
  } catch (error) {
    console.error("Error fetching pending transaction:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
