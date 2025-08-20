const cron = require('node-cron');
const Appointment = require('../models/appointmentModel'); // Adjust path
const Notification = require('../models/notificationHub');  // Adjust path

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

// Now the export will work correctly because the function exists
module.exports = { startReminderCronJob };