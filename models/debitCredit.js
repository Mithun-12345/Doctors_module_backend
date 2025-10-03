const mongoose = require('mongoose');
const { Schema } = mongoose;
require('../models/doctorModel');

const debitCreditNoteSchema = new Schema({
    /**
     * Unique identifier for the note. Could be a custom string like 'DCN-2025-0001'
     * or a UUID, generated before saving.
     */
    noteId: {
        type: String,
        required: [true, 'Note ID is required.'],
        unique: true,
        trim: true
    },
    /**
     * Specifies whether the note is a Debit or a Credit note.
     */
    noteType: {
        type: String,
        required: [true, 'Note Type is required.'],
        enum: ['Debit', 'Credit']
    },
    /**
     * Identifies if the note is related to accounts receivable (patient-side)
     * or accounts payable (vendor-side).
     */
    linkedType: {
        type: String,
        required: [true, 'Linked Type is required.'],
        enum: ['Receivable', 'Payable']
    },
    /**
     * The ID of the original transaction (e.g., invoice, bill) this note is linked to.
     */
    linkedTransactionId: {
        type: String,
        required: [true, 'Linked Transaction ID is required.'],
        trim: true
    },
    /**
     * The financial category of the adjustment.
     */
    category: {
        type: String,
        required: [true, 'Category is required.'],
    },
    /**
     * The monetary value of the debit/credit note in ₹.
     */
    amount: {
        type: Number,
        required: [true, 'Amount is required.'],
        min: [0, 'Amount cannot be negative.']
    },
    /**
     * A flexible field to store tax details like GST, VAT as a JSON object.
     * Example: { "gst": 18, "gstAmount": 90 }
     */
    taxDetails: {
        type: Schema.Types.Mixed,
        default: null
    },
    /**
     * A brief explanation for issuing the note (e.g., "Refund for returned items").
     */
    reason: {
        type: String,
        required: [true, 'Reason is required.'],
        trim: true
    },
    /**
     * Name or ID of the patient or vendor involved in the transaction.
     */
    issuedToOrBy: {
        type: String,
        required: [true, 'Issued To/By is required.'],
        trim: true
    },
    /**
     * The date the note was officially issued.
     */
    issuedDate: {
        type: Date,
        required: [true, 'Issued Date is required.']
    },
    /**
     * The user ID of the staff member who created this note.
     * It references the 'User' model.
     */
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Doctor', // Assumes you have a 'User' model for staff/admins
        required: true
    },
    /**
     * The current approval state of the note.
     */
    approvalStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    /**
     * The financial settlement status of the note.
     */
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Settled', 'Adjusted'],
        default: 'Pending'
    },
    /**
     * A URL pointing to any supporting document (e.g., receipt scan) stored in the cloud.
     */
    supportingDocumentURL: {
        type: String,
        trim: true,
        default: null
    }
}, {
    /**
     * Mongoose's timestamps option automatically adds:
     * 1. createdAt: The date the document was created.
     * 2. updatedAt: The date the document was last updated.
     * This 'updatedAt' field serves as your 'LastUpdated' requirement.
     */
    timestamps: true
});

const DebitCreditNote = mongoose.model('DebitCreditNote', debitCreditNoteSchema);

module.exports = DebitCreditNote;