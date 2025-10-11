const asyncHandler = require("express-async-handler");
const axios = require("axios");
const Patient = require("../models/patientModel");
const MedicalDetails = require("../models/patientDetails");
const PatientDetails = require("../models/patientDetails");
const ChronicPatient = require("../models/chronicModel");
const Payment = require("../models/Payment");
const FamilyLink = require("../models/FamilyLink");
const Appointment = require("../models/appointmentModel");
const Referral = require("../models/referralModel");
const { ClinicOperationHours, AppointmentSlotTypes } = require("../models/consultationMessengerSettings"); // Adjust path
require("dotenv").config({ path: "./config/.env" });
// Add this new line right below the one you just changed
const { DoctorPrefinedAppointmentDetails } = require('../models/doctorPrefinedSettings'); // Or whatever you named the file
const Doctor = require("../models/doctorModel");
const moment = require("moment");
const momentIST = require("moment-timezone");
const twilio = require("twilio");
const fs = require("fs");
const crypto = require("crypto");
const { google } = require("googleapis");
const { createGoogleMeet } = require("./Gmeet");
const cloudinary = require("cloudinary").v2;
const Notification = require("../models/notificationHub");
// patientController.js
const UserGoogleTokens = require("../models/UserTokenSchema");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);
const bcrypt = require("bcrypt");
const Prescription = require('../models/Prescription');
const mongoose = require("mongoose");
const PatientNotification = require("../models/PatientNotification");
const NotificationReminderSettings = require('../models/NotificationReminderSettings');
const admin = require("../configs/firebase");
const {pushnotificationModel} = require("../models/pushNotificationModel");
const Message = require('../models/messageModel'); // Or whatever the path to your file is
const DebitCreditNote = require('../models/debitCredit'); // Adjust the path as needed
const MedicinePreparationSummary = require('../models/MedicinePreparationSummary'); // Adjust path
const Analytics = require('../models/dashboardAnalytics'); // The model we created earlier
const Feedback = require('../models/appRatings');
const RawMaterial = require('../models/RawMaterial'); // Adjust the path if needed
const Order = require('../models/Order'); // Adjust path
const Vendor = require('../models/Vendor'); // Make sure Vendor model is imported
const FeedbackQuestion = require('../models/feedbackQuestions');
const FeedbackResponse = require('../models/feedBackResponseModel');

/**
 * @desc    Submit a patient's feedback response.
 * @route   POST /api/feedback/responses
 * @access  Private (Patient)
 */
