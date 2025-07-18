const Prescription = require('../models/Prescription');
const moment = require('moment-timezone');
const NotificationReminderSettings = require('../models/NotificationReminderSettings');

const generateMedicationSchedule = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    console.log('📥 Received request for prescription ID:', prescriptionId);

    if (!prescriptionId) {
      return res.status(400).json({ message: 'Missing prescriptionId in request' });
    }

    const prescription = await Prescription.findById(prescriptionId).lean();
    if (!prescription || !prescription.prescriptionItems?.length) {
      return res.status(404).json({ message: 'Prescription not found or empty' });
    }

    const startDate = prescription.startDate;
    if (!startDate) {
      return res.status(400).json({ message: 'Missing startDate in prescription' });
    }

    const finalSchedule = [];

    for (const item of prescription.prescriptionItems) {
      const { medicineName, frequencies } = item;
      const medicineSchedule = [];

      if (frequencies?.length > 0) {
        for (const freq of frequencies) {
          const {
            day,
            frequencyType,
            standardFrequency,
            frequentFrequency,
            parallelConsumption,
            timings
          } = freq;

          if (!day) continue;
          const date = moment(startDate).add(day - 1, 'days').format('YYYY-MM-DD');

          // Standard Frequency
          if (frequencyType === 'standard') {
            const timeSlots = ['morning', 'afternoon', 'evening', 'night'];
            for (const slot of timeSlots) {
              const timing = standardFrequency?.[slot];
              if (timing?.from) {
                medicineSchedule.push({ date, time: timing.from, day });
              }
            }
          }

          // Parallel Consumption (independent of frequencyType)
          if (parallelConsumption?.schedule?.length > 0) {
            for (const nested of parallelConsumption.schedule) {
              const nestedDate = moment(startDate).add(nested.day - 1, 'days').format('YYYY-MM-DD');
              if (nested.time) {
                medicineSchedule.push({
                  date: nestedDate,
                  time: nested.time,
                  day: nested.day
                });
              }
            }
          }

          // Frequent Frequency (include timings regardless of parallelConsumption)
          if (frequencyType === 'frequent') {
            if (timings?.length > 0) {
              for (const time of timings) {
                medicineSchedule.push({ date, time, day });
              }
            } else if (
              frequentFrequency?.doses &&
              (frequentFrequency.hours || frequentFrequency.minutes)
            ) {
              const totalDoses = frequentFrequency.doses;
              const intervalMinutes = (frequentFrequency.hours || 0) * 60 + (frequentFrequency.minutes || 0);
              const startTime = timings?.[0] || '08:00';
              const firstDose = moment(startTime, 'HH:mm');

              for (let i = 0; i < totalDoses; i++) {
                const doseTime = firstDose.clone().add(i * intervalMinutes, 'minutes');
                medicineSchedule.push({
                  date,
                  time: doseTime.format('HH:mm'),
                  day
                });
              }
            }
          }
        }
      }

      if (medicineSchedule.length > 0) {
        finalSchedule.push({
          medicineName,
          schedule: medicineSchedule
        });
      }
    }

    const remindersToInsert = finalSchedule.flatMap(entry =>
      entry.schedule.map(s => ({
        prescriptionId: prescription._id,
        patientId: prescription.patientId,
        doctorId: prescription.doctorId,
        medicineName: entry.medicineName,
        date: new Date(`${s.date}T${s.time}:00Z`),
        doseTime: s.time,
        day: s.day
      }))
    );

    if (remindersToInsert.length > 0) {
      await NotificationReminderSettings.insertMany(remindersToInsert);
      console.log(`✅ ${remindersToInsert.length} reminders saved`);
    }

    return res.json({
      schedules: finalSchedule.map(({ medicineName, schedule }) => ({
        medicineName,
        schedule: schedule.map(({ date, time }) => ({ date, time }))
      }))
    });
  } catch (error) {
    console.error('🔥 Schedule Generation Error:', error);
    return res.status(500).json({ message: 'Server error generating schedule' });
  }
};


module.exports = generateMedicationSchedule;


