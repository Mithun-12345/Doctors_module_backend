const moment = require("moment-timezone");
const NotificationReminderSettings = require("../models/NotificationReminderSettings");
const Patient = require("../models/patientModel");
const mongoose = require('mongoose');
const Prescription = require("../models/Prescription");
const asyncHandler = require("express-async-handler");
const axios = require("axios");
const MedicalDetails = require("../models/patientDetails");
const PatientDetails = require("../models/patientDetails");
const ChronicPatient = require("../models/chronicModel");
const Payment = require("../models/Payment");
const FamilyLink = require("../models/FamilyLink");
const Appointment = require("../models/appointmentModel");
const Referral = require("../models/referralModel");
const { ClinicOperationHours, AppointmentSlotTypes } = require("../models/consultationMessengerSettings"); // Adjust path
require("dotenv").config({ path: "./config/.env" });
// Add this new line right below the one you just changed
const { DoctorPrefinedAppointmentDetails } = require('../models/doctorPrefinedSettings'); // Or whatever you named the file
const Doctor = require("../models/doctorModel");
const momentIST = require("moment-timezone");
const twilio = require("twilio");
const fs = require("fs");
const crypto = require("crypto");
const { google } = require("googleapis");
const { createGoogleMeet } = require("./Gmeet");
const cloudinary = require("cloudinary").v2;
const Notification = require("../models/notificationHub");
// patientController.js
const UserGoogleTokens = require("../models/UserTokenSchema");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);
const bcrypt = require("bcrypt");
const PatientNotification = require("../models/PatientNotification");
const admin = require("../configs/firebase");
const {pushnotificationModel} = require("../models/pushNotificationModel");
const Message = require('../models/messageModel'); // Or whatever the path to your file is
const DebitCreditNote = require('../models/debitCredit'); // Adjust the path as needed
const MedicinePreparationSummary = require('../models/MedicinePreparationSummary'); // Adjust path
const Analytics = require('../models/dashboardAnalytics'); // The model we created earlier
const Feedback = require('../models/appRatings');
const RawMaterial = require('../models/RawMaterial'); // Adjust the path if needed
const Order = require('../models/Order'); // Adjust path
const Vendor = require('../models/Vendor'); // Make sure Vendor model is imported
const FeedbackQuestion = require('../models/feedbackQuestions');
const FeedbackResponse = require('../models/feedBackResponseModel');


