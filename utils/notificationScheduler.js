const cron = require('node-cron');
const Appointment = require('../models/appointmentModel'); // Adjust path
const Notification = require('../models/notificationHub');  // Adjust path
const NotificationReminderSettings = require('../models/NotificationReminderSettings'); // Adjust path
const { pushnotificationModel } = require("../models/pushNotificationModel"); // Adjust path
const admin = require("../configs/firebase"); // Your initialized Firebase Admin SDK
const { calculateOverallTatAnalytics,getOverallClinicAnalytics } = require('../controllers/dashboardAnalyticsController'); // Adjust path
const Patient = require('../models/patientModel'); // Adjust path to your Patient model

// --- NEW FUNCTION: Update Welcome Call Status ---
const updateWelcomeCallStatuses = async () => {
  try {
    console.log('Running cron job: Updating Welcome Call statuses to Overdue...');
    const now = new Date();

    // efficient single-command update
    const result = await Patient.updateMany(
      {
        // 1. Target calls that are currently Pending
        'newPatientFollowUp.status': 'Pending',
        // 2. AND where the scheduled time has already passed
        'newPatientFollowUp.scheduledTime': { $lt: now }
      },
      {
        // 3. Update status to Overdue
        $set: { 'newPatientFollowUp.status': 'Overdue' }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ Successfully marked ${result.modifiedCount} welcome calls as 'Overdue'.`);
    } else {
      console.log('No pending welcome calls have exceeded their scheduled time.');
    }

  } catch (error) {
    console.error('Error running welcome call status update:', error);
  }
};

// --- SCHEDULER ---
const startWelcomeCallStatusCronJob = () => {
  // Run every 10 minutes
  cron.schedule('*/1 * * * *', updateWelcomeCallStatuses, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  console.log('✅ Welcome Call status update cron job scheduled to run every 1 minutes.');
};

// No changes to this function. It is correct.
const generateAppointmentReminders = async () => {
  try {
    console.log('Running cron job: Checking for upcoming appointment reminders...');
    const now = new Date();
    const searchStart = new Date(now.getTime() + 115 * 60 * 1000);
    const searchEnd = new Date(now.getTime() + 120 * 60 * 1000);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todaysAppointments = await Appointment.find({
      status: 'confirmed',
      appointmentDate: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    }).populate({ path: 'doctor', select: 'name -_id' });

    if (todaysAppointments.length === 0) {
      console.log('No confirmed appointments found for today.');
      return;
    }

    const appointmentsToNotify = todaysAppointments.filter(appt => {
      const [hours, minutes] = appt.timeSlot.split(':');
      const fullAppointmentTime = new Date(appt.appointmentDate);
      fullAppointmentTime.setHours(hours, minutes, 0, 0);
      return fullAppointmentTime >= searchStart && fullAppointmentTime <= searchEnd;
    });

    if (appointmentsToNotify.length === 0) {
      console.log('No appointments found in the upcoming two-hour window.');
      return;
    }

    for (const appt of appointmentsToNotify) {
      const istFormatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'long',
        timeStyle: 'short',
      });
      const [hours, minutes] = appt.timeSlot.split(':');
      const fullAppointmentTime = new Date(appt.appointmentDate);
      fullAppointmentTime.setHours(hours, minutes, 0, 0);
      const formattedDateTime = istFormatter.format(fullAppointmentTime);
      const doctorName = appt.doctor ? appt.doctor.name : 'your doctor';

      await Notification.create({
        recipient: appt.patient,
        message: `Reminder: Your appointment with ${doctorName} is in two hours at ${formattedDateTime}.`,
        type: 'APPOINTMENT_REMINDER',
        link: `/appointments/${appt._id}`,
      });
      try {
    const pushInfo = await pushnotificationModel.findOne({ patientId: appt.patient });
    if (pushInfo && pushInfo.token) {
        await admin.messaging().send({
            notification: {
                title: "Appointment Reminder",
                body: `Your appointment with ${doctorName} is in two hours at ${formattedDateTime}.`
            },
            token: pushInfo.token
        });
        console.log(`Push notification sent for appointment reminder to patient: ${appt.patient}`);
    }
} catch (pushError) {
    console.error(`Failed to send appointment reminder push notification:`, pushError);
}
    }
    
    console.log(`Successfully created ${appointmentsToNotify.length} appointment reminders.`);
  } catch (error) {
    console.error('Error running appointment reminder cron job:', error);
  }
};

const startReminderCronJob = () => {
  cron.schedule('*/5 * * * *', generateAppointmentReminders, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  console.log('✅ Appointment reminder cron job scheduled to run every 5 minutes.');
};

const generateMedicineReminders = async () => {
    try {
        console.log('Running cron job: Checking for ADVANCE medicine reminders...');
        const now = new Date();

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const pendingReminders = await NotificationReminderSettings.find({
            date: { $gte: startOfToday, $lte: endOfToday },
            reminderSent: false
        });

        if (pendingReminders.length === 0) {
            console.log('No pending advance medicine reminders found for today.');
            return;
        }

        const remindersToSend = [];
        for (const reminder of pendingReminders) {
            const [hours, minutes] = reminder.doseTime.split(':');
            const doseDateTime = new Date(reminder.date);
            doseDateTime.setHours(hours, minutes, 0, 0);
            const reminderMinutes = reminder.reminderSetting || 5;
            const scheduledReminderTime = new Date(doseDateTime.getTime() - reminderMinutes * 60 * 1000);

            if (scheduledReminderTime <= now) {
                remindersToSend.push(reminder);
            }
        }

        if (remindersToSend.length === 0) {
            console.log('No advance medicine reminders due at this exact minute.');
            return;
        }

        for (const reminder of remindersToSend) {
            const [hours, minutes] = reminder.doseTime.split(':');
            const doseTimeObject = new Date();
            doseTimeObject.setHours(hours, minutes, 0, 0);
            const formattedDoseTime = doseTimeObject.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

            // --- IMPROVEMENT 1: Made the message clearer for the advance reminder ---
            const reminderMinutes = reminder.reminderSetting || 5;
            const notificationMessage = `Reminder: Your dose of ${reminder.medicineName} is due in ${reminderMinutes} minutes at ${formattedDoseTime}.`;
            
            await Notification.create({
                recipient: reminder.patientId,
                message: notificationMessage,
                type: 'MEDICINE_REMINDER',
                link: `/prescriptions/${reminder.prescriptionId}`,
            });

            try {
                const pushInfo = await pushnotificationModel.findOne({ patientId: reminder.patientId });
                if (pushInfo && pushInfo.token) {
                    await admin.messaging().send({
                        notification: {
                            title: 'Medicine Reminder 💊',
                            body: notificationMessage
                        },
                        token: pushInfo.token
                    });
                    console.log(`Advance push notification sent to patient: ${reminder.patientId}`);
                }
            } catch (pushError) {
                console.error(`Failed to send advance push notification:`, pushError);
            }
            
            // Mark the reminder as sent immediately after processing
            await NotificationReminderSettings.updateOne({ _id: reminder._id }, { $set: { reminderSent: true } });
        }
        console.log(`Successfully sent and updated ${remindersToSend.length} advance medicine reminders.`);
    } catch (error) {
        console.error('Error running advance medicine reminder cron job:', error);
    }
};

const startMedicineReminderCronJob = () => {
    cron.schedule('* * * * *', generateMedicineReminders, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
    console.log('✅ Advance medicine reminder cron job scheduled to run every minute.');
};

const generateExactTimeReminders = async () => {
    try {
        console.log('Running cron job: Checking for EXACT-TIME medicine notifications...');
        const now = new Date();

        const currentTime = now.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
        });
        
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const dueReminders = await NotificationReminderSettings.find({
            date: { $gte: startOfToday, $lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) },
            doseTime: currentTime,
            onTimeNotificationSent: false,
            status: null // Only send if the user hasn't already acted
        });

        if (dueReminders.length === 0) {
            console.log(`No exact-time reminders due at ${currentTime}.`);
            return;
        }

        for (const reminder of dueReminders) {
            const notificationMessage = `It's time to take your medicine: ${reminder.medicineName}.`;
            
            const pushInfo = await pushnotificationModel.findOne({ patientId: reminder.patientId });
            if (pushInfo && pushInfo.token) {
                const message = {
                    notification: {
                        title: 'Time for your medicine! 💊',
                        body: notificationMessage
                    },
                    data: {
                        actionCategory: "MEDICATION_RESPONSE", 
                        patientId: reminder.patientId.toString(),
                        medicineName: reminder.medicineName,
                        doseTime: reminder.doseTime,
                        date: reminder.date.toISOString().split('T')[0]
                    },
                    apns: { payload: { aps: { category: "MEDICATION_RESPONSE" } } },
                    token: pushInfo.token
                };
                
                try {
                    await admin.messaging().send(message);
                    console.log(`Actionable push notification sent to patient: ${reminder.patientId}`);
                } catch (pushError) {
                    console.error(`Failed to send actionable push notification:`, pushError);
                }
            }
            
            // --- IMPROVEMENT 2: Filled in the missing in-app notification ---
            await Notification.create({
                recipient: reminder.patientId,
                message: notificationMessage,
                type: 'MEDICINE_DOSE_TIME',
                link: `/prescriptions/${reminder.prescriptionId}`
            });
            
            // Mark this specific reminder as sent
            await NotificationReminderSettings.updateOne({ _id: reminder._id }, { $set: { onTimeNotificationSent: true } });
        }
        console.log(`Successfully sent and updated ${dueReminders.length} actionable reminders.`);
    } catch (error) {
        console.error('Error running exact-time reminder cron job:', error);
    }
};

const startExactTimeReminderCronJob = () => {
    cron.schedule('* * * * *', generateExactTimeReminders, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
    console.log('✅ Exact-time medicine reminder cron job scheduled to run every minute.');
};
const updateUserActivityStatus = async () => {
  try {
    console.log('Running cron job: Updating user activity statuses...');
    const now = new Date();

    // Define the date thresholds from today
    const activeThreshold = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
    const inactiveThreshold = new Date(now.getTime() - (120 * 24 * 60 * 60 * 1000));
    const dormantThreshold = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));

    // --- Update Patients ---
    const patientUpdates = [
      // Active: Last login within 60 days
      Patient.updateMany({ lastLoginAt: { $gte: activeThreshold } }, { userStatus: 'Active' }),
      // Inactive: Last login between 61 and 120 days
      Patient.updateMany({ lastLoginAt: { $lt: activeThreshold, $gte: inactiveThreshold } }, { userStatus: 'Inactive' }),
      // Dormant: Last login between 121 and 365 days
      Patient.updateMany({ lastLoginAt: { $lt: inactiveThreshold, $gte: dormantThreshold } }, { userStatus: 'Dormant' }),
      // Exit: Last login more than 365 days ago
      Patient.updateMany({ lastLoginAt: { $lt: dormantThreshold } }, { userStatus: 'Exit' })
    ];
    
    // --- Update Doctors ---
    const doctorUpdates = [
      Doctor.updateMany({ lastLoginAt: { $gte: activeThreshold } }, { userStatus: 'Active' }),
      Doctor.updateMany({ lastLoginAt: { $lt: activeThreshold, $gte: inactiveThreshold } }, { userStatus: 'Inactive' }),
      Doctor.updateMany({ lastLoginAt: { $lt: inactiveThreshold, $gte: dormantThreshold } }, { userStatus: 'Dormant' }),
      Doctor.updateMany({ lastLoginAt: { $lt: dormantThreshold } }, { userStatus: 'Exit' })
    ];
    
    // Run all updates in parallel for efficiency
    await Promise.all([...patientUpdates, ...doctorUpdates]);

    console.log('✅ User activity statuses updated successfully.');
  } catch (error) {
    console.error('Error running user status update cron job:', error);
  }
};
// --- NEW SCHEDULER FUNCTION ---
const startUserStatusCronJob = () => {
  // Schedule to run at 1:00 AM every day
  cron.schedule('0 1 * * *', updateUserActivityStatus, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  console.log('✅ User status update cron job scheduled to run daily at 1:00 AM.');
};
// --- NEW CRON JOB FOR TAT ANALYTICS ---
const startTatAnalyticsCronJob = () => {
    // Schedule to run at 2:00 AM every day
    cron.schedule('0 2 * * *', async () => {
        console.log('Running daily cron job: Calculating TAT Analytics...');
        try {
            // Call the function directly, no need for req, res, or axios
            await calculateOverallTatAnalytics();
        } catch (error) {
            console.error('Error running TAT Analytics cron job:', error.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
    console.log('✅ TAT Analytics cron job scheduled to run daily at 2:00 AM.');
};
/**
 * Schedules the getOverallClinicAnalytics function to run once daily.
 */
const startOverallAnalyticsCronJob = () => {
    // This cron string means 'at 3:00 AM' every day.
    const rule = '0 3 * * *'; 

    cron.schedule(rule, async () => {
        console.log('Running daily job: Calculating Overall Clinic Analytics...');
        try {
            // 2. Create mock request and response objects
            // We use an empty body to get the all-time summary
            const mockReq = {
                body: {} 
            };
            
            // This mock response will just log the output to your console
            const mockRes = {
                status: (code) => {
                    console.log(`Analytics job finished with status: ${code}`);
                    return { json: (data) => console.log('Analytics job response:', data) };
                }
            };
            
            // 3. Call your controller function with the mock objects
            await getOverallClinicAnalytics(mockReq, mockRes);

        } catch (error) {
            console.error('❌ Error running daily Overall Clinic Analytics job:', error);
        }
    });

    console.log('✅ Overall Clinic Analytics job scheduled to run at 3:00 AM.');
};


module.exports = { 
    startReminderCronJob,
    startMedicineReminderCronJob,
    startExactTimeReminderCronJob,
    startUserStatusCronJob,
    startTatAnalyticsCronJob,
    startOverallAnalyticsCronJob,
    startWelcomeCallStatusCronJob
};