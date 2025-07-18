const mongoose = require('mongoose');

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
required: true // Ensure time is specified
},
reminderSetting: {
type: Number,
enum: [5, 10, 15, 20, 25, 30],
default: 5
},
reminderTune: {
type: String,
enum: ['a', 'b', 'c']
},
reminderSent: {
type: Boolean,
default: false
},
status: {
type: Boolean,
default: null // Can be true (acknowledged), false (missed), or null (pending)
},
followUpSent: {
type: Boolean,
default: false
},
acknowledged: {
type: Boolean,
default: false // Optional: can mirror status or be removed if redundant
}
}, {
timestamps: true
});

// Enforce uniqueness per patient + medicine + date + time
notificationReminderSettingsSchema.index(
{ patientId: 1, medicineName: 1, date: 1, doseTime: 1 },
{ unique: true }
);

module.exports = mongoose.model('NotificationReminderSettings', notificationReminderSettingsSchema);
