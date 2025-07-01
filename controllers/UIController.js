const Appointment = require("../models/appointmentModel");
const Patient = require("../models/patientModel");
const Referral = require("../models/referralModel");
const Transaction = require("../models/Transaction");
const Payment = require("../models/Payment");

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

exports.referFriendUI = async (req, res) => {
  try {
    const referrals = await Referral.find({ referrerId: req.user._id });

    const now = new Date();

    const referralData = referrals.map((ref) => {
      let status;

      if (ref.expiresAt && ref.expiresAt < now) {
        status = "Outdated";
      } else if (ref.firstAppointmentDone && !ref.isUsed) {
        status = "Accepted";
      } else {
        status = "Pending";
      }

      return {
        friendName: ref.referredFriendName || "N/A",
        date: ref.createdAt
          ? new Date(ref.createdAt).toLocaleDateString()
          : "N/A",
        referralCode: ref.code,
        validity: ref.expiresAt
          ? new Date(ref.expiresAt).toLocaleDateString()
          : "N/A",
        status,
      };
    });

    return res.status(200).json({ referrals: referralData });
  } catch (error) {
    console.error("Referral fetch error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.appointments = async (req, res) => {
  try {
    const phone = req.user.phone;

    const user = await Patient.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalAppointments = await Appointment.countDocuments({
      patient: user._id,
    });

    const appointments = await Appointment.find({ patient: user._id })
      .sort({ appointmentDate: -1 }) // newest first
      .skip(skip)
      .limit(limit)
      .populate("doctor") // populate doctor info if needed
      .populate("patient");

    res.json({
      data: appointments,
      currentPage: page,
      totalPages: Math.ceil(totalAppointments / limit),
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPatientPayments = async (req, res) => {
  try {
    const patientId = req.user._id;

    // Find appointments for this patient
    const appointments = await Appointment.find({ patient: patientId }).select(
      "_id"
    );
    const appointmentIds = appointments.map((a) => a._id);

    // Find payments linked to those appointments
    const payments = await Payment.find({
      appointmentId: { $in: appointmentIds },
    })
      .populate({
        path: "appointmentId",
        populate: { path: "doctor", select: "name" },
      })
      .sort({ createdAt: -1 });

    res.json({ data: payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch payments" });
  }
};
