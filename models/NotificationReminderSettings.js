const mongoose = require('mongoose');
const { FactorListInstance } = require('twilio/lib/rest/verify/v2/service/entity/factor');

const notificationReminderSettingsSchema = new mongoose.Schema({
prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: false
  },
patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: false
  },
medicineName: {
    type: String,
    required: true
  },
day: {
    type: Number,
    required: false
  },
date: {
    type: Date,
    required: true
  },
doseTime: {
    type: String,
    default: '08:00'
  },
reminderSetting: {
  type: Number,
  enum: [5, 10, 15, 20, 25, 30],
  default: 5
},
reminderTune:{
    type: String,
    enum: ['a','b','c'],
},
reminderSent: {
    type: Boolean,
    default: false
  },
followUpSent: {
    type: Boolean,
    default: false
  },
acknowledged: {
    type: Boolean,
    default: false
  }
}, {
timestamps: true
});

module.exports = mongoose.model('NotificationReminderSettings', notificationReminderSettingsSchema);
