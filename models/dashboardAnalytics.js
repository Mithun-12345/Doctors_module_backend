const mongoose = require('mongoose');

// UPDATED: Reusable sub-schema for storing stats for a single time frame
const TatStatSchema = new mongoose.Schema({
    // We KEEP this for accurate, efficient mathematical calculations.
    averageMilliseconds: {
        type: Number,
        default: 0
    },
    // NEW: We ADD this field to store the human-readable version.
    averageFormatted: {
        type: String,
        default: '0 minutes'
    },
    // Count is still essential for calculating the running average.
    count: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, { _id: false });


// This schema remains the same, as it just uses the TatStatSchema above
const ProcessTatSchema = new mongoose.Schema({
    daily: TatStatSchema,
    weekly: TatStatSchema,
    monthly: TatStatSchema,
    overall: TatStatSchema
}, { _id: false });


// The main schema also remains the same
const analyticsSchema = new mongoose.Schema({
    identifier: {
        type: String,
        default: 'global_summary',
        unique: true,
        required: true,
    },
    appointmentToPrescription: ProcessTatSchema,
    prescriptionToPayment: ProcessTatSchema,
    paymentToPreparation: ProcessTatSchema,
    preparationToShipment: ProcessTatSchema,
    shipmentToDelivery: ProcessTatSchema,
    shipmentToPatientCare: ProcessTatSchema, // RENAMED: from shipmentToDelivery
    
    // --- High-Level Metrics ---
    endToEndCycle: ProcessTatSchema, // RENAMED: from completeCycle. Still measures the full journey.
    overallAverageTat: ProcessTatSchema, // NEW: Will store the average of all the individual steps
}, { timestamps: true });

module.exports = mongoose.model('Analytics', analyticsSchema);