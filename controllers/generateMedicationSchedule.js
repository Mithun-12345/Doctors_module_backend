const moment = require("moment-timezone");
const NotificationReminderSettings = require("../models/NotificationReminderSettings");
const Patient = require("../models/patientModel");

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

// ✅ PATCH: Update Status for a Medication Dose
exports.updateMedicationStatus = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { medicineName, doseTime, status } = req.body;

    if (
      !patientId ||
      !medicineName ||
      !doseTime ||
      typeof status !== "boolean"
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const todayIST = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
    const fullIST = moment.tz(
      `${todayIST} ${doseTime}`,
      "YYYY-MM-DD HH:mm",
      "Asia/Kolkata"
    );
    const fullUTC = fullIST.clone().utc().toDate();

    const updated = await NotificationReminderSettings.findOneAndUpdate(
      {
        patientId,
        medicineName,
        date: fullUTC,
      },
      {
        status: status,
        acknowledged: true,
      },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ message: "No matching reminder found to update" });
    }

    return res.status(200).json({
      message: `Medication status updated to ${status ? "taken" : "not taken"}`,
      updated,
    });
  } catch (err) {
    console.error("🔥 Error updating medication status:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

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
