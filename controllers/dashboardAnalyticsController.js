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
require("dotenv").config({ path: "./config/.env" });
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
 * @desc    Get a summary of total amounts for receivables and payables.
 * @route   GET /api/financials/debit-credit-summary
 * @access  Private/Admin
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
exports.getDebitCreditSummary = async (req, res) => {
    try {
        // Get the optional filter from the request body
        const { filter } = req.body;

        const matchQuery = {};

        // If a filter is provided, calculate the start date for the query
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

            // The filter applies to the 'createdAt' field from timestamps
            if (startDate) {
                matchQuery.createdAt = { $gte: startDate };
            }
        }

        const results = await DebitCreditNote.aggregate([
            // Stage 1: Filter documents based on the date period (if any)
            {
                $match: matchQuery
            },
            // Stage 2: Group by the 'linkedType' to separate Receivables and Payables
            {
                $group: {
                    _id: '$linkedType',      // Group by 'Receivable' or 'Payable'
                    totalAmount: { $sum: '$amount' } // Sum the amount for each group
                }
            }
        ]);

        // --- Process the aggregation results ---
        // The result will be an array like: [{ _id: 'Receivable', totalAmount: 5000 }, { _id: 'Payable', totalAmount: 2000 }]

        const receivableData = results.find(item => item._id === 'Receivable');
        const payableData = results.find(item => item._id === 'Payable');

        const totalReceivables = receivableData ? receivableData.totalAmount : 0;
        const totalPayables = payableData ? payableData.totalAmount : 0;
        
        // --- Send the final summary response ---
        res.status(200).json({
            success: true,
            data: {
                totalReceivables,
                totalPayables
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