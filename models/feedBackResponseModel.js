const mongoose = require('mongoose');

const feedbackResponseSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    responses: [{
        question: { type: String, required: true },
        category: { type: String, required: true },
        rating: { type: Number, required: true, min: 1, max: 5 }
    }],
    averageScore: { type: Number, required: true },
    comment: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('FeedbackResponse', feedbackResponseSchema);