// ✅ GET: Today's Medication Schedule
exports.getTodaysMedicationSchedule = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({ message: "Patient ID is required" });
    }

    const todayIST = moment().tz("Asia/Kolkata").startOf("day");
    const tomorrowIST = moment(todayIST).add(1, "day");
    const todayUTC = todayIST.clone().utc();
    const tomorrowUTC = tomorrowIST.clone().utc();

    const reminders = await NotificationReminderSettings.find({
      patientId,
      date: { $gte: todayUTC.toDate(), $lt: tomorrowUTC.toDate() },
    }).sort({ date: 1 });

    if (!reminders.length) {
      return res.status(200).json({
        message: "No medications scheduled for today",
        medications: [],
      });
    }

    const schedule = reminders.map((r) => {
      const istDate = moment(r.date).tz("Asia/Kolkata");
      return {
        medicineName: r.medicineName,
        date: istDate.format("YYYY-MM-DD"),
        doseTime: r.doseTime,
        day: r.day,
        status: r.status ?? null,
      };
    });

    return res.status(200).json({
      message: "Today's medication schedule",
      medications: schedule,
    });
  } catch (err) {
    console.error("🔥 Error fetching today's medication schedule:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};
exports.updateMedicationStatus = async (req, res) => {
    try {
        console.log("🩺 updateMedicationStatus called");
        const { patientId } = req.params;
        const { medicineName, doseTime, date, status } = req.body;
        console.log("📥 Request data:", { patientId, medicineName, doseTime, date, status });

        if (!patientId || !medicineName || !doseTime || !date || typeof status !== 'boolean') {
            console.warn("⚠️ Missing required fields or invalid status");
            return res.status(400).json({ message: 'Missing required fields (including date) or invalid status' });
        }

        console.log("🔍 Searching for reminder...");
        const reminder = await NotificationReminderSettings.findOne({
            patientId, medicineName, doseTime, date: new Date(date)
        });

        if (!reminder) {
            console.warn(`❌ No reminder found for ${patientId} - ${medicineName} - ${doseTime} - ${date}`);
            return res.status(404).json({ message: 'No matching medication reminder found for that specific date' });
        }

        console.log("✅ Reminder found:", reminder._id);

        reminder.status = status;
        reminder.acknowledged = true;
        console.log(`💊 Setting status to ${status}, acknowledged = true`);

        if (status === true) {
            console.log("📊 Running quantity calculation logic (if any)...");
            // ... quantity calculation logic ...
        }

        console.log("💾 Saving updated reminder...");
        const updatedReminder = await reminder.save();
        console.log("✅ Reminder saved:", updatedReminder._id);

        // --- BACKGROUND LOGIC ---
        console.log("🧠 Running background logic...");
        try {
            const [patient, remainingDosesCount] = await Promise.all([
                Patient.findById(patientId).select('follow'),
                NotificationReminderSettings.countDocuments({ patientId: patientId, status: null })
            ]);
            console.log("📊 Background data:", { patientFollow: patient?.follow, remainingDosesCount });

            if (remainingDosesCount === 0) {
                console.log("🎉 All doses completed for patient:", patientId);

                // --- 1. SEND FEEDBACK REQUEST ---
                if (patient && patient.follow === 'Patient Care') {
                    console.log("📨 Patient is under 'Patient Care' - preparing feedback trigger...");

                    // --- THIS IS THE CORRECTED QUERY ---
                    const lastAppointment = await Appointment.findOne({ patient: patientId }).sort({ updatedAt: -1 });
                    console.log("🗓️ Last appointment:", lastAppointment?._id || "None");

                    if (lastAppointment) {
                        const io = req.app.get('socketio');
                        io.to(`user_${patientId}`).emit("requestFeedback", {
                            message: "You've completed your course! We'd love to get your feedback on your experience.",
                            appointmentId: lastAppointment._id,
                            doctorId: lastAppointment.doctor
                        });
                        console.log(`✅ Feedback signal ('requestFeedback') sent to patient: ${patientId}`);
                    } else {
                        console.log("⚠️ No last appointment found, skipping feedback emit");
                    }
                }

                // --- 2. UPDATE STATUS TO INACTIVE ---
                console.log("🧩 Updating prescription, patient, and appointment statuses to 'Inactive'...");
                const prescription = await Prescription.findById(reminder.prescriptionId).select('appointmentID');
                console.log("💊 Found prescription:", prescription?._id || "None", "→ appointmentID:", prescription?.appointmentID || "None");

                const patientUpdate = Patient.findByIdAndUpdate(patientId, { follow: "Inactive", stage: "Inactive" });
                let appointmentUpdate = prescription?.appointmentID
                    ? Appointment.findByIdAndUpdate(prescription.appointmentID, { follow: "Inactive" })
                    : Promise.resolve();

                await Promise.all([patientUpdate, appointmentUpdate]);
                console.log("✅ Patient and appointment updated to 'Inactive'");
            } else {
                console.log("⏳ Remaining doses still pending:", remainingDosesCount);
            }
        } catch (backgroundLogicError) {
            console.error("❗ Error in background trigger logic:", backgroundLogicError);
        }

        console.log("✅ Successfully updated medication status");
        return res.status(200).json({
            message: `Medication status updated to ${status ? 'taken' : 'not taken'}`,
            updated: updatedReminder
        });

    } catch (err) {
        console.error('🔥 Error updating medication status:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

exports.getMedicationForDailyIntake = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({ message: "Patient ID is required" });
    }

    const todayIST = moment().tz("Asia/Kolkata").startOf("day");
    const tomorrowIST = moment(todayIST).add(1, "day");
    const todayUTC = todayIST.clone().utc();
    const tomorrowUTC = tomorrowIST.clone().utc();

    const reminders = await NotificationReminderSettings.find({
      patientId,
      date: { $gte: todayUTC.toDate(), $lt: tomorrowUTC.toDate() },
    }).sort({ date: 1 });

    if (!reminders.length) {
      return res.status(200).json({
        message: "No medications scheduled for today",
        medications: [],
      });
    }

    const schedule = reminders.map((r) => {
      const istDate = moment(r.date).tz("Asia/Kolkata");
      let statusLabel = "Pending";
      if (r.status === true) statusLabel = "Taken";
      else if (r.status === false) statusLabel = "Missed";

      return {
        medicineName: r.medicineName,
        date: istDate.format("YYYY-MM-DD"),
        doseTime: r.doseTime,
        day: r.day,
        status: statusLabel,
      };
    });

    return res.status(200).json({
      message: "Today's medication schedule",
      medications: schedule,
    });
  } catch (err) {
    console.error("🔥 Error fetching today's medication schedule:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// ✅ GET: Notify Doctor if 2+ Doses Missed
exports.notifyDoctorOfMissedDoses = async (req, res) => {
  try {
    const { doctorId } = req.params;

    if (!doctorId) {
      return res.status(400).json({ message: "Doctor ID is required" });
    }

    const todayIST = moment().tz("Asia/Kolkata").startOf("day");
    const tomorrowIST = moment(todayIST).add(1, "day");
    const todayUTC = todayIST.clone().utc();
    const tomorrowUTC = tomorrowIST.clone().utc();

    const missedReminders = await NotificationReminderSettings.find({
      doctorId,
      date: { $gte: todayUTC.toDate(), $lt: tomorrowUTC.toDate() },
      $or: [
        { status: false },
        { status: { $exists: false } },
        { status: null },
      ],
    });

    if (!missedReminders.length) {
      return res
        .status(200)
        .json({ message: "No missed doses for any patient today." });
    }

    const patientMissedMap = {};
    for (const reminder of missedReminders) {
      const pid = reminder.patientId.toString();
      if (!patientMissedMap[pid]) {
        patientMissedMap[pid] = [];
      }
      patientMissedMap[pid].push(reminder);
    }

    const patientIds = Object.keys(patientMissedMap);
    const patients = await Patient.find({ _id: { $in: patientIds } });

    const notifications = [];

    for (const patient of patients) {
      const reminders = patientMissedMap[patient._id.toString()];
      const missedCount = reminders.length;

      if (missedCount >= 2) {
        const medicineNames = [
          ...new Set(reminders.map((r) => r.medicineName).filter(Boolean)),
        ];

        const message = `Patient ${
          patient.name
        } missed ${missedCount} doses today (${medicineNames.join(", ")}).`;

        notifications.push(message);
      }
    }

    if (notifications.length === 0) {
      return res
        .status(200)
        .json({ message: "No patients missed 2 or more doses today." });
    }

    return res.status(200).json({
      message: "Doctor notifications generated successfully.",
      notifications,
    });
  } catch (err) {
    console.error("Error generating doctor notifications:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};
exports.getMedicationStockStatus = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    const stockStatus = await NotificationReminderSettings.aggregate([
      {
        $match: { patientId: new mongoose.Types.ObjectId(patientId) }
      },
      {
        $group: {
          _id: {
            medicineName: "$medicineName",
            dispenseQuantity: "$dispenseQuantity",
            form: "$form"
          },
          totalQuantityConsumed: { $sum: "$quantityConsumed" }
        }
      },
      {
        $project: {
          _id: 0,
          medicineName: "$_id.medicineName",
          dispenseQuantity: "$_id.dispenseQuantity",
          form: "$_id.form",
          totalQuantityConsumed: 1
        }
      }
    ]);

    const finalReport = stockStatus.map(med => {
      const match = med.dispenseQuantity ? med.dispenseQuantity.match(/(\d+(\.\d+)?)/) : null;
      const numericDispenseQty = match ? parseFloat(match[0]) : 0;

      let medicineStatus = "Available";

      if (numericDispenseQty > 0) {
        const percentageUsed = (med.totalQuantityConsumed / numericDispenseQty) * 100;
        if (percentageUsed > 80) {
          medicineStatus = "Low Stock";
        }
      }

      // ✅ **Calculate the remaining quantity**
      const quantityRemaining = numericDispenseQty - med.totalQuantityConsumed;

      return {
        ...med,
        medicineStatus,
        quantityRemaining // ✅ Add it to the response**
      };
    });

    return res.status(200).json(finalReport);

  } catch (err) {
    console.error('🔥 Error getting medication stock status:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};
exports.getMedicationStockStatusByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    if (!doctorId) {
      return res.status(400).json({ message: 'Doctor ID is required' });
    }

    // This pipeline is multi-stage to achieve the desired grouping and data lookup
    let patientReports = await NotificationReminderSettings.aggregate([
      // Step 1: Find all reminders for the given doctor
      {
        $match: { doctorId: new mongoose.Types.ObjectId(doctorId) }
      },
      // Step 2: Group by patient and their unique medicine stock to sum consumption
      {
        $group: {
          _id: {
            patientId: "$patientId",
            medicineName: "$medicineName",
            dispenseQuantity: "$dispenseQuantity",
            form: "$form"
          },
          totalQuantityConsumed: { $sum: "$quantityConsumed" }
        }
      },
      // Step 3: Join with the 'patients' collection to get each patient's name
      {
        $lookup: {
          from: 'patients', // The name of your patients collection
          localField: '_id.patientId',
          foreignField: '_id',
          as: 'patientInfo'
        }
      },
      { $unwind: "$patientInfo" }, // Unpack the patientInfo array created by $lookup
      // Step 4: Group again, this time by patient, to create the nested structure
      {
        $group: {
          _id: "$_id.patientId",
          patientName: { $first: "$patientInfo.name" },
          medicationStock: {
            $push: { // Push each medicine's details into a 'medicationStock' array
              medicineName: "$_id.medicineName",
              dispenseQuantity: "$_id.dispenseQuantity",
              form: "$_id.form",
              totalQuantityConsumed: "$totalQuantityConsumed"
            }
          }
        }
      },
      // Step 5: Final projection for a clean output
      {
        $project: {
          _id: 0,
          patientId: "$_id",
          patientName: 1,
          medicationStock: 1
        }
      }
    ]);

    // Step 6: Loop through the results to calculate status and remaining quantity
    patientReports.forEach(report => {
      report.medicationStock = report.medicationStock.map(med => {
        const match = med.dispenseQuantity ? med.dispenseQuantity.match(/(\d+(\.\d+)?)/) : null;
        const numericDispenseQty = match ? parseFloat(match[0]) : 0;

        let medicineStatus = "Available";
        if (numericDispenseQty > 0) {
          const percentageUsed = (med.totalQuantityConsumed / numericDispenseQty) * 100;
          if (percentageUsed > 80) {
            medicineStatus = "Low Stock";
          }
        }

        const quantityRemaining = numericDispenseQty - med.totalQuantityConsumed;

        return { ...med, medicineStatus, quantityRemaining };
      });
    });

    return res.status(200).json(patientReports);

  } catch (err) {
    console.error('🔥 Error getting medication stock status by doctor:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};