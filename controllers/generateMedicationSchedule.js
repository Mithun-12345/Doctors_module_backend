const moment = require('moment-timezone');
const NotificationReminderSettings = require('../models/NotificationReminderSettings');

// ✅ GET: Today's Medication Schedule
exports.getTodaysMedicationSchedule = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({ message: "Patient ID is required" });
    }

    const todayIST = moment().tz('Asia/Kolkata').startOf('day');
    const tomorrowIST = moment(todayIST).add(1, 'day');
    const todayUTC = todayIST.clone().utc();
    const tomorrowUTC = tomorrowIST.clone().utc();

    const reminders = await NotificationReminderSettings.find({
      patientId,
      date: { $gte: todayUTC.toDate(), $lt: tomorrowUTC.toDate() }
    }).sort({ date: 1 });

    if (!reminders.length) {
      return res.status(200).json({ message: "No medications scheduled for today", medications: [] });
    }

    const schedule = reminders.map(r => {
      const istDate = moment(r.date).tz('Asia/Kolkata');
      return {
        medicineName: r.medicineName,
        date: istDate.format('YYYY-MM-DD'),
        doseTime: istDate.format('HH:mm'),
        day: r.day,
        status: r.Status ?? null
      };
    });

    return res.status(200).json({
      message: "Today's medication schedule",
      medications: schedule
    });
  } catch (err) {
    console.error("🔥 Error fetching today's medication schedule:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

// ✅ PATCH: Update Status for a Medication Dose
exports.updateMedicationStatus = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { medicineName, doseTime, status } = req.body;

    if (!patientId || !medicineName || !doseTime || typeof status !== 'boolean') {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const todayIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    const fullIST = moment.tz(`${todayIST} ${doseTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    const fullUTC = fullIST.clone().utc().toDate();

    const updated = await NotificationReminderSettings.findOneAndUpdate(
      {
        patientId,
        medicineName,
        date: fullUTC
      },
      {
        Status: status,
        acknowledged: true
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'No matching reminder found to update' });
    }

    return res.status(200).json({
      message: `Medication status updated to ${status ? 'taken' : 'not taken'}`,
      updated
    });

  } catch (err) {
    console.error('🔥 Error updating medication status:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// ✅ GET: Notify Doctor if 2+ Doses Missed
exports.notifyDoctorIfPatientMissesDoses = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    const todayIST = moment().tz('Asia/Kolkata').startOf('day');
    const tomorrowIST = moment(todayIST).add(1, 'day');
    const todayUTC = todayIST.clone().utc();
    const tomorrowUTC = tomorrowIST.clone().utc();

    const missedReminders = await NotificationReminderSettings.find({
      patientId,
      date: { $gte: todayUTC.toDate(), $lt: tomorrowUTC.toDate() },
      $or: [
        { Status: false },
        { Status: { $exists: false } },
        { Status: null }
      ]
    });

    if (missedReminders.length < 2) {
      return res.status(200).json({ message: 'Less than 2 doses missed. No notification sent.' });
    }

    const doctorId = missedReminders[0].doctorId;

    const summary = missedReminders.map(r => ({
      medicineName: r.medicineName,
      time: moment(r.date).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm')
    }));

    console.log(`📨 Notify Doctor ${doctorId}: Patient ${patientId} missed ${summary.length} doses`);
    summary.forEach(entry => {
      console.log(`❌ Missed: ${entry.medicineName} at ${entry.time}`);
    });

    return res.status(200).json({
      message: `Doctor notified about ${summary.length} missed medications`,
      doctorId,
      missedDoses: summary
    });

  } catch (err) {
    console.error('🔥 Error checking missed medications:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

