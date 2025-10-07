const mongoose = require('mongoose');

const feedbackQuestionSchema = new mongoose.Schema({
    question: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('FeedbackQuestion', feedbackQuestionSchema);