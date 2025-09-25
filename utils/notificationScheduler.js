const cron = require('node-cron');
const Appointment = require('../models/appointmentModel'); // Adjust path
const Notification = require('../models/notificationHub');  // Adjust path
const NotificationReminderSettings = require('../models/NotificationReminderSettings'); // Adjust path
const { pushnotificationModel } = require("../models/pushNotificationModel"); // Adjust path
const admin = require("../configs/firebase"); // Your initialized Firebase Admin SDK

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

// --- THIS IS THE MISSING FUNCTION ---
/**
 * Schedules the reminder function to run.
 */
const startReminderCronJob = () => {
  // Runs every 5 minutes
  cron.schedule('*/5 * * * *', generateAppointmentReminders, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log('✅ Appointment reminder cron job scheduled to run every 5 minutes.');
};
// ------------------------------------

/**
 * Finds and sends pending medicine reminders.
 */
const generateMedicineReminders = async () => {
    try {
        console.log('Running cron job: Checking for medicine reminders...');
        const now = new Date();

        // 1. Find all reminders for today that haven't been sent yet
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const pendingReminders = await NotificationReminderSettings.find({
            date: { $gte: startOfToday, $lte: endOfToday },
            reminderSent: false
        });

        if (pendingReminders.length === 0) {
            console.log('No pending medicine reminders found for today.');
            return;
        }

        const remindersToSend = [];
        for (const reminder of pendingReminders) {
            const [hours, minutes] = reminder.doseTime.split(':');
            const doseDateTime = new Date(reminder.date);
            doseDateTime.setHours(hours, minutes, 0, 0);

            // Calculate the exact time the reminder should be sent
            const reminderMinutes = reminder.reminderSetting || 5; // Default to 5 mins if not set
            const scheduledReminderTime = new Date(doseDateTime.getTime() - reminderMinutes * 60 * 1000);

            // If the scheduled time is now or in the past, it's time to send
            if (scheduledReminderTime <= now) {
                remindersToSend.push(reminder);
            }
        }

        if (remindersToSend.length === 0) {
            console.log('No medicine reminders due at this exact minute.');
            return;
        }

        const sentReminderIds = [];

        for (const reminder of remindersToSend) {
            // Create a nicely formatted time string (e.g., "3:03 PM")
            const [hours, minutes] = reminder.doseTime.split(':');
            const doseTimeObject = new Date();
            doseTimeObject.setHours(hours, minutes, 0, 0);
            const formattedDoseTime = doseTimeObject.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

            // This is the improved notification message
            const notificationMessage = `Reminder: It's time to take your ${reminder.medicineName} at ${formattedDoseTime}.`;

            // 2. Create the in-app notification
            await Notification.create({
                recipient: reminder.patientId,
                message: notificationMessage,
                type: 'MEDICINE_REMINDER',
                link: `/prescriptions/${reminder.prescriptionId}`,
            });

            // 3. Send the Push Notification
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
                    console.log(`Push notification sent for medicine reminder to patient: ${reminder.patientId}`);
                }
            } catch (pushError) {
                console.error(`Failed to send medicine reminder push notification:`, pushError);
            }

            sentReminderIds.push(reminder._id);
        }

        // 4. Mark the reminders as sent to prevent duplicates
        if (sentReminderIds.length > 0) {
            await NotificationReminderSettings.updateMany(
                { _id: { $in: sentReminderIds } },
                { $set: { reminderSent: true } }
            );
            console.log(`Successfully sent and updated ${sentReminderIds.length} medicine reminders.`);
        }

    } catch (error) {
        console.error('Error running medicine reminder cron job:', error);
    }
};

/**
 * Schedules the medicine reminder cron job to run.
 */
const startMedicineReminderCronJob = () => {
    // Runs every minute
    cron.schedule('* * * * *', generateMedicineReminders, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('✅ Medicine reminder cron job scheduled to run every minute.');
};
const generateExactTimeReminders = async () => {
    try {
        console.log('Running cron job: Checking for exact-time medicine notifications...');
        const now = new Date();

        const currentTime = now.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
        });
        
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const dueReminders = await NotificationReminderSettings.find({
            date: { $gte: startOfToday, $lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) },
            doseTime: currentTime,
            reminderSent: false
        });

        if (dueReminders.length === 0) {
            console.log(`No exact-time reminders due at ${currentTime}.`);
            return;
        }

        const sentReminderIds = [];

        for (const reminder of dueReminders) {
            const notificationMessage = `It's time to take your medicine: ${reminder.medicineName}.`;
            
            // --- MODIFICATION IS HERE ---
            const pushInfo = await pushnotificationModel.findOne({ patientId: reminder.patientId });
            if (pushInfo && pushInfo.token) {
                const message = {
                    notification: {
                        title: 'Time for your medicine! 💊',
                        body: notificationMessage
                    },
                    // Add this data payload to trigger actions
                    data: {
                        // A category for the app to identify the button layout
                        actionCategory: "MEDICATION_RESPONSE", 
                        
                        // Pass the exact details the app needs to call your API
                        patientId: reminder.patientId.toString(),
                        medicineName: reminder.medicineName,
                        doseTime: reminder.doseTime,
                        date: reminder.date.toISOString().split('T')[0] // Format as YYYY-MM-DD
                    },
                    apns: {
                        payload: {
                            aps: {
                                category: "MEDICATION_RESPONSE" // For iOS
                            }
                        }
                    },
                    token: pushInfo.token
                };
                
                try {
                    await admin.messaging().send(message);
                    console.log(`Actionable push notification sent to patient: ${reminder.patientId}`);
                } catch (pushError) {
                    console.error(`Failed to send actionable push notification:`, pushError);
                }
            }
            
            // The in-app notification remains the same
            await Notification.create({ /* ... */ });
            
            sentReminderIds.push(reminder._id);
        }

        if (sentReminderIds.length > 0) {
            await NotificationReminderSettings.updateMany(
                { _id: { $in: sentReminderIds } },
                { $set: { reminderSent: true } }
            );
            console.log(`Successfully sent and updated ${sentReminderIds.length} actionable reminders.`);
        }

    } catch (error) {
        console.error('Error running exact-time reminder cron job:', error);
    }
};
const startExactTimeReminderCronJob = () => {
    // Runs every minute
    cron.schedule('* * * * *', generateExactTimeReminders, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('✅ Exact-time medicine reminder cron job scheduled to run every minute.');
};


// Now the export will work correctly because the function exists
module.exports = { startReminderCronJob,startMedicineReminderCronJob,startExactTimeReminderCronJob};