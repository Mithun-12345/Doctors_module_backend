const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true
    },
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
        unique: true // A patient can only leave one feedback per appointment
    },
    ratings: {
        consultation: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        medicineDelivery: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        communication: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        }
    },
    averageScore: {
        type: Number,
        required: true
    },
    comment: {
        type: String,
        trim: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Feedback', feedbackSchema);