const moment = require("moment-timezone");
const NotificationReminderSettings = require("../models/NotificationReminderSettings");
const Patient = require("../models/patientModel");
const mongoose = require('mongoose');

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
// ... (your model imports at the top are unchanged)

exports.updateMedicationStatus = async (req, res) => {
    try {
        // ... (the first part of your function is unchanged)
        const { patientId } = req.params;
        const { medicineName, doseTime, date, status } = req.body;

        if (!patientId || !medicineName || !doseTime || !date || typeof status !== 'boolean') {
            return res.status(400).json({ message: 'Missing required fields (including date) or invalid status' });
        }
        const reminder = await NotificationReminderSettings.findOne({
            patientId, medicineName, doseTime, date: new Date(date)
        });
        if (!reminder) {
            return res.status(404).json({ message: 'No matching medication reminder found for that specific date' });
        }
        
        reminder.status = status;
        reminder.acknowledged = true;
        if (status === true) { /* ... quantity logic ... */ }

        const updatedReminder = await reminder.save();

        // --- BACKGROUND LOGIC STARTS HERE ---
        try {
            const [patient, remainingDosesCount] = await Promise.all([
                Patient.findById(patientId).select('follow'),
                NotificationReminderSettings.countDocuments({ patientId: patientId, status: null })
            ]);

            // --- THIS BLOCK WAS REMOVED ---
            // The old logic for remainingDosesCount === 1 is now gone.
            // -----------------------------

            // Inactivate Status Trigger (when 0 doses are left)
            if (remainingDosesCount === 0) {
                console.log(`Patient ${patientId} has completed their course.`);
                
                // --- 1. UPDATE STATUS TO INACTIVE (Unchanged) ---
                const prescription = await Prescription.findById(reminder.prescriptionId).select('appointmentID');
                const patientUpdate = Patient.findByIdAndUpdate(patientId, {
                    follow: "Inactive",
                    stage: "Inactive"
                });
                let appointmentUpdate = Promise.resolve();
                if (prescription && prescription.appointmentID) {
                    appointmentUpdate = Appointment.findByIdAndUpdate(prescription.appointmentID, {
                        follow: "Inactive"
                    });
                }
                await Promise.all([patientUpdate, appointmentUpdate]);

                // --- 2. SEND FEEDBACK REQUEST (Moved here) ---
                if (patient && patient.follow === 'Patient Care') {
                    console.log(`Triggering feedback for patient ${patientId}: Course completed.`);
                    const lastAppointment = await Appointment.findOne({ patientId: patientId, status: 'completed' }).sort({ updatedAt: -1 });

                    if (lastAppointment) {
                        const io = req.app.get('socketio');
                        io.to(`user_${patientId}`).emit("requestFeedback", {
                            // Message updated for course completion
                            message: "You've completed your course! We'd love to get your feedback on your experience.",
                            appointmentId: lastAppointment._id,
                            doctorId: lastAppointment.doctor
                        });
                    }
                }
            }
        } catch (backgroundLogicError) {
            console.error("Error in background trigger logic:", backgroundLogicError);
        }
        // --- BACKGROUND LOGIC ENDS HERE ---

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