exports.submitFeedbackResponse = async (req, res) => {
    try {
        // 1. Get patientId from the authenticated user's token
        const patientId = req.user.id; 
        const { responses, comment } = req.body;

        // 2. Validate the incoming data
        if (!Array.isArray(responses) || responses.length === 0) {
            return res.status(400).json({ message: "A non-empty 'responses' array is required." });
        }

        // 3. Calculate the average score from all the ratings in the array
        const totalScore = responses.reduce((sum, res) => sum + res.rating, 0);
        const averageScore = totalScore / responses.length;

        // 4. Create and save the new feedback response document
        const newResponse = await FeedbackResponse.create({
            patientId,
            responses,
            averageScore,
            comment
        });

        // 5. Send a successful response
        res.status(201).json({
            success: true,
            message: "Thank you for your feedback!",
            data: newResponse
        });

    } catch (error) {
        console.error("Error submitting feedback:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * @desc    Create one or more new feedback questions.
 * @route   POST /api/feedback/questions
 * @access  Private (Admin)
 */
exports.createFeedbackQuestions = async (req, res) => {
    try {
        const questions = req.body;
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: "Request body must be a non-empty array of question objects." });
        }
        const newQuestions = await FeedbackQuestion.create(questions);
        res.status(201).json({
            success: true,
            message: `${newQuestions.length} feedback question(s) created successfully.`,
            data: newQuestions
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "One or more of these questions already exist." });
        }
        console.error("Error creating feedback questions:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * @desc    Get all feedback questions, optionally filtered by category.
 * @route   GET /api/feedback/questions
 * @access  Private
 */
exports.getFeedbackQuestions = async (req, res) => {
    try {
        const { category } = req.query;
        const filter = {};
        if (category) {
            filter.category = category;
        }
        const questions = await FeedbackQuestion.find(filter).sort({ category: 1, createdAt: 1 });
        res.status(200).json({
            success: true,
            count: questions.length,
            data: questions
        });
    } catch (error) {
        console.error("Error fetching feedback questions:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * @desc    Update a feedback question.
 * @route   PATCH /api/feedback/questions/:id
 * @access  Private (Admin)
 */
exports.updateFeedbackQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid ID format." });
        }
        const updatedQuestion = await FeedbackQuestion.findByIdAndUpdate(
            id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedQuestion) {
            return res.status(404).json({ message: "Question not found." });
        }
        res.status(200).json({
            success: true,
            message: "Question updated successfully.",
            data: updatedQuestion
        });
    } catch (error) {
        console.error("Error updating feedback question:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * @desc    Delete a feedback question.
 * @route   DELETE /api/feedback/questions/:id
 * @access  Private (Admin)
 */
exports.deleteFeedbackQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid ID format." });
        }
        const deletedQuestion = await FeedbackQuestion.findByIdAndDelete(id);
        if (!deletedQuestion) {
            return res.status(404).json({ message: "Question not found." });
        }
        res.status(200).json({ success: true, message: "Question deleted successfully." });
    } catch (error) {
        console.error("Error deleting feedback question:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * @desc    Get detailed analytics for patient entry sources.
 * @route   GET /api/patients/analytics/entry-counts
 * @access  Private
 * @body    { "filter": "[day|week|month]" }
 */
exports.getPatientEntryCounts = async (req, res) => {
    try {
        const { filter } = req.body;

        if (!filter) {
            // Handle the "no filter" case to provide all-time totals
            const allTimeResults = await Patient.aggregate([
                { $match: { patientEntry: { $exists: true, $ne: null, $ne: "" } } },
                { $group: { _id: "$patientEntry", count: { $sum: 1 } } }
            ]);

            const entryCounts = allTimeResults.map(item => ({
                source: item._id,
                periodCount: 0,
                periodPercentageChange: null,
                periodChangeCount: 0,
                allTimeCount: item.count
            }));

            return res.status(200).json({
                overallPercentageChange: null,
                entryCounts: entryCounts.sort((a, b) => b.allTimeCount - a.count)
            });
        }

        // --- Date Calculation ---
        const now = new Date();
        let currentStartDate, previousStartDate, previousEndDate;

        switch (filter) {
            case 'day':
                currentStartDate = new Date(new Date().setHours(0, 0, 0, 0));
                previousEndDate = new Date(currentStartDate);
                previousStartDate = new Date(new Date(currentStartDate).setDate(currentStartDate.getDate() - 1));
                break;
            case 'week':
                const firstDayOfWeek = now.getDate() - now.getDay();
                currentStartDate = new Date(new Date().setDate(firstDayOfWeek));
                currentStartDate.setHours(0, 0, 0, 0);
                previousEndDate = new Date(currentStartDate);
                previousStartDate = new Date(new Date(currentStartDate).setDate(currentStartDate.getDate() - 7));
                break;
            case 'month':
                currentStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
                previousEndDate = new Date(currentStartDate);
                previousStartDate = new Date(new Date(currentStartDate).setMonth(currentStartDate.getMonth() - 1));
                break;
            default:
                return res.status(400).json({ message: "Invalid filter value." });
        }

        // --- Run 3 Aggregations in Parallel ---
        const [currentPeriodResults, previousPeriodResults, allTimeResults] = await Promise.all([
            // 1. Get current period counts
            Patient.aggregate([
                { $match: { createdAt: { $gte: currentStartDate }, patientEntry: { $exists: true, $ne: null, $ne: "" } } },
                { $group: { _id: "$patientEntry", count: { $sum: 1 } } }
            ]),
            // 2. Get previous period counts
            Patient.aggregate([
                { $match: { createdAt: { $gte: previousStartDate, $lt: previousEndDate }, patientEntry: { $exists: true, $ne: null, $ne: "" } } },
                { $group: { _id: "$patientEntry", count: { $sum: 1 } } }
            ]),
            // 3. Get all-time counts
            Patient.aggregate([
                { $match: { patientEntry: { $exists: true, $ne: null, $ne: "" } } },
                { $group: { _id: "$patientEntry", count: { $sum: 1 } } }
            ])
        ]);

        // --- Merge All Data in JavaScript ---
        const currentPeriodMap = new Map(currentPeriodResults.map(item => [item._id, item.count]));
        const previousPeriodMap = new Map(previousPeriodResults.map(item => [item._id, item.count]));
        const allTimeMap = new Map(allTimeResults.map(item => [item._id, item.count]));

        // Get a unique list of every source that has ever existed
        const allSources = new Set([...allTimeMap.keys()]);

        let totalCurrentCount = 0;
        let totalPreviousCount = 0;
        const entryCounts = [];

        for (const source of allSources) {
            const periodCount = currentPeriodMap.get(source) || 0;
            const previousCount = previousPeriodMap.get(source) || 0;
            const allTimeCount = allTimeMap.get(source) || 0;

            totalCurrentCount += periodCount;
            totalPreviousCount += previousCount;

            const periodChangeCount = periodCount - previousCount;
            let periodPercentageChange = 0;

            if (previousCount > 0) {
                periodPercentageChange = (periodChangeCount / previousCount) * 100;
            } else if (periodCount > 0) {
                periodPercentageChange = 100;
            }

            entryCounts.push({
                source,
                periodCount,
                periodPercentageChange: parseFloat(periodPercentageChange.toFixed(2)),
                periodChangeCount,
                allTimeCount
            });
        }
        
        // --- Calculate Overall Metrics ---
        let overallPercentageChange = 0;
        if (totalPreviousCount > 0) {
            overallPercentageChange = ((totalCurrentCount - totalPreviousCount) / totalPreviousCount) * 100;
        } else if (totalCurrentCount > 0) {
            overallPercentageChange = 100;
        }

        res.status(200).json({
            overallPercentageChange: parseFloat(overallPercentageChange.toFixed(2)),
            entryCounts: entryCounts.sort((a, b) => b.allTimeCount - a.allTimeCount) // Sort by most popular source all-time
        });

    } catch (error) {
        console.error("Error fetching patient entry counts:", error);
        res.status(500).json({ message: "Server error while fetching analytics." });
    }
};
/**
 * @desc    Get the count of patients grouped by userStatus, with optional time filters.
 * @route   GET /api/patients/status-counts
 * @access  Private/Admin
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
exports.getPatientStatusCounts = async (req, res) => {
    try {
        // Get the optional filter from the request body
        const { filter } = req.body;

        // Start with an empty match query
        const matchQuery = {};

        // If a filter is provided, calculate the date range
        if (filter) {
            const now = new Date();
            let startDate;

            switch (filter) {
                case 'day':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    const firstDayOfWeek = now.getDate() - now.getDay();
                    startDate = new Date(now.setDate(firstDayOfWeek));
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                default:
                    return res.status(400).json({ message: "Invalid filter value. Use 'day', 'week', or 'month'." });
            }

            // Add the date condition to our match query
            if (startDate) {
                matchQuery.createdAt = { $gte: startDate };
            }
        }

        const statusCounts = await Patient.aggregate([
            // Stage 1: Conditionally match by date. If no filter, this matches all documents.
            {
                $match: matchQuery
            },
            // Stage 2: Group documents by the 'userStatus' field
            {
                $group: {
                    _id: '$userStatus', // Group by the value of the userStatus field
                    count: { $sum: 1 }  // For each document in the group, add 1 to the count
                }
            },
            // Stage 3: Reshape the output for clarity
            {
                $project: {
                    _id: 0,             // Exclude the default '_id' field
                    status: '$_id',     // Rename '_id' to 'status'
                    count: 1            // Include the 'count' field
                }
            }
        ]);

        res.status(200).json(statusCounts);

    } catch (error) {
        console.error("Error fetching patient status counts:", error);
        res.status(500).json({ message: "Server error while fetching patient counts." });
    }
};

/**
 * @desc    Get a summary of all pending payments
 * @route   GET /api/dashboard/pending-payments
 * @access  Private/Admin
 */
exports.getPendingPaymentsSummary = async (req, res) => {
    try {
        // --- Aggregation Pipeline for Unpaid Appointments ---
        const appointmentPipeline = [
            // Stage 1: Find appointments that are not paid
            { $match: { isPaid: false } },
            // Stage 2: Group them all into a single document and sum the 'payment' field
            {
                $group: {
                    _id: null, // Group all found documents together
                    total: { $sum: '$payment' }
                }
            }
        ];

        // --- Aggregation Pipeline for Unpaid Prescriptions ---
        const prescriptionPipeline = [
            // Stage 1: Find prescriptions where payment is not done
            { $match: { isPayementDone: false } }, // Note: isPayementDone is based on your schema
            // Stage 2: Group them and sum the different charge fields
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: {
                            // Add the three charge fields together for each document
                            $add: [
                                { $ifNull: ["$medicineCharges", 0] },
                                { $ifNull: ["$shippingCharges", 0] },
                                { $ifNull: ["$additionalCharges", 0] }
                            ]
                        }
                    }
                }
            }
        ];

        // --- Run both aggregations in parallel for efficiency ---
        const [appointmentResults, prescriptionResults] = await Promise.all([
            Appointment.aggregate(appointmentPipeline),
            Prescription.aggregate(prescriptionPipeline)
        ]);

        // --- Process the results ---
        // If the aggregation finds no documents, the result array will be empty.
        const totalUnpaidAppointments = appointmentResults.length > 0 ? appointmentResults[0].total : 0;
        const totalUnpaidPrescriptions = prescriptionResults.length > 0 ? prescriptionResults[0].total : 0;
        const totalPendingCost = totalUnpaidAppointments + totalUnpaidPrescriptions;
        
        // --- Send the final summary response ---
        res.status(200).json({
            success: true,
            data: {
                totalUnpaidAppointments,
                totalUnpaidPrescriptions,
                totalPendingCost
            }
        });

    } catch (error) {
        console.error("Error fetching pending payments summary:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};
/**
 * @desc    Get a detailed list of all pending payments.
 * @route   GET /api/analytics/pending-payments-list
 * @access  Private (Admin)
 */
exports.getListPendingPayments = async (req, res) => {
    try {
        // Run two separate aggregation queries in parallel
        const [unpaidAppointments, unpaidPrescriptions] = await Promise.all([
            // Query 1: Find all unpaid appointments
            Appointment.aggregate([
                { $match: { isPaid: false } },
                { $lookup: { from: 'patients', localField: 'patient', foreignField: '_id', as: 'patientInfo' } },
                { $unwind: '$patientInfo' },
                {
                    $project: {
                        _id: 0,
                        patientId: '$patient',
                        patientName: '$patientInfo.name',
                        amount: '$payment',
                        paidFor: 'Consultation',
                        status: 'Pending',
                        referenceId: '$_id', // The appointment ID
                        date: '$createdAt'
                    }
                }
            ]),
            // Query 2: Find all unpaid prescriptions
            Prescription.aggregate([
                { $match: { isPayementDone: false } },
                { $lookup: { from: 'patients', localField: 'patientId', foreignField: '_id', as: 'patientInfo' } },
                { $unwind: '$patientInfo' },
                {
                    $project: {
                        _id: 0,
                        patientId: '$patientId',
                        patientName: '$patientInfo.name',
                        amount: { $add: [
                            { $ifNull: ["$medicineCharges", 0] },
                            { $ifNull: ["$shippingCharges", 0] },
                            { $ifNull: ["$additionalCharges", 0] }
                        ]},
                        paidFor: 'Medicine',
                        status: 'Pending',
                        referenceId: '$_id', // The prescription ID
                        date: '$createdAt'
                    }
                }
            ])
        ]);

        // Combine the results from both queries into a single list
        const allPendingPayments = [...unpaidAppointments, ...unpaidPrescriptions];

        // Sort the final list by date, most recent first
        allPendingPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({
            success: true,
            count: allPendingPayments.length,
            data: allPendingPayments
        });

    } catch (error) {
        console.error("Error fetching pending payments list:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};
/**
 * @desc    Get a logged-in doctor's upcoming appointments.
 * @route   GET /api/doctors/upcoming-appointments
 * @access  Private (Doctor)
 */
exports.getDoctorUpcomingAppointments = async (req, res) => {
    try {
        // 1. Get the doctor's ID from the authenticated user's token
        const doctorId = req.user.id; 

        // 2. Build an aggregation pipeline to fetch and format the data
        const pipeline = [
            // Stage 1: Match only confirmed appointments for this doctor from today onwards
            {
                $match: {
                    doctor: new mongoose.Types.ObjectId(doctorId),
                    status: 'confirmed',
                    appointmentDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
            },
            // Stage 2: Sort the appointments chronologically
            {
                $sort: {
                    appointmentDate: 1,
                    timeSlot: 1
                }
            },
            // Stage 3: Join with the 'patients' collection to get the patient's name
            {
                $lookup: {
                    from: 'patients',
                    localField: 'patient',
                    foreignField: '_id',
                    as: 'patientInfo'
                }
            },
            {
                $unwind: { path: '$patientInfo', preserveNullAndEmptyArrays: true }
            },
            // Stage 4: Project only the fields you requested
            {
                $project: {
                    _id: 1, // The appointment ID
                    patientId: '$patientInfo._id',
                    patientName: '$patientInfo.name',
                    meetLink: 1,
                    diseaseName: 1, // Using diseaseName as 'symptom'
                    appointmentDate: 1,
                    timeSlot: 1
                }
            }
        ];

        // 3. Execute the pipeline
        const upcomingAppointments = await Appointment.aggregate(pipeline);

        res.status(200).json({
            success: true,
            count: upcomingAppointments.length,
            data: upcomingAppointments
        });

    } catch (error) {
        console.error("Error fetching upcoming appointments:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * @desc    Get a summary of total amounts for receivables and payables.
 * @route   GET /api/financials/debit-credit-summary
 * @access  Private/Admin
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */

exports.getDebitCreditSummary = async (req, res) => {
    try {
        const { filter } = req.body;
        const matchQuery = {};

        if (filter) {
            const now = new Date();
            let startDate;
            switch (filter) {
                case 'day': startDate = new Date(new Date().setHours(0, 0, 0, 0)); break;
                case 'week':
                    const firstDayOfWeek = now.getDate() - now.getDay();
                    startDate = new Date(new Date().setDate(firstDayOfWeek));
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month': startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1); break;
                default: return res.status(400).json({ message: "Invalid filter value." });
            }
            if (startDate) {
                matchQuery.createdAt = { $gte: startDate };
            }
        }
        
        // --- NEW LOGIC: Run three separate queries in parallel ---
        const [
            payablesResult,
            bookingFeeResult,
            prescriptionChargesResult
        ] = await Promise.all([
            // Query 1: Get Total Payables from DebitCreditNote (Unchanged)
            DebitCreditNote.aggregate([
                { $match: { ...matchQuery, linkedType: 'Payable' } },
                { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
            ]),

            // Query 2: Get "Booking fee" from successful Consultation payments
            Payment.aggregate([
                { $match: { ...matchQuery, paidFor: "Consultation" } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),

            // Query 3: Get all other charges from successful Prescription payments
            Prescription.aggregate([
                { $match: { ...matchQuery, isPayementDone: true } },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: { $add: [
                                "$shippingCharges",
                                "$additionalCharges",
                                "$medicineCharges"
                            ]}
                        }
                    }
                }
            ])
        ]);

        // --- Process all results ---
        const totalPayables = payablesResult[0]?.totalAmount || 0;
        
        const bookingFee = bookingFeeResult[0]?.total || 0;
        const prescriptionCharges = prescriptionChargesResult[0]?.total || 0;
        
        // The new totalReceivables is the sum from Payments and Prescriptions
        const totalReceivables = bookingFee + prescriptionCharges;

        // --- Send the final response in the ORIGINAL format ---
        res.status(200).json({
            success: true,
            data: {
                totalPayables,
                totalReceivables
            }
        });

    } catch (error) {
        console.error("Error fetching debit/credit note summary:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

// --- Helper Functions ---

/**
 * Calculates the average of an array of numbers.
 * @param {number[]} arr Array of numbers (durations in ms).
 * @returns {number} The average, or 0 if the array is empty.
 */
const calculateAverage = (arr) => {
    if (!arr || arr.length === 0) return 0;
    const sum = arr.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / arr.length);
};

/**
 * Converts milliseconds to a human-readable "X hours and Y minutes" format.
 * @param {number} ms Milliseconds.
 * @returns {string} Formatted string.
 */
const formatMilliseconds = (ms) => {
    if (ms === 0) return '0 minutes';
    if (!ms || ms < 0) return 'N/A';
    
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
        return `${hours} hours and ${minutes} minutes`;
    }
    return `${minutes} minutes`;
};
exports.calculateOverallTatAnalytics = async (req, res) => {
    try {
        console.log("Starting Turnaround Time (TAT) analytics calculation...");

        const consultationPayments = await Payment.find({ paidFor: 'Consultation' }).sort({ createdAt: 1 }).lean();

        if (consultationPayments.length === 0) {
            return res.status(200).json({ message: "No consultation payments found to analyze." });
        }

        // Renamed fields for clarity
        const durations = {
            appointmentToPrescription: [],
            prescriptionToPayment: [],
            paymentToPreparation: [],
            preparationToShipment: [],
            shipmentToPatientCare: [], // Renamed
            endToEndCycle: [],        // Renamed
        };

        for (const consultPayment of consultationPayments) {
            const t1_appointmentConclusion = consultPayment.createdAt;
            const appointmentId = consultPayment.appointmentId;
            
            const prescription = await Prescription.findOne({ appointmentID: appointmentId }).lean();
            if (!prescription) continue;
            const t2_prescriptionCreated = prescription.createdAt;
            durations.appointmentToPrescription.push(t2_prescriptionCreated - t1_appointmentConclusion);

            const medicinePayment = await Payment.findOne({ appointmentId, paidFor: 'Medicine' }).lean();
            if (!medicinePayment) continue;
            const t3_prescriptionPaid = medicinePayment.createdAt;
            durations.prescriptionToPayment.push(t3_prescriptionPaid - t2_prescriptionCreated);

            const prepSummary = await MedicinePreparationSummary.findOne({ prescriptionId: prescription._id }).lean();
            if (!prepSummary) continue;
            const t4_preparationStarted = prepSummary.createdAt;
            durations.paymentToPreparation.push(t4_preparationStarted - t3_prescriptionPaid);
            
            if (!prescription.isProductShipped || !prescription.shippedDate) continue;
            const t5_shipped = prescription.shippedDate;
            durations.preparationToShipment.push(t5_shipped - t4_preparationStarted);

            if (!prescription.isProductReceived || !prescription.receivedDate) continue;
            const t6_received = prescription.receivedDate;
            // Pushing to the renamed field
            durations.shipmentToPatientCare.push(t6_received - t5_shipped);

            // Pushing to the renamed field for the full journey
            durations.endToEndCycle.push(t6_received - t1_appointmentConclusion);
        }

        const analyticsUpdate = {};
        const individualStepAverages = []; // To hold averages for the final calculation

        // Calculate averages for each step first
        const processKeys = ['appointmentToPrescription', 'prescriptionToPayment', 'paymentToPreparation', 'preparationToShipment', 'shipmentToPatientCare', 'endToEndCycle'];
        for (const key of processKeys) {
            const avgMs = calculateAverage(durations[key]);
            analyticsUpdate[key] = {
                overall: {
                    averageMilliseconds: avgMs,
                    averageFormatted: formatMilliseconds(avgMs),
                    count: durations[key].length,
                    lastUpdated: new Date()
                }
            };
            // Add to our list for the final calculation, but only if it's a primary step
            if (key !== 'endToEndCycle') {
                individualStepAverages.push(avgMs);
            }
        }
        
        // --- NEW: Calculate the "Overall Average TAT" ---
        // This is the average of the averages of the individual steps
        const overallAvgMs = calculateAverage(individualStepAverages.filter(avg => avg > 0));
        analyticsUpdate.overallAverageTat = {
             overall: {
                averageMilliseconds: overallAvgMs,
                averageFormatted: formatMilliseconds(overallAvgMs),
                count: individualStepAverages.filter(avg => avg > 0).length, // The count is the number of steps
                lastUpdated: new Date()
            }
        };
        
        const updatedAnalytics = await Analytics.findOneAndUpdate(
            { identifier: 'global_summary' }, { $set: analyticsUpdate }, { upsert: true, new: true }
        );

        console.log("\n✅ TAT analytics calculation finished.");
        res.status(200).json({
            message: "Turnaround time analytics calculated and saved successfully.",
            data: updatedAnalytics
        });

    } catch (error) {
        console.error("Error calculating TAT analytics:", error);
        res.status(500).json({ success: false, message: "Server error during analytics calculation." });
    }
};
/**
 * @desc    Get a summary of patient medication adherence.
 * @route   POST /api/patients/adherence-summary
 * @access  Private (Patient Care)
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
// Make sure all these models are imported at the top of your file
exports.getPatientAdherenceSummary = async (req, res) => {
    try {
        const { filter } = req.body;
        const matchQuery = {};
        if (filter) {
            const now = new Date();
            let startDate;
            switch (filter) {
                case 'day': startDate = new Date(new Date().setHours(0, 0, 0, 0)); break;
                case 'week':
                    const firstDayOfWeek = now.getDate() - now.getDay();
                    startDate = new Date(new Date().setDate(firstDayOfWeek));
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month': startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1); break;
            }
            if (startDate) {
                matchQuery.date = { $gte: startDate };
            }
        }

        // --- All four analytics queries run in parallel ---
        const [
            adherenceResult,
            patientStatusResult,
            missingStartDateResult,
            callStatsResult
        ] = await Promise.all([
            // 1. Adherence Calculation
            NotificationReminderSettings.aggregate([
                {
                    $match: {
                        ...matchQuery,
                        $expr: {
                            $lte: [
                                { $dateFromParts: {
                                    year: { $year: "$date" }, month: { $month: "$date" }, day: { $dayOfMonth: "$date" },
                                    hour: { $toInt: { $substr: ["$doseTime", 0, 2] } },
                                    minute: { $toInt: { $substr: ["$doseTime", 3, 2] } },
                                    timezone: "Asia/Kolkata"
                                }},
                                "$$NOW"
                            ]
                        }
                    }
                },
                { $group: {
                    _id: "$patientId",
                    totalDoses: { $sum: 1 },
                    takenDoses: { $sum: { $cond: [{ $eq: ["$status", true] }, 1, 0] } }
                }},
                { $project: {
                    _id: 1,
                    adherencePercentage: {
                        $cond: {
                            if: { $gt: ["$totalDoses", 0] },
                            then: { $multiply: [{ $divide: ["$takenDoses", "$totalDoses"] }, 100] },
                            else: 0
                        }
                    }
                }},
                { $group: {
                    _id: null,
                    consistentPatients: { $sum: { $cond: [{ $gt: ["$adherencePercentage", 90] }, 1, 0] } },
                    inconsistentPatients: { $sum: { $cond: [ { $and: [ { $lte: ["$adherencePercentage", 90] }, { $gt: ["$adherencePercentage", 70] } ]}, 1, 0 ]}},
                    nonAdherentPatients: { $sum: { $cond: [{ $lte: ["$adherencePercentage", 70] }, 1, 0] } }
                }},
                { $project: { _id: 0, consistentPatients: 1, inconsistentPatients: 1, nonAdherentPatients: 1 } }
            ]),

            // 2. Patient Status Counts
            Patient.aggregate([
                { $match: { follow: { $in: ['Patient Care', 'Inactive'] } } },
                { $group: { _id: '$follow', count: { $sum: 1 } } }
            ]),

            // 3. Missing Prescription Start Date Count
            Appointment.aggregate([
                { $match: { follow: 'Patient Care', prescriptionID: { $ne: null } } },
                { $lookup: { from: 'prescriptions', localField: 'prescriptionID', foreignField: '_id', as: 'prescriptionInfo' } },
                { $unwind: '$prescriptionInfo' },
                { $match: { 'prescriptionInfo.startDate': null } },
                { $count: 'missingCount' }
            ]),

            // 4. Follow-up Call Statistics
            Patient.aggregate([
                { $match: { follow: { $in: ['Patient Care', 'Inactive'] }, "followUpCallsMade.0": { $exists: true } } },
                { $unwind: '$followUpCallsMade' },
                // Filter out calls scheduled for the future
                { $match: { "followUpCallsMade.date": { $lte: new Date() } } },
                { $group: {
                    _id: null,
                    totalCalls: { $sum: 1 },
                    callsMade: { $sum: { $cond: [{ $eq: ['$followUpCallsMade.callMade', true] }, 1, 0] } }
                }}
            ])
        ]);

        // --- Process all results ---
        const adherenceSummary = adherenceResult[0] || { consistentPatients: 0, inconsistentPatients: 0, nonAdherentPatients: 0 };
        
        const patientCareCount = patientStatusResult.find(r => r._id === 'Patient Care')?.count || 0;
        const inactiveCount = patientStatusResult.find(r => r._id === 'Inactive')?.count || 0;
        const churnRatePercentage = (patientCareCount > 0) ? (inactiveCount / patientCareCount) * 100 : 0;

        const missingStartDateCount = missingStartDateResult[0]?.missingCount || 0;

        const callStats = callStatsResult[0] || { totalCalls: 0, callsMade: 0 };
        const callsMissed = callStats.totalCalls - callStats.callsMade;
        const callsMadePercentage = (callStats.totalCalls > 0) ? (callStats.callsMade / callStats.totalCalls) * 100 : 0;
        const callsMissedPercentage = (callStats.totalCalls > 0) ? (callsMissed / callStats.totalCalls) * 100 : 0;

        // --- Combine into the final response ---
        res.status(200).json({
            success: true,
            summary: {
                ...adherenceSummary,
                totalPatientCare: patientCareCount,
                churnRatePercentage: parseFloat(churnRatePercentage.toFixed(2)),
                prescriptionsMissingStartDate: missingStartDateCount,
                followUpCalls: {
                    madePercentage: parseFloat(callsMadePercentage.toFixed(2)),
                    missedPercentage: parseFloat(callsMissedPercentage.toFixed(2))
                }
            }
        });

    } catch (error) {
        console.error("Error fetching patient adherence summary:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.getMedicinePreparationStatus = async (req, res) => {
    try {
        const { filter } = req.body;
        const dateMatchCondition = {};

        if (filter) {
            const now = new Date();
            let startDate;
            switch (filter) {
                case 'day':
                    startDate = new Date(new Date().setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    const firstDayOfWeek = now.getDate() - now.getDay();
                    startDate = new Date(new Date().setDate(firstDayOfWeek));
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
            }
            if (startDate) {
                dateMatchCondition.createdAt = { $gte: startDate };
            }
        }

        // --- Part 1: Get Main Counts ---
        const countsPipeline = [
            { $match: dateMatchCondition },
            { $lookup: { from: 'appointments', localField: 'prescriptionId', foreignField: 'prescriptionID', as: 'appointmentInfo' } },
            { $unwind: { path: '$appointmentInfo', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: null,
                    totalInitialized: { $sum: 1 },
                    completedCount: { $sum: { $cond: [{ $eq: ['$appointmentInfo.medicinePrepared', true] }, 1, 0] } },
                    totalAttempts: { $sum: { $ifNull: ["$preparationAttempts", 1] } },
                    shortfallsFlagged: { $sum: { $cond: [ { $and: [ { $gt: ["$preparationAttempts", 1] }, { $ne: ['$appointmentInfo.medicinePrepared', true] } ]}, 1, 0 ]} },
                    shortfallsResolved: { $sum: { $cond: [ { $and: [ { $gt: ["$preparationAttempts", 1] }, { $eq: ['$appointmentInfo.medicinePrepared', true] } ]}, 1, 0 ]} }
                }
            }
        ];
        const countResults = await MedicinePreparationSummary.aggregate(countsPipeline);
        const stats = countResults[0] || { totalInitialized: 0, completedCount: 0, totalAttempts: 0, shortfallsFlagged: 0, shortfallsResolved: 0 };
        const pendingCount = stats.totalInitialized - stats.completedCount;
        const preparationShortfalls = stats.totalAttempts - stats.totalInitialized;
        
        // --- Part 2: Analyze Pending Medicines for Inventory Shortage ---
        const pendingSummaries = await MedicinePreparationSummary.find({ ...dateMatchCondition, 'appointmentInfo.medicinePrepared': { $ne: true } }).lean();
        
        let inventoryShortageCount = 0;
        if (pendingSummaries.length > 0) {
            for (const summary of pendingSummaries) {
                const requiredMaterialIds = summary.medicinePreparations.flatMap(med => med.rawMaterialsUsed.map(rm => rm.materialId));
                if (requiredMaterialIds.length > 0) {
                    const outOfStockCount = await RawMaterial.countDocuments({
                        _id: { $in: requiredMaterialIds },
                        currentQuantity: 0
                    });
                    if (outOfStockCount > 0) {
                        inventoryShortageCount++;
                    }
                }
            }
        }
        const staffAllocationCount = pendingCount - inventoryShortageCount;

        // --- Part 3: Calculate Cumulative Leaked Quantity ---
        const allSummariesInPeriod = await MedicinePreparationSummary.find(dateMatchCondition).lean();
        const allMaterialIds = [...new Set(allSummariesInPeriod.flatMap(s => s.medicinePreparations.flatMap(m => m.rawMaterialsUsed.map(rm => rm.materialId))))];
        
        let cumulativeLeakedQuantity = 0;
        if (allMaterialIds.length > 0) {
            const leakageResult = await RawMaterial.aggregate([
                { $match: { _id: { $in: allMaterialIds } } },
                { $group: { _id: null, totalLeakage: { $sum: "$totalLeakedQuantity" } } }
            ]);
            if (leakageResult.length > 0) {
                cumulativeLeakedQuantity = leakageResult[0].totalLeakage;
            }
        }

        // --- Part 4: Combine and Send Final Response ---
        res.status(200).json({
            success: true,
            filter: filter || 'overall',
            data: {
                totalInitializedMedicines: stats.totalInitialized,
                completedMedicines: stats.completedCount,
                pendingMedicines: pendingCount,
                preparationShortfalls,
                inventoryShortage: inventoryShortageCount,
                awaitingStaffAllocation: staffAllocationCount,
                cumulativeLeakedQuantity,
                shortfallsFlagged: stats.shortfallsFlagged,
                shortfallsResolved: stats.shortfallsResolved
            }
        });

    } catch (error) {
        console.error("Error fetching medicine preparation status:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};
/**
 * @desc    Get a summary of appointment counts and percentages for a specific day.
 * @route   GET /api/appointments/summary-by-date?appointmentDate=YYYY-MM-DD
 * @access  Private
 */
exports.getAppointmentSummaryForDay = async (req, res) => {
    try {
        const { appointmentDate } = req.query;
        if (!appointmentDate) {
            return res.status(400).json({ message: "An 'appointmentDate' query parameter is required." });
        }

        const startOfDay = new Date(appointmentDate);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(appointmentDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        if (isNaN(startOfDay.getTime())) {
            return res.status(400).json({ message: "Invalid date format. Please use YYYY-MM-DD." });
        }

        const pipeline = [
            // Stage 1: Match appointments within the given day (no changes here)
            {
                $match: {
                    appointmentDate: {
                        $gte: startOfDay,
                        $lte: endOfDay
                    }
                }
            },
            // Stage 2: Group and calculate all counts (no changes here)
            {
                $group: {
                    _id: null,
                    bookedAppointments: { $sum: 1 },
                    appointmentsComplete: {
                        $sum: { $cond: [{ $and: [ { $eq: ["$status", "completed"] }, { $eq: ["$noShow", false] } ]}, 1, 0] }
                    },
                    appointmentsMissed: {
                        $sum: { $cond: [{ $eq: ["$noShow", true] }, 1, 0] }
                    },
                    appointmentsRescheduled: {
                        $sum: { $cond: [{ $eq: ["$reschedule", true] }, 1, 0] }
                    },
                    appointmentsDue: {
                        $sum: { $cond: [{ $and: [ { $ne: ["$status", "completed"] }, { $ne: ["$noShow", true] } ]}, 1, 0] }
                    }
                }
            },
            // Stage 3: MODIFIED to calculate and format the final output
            {
                $project: {
                    _id: 0,
                    // Keep the original counts
                    bookedAppointments: 1,
                    appointmentsComplete: 1,
                    appointmentsMissed: 1,
                    appointmentsRescheduled: 1,
                    appointmentsDue: 1,
                    // --- NEW: Add percentage calculations ---
                    completionPercentage: {
                        $cond: {
                            if: { $gt: ["$bookedAppointments", 0] },
                            then: { $multiply: [{ $divide: ["$appointmentsComplete", "$bookedAppointments"] }, 100] },
                            else: 0
                        }
                    },
                    missedPercentage: {
                        $cond: {
                            if: { $gt: ["$bookedAppointments", 0] },
                            then: { $multiply: [{ $divide: ["$appointmentsMissed", "$bookedAppointments"] }, 100] },
                            else: 0
                        }
                    },
                    reschedulePercentage: {
                        $cond: {
                            if: { $gt: ["$bookedAppointments", 0] },
                            then: { $multiply: [{ $divide: ["$appointmentsRescheduled", "$bookedAppointments"] }, 100] },
                            else: 0
                        }
                    }
                }
            }
        ];

        const result = await Appointment.aggregate(pipeline);

        let summary;
        if (result.length > 0) {
            // Round the percentages to two decimal places for a cleaner look
            const rawSummary = result[0];
            summary = {
                ...rawSummary,
                completionPercentage: parseFloat(rawSummary.completionPercentage.toFixed(2)),
                missedPercentage: parseFloat(rawSummary.missedPercentage.toFixed(2)),
                reschedulePercentage: parseFloat(rawSummary.reschedulePercentage.toFixed(2))
            };
        } else {
            // MODIFIED: Update the default object to include percentages
            summary = {
                bookedAppointments: 0,
                appointmentsComplete: 0,
                appointmentsMissed: 0,
                appointmentsRescheduled: 0,
                appointmentsDue: 0,
                completionPercentage: 0,
                missedPercentage: 0,
                reschedulePercentage: 0
            };
        }

        res.status(200).json({
            success: true,
            date: appointmentDate,
            summary: summary,
        });

    } catch (error) {
        console.error("Error fetching appointment summary:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * @desc    Get a summary of shipment statuses (shipped, received, lost, awaiting).
 * @route   GET /api/prescriptions/shipment-summary
 * @access  Private (Admin/Logistics)
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
exports.getShipmentSummary = async (req, res) => {
    try {
        const { filter } = req.body;
        const matchQuery = {};
        const SLA_THRESHOLD_HOURS = 24;
        const SLA_THRESHOLD_MS = SLA_THRESHOLD_HOURS * 60 * 60 * 1000;

        if (filter) {
            const now = new Date();
            let startDate;
            switch (filter) {
                case 'day':
                    startDate = new Date(new Date().setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    const firstDayOfWeek = now.getDate() - now.getDay();
                    startDate = new Date(new Date().setDate(firstDayOfWeek));
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                default:
                    return res.status(400).json({ message: "Invalid filter value." });
            }
            if (startDate) {
                matchQuery.createdAt = { $gte: startDate };
            }
        }

        // --- FIX: Get the collection name programmatically ---
        const paymentCollectionName = Payment.collection.collectionName;

        const pipeline = [
            { $match: matchQuery },
            {
                $lookup: {
                    // --- FIX: Use the variable here ---
                    from: paymentCollectionName,
                    localField: "_id",
                    foreignField: "prescriptionId",
                    pipeline: [{ $match: { paidFor: 'Medicine' } }, { $sort: { createdAt: -1 } }, { $limit: 1 }],
                    as: "paymentInfo"
                }
            },
            { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: null,
                    productsShipped: { $sum: { $cond: [{ $eq: ["$isProductShipped", true] }, 1, 0] } },
                    productsReceived: { $sum: { $cond: [{ $eq: ["$isProductReceived", true] }, 1, 0] } },
                    shipmentsLost: { $sum: { $cond: [{ $eq: ["$shipmentLost", true] }, 1, 0] } },
                    awaitingDispatch: { $sum: { $cond: [{ $eq: ["$isProductShipped", false] }, 1, 0] } },
                    slaMetCount: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $eq: ["$isProductShipped", true] },
                                    { $lte: [ { $subtract: ["$shippedDate", "$paymentInfo.createdAt"] }, SLA_THRESHOLD_MS ] }
                                ]}, 1, 0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    productsShipped: 1,
                    productsReceived: 1,
                    shipmentsLost: 1,
                    awaitingDispatch: 1,
                    slaMetCount: 1,
                    slaNotMetCount: { $subtract: ["$productsShipped", "$slaMetCount"] },
                    slaAdherencePercentage: {
                        $cond: {
                            if: { $gt: ["$productsShipped", 0] },
                            then: { $multiply: [{ $divide: ["$slaMetCount", "$productsShipped"] }, 100] },
                            else: 0
                        }
                    },
                    deliveredPercentage: {
                        $let: {
                            vars: { total: { $add: ["$productsShipped", "$awaitingDispatch"] } },
                            in: {
                                $cond: {
                                    if: { $gt: ["$$total", 0] },
                                    then: { $multiply: [{ $divide: ["$productsReceived", "$$total"] }, 100] },
                                    else: 0
                                }
                            }
                        }
                    },
                    pendingPercentage: {
                        $let: {
                            vars: { total: { $add: ["$productsShipped", "$awaitingDispatch"] } },
                            in: {
                                $cond: {
                                    if: { $gt: ["$$total", 0] },
                                    then: { $multiply: [{ $divide: [ { $subtract: ["$$total", "$productsReceived"] }, "$$total" ] }, 100] },
                                    else: 0
                                }
                            }
                        }
                    }
                }
            }
        ];

        const result = await Prescription.aggregate(pipeline);

        let summary;
        if (result.length > 0) {
            const raw = result[0];
            summary = {
                ...raw,
                slaAdherencePercentage: parseFloat(raw.slaAdherencePercentage.toFixed(2)),
                deliveredPercentage: parseFloat(raw.deliveredPercentage.toFixed(2)),
                pendingPercentage: parseFloat(raw.pendingPercentage.toFixed(2))
            };
        } else {
            summary = {
                productsShipped: 0, productsReceived: 0, shipmentsLost: 0, awaitingDispatch: 0,
                slaMetCount: 0, slaNotMetCount: 0, slaAdherencePercentage: 0,
                deliveredPercentage: 0, pendingPercentage: 0
            };
        }

        res.status(200).json({ success: true, summary: summary });

    } catch (error) {
        console.error("Error fetching shipment summary:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
// ... other models

/**
 * @desc    Get a summary of chat and follow-up call analytics.
 * @route   POST /api/messages/summary
 * @access  Private (Admin)
 */
exports.getMessageSummary = async (req, res) => {
    try {
        const { filter } = req.body;
        const now = new Date();
        let messageMatch = {};
        let callMatch = {};

        if (filter) {
            let startDate;
            switch (filter) {
                case 'day': startDate = new Date(new Date().setHours(0, 0, 0, 0)); break;
                case 'week':
                    const firstDayOfWeek = now.getDate() - now.getDay();
                    startDate = new Date(new Date().setDate(firstDayOfWeek));
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
            }
            if (startDate) {
                messageMatch.timestamp = { $gte: startDate };
                callMatch["followUpCallsMade.date"] = { $gte: startDate };
            }
        }
        
        const OUTSTANDING_THRESHOLD_DAYS = 3;
        const outstandingDateLimit = new Date(new Date().setDate(now.getDate() - OUTSTANDING_THRESHOLD_DAYS));

        const [
            messageResult,
            callStatsResult
        ] = await Promise.all([
            // --- FIX: The complete message analytics pipeline is now here ---
            Message.aggregate([
                { $match: messageMatch },
                {
                    $lookup: {
                        from: 'patients',
                        let: { receiverId: { $toObjectId: '$receiver' } },
                        pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$receiverId'] } } }],
                        as: 'patientInfo'
                    }
                },
                {
                    $lookup: {
                        from: 'doctors',
                        let: { senderId: { $toObjectId: '$sender' } },
                        pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$senderId'] } } }],
                        as: 'doctorInfo'
                    }
                },
                {
                    $group: {
                        _id: null,
                        doctorToPatientResponses: { $sum: { $cond: [{ $and: [ { $gt: [{ $size: "$doctorInfo" }, 0] }, { $gt: [{ $size: "$patientInfo" }, 0] } ]}, 1, 0] } },
                        outstandingMessages: { $sum: { $cond: [{ $and: [ { $eq: ["$isRead", false] }, { $lt: ["$timestamp", outstandingDateLimit] } ]}, 1, 0] } },
                        uniquePatientsWithMessage: { $addToSet: { $cond: [{ $gt: [{ $size: "$patientInfo" }, 0] }, "$receiver", null] } },
                        uniquePatientsWithUnread: { $addToSet: { $cond: [{ $and: [ { $gt: [{ $size: "$patientInfo" }, 0] }, { $eq: ["$isRead", false] } ]}, "$receiver", null] } }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        doctorToPatientResponses: 1,
                        outstandingMessages: 1,
                        patientsWithMessage: { $size: { $ifNull: ["$uniquePatientsWithMessage", []] } },
                        patientsWithUnreadMessages: { $size: { $ifNull: ["$uniquePatientsWithUnread", []] } }
                    }
                }
            ]),

            // Query 2: Follow-up Call Analytics (unchanged)
            Patient.aggregate([
                { $unwind: "$followUpCallsMade" },
                { $match: callMatch },
                {
                    $group: {
                        _id: null,
                        totalFollowUpCallsMade: { $sum: { $cond: [{ $eq: ["$followUpCallsMade.callMade", true] }, 1, 0] } },
                        followUpCallsPending: { $sum: { $cond: [ { $and: [ { $eq: ["$followUpCallsMade.callMade", false] }, { $gt: ["$followUpCallsMade.date", now] } ]}, 1, 0 ]} },
                        followUpCallsMissed: { $sum: { $cond: [ { $and: [ { $eq: ["$followUpCallsMade.callMade", false] }, { $lt: ["$followUpCallsMade.date", now] } ]}, 1, 0 ]} }
                    }
                }
            ])
        ]);

        // Process results
        const messageSummary = messageResult[0] || { patientsWithMessage: 0, doctorToPatientResponses: 0, patientsWithUnreadMessages: 0, outstandingMessages: 0 };
        const callSummary = callStatsResult[0] || { totalFollowUpCallsMade: 0, followUpCallsPending: 0, followUpCallsMissed: 0 };
        
        // Combine into final response
        res.status(200).json({
            success: true,
            summary: {
                ...messageSummary,
                totalFollowUpCallsMade: callSummary.totalFollowUpCallsMade,
                followUpCallsPending: callSummary.followUpCallsPending,
                followUpCallsMissed: callSummary.followUpCallsMissed
            }
        });

    } catch (error) {
        console.error("Error fetching message summary:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * @desc    Get a summary of raw material stock levels, including expiry status.
 * @route   POST /api/raw-materials/stock-summary
 * @access  Private (Admin/Inventory)
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
exports.getRawMaterialStockSummary = async (req, res) => {
    try {
        const { filter } = req.body;
        const matchQuery = {};

        const EXPIRY_THRESHOLD_DAYS = 30;
        const now = new Date();
        const expiryLimitDate = new Date(new Date().setDate(now.getDate() + EXPIRY_THRESHOLD_DAYS));

        if (filter) {
            // ... (your existing filter logic is unchanged)
        }

        const pipeline = [
            // Stage A: Initial match (unchanged)
            {
                $match: {
                    ...matchQuery,
                    quantity: { $gt: 0 }
                }
            },
            // Stage B: MODIFIED to add new counters for material types
            {
                $group: {
                    _id: null,
                    stockOut: { $sum: { $cond: [{ $eq: ["$currentQuantity", 0] }, 1, 0] } },
                    overThreshold: { $sum: { $cond: [ { $and: [ { $gt: ["$currentQuantity", 0] }, { $lt: [{ $divide: ["$currentQuantity", "$quantity"] }, 0.20] } ]}, 1, 0 ] } },
                    aboveThreshold: { $sum: { $cond: [ { $gte: [{ $divide: ["$currentQuantity", "$quantity"] }, 0.20] }, 1, 0 ] } },
                    nearExpiryCount: { $sum: { $cond: [{ $and: [ { $ne: ["$expiryDate", null] }, { $gte: ["$expiryDate", new Date()] }, { $lte: ["$expiryDate", expiryLimitDate] } ]}, 1, 0] } },
                    totalWithExpiryDate: { $sum: { $cond: [{ $ne: ["$expiryDate", null] }, 1, 0] } },

                    // --- NEW COUNTERS ADDED HERE ---
                    totalMaterials: { $sum: 1 },
                    packagingCount: {
                        $sum: { $cond: [{ $eq: ["$type", "Packaging"] }, 1, 0] }
                    }
                }
            },
            // Stage C: MODIFIED to calculate all final percentages
            {
                $project: {
                    _id: 0,
                    stockOut: 1,
                    overThreshold: 1,
                    aboveThreshold: 1,
                    nearExpiryPercentage: {
                        $cond: {
                            if: { $gt: ["$totalWithExpiryDate", 0] },
                            then: { $multiply: [{ $divide: ["$nearExpiryCount", "$totalWithExpiryDate"] }, 100] },
                            else: 0
                        }
                    },
                    // --- NEW PERCENTAGES ADDED HERE ---
                    packagingPercentage: {
                        $cond: {
                            if: { $gt: ["$totalMaterials", 0] },
                            then: { $multiply: [{ $divide: ["$packagingCount", "$totalMaterials"] }, 100] },
                            else: 0
                        }
                    },
                    otherMaterialsPercentage: {
                        $cond: {
                            if: { $gt: ["$totalMaterials", 0] },
                            then: { $multiply: [{ $divide: [ { $subtract: ["$totalMaterials", "$packagingCount"] }, "$totalMaterials" ] }, 100] },
                            else: 0
                        }
                    }
                }
            }
        ];

        const result = await RawMaterial.aggregate(pipeline);

        let summary;
        if (result.length > 0) {
            const rawSummary = result[0];
            summary = {
                ...rawSummary,
                // Round all percentages for a cleaner response
                nearExpiryPercentage: parseFloat(rawSummary.nearExpiryPercentage.toFixed(2)),
                packagingPercentage: parseFloat(rawSummary.packagingPercentage.toFixed(2)),
                otherMaterialsPercentage: parseFloat(rawSummary.otherMaterialsPercentage.toFixed(2))
            };
        } else {
            // MODIFIED: Update the default object
            summary = {
                stockOut: 0,
                overThreshold: 0,
                aboveThreshold: 0,
                nearExpiryPercentage: 0,
                packagingPercentage: 0,
                otherMaterialsPercentage: 0
            };
        }

        res.status(200).json({
            success: true,
            summary
        });

    } catch (error) {
        console.error("Error fetching raw material stock summary:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * @desc    Allow a patient to add feedback for an appointment
 * @route   POST /api/feedback
 * @access  Private (Patient)
 */
exports.addFeedback = async (req, res) => {
    try {
        const { doctorId, appointmentId, ratings, comment } = req.body;
        const patientId = req.user._id; // Assuming patient ID comes from auth middleware

        // 1. Validate input
        if (!doctorId || !appointmentId || !ratings) {
            return res.status(400).json({ message: "Doctor, appointment, and ratings are required." });
        }
        const { consultation, medicineDelivery, communication } = ratings;
        if (consultation === undefined || medicineDelivery === undefined || communication === undefined) {
            return res.status(400).json({ message: "All rating categories are required." });
        }

        // 2. Check for duplicate feedback
        const existingFeedback = await Feedback.findOne({ appointmentId, patientId });
        if (existingFeedback) {
            return res.status(409).json({ message: "Feedback has already been submitted for this appointment." });
        }

        // 3. Calculate the average score
        const averageScore = (consultation + medicineDelivery + communication) / 3;

        // 4. Create and save the new feedback document
        const newFeedback = new Feedback({
            patientId,
            doctorId,
            appointmentId,
            ratings,
            averageScore,
            comment
        });

        const savedFeedback = await newFeedback.save();

        res.status(201).json({
            success: true,
            message: "Thank you for your feedback!",
            data: savedFeedback
        });

    } catch (error) {
        console.error("Error adding feedback:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * @desc    Get an overall summary of all feedback within a time period.
 * @route   POST /api/feedback/summary
 * @access  Private (Admin/Doctor)
 */
exports.getFeedbackSummary = async (req, res) => {
    try {
        const { filter } = req.body;
        const matchQuery = {};

        if (filter) {
            // ... (your existing filter logic is unchanged)
            const now = new Date();
            let startDate;
            switch (filter) {
                case 'day': startDate = new Date(new Date().setHours(0, 0, 0, 0)); break;
                case 'week':
                    const firstDayOfWeek = now.getDate() - now.getDay();
                    startDate = new Date(new Date().setDate(firstDayOfWeek));
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
                default: return res.status(400).json({ message: "Invalid filter value." });
            }
            if (startDate) {
                matchQuery.createdAt = { $gte: startDate };
            }
        }

        // --- NEW, MORE POWERFUL AGGREGATION PIPELINE ---
        const pipeline = [
            // Stage 1: Initial match by date (if filter is provided)
            { $match: matchQuery },

            // Stage 2: Deconstruct the 'responses' array to process each answer individually
            { $unwind: "$responses" },

            // Stage 3: Group by category to get the average rating for each one
            {
                $group: {
                    _id: "$responses.category",
                    averageRating: { $avg: "$responses.rating" },
                    totalRatingsInCategory: { $sum: 1 }
                }
            },

            // Stage 4: Group everything together again to calculate the overall average
            {
                $group: {
                    _id: null,
                    overallAverageScore: { $avg: "$averageRating" },
                    totalRatings: { $sum: "$totalRatingsInCategory" },
                    // Collect the per-category stats into an array
                    categories: {
                        $push: {
                            category: "$_id",
                            averageRating: { $round: ["$averageRating", 1] },
                        }
                    }
                }
            },
            
            // Stage 5: Format the final output
            {
                $project: {
                    _id: 0,
                    totalRatings: 1,
                    overallAverageScore: { $round: ["$overallAverageScore", 1] },
                    categories: 1
                }
            }
        ];

        const result = await FeedbackResponse.aggregate(pipeline);

        // Handle case where no feedback is found
        const summary = result[0] || {
            totalRatings: 0,
            overallAverageScore: 0,
            categories: []
        };

        res.status(200).json({ success: true, data: summary });

    } catch (error) {
        console.error("Error fetching feedback summary:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Helper function (unchanged)
const msToHoursMinutes = (ms) => {
    if (!ms || ms <= 0) return "0h 0m";
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
};

/**
 * @desc    Get a final, overall summary of key clinic analytics with time filters.
 * @route   POST /api/analytics/overall-summary
 * @access  Private (Admin)
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
exports.getOverallClinicAnalytics = async (req, res) => {
    try {
        // --- NEW: Standard time filter logic ---
        const { filter } = req.body;
        const matchQuery = {};
        if (filter) {
            const now = new Date();
            let startDate;
            switch (filter) {
                case 'day':
                    startDate = new Date(new Date().setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    const firstDayOfWeek = now.getDate() - now.getDay();
                    startDate = new Date(new Date().setDate(firstDayOfWeek));
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month':
                    startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                    break;
                default:
                    return res.status(400).json({ message: "Invalid filter value." });
            }
            if (startDate) {
                matchQuery.createdAt = { $gte: startDate };
            }
        }
        // --- END OF NEW LOGIC ---

        const [
            loginStats,
            prescriptionStats,
            callStats,
            feedbackStats
        ] = await Promise.all([
            // 1. Average time to first login (for patients registered in the period)
            Patient.aggregate([
                { $match: { ...matchQuery, firstLoginDone: true, firstLoginTime: { $ne: null } } },
                { $project: { timeToLogin: { $subtract: ["$firstLoginTime", "$createdAt"] } } },
                { $group: { _id: null, avgTimeToLogin: { $avg: "$timeToLogin" } } }
            ]),

            // 2. Prescription revision rate (for prescriptions created in the period)
            Prescription.aggregate([
                { $match: matchQuery }, // Apply filter here
                { $group: {
                    _id: null,
                    totalPrescriptions: { $sum: 1 },
                    prescriptionsWithRevisions: {
                        $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$subPrescriptionID", []] } }, 0] }, 1, 0] }
                    }
                }},
                { $project: {
                    _id: 0,
                    revisionRate: {
                        $cond: {
                            if: { $gt: ["$totalPrescriptions", 0] },
                            then: { $multiply: [{ $divide: ["$prescriptionsWithRevisions", "$totalPrescriptions"] }, 100] },
                            else: 0
                        }
                    }
                }}
            ]),

            // 3. Average calls per patient (for patients registered in the period)
            Patient.aggregate([
                { $match: matchQuery }, // Apply filter here
                { $group: { _id: null, avgCallsReceived: { $avg: "$phoneReceived" } } }
            ]),

            // 4. Average communication score (for feedback created in the period)
            Feedback.aggregate([
                { $match: matchQuery }, // Apply filter here
                { $group: { _id: null, avgCommunicationScore: { $avg: "$ratings.communication" } } }
            ])
        ]);

        // Processing results (unchanged)
        const avgTimeToLoginMs = loginStats[0]?.avgTimeToLogin || 0;
        const prescriptionRevisionRate = prescriptionStats[0]?.revisionRate || 0;
        const avgCallsPerPatient = callStats[0]?.avgCallsReceived || 0;
        const avgCommunicationScore = feedbackStats[0]?.avgCommunicationScore || 0;

        const summary = {
            averageTimeToFirstLogin: msToHoursMinutes(avgTimeToLoginMs),
            prescriptionRevisionRatePercentage: parseFloat(prescriptionRevisionRate.toFixed(2)),
            averageCallsPerPatient: parseFloat(avgCallsPerPatient.toFixed(2)),
            averageCommunicationScore: parseFloat(avgCommunicationScore.toFixed(1))
        };

        res.status(200).json({
            success: true,
            summary
        });

    } catch (error) {
        console.error("Error fetching overall clinic analytics:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * @desc    Get a summary of doctor attendance and total doctor count.
 * @route   GET /api/doctors/attendance-summary?date=YYYY-MM-DD
 * @access  Private (Admin)
 */
exports.getDoctorAttendanceSummary = async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();

        const startOfDay = new Date(targetDate);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        if (isNaN(startOfDay.getTime())) {
            return res.status(400).json({ message: "Invalid date format. Please use YYYY-MM-DD." });
        }

        const attendancePipeline = [
            // This pipeline is unchanged
            { $unwind: "$attendanceRecords" },
            { $match: { "attendanceRecords.date": { $gte: startOfDay, $lte: endOfDay } } },
            {
                $group: {
                    _id: null,
                    presentCount: { $sum: { $cond: [{ $eq: ["$attendanceRecords.status", "Present"] }, 1, 0] } },
                    absentCount: { $sum: { $cond: [{ $eq: ["$attendanceRecords.status", "Absent"] }, 1, 0] } },
                    lateCount: { $sum: { $cond: [{ $eq: ["$attendanceRecords.status", "Late"] }, 1, 0] } }
                }
            },
            {
                $project: {
                    _id: 0,
                    present: "$presentCount",
                    absent: "$absentCount",
                    late: "$lateCount"
                }
            }
        ];

        // --- MODIFIED: Run both queries in parallel for efficiency ---
        const [attendanceResult, totalDoctors] = await Promise.all([
            Doctor.aggregate(attendancePipeline),
            Doctor.countDocuments() // New query to get the total count of all doctors
        ]);
        
        // Prepare the attendance summary
        let summary;
        if (attendanceResult.length > 0) {
            summary = attendanceResult[0];
        } else {
            summary = {
                present: 0,
                absent: 0,
                late: 0
            };
        }

        // --- MODIFIED: Add totalDoctors to the final response ---
        res.status(200).json({
            success: true,
            date: targetDate.toISOString().split('T')[0],
            summary: summary,
            totalDoctors: totalDoctors 
        });

    } catch (error) {
        console.error("Error fetching doctor attendance summary:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
// Import all necessary models at the top of your file


// --- Helper functions from your other controller ---
function convertTo24Hour(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return "00:00";
    const time = timeStr.toUpperCase();
    const [hoursMinutes, modifier] = time.split(' ');
    let [hours, minutes] = hoursMinutes.split(':');
    if (modifier === 'PM' && hours !== '12') hours = parseInt(hours, 10) + 12;
    if (modifier === 'AM' && hours === '12') hours = '00';
    return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function getTimeSlots24(start, end, duration) {
    const startTime24 = convertTo24Hour(start);
    const endTime24 = convertTo24Hour(end);
    const slots = [];
    let currentTime = new Date(`1970-01-01T${startTime24}:00`);
    const endTime = new Date(`1970-01-01T${endTime24}:00`);
    if (endTime <= currentTime) endTime.setDate(endTime.getDate() + 1);
    while (currentTime < endTime) {
        slots.push(currentTime.toTimeString().substring(0, 5));
        currentTime.setMinutes(currentTime.getMinutes() + duration);
    }
    return slots;
}
// --- End of Helper functions ---
/**
 * @desc    Get appointment chart data for a specific day, grouped into 2-hour buckets.
 * @route   GET /api/analytics/appointment-chart?date=YYYY-MM-DD
 * @access  Private (Admin)
 */
exports.getAppointmentChartData = async (req, res) => {
    try {
        // 1. Get date from query, or default to today's date
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();

        const startOfDay = new Date(targetDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        if (isNaN(startOfDay.getTime())) {
            return res.status(400).json({ message: "Invalid date format. Please use YYYY-MM-DD." });
        }

        // --- STEP 1: DEFINE THE MASTER TIMELINE ---
        // A fixed array of the starting hour for each 2-hour bucket
        const masterBuckets = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

        // --- STEP 2: GET APPOINTMENT COUNTS FROM THE DATABASE ---
        const aggregationPipeline = [
            { $match: { appointmentDate: { $gte: startOfDay, $lte: endOfDay } } },
            {
                $group: {
                    _id: { // Group by a calculated 2-hour bucket
                        $subtract: [
                            { $toInt: { $substr: ["$timeSlot", 0, 2] } },
                            { $mod: [{ $toInt: { $substr: ["$timeSlot", 0, 2] } }, 2] }
                        ]
                    },
                    bookedCount: { $sum: { $cond: [{ $eq: ["$follow", "Consultation"] }, 1, 0] } },
                    completedCount: { $sum: { $cond: [{ $ne: ["$follow", "Consultation"] }, 1, 0] } }
                }
            }
        ];
        const bookedSlotsResult = await Appointment.aggregate(aggregationPipeline);
        const resultsMap = new Map(bookedSlotsResult.map(item => [item._id, item]));

        // --- STEP 3: MERGE THE DATA ---
        const bookedAppointments = [];
        const completedAppointments = [];

        for (const bucketHour of masterBuckets) {
            // Create a clean label for the chart's x-axis
            const label = `${String(bucketHour).padStart(2, '0')}:00 - ${String(bucketHour + 2).padStart(2, '0')}:00`;
            
            // Get the counts from our database results, or default to 0
            const counts = resultsMap.get(bucketHour) || { bookedCount: 0, completedCount: 0 };
            
            bookedAppointments.push({ x: label, y: counts.bookedCount });
            completedAppointments.push({ x: label, y: counts.completedCount });
        }

        res.status(200).json({
            success: true,
            date: targetDate.toISOString().split('T')[0],
            data: {
                bookedAppointments,
                completedAppointments
            }
        });

    } catch (error) {
        console.error("Error fetching appointment chart data:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * @desc    Get chart data for settled payables and receivables grouped by category.
 * @route   POST /api/notes/chart-data
 * @access  Private (Admin)
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
// Make sure to import the Payment and Prescription models
exports.getDebitCreditChartData = async (req, res) => {
    try {
        const PAYABLE_CATEGORIES = ["Vendor", "Staff", "Logistics", "Miscellaneous"];
        const RECEIVABLE_CATEGORIES = ["Booking fee", "Consultation fee", "Medicine prep", "Shipment", "Miscellaneous"];

        const { filter } = req.body;
        const matchQuery = {}; // For createdAt
        const dcMatchQuery = {}; // For issuedDate

        if (filter) {
            let startDate;
            // ... (your existing filter logic is unchanged) ...
            if(startDate) {
                matchQuery.createdAt = { $gte: startDate };
                dcMatchQuery.issuedDate = { $gte: startDate };
            }
        }

        // --- NEW LOGIC: Run three separate queries in parallel ---
        const [
            payablesResult,
            bookingFeeResult,
            prescriptionChargesResult
        ] = await Promise.all([
            // Query 1: Get Payables from DebitCreditNote
            DebitCreditNote.aggregate([
                { $match: { ...dcMatchQuery, paymentStatus: 'Settled', linkedType: 'Payable' } },
                { $group: { _id: "$category", totalAmount: { $sum: "$amount" } } },
                { $project: { x: "$_id", y: "$totalAmount", _id: 0 } }
            ]),

            // Query 2: Get "Booking fee" from successful Consultation payments
            Payment.aggregate([
                { $match: { ...matchQuery, paidFor: "Consultation" } },
                { $group: { _id: "Booking fee", totalAmount: { $sum: '$amount' } } },
                { $project: { x: "$_id", y: "$totalAmount", _id: 0 } }
            ]),

            // Query 3: Get other fees from successful Prescription payments
            Prescription.aggregate([
                { $match: { ...matchQuery, isPayementDone: true } },
                {
                    $group: {
                        _id: null,
                        "Shipping fee": { $sum: '$shippingCharges' },
                        "Consultation fee": { $sum: '$additionalCharges' },
                        "Medicine prep": { $sum: '$medicineCharges' }
                    }
                }
            ])
        ]);

        // --- Process all results and merge them ---
        
        // Process Payables (unchanged)
        const payablesMap = new Map(payablesResult.map(item => [item.x, item.y]));
        const finalPayables = PAYABLE_CATEGORIES.map(category => ({
            x: category,
            y: payablesMap.get(category) || 0
        }));

        // Process all Receivables from the new sources
        const receivablesMap = new Map();
        // Add from booking fees
        if (bookingFeeResult.length > 0) {
            receivablesMap.set(bookingFeeResult[0].x, bookingFeeResult[0].y);
        }
        // Add from prescription charges
        if (prescriptionChargesResult.length > 0) {
            const presData = prescriptionChargesResult[0];
            receivablesMap.set("Shipping fee", presData["Shipping fee"] || 0);
            receivablesMap.set("Consultation fee", (receivablesMap.get("Consultation fee") || 0) + (presData["Consultation fee"] || 0));
            receivablesMap.set("Medicine prep", presData["Medicine prep"] || 0);
        }
        
        const finalReceivables = RECEIVABLE_CATEGORIES.map(category => ({
            x: category,
            y: receivablesMap.get(category) || 0
        }));
        
        // --- Send the final response in the ORIGINAL format ---
        res.status(200).json({
            success: true,
            data: {
                payablesByCategory: finalPayables,
                receivablesByCategory: finalReceivables
            }
        });

    } catch (error) {
        console.error("Error fetching debit/credit chart data:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};
/**
 * @desc    Get a complete summary of all vendors' reliability and price index.
 * @route   POST /api/analytics/vendor-summary
 * @access  Private (Admin)
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
exports.getVendorAnalytics = async (req, res) => {
    try {
        const { filter } = req.body;
        let startDate = null; // Default to null for all-time

        // Standard time filter logic
        if (filter) {
            const now = new Date();
            switch (filter) {
                case 'day':
                    startDate = new Date(new Date().setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    const firstDayOfWeek = now.getDate() - now.getDay();
                    startDate = new Date(new Date().setDate(firstDayOfWeek));
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
            }
        }

        const matchQuery = { status: 'delivered' };
        if (startDate) {
            matchQuery.orderDate = { $gte: startDate };
        }

        const [vendorResults, overallStats] = await Promise.all([
            // Query 1: Get data for ALL vendors, looking up their orders
            Vendor.aggregate([
                // Stage 1: Lookup orders for each vendor
                {
                    $lookup: {
                        from: "orders",
                        localField: "_id",
                        foreignField: "vendorId",
                        as: "orders"
                    }
                },
                // Stage 2: Calculate metrics based on the orders array
                {
                    $project: {
                        name: 1, // Keep the vendor name
                        // Filter orders to only include delivered ones in the date range
                        filteredOrders: {
                            $filter: {
                                input: "$orders",
                                as: "order",
                                cond: { $and: [
                                    { $eq: ["$$order.status", "delivered"] },
                                    startDate ? { $gte: ["$$order.orderDate", startDate] } : true
                                ]}
                            }
                        }
                    }
                },
                // Stage 3: Project the final calculated scores
                {
                    $project: {
                        _id: 0,
                        vendorId: "$_id",
                        vendorName: "$name",
                        priceIndex: { $ifNull: [{ $avg: "$filteredOrders.totalAmount" }, 0] },
                        reliabilityScore: {
                            $let: {
                                vars: {
                                    onTime: {
                                        $filter: {
                                            input: "$filteredOrders",
                                            as: "order",
                                            cond: { $lte: ["$$order.deliveryDate", "$$order.expectedDeliveryDate"] }
                                        }
                                    }
                                },
                                in: {
                                    $cond: {
                                        if: { $gt: [{ $size: "$filteredOrders" }, 0] },
                                        then: { $multiply: [{ $divide: [{ $size: "$$onTime" }, { $size: "$filteredOrders" }] }, 100] },
                                        else: 0
                                    }
                                }
                            }
                        }
                    }
                },
                { $sort: { vendorName: 1 } }
            ]),
            // Query 2: Get the overall average (unchanged)
            Order.aggregate([
                { $match: matchQuery },
                { $group: { _id: null, overallAverage: { $avg: "$totalAmount" } } }
            ])
        ]);
        
        // Final processing and percentage calculation (unchanged)
        const overallAverageValue = overallStats[0]?.overallAverage || 0;
        const formattedAnalytics = vendorResults.map(item => {
            let priceIndexPercentage = 0; // Default to 0 if they have no orders
            if (overallAverageValue > 0 && item.priceIndex > 0) {
                priceIndexPercentage = (item.priceIndex / overallAverageValue) * 100;
            }
            return {
                ...item,
                reliabilityScore: parseFloat(item.reliabilityScore.toFixed(2)),
                priceIndex: parseFloat(item.priceIndex.toFixed(2)),
                priceIndexPercentage: parseFloat(priceIndexPercentage.toFixed(2))
            };
        });

        res.status(200).json({ success: true, data: formattedAnalytics });

    } catch (error) {
        console.error("Error fetching vendor analytics:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.bulkUpdateFeedbackQuestions = async (req, res) => {
    try {
        const items = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Request body must be a non-empty array." });
        }

        // Prepare the operations for bulkWrite
        const operations = items.map(item => {
            if (item._id) {
                // This is an UPDATE operation
                const { _id, ...updateData } = item;
                return {
                    updateOne: {
                        filter: { _id: _id },
                        update: { $set: updateData }
                    }
                };
            } else {
                // This is a CREATE operation
                return {
                    insertOne: {
                        document: item
                    }
                };
            }
        });

        const result = await FeedbackQuestion.bulkWrite(operations);

        res.status(200).json({
            success: true,
            message: `Operation successful: ${result.nInserted} created, ${result.nModified} updated.`,
            data: result
        });

    } catch (error) {
        console.error("Error in bulk operation:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};
exports.getOrderFrequencyChart = async (req, res) => {
    try {
        const { filter } = req.body;
        let startDate = null;
        let endDate = new Date();
        
        let groupBy, masterKeys, getLabel;

        const now = new Date();

        if (filter === 'day') {
            startDate = new Date(now.setHours(0, 0, 0, 0));
            endDate.setHours(23, 59, 59, 999);
            
            groupBy = { // Group by 2-hour bucket
                $subtract: [
                    { $hour: { date: "$orderDate", timezone: "Asia/Kolkata" } },
                    { $mod: [{ $hour: { date: "$orderDate", timezone: "Asia/Kolkata" } }, 2] }
                ]
            };
            masterKeys = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
            getLabel = (key) => `${String(key).padStart(2, '0')}:00 - ${String(key + 2).padStart(2, '0')}:00`;

        } else if (filter === 'week') {
            const firstDayOfWeek = now.getDate() - now.getDay();
            startDate = new Date(new Date().setDate(firstDayOfWeek));
            startDate.setHours(0, 0, 0, 0);
            
            groupBy = { $dayOfWeek: { date: "$orderDate", timezone: "Asia/Kolkata" } }; // 1=Sun, 2=Mon...
            masterKeys = [1, 2, 3, 4, 5, 6, 7];
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            getLabel = (key) => dayNames[key - 1];

        } else if (filter === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            
            groupBy = { $dayOfMonth: { date: "$orderDate", timezone: "Asia/Kolkata" } };
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            masterKeys = Array.from({ length: daysInMonth }, (_, i) => i + 1); // [1, 2, 3, ... 31]
            getLabel = (key) => `Day ${key}`;
        }
        
        // Default to 'day' if no valid filter is provided
        if (!groupBy) {
            startDate = new Date(now.setHours(0, 0, 0, 0));
            endDate.setHours(23, 59, 59, 999);
            groupBy = { $subtract: [ { $hour: { date: "$orderDate", timezone: "Asia/Kolkata" } }, { $mod: [{ $hour: { date: "$orderDate", timezone: "Asia/Kolkata" } }, 2] }]};
            masterKeys = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
            getLabel = (key) => `${String(key).padStart(2, '0')}:00 - ${String(key + 2).padStart(2, '0')}:00`;
        }

        const matchQuery = startDate ? { orderDate: { $gte: startDate, $lte: endDate } } : {};
        
        const aggregationPipeline = [
            { $match: matchQuery },
            { $group: { _id: groupBy, orderCount: { $sum: 1 } } }
        ];
        
        const results = await Order.aggregate(aggregationPipeline);
        const resultsMap = new Map(results.map(item => [item._id, item.orderCount]));
        
        const chartData = masterKeys.map(key => ({
            x: getLabel(key),
            y: resultsMap.get(key) || 0
        }));

        res.status(200).json({
            success: true,
            filter: filter || 'day',
            data: chartData
        });

    } catch (error) {
        console.error("Error fetching order frequency chart:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * @desc    Create a new feedback question.
 * @route   POST /api/feedback/questions
 * @access  Private (Admin)
 */
exports.createFeedbackQuestion = async (req, res) => {
    try {
        // 1. The body is now expected to be an array of questions
        const questions = req.body;

        // 2. New validation to check if the payload is a non-empty array
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: "Request body must be an array of question objects." });
        }

        // 3. Mongoose's .create() can handle an array directly
        const newQuestions = await Feedback.create(questions);

        res.status(201).json({
            success: true,
            message: `${newQuestions.length} feedback question(s) created successfully.`,
            data: newQuestions
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "One or more of these questions already exist." });
        }
        console.error("Error creating feedback questions:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};