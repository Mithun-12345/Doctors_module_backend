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
const Feedback = require('../models/appRatings');


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
/**
 * @desc    Get a summary of patient medication adherence.
 * @route   POST /api/patients/adherence-summary
 * @access  Private (Patient Care)
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
exports.getPatientAdherenceSummary = async (req, res) => {
    try {
        const { filter } = req.body;
        const matchQuery = {};

        // 1. Standard time filter logic
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
                // --- THIS IS THE ONLY LINE THAT CHANGED ---
                matchQuery.date = { $gte: startDate }; // Now filters by the reminder's scheduled date
            }
        }

        // 2. Build the complex aggregation pipeline
        const pipeline = [
            // Stage A: Initial match for the date range AND to filter out future reminders
            {
                $match: {
                    ...matchQuery,
                    $expr: {
                        $lte: [
                            // Construct the full reminder datetime from parts
                            {
                                $dateFromParts: {
                                    year: { $year: "$date" },
                                    month: { $month: "$date" },
                                    day: { $dayOfMonth: "$date" },
                                    hour: { $toInt: { $substr: ["$doseTime", 0, 2] } },
                                    minute: { $toInt: { $substr: ["$doseTime", 3, 2] } },
                                    timezone: "Asia/Kolkata"
                                }
                            },
                            // Compare it to the current time
                            "$$NOW"
                        ]
                    }
                }
            },
            // Stage B: Group by patient to calculate individual adherence
            {
                $group: {
                    _id: "$patientId",
                    totalDoses: { $sum: 1 },
                    takenDoses: {
                        $sum: { $cond: [{ $eq: ["$status", true] }, 1, 0] }
                    }
                }
            },
            // Stage C: Calculate the adherence percentage for each patient
            {
                $project: {
                    _id: 1,
                    adherencePercentage: {
                        $cond: {
                            if: { $gt: ["$totalDoses", 0] },
                            then: { $multiply: [{ $divide: ["$takenDoses", "$totalDoses"] }, 100] },
                            else: 0
                        }
                    }
                }
            },
            // Stage D: Group ALL patients together to count them into categories
            {
                $group: {
                    _id: null,
                    consistentPatients: {
                        $sum: { $cond: [{ $gt: ["$adherencePercentage", 90] }, 1, 0] }
                    },
                    inconsistentPatients: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $lte: ["$adherencePercentage", 90] },
                                    { $gt: ["$adherencePercentage", 70] }
                                ]}, 1, 0
                            ]
                        }
                    },
                    nonAdherentPatients: {
                        $sum: { $cond: [{ $lte: ["$adherencePercentage", 70] }, 1, 0] }
                    }
                }
            },
            // Stage E: Format the final output
            {
                $project: {
                    _id: 0,
                    consistentPatients: 1,
                    inconsistentPatients: 1,
                    nonAdherentPatients: 1
                }
            }
        ];

        const result = await NotificationReminderSettings.aggregate(pipeline);

        // 3. Prepare and send the final response
        let summary;
        if (result.length > 0) {
            summary = result[0];
        } else {
            summary = {
                consistentPatients: 0,
                inconsistentPatients: 0,
                nonAdherentPatients: 0
            };
        }

        res.status(200).json({
            success: true,
            summary: summary
        });

    } catch (error) {
        console.error("Error fetching patient adherence summary:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.getMedicinePreparationStatus = async (req, res) => {
    try {
        // --- 1. Get the filter from the request body ---
        const { filter } = req.body; // e.g., "day", "week", "month"

        // --- 2. Calculate the date range based on the filter ---
        let startDate;
        const endDate = new Date();

        if (filter === 'day') {
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
        } else if (filter === 'week') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of the week (Sunday)
            startDate.setHours(0, 0, 0, 0);
        } else if (filter === 'month') {
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
        }
        
        // --- 3. Create the match condition for our queries ---
        const dateMatchCondition = {};
        if (startDate) {
            dateMatchCondition.createdAt = { $gte: startDate, $lte: endDate };
        }

        // --- Part 1: Get Counts using an Aggregation Pipeline ---
        const countsPipeline = [
            // NEW: Add the date match stage at the very beginning for efficiency
            { $match: dateMatchCondition },
            
            // The rest of the pipeline remains the same
            {
                $lookup: { from: 'appointments', localField: 'prescriptionId', foreignField: 'prescriptionID', as: 'appointmentInfo' }
            },
            {
                $unwind: { path: '$appointmentInfo', preserveNullAndEmptyArrays: true }
            },
            {
                $group: {
                    _id: null,
                    totalInitialized: { $sum: { $size: '$medicinePreparations' } },
                    completedCount: {
                        $sum: {
                            $cond: [ { $eq: ['$appointmentInfo.medicinePrepared', true] }, { $size: '$medicinePreparations' }, 0 ]
                        }
                    }
                }
            }
        ];

        const countResults = await MedicinePreparationSummary.aggregate(countsPipeline);

        // --- Part 2: Generate the Detailed Leakage Report ---
        const leakageFindFilter = {
            "medicinePreparations.rawMaterialsUsed.leakageDetected": true,
            ...dateMatchCondition // Add the same date filter here
        };

        const summariesWithLeakage = await MedicinePreparationSummary.find(leakageFindFilter).lean();

        const leakageReport = [];
        summariesWithLeakage.forEach(summary => {
            summary.medicinePreparations.forEach(med => {
                const leakedMaterials = med.rawMaterialsUsed.filter(rm => rm.leakageDetected === true);
                if (leakedMaterials.length > 0) {
                    leakageReport.push({
                        prescriptionId: summary.prescriptionId,
                        medicineName: med.medicineName,
                        leakedItems: leakedMaterials.map(item => ({
                            materialName: item.materialName,
                            quantityLeaked: item.quantityLeaked || 0
                        }))
                    });
                }
            });
        });

        // --- Part 3: Combine and Send the Final Response ---
        const stats = countResults[0] || { totalInitialized: 0, completedCount: 0 };
        const pendingCount = stats.totalInitialized - stats.completedCount;

        res.status(200).json({
            success: true,
            filter: filter || 'overall', // Let the frontend know which filter was applied
            data: {
                totalInitializedMedicines: stats.totalInitialized,
                completedMedicines: stats.completedCount,
                pendingMedicines: pendingCount,
                leakageDetails: leakageReport
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
            if (startDate) {
                matchQuery.createdAt = { $gte: startDate };
            }
        }

        const pipeline = [
            {
                $match: matchQuery
            },
            // Stage 2: MODIFIED to include the new 'awaitingDispatch' counter
            {
                $group: {
                    _id: null,
                    productsShipped: {
                        $sum: { $cond: [{ $eq: ["$isProductShipped", true] }, 1, 0] }
                    },
                    productsReceived: {
                        $sum: { $cond: [{ $eq: ["$isProductReceived", true] }, 1, 0] }
                    },
                    shipmentsLost: {
                        $sum: { $cond: [{ $eq: ["$shipmentLost", true] }, 1, 0] }
                    },
                    // --- NEW COUNTER ADDED HERE ---
                    awaitingDispatch: {
                        $sum: { $cond: [{ $eq: ["$isProductShipped", false] }, 1, 0] }
                    }
                }
            },
            // Stage 3: MODIFIED to include the new field in the output
            {
                $project: {
                    _id: 0,
                    productsShipped: 1,
                    productsReceived: 1,
                    shipmentsLost: 1,
                    awaitingDispatch: 1 // --- ADDED HERE ---
                }
            }
        ];

        const result = await Prescription.aggregate(pipeline);

        let summary;
        if (result.length > 0) {
            summary = result[0];
        } else {
            // MODIFIED: Update the default object
            summary = {
                productsShipped: 0,
                productsReceived: 0,
                shipmentsLost: 0,
                awaitingDispatch: 0 // --- ADDED HERE ---
            };
        }

        res.status(200).json({
            success: true,
            summary: summary
        });

    } catch (error) {
        console.error("Error fetching shipment summary:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**

 * @desc    Get a summary of chat message analytics.
 * @route   POST /api/messages/summary
 * @access  Private (Admin)
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
exports.getMessageSummary = async (req, res) => {
    try {
        const { filter } = req.body;

        const matchQuery = {};
        const now = new Date();

        // 1. Standard time filter logic
        if (filter) {
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
                matchQuery.timestamp = { $gte: startDate }; // Filter by message timestamp
            }
        }

        // Define what "outstanding" means (e.g., unread for more than 3 days)
        const OUTSTANDING_THRESHOLD_DAYS = 3;
        const outstandingDateLimit = new Date(now.setDate(now.getDate() - OUTSTANDING_THRESHOLD_DAYS));

        // 2. Build the complex aggregation pipeline
        const pipeline = [
            // Stage A: Initial match on the message collection based on the filter
            { $match: matchQuery },

            // Stage B: Join with the Patients collection to verify the receiver
            {
                $lookup: {
                    from: 'patients', // The name of the patients collection
                    let: { receiverId: { $toObjectId: '$receiver' } }, // Convert string ID to ObjectId
                    pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$receiverId'] } } }],
                    as: 'patientInfo'
                }
            },

            // Stage C: Join with the Doctors collection to verify the sender
            {
                $lookup: {
                    from: 'doctors', // The name of the doctors collection
                    let: { senderId: { $toObjectId: '$sender' } }, // Convert string ID to ObjectId
                    pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$senderId'] } } }],
                    as: 'doctorInfo'
                }
            },

            // Stage D: Group everything to calculate all metrics at once
            {
                $group: {
                    _id: null,
                    // Count messages where sender is a doctor AND receiver is a patient
                    doctorToPatientResponses: {
                        $sum: {
                            $cond: [{ $and: [
                                { $gt: [{ $size: "$doctorInfo" }, 0] },
                                { $gt: [{ $size: "$patientInfo" }, 0] }
                            ]}, 1, 0]
                        }
                    },
                    // Count messages that are unread AND older than our threshold
                    outstandingMessages: {
                        $sum: {
                            $cond: [{ $and: [
                                { $eq: ["$isRead", false] },
                                { $lt: ["$timestamp", outstandingDateLimit] }
                            ]}, 1, 0]
                        }
                    },
                    // Collect unique patient IDs who received a message
                    uniquePatientsWithMessage: {
                        $addToSet: {
                            $cond: [{ $gt: [{ $size: "$patientInfo" }, 0] }, "$receiver", null]
                        }
                    },
                    // Collect unique patient IDs with unread messages
                    uniquePatientsWithUnread: {
                        $addToSet: {
                            $cond: [{ $and: [
                                { $gt: [{ $size: "$patientInfo" }, 0] },
                                { $eq: ["$isRead", false] }
                            ]}, "$receiver", null]
                        }
                    }
                }
            },

            // Stage E: Project the final counts from the unique sets
            {
                $project: {
                    _id: 0,
                    doctorToPatientResponses: 1,
                    outstandingMessages: 1,
                    patientsWithMessage: { $size: { $ifNull: ["$uniquePatientsWithMessage", []] } },
                    patientsWithUnreadMessages: { $size: { $ifNull: ["$uniquePatientsWithUnread", []] } }
                }
            }
        ];

        const result = await Message.aggregate(pipeline);

        // 3. Prepare and send the final response
        let summary;
        if (result.length > 0) {
            summary = result[0];
        } else {
            summary = {
                patientsWithMessage: 0,
                doctorToPatientResponses: 0,
                patientsWithUnreadMessages: 0,
                outstandingMessages: 0
            };
        }

        res.status(200).json({ success: true, summary });

    } catch (error) {
        console.error("Error fetching message summary:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * @desc    Get a summary of chat message analytics.
 * @route   POST /api/messages/summary
 * @access  Private (Admin)
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
exports.getMessageSummary = async (req, res) => {
    try {
        const { filter } = req.body;

        const matchQuery = {};
        const now = new Date();

        // 1. Standard time filter logic
        if (filter) {
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
                matchQuery.timestamp = { $gte: startDate }; // Filter by message timestamp
            }
        }

        // Define what "outstanding" means (e.g., unread for more than 3 days)
        const OUTSTANDING_THRESHOLD_DAYS = 3;
        const outstandingDateLimit = new Date(now.setDate(now.getDate() - OUTSTANDING_THRESHOLD_DAYS));

        // 2. Build the complex aggregation pipeline
        const pipeline = [
            // Stage A: Initial match on the message collection based on the filter
            { $match: matchQuery },

            // Stage B: Join with the Patients collection to verify the receiver
            {
                $lookup: {
                    from: 'patients', // The name of the patients collection
                    let: { receiverId: { $toObjectId: '$receiver' } }, // Convert string ID to ObjectId
                    pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$receiverId'] } } }],
                    as: 'patientInfo'
                }
            },

            // Stage C: Join with the Doctors collection to verify the sender
            {
                $lookup: {
                    from: 'doctors', // The name of the doctors collection
                    let: { senderId: { $toObjectId: '$sender' } }, // Convert string ID to ObjectId
                    pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$senderId'] } } }],
                    as: 'doctorInfo'
                }
            },

            // Stage D: Group everything to calculate all metrics at once
            {
                $group: {
                    _id: null,
                    // Count messages where sender is a doctor AND receiver is a patient
                    doctorToPatientResponses: {
                        $sum: {
                            $cond: [{ $and: [
                                { $gt: [{ $size: "$doctorInfo" }, 0] },
                                { $gt: [{ $size: "$patientInfo" }, 0] }
                            ]}, 1, 0]
                        }
                    },
                    // Count messages that are unread AND older than our threshold
                    outstandingMessages: {
                        $sum: {
                            $cond: [{ $and: [
                                { $eq: ["$isRead", false] },
                                { $lt: ["$timestamp", outstandingDateLimit] }
                            ]}, 1, 0]
                        }
                    },
                    // Collect unique patient IDs who received a message
                    uniquePatientsWithMessage: {
                        $addToSet: {
                            $cond: [{ $gt: [{ $size: "$patientInfo" }, 0] }, "$receiver", null]
                        }
                    },
                    // Collect unique patient IDs with unread messages
                    uniquePatientsWithUnread: {
                        $addToSet: {
                            $cond: [{ $and: [
                                { $gt: [{ $size: "$patientInfo" }, 0] },
                                { $eq: ["$isRead", false] }
                            ]}, "$receiver", null]
                        }
                    }
                }
            },

            // Stage E: Project the final counts from the unique sets
            {
                $project: {
                    _id: 0,
                    doctorToPatientResponses: 1,
                    outstandingMessages: 1,
                    patientsWithMessage: { $size: { $ifNull: ["$uniquePatientsWithMessage", []] } },
                    patientsWithUnreadMessages: { $size: { $ifNull: ["$uniquePatientsWithUnread", []] } }
                }
            }
        ];

        const result = await Message.aggregate(pipeline);

        // 3. Prepare and send the final response
        let summary;
        if (result.length > 0) {
            summary = result[0];
        } else {
            summary = {
                patientsWithMessage: 0,
                doctorToPatientResponses: 0,
                patientsWithUnreadMessages: 0,
                outstandingMessages: 0
            };
        }

        res.status(200).json({ success: true, summary });

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

        // --- NEW: Define expiry threshold ---
        const EXPIRY_THRESHOLD_DAYS = 30;
        const now = new Date();
        const expiryLimitDate = new Date(new Date().setDate(now.getDate() + EXPIRY_THRESHOLD_DAYS));

        // 1. Standard time filter logic
        if (filter) {
            let startDate;
            switch (filter) {
                // ... (day, week, month cases are unchanged)
                case 'day':
                    startDate = new Date(new Date().setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    const firstDayOfWeek = new Date().getDate() - new Date().getDay();
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

        // 2. Build the aggregation pipeline
        const pipeline = [
            // Stage A: Initial match (unchanged)
            {
                $match: {
                    ...matchQuery,
                    quantity: { $gt: 0 }
                }
            },
            // Stage B: MODIFIED to add expiry calculations
            {
                $group: {
                    _id: null,
                    stockOut: {
                        $sum: { $cond: [{ $eq: ["$currentQuantity", 0] }, 1, 0] }
                    },
                    overThreshold: {
                        $sum: { $cond: [ { $and: [ { $gt: ["$currentQuantity", 0] }, { $lt: [{ $divide: ["$currentQuantity", "$quantity"] }, 0.20] } ]}, 1, 0 ] }
                    },
                    aboveThreshold: {
                        $sum: { $cond: [ { $gte: [{ $divide: ["$currentQuantity", "$quantity"] }, 0.20] }, 1, 0 ] }
                    },
                    // --- NEW: Count items nearing expiry ---
                    nearExpiryCount: {
                        $sum: {
                            $cond: [{ $and: [
                                { $ne: ["$expiryDate", null] }, // Must have an expiry date
                                { $gte: ["$expiryDate", new Date()] }, // Must not be already expired
                                { $lte: ["$expiryDate", expiryLimitDate] } // And must be within our 30-day threshold
                            ]}, 1, 0]
                        }
                    },
                    // --- NEW: Count total items that have an expiry date for the percentage calculation ---
                    totalWithExpiryDate: {
                        $sum: {
                            $cond: [{ $ne: ["$expiryDate", null] }, 1, 0]
                        }
                    }
                }
            },
            // Stage C: MODIFIED to calculate the final percentage
            {
                $project: {
                    _id: 0,
                    stockOut: 1,
                    overThreshold: 1,
                    aboveThreshold: 1,
                    // --- NEW: Calculate the near expiry percentage ---
                    nearExpiryPercentage: {
                        $cond: {
                            if: { $gt: ["$totalWithExpiryDate", 0] },
                            then: { $multiply: [{ $divide: ["$nearExpiryCount", "$totalWithExpiryDate"] }, 100] },
                            else: 0 // If no items have an expiry date, percentage is 0
                        }
                    }
                }
            }
        ];

        const result = await RawMaterial.aggregate(pipeline);

        // 3. Prepare and send the final response
        let summary;
        if (result.length > 0) {
            const rawSummary = result[0];
            summary = {
                ...rawSummary,
                // Round the percentage for a cleaner response
                nearExpiryPercentage: parseFloat(rawSummary.nearExpiryPercentage.toFixed(2))
            };
        } else {
            // MODIFIED: Update the default object
            summary = {
                stockOut: 0,
                overThreshold: 0,
                aboveThreshold: 0,
                nearExpiryPercentage: 0 // --- ADDED HERE ---
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
 * @body    { "filter": "[day|week|month]" } // Optional filter
 */
exports.getFeedbackSummary = async (req, res) => {
    try {
        // MODIFIED: Read 'filter' from the request body
        const { filter } = req.body;
        const matchQuery = {};

        // NEW: Standard time filter logic
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
                // Filter by when the feedback was created
                matchQuery.createdAt = { $gte: startDate };
            }
        }

        // The aggregation pipeline is the same, but now uses the date-filtered matchQuery
        const pipeline = [
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalRatings: { $sum: 1 },
                    overallAverageScore: { $avg: "$averageScore" },
                    avgConsultation: { $avg: "$ratings.consultation" },
                    avgMedicineDelivery: { $avg: "$ratings.medicineDelivery" },
                    avgCommunication: { $avg: "$ratings.communication" }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalRatings: 1,
                    overallAverageScore: { $round: ["$overallAverageScore", 1] },
                    avgConsultation: { $round: ["$avgConsultation", 1] },
                    avgMedicineDelivery: { $round: ["$avgMedicineDelivery", 1] },
                    avgCommunication: { $round: ["$avgCommunication", 1] }
                }
            }
        ];

        const result = await Feedback.aggregate(pipeline);

        let summary;
        if (result.length > 0) {
            summary = result[0];
        } else {
            summary = {
                totalRatings: 0,
                overallAverageScore: 0,
                avgConsultation: 0,
                avgMedicineDelivery: 0,
                avgCommunication: 0
            };
        }

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