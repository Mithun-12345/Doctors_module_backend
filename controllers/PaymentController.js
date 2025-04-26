const crypto = require("crypto");
const Razorpay = require("razorpay");
const PaymentConfig = require("../models/PaymentConfig");
const Transaction = require("../models/Transaction");
const {
  validatePaymentVerification,
} = require("razorpay/dist/utils/razorpay-utils");
const Appointment = require("../models/appointmentModel");
const Patient = require("../models/patientModel");
const MedicalDetails = require("../models/patientDetails");
const Doctor = require("../models/doctorModel");
// Initialize Razorpay with your key credentials
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

class PaymentController {
  static async calculateAmount(appointmentDate, patientType) {
    try {
      const paymentConfig = await PaymentConfig.findOne().sort({
        createdAt: -1,
      });
      if (!paymentConfig) {
        throw new Error("Payment configuration not found");
      }

      const appointmentDay = new Date(appointmentDate).getDay();
      const isWeekend = appointmentDay === 0 || appointmentDay === 6;
      const isChronicPatient = patientType.toLowerCase() === "chronic";

      if (isWeekend) {
        return isChronicPatient
          ? paymentConfig.weekendChronic
          : paymentConfig.weekendAcute;
      }
      return isChronicPatient
        ? paymentConfig.weekdayChronic
        : paymentConfig.weekdayAcute;
    } catch (error) {
      throw new Error(`Error calculating amount: ${error.message}`);
    }
  }

  static async createDraftAppointment(req, res) {
    try {
      const {
        appointmentDate,
        timeSlot,
        consultingFor,
        fullName,
        consultingReason,
        symptom,
      } = req.body;
      const phone = req.user.phone;

      // Validate user exists
      const user = await Patient.findOne({ phone });
      if (!user) return res.status(404).json({ message: "Patient not found" });

      const medicalDetails = await MedicalDetails.findOne({
        patientId: user._id,
      });
      if (!medicalDetails) {
        return res.status(404).json({ message: "Medical details not found" });
      }

      const doctorId = "67bc3391654d85340a8ce713"; // should be changed

      // Find the doctor by ID
      const doctor = await Doctor.findById(doctorId);
      if (!doctor || doctor.role !== "admin-doctor") {
        return res.status(404).json({ message: "Doctor not found" });
      }

      // Validate time slot
      const timeSlots = [
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
      ];
      const requestedSlotIndex = timeSlots.indexOf(timeSlot);

      if (requestedSlotIndex === -1) {
        return res.status(400).json({ message: "Invalid time slot" });
      }

      // Validate appointment date
      const currentDate = new Date();
      const appointmentDateObj = new Date(appointmentDate);
      const oneMonthLater = new Date();
      oneMonthLater.setMonth(currentDate.getMonth() + 1);

      if (appointmentDateObj < currentDate) {
        return res
          .status(400)
          .json({ message: "Cannot book appointments in the past" });
      }

      if (appointmentDateObj > oneMonthLater) {
        return res
          .status(400)
          .json({ message: "Appointments can only be booked within a month" });
      }

      // Check if the patient has a chronic condition
      const isChronic =
        medicalDetails.diseaseType.name.toLowerCase() === "chronic";

      // Fetch existing appointments for that date
      const appointments = await Appointment.find({
        appointmentDate,
        status: { $ne: "draft" }, // Only consider confirmed appointments
      });

      const isMorningSlot = (slot) => timeSlots.indexOf(slot) < 4;

      // Validate availability based on chronic condition
      if (isChronic) {
        const chronicBookingInMorning = appointments.some(
          (appt) => appt.isChronic && isMorningSlot(appt.timeSlot)
        );
        const chronicBookingInAfternoon = appointments.some(
          (appt) => appt.isChronic && !isMorningSlot(appt.timeSlot)
        );

        // For chronic patients, block entire morning or afternoon session
        if (
          (isMorningSlot(timeSlot) && chronicBookingInMorning) ||
          (!isMorningSlot(timeSlot) && chronicBookingInAfternoon)
        ) {
          return res.status(400).json({
            message:
              "The selected time slot is not available for chronic patients",
          });
        }
      } else {
        const isSlotBooked = appointments.some(
          (appt) => appt.timeSlot === timeSlot
        );

        // For acute patients, only check if the specific slot is booked
        if (isSlotBooked) {
          return res
            .status(400)
            .json({ message: "Time slot is not available" });
        }
      }

      // Create a draft appointment with all details
      const draftAppointment = new Appointment({
        patient: user._id,
        patientEmail: user.email,
        patientName: user.name,
        consultingFor,
        consultingPersonName: fullName,
        reason: consultingReason,
        symptom,
        doctor: doctor._id,
        doctorName: doctor.name,
        appointmentDate,
        timeSlot,
        isChronic,
        status: "draft", // Mark as draft until payment is confirmed
        expiresAt: new Date(Date.now() + 1 * 60 * 1000),
      });

      await draftAppointment.save();

      res.status(200).json({
        success: true,
        appointmentId: draftAppointment._id,
      });
    } catch (error) {
      console.error("Draft appointment creation error:", error);
      res.status(500).json({ error: "Failed to create draft appointment" });
    }
  }

  static async createPaymentOrder(req, res) {
    try {
      console.log("create order reached:", req.body);
      const { appointmentDate, patientType, appointmentId } = req.body;
      const patientId = req.user.id; // Assuming you have user data in request after authentication
      console.log(patientId);

      // Calculate amount based on appointment date and patient type
      const amount = await PaymentController.calculateAmount(
        appointmentDate,
        patientType
      );
      console.log(amount);
      const receipt = `receipt_${Date.now()}_${patientId
        .toString()
        .slice(0, 8)}`;
      // Create Razorpay order
      const order = await razorpay.orders.create({
        amount: amount * 100, // Razorpay expects amount in paise
        currency: "INR",
        receipt: receipt,
        notes: {
          appointmentId: appointmentId,
          patientId: patientId,
          appointmentDate: appointmentDate,
        },
      });
      console.log("order", order);

      // Create transaction record
      const transaction = new Transaction({
        transactionId: `TXN_${Date.now()}_${patientId}`,
        appointmentId,
        patientId,
        amount,
        razorpayOrderId: order.id,
        status: "pending",
        paymentMethod: "razorpay",
      });
      await transaction.save();

      res.status(200).json({
        orderId: order.id,
        amount: amount,
        currency: "INR",
        transactionId: transaction.transactionId,
      });
    } catch (error) {
      console.error("Payment order creation error:", error);
      res.status(500).json({ error: "Failed to create payment order" });
    }
  }

  static async verifyPayment(req, res) {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        transactionId,
      } = req.body;

      // Verify payment signature
      const isValid = validatePaymentVerification(
        {
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
        },
        razorpay_signature,
        process.env.RAZORPAY_KEY_SECRET
      );

      if (!isValid) {
        throw new Error("Invalid payment signature");
      }

      // Update transaction record
      const transaction = await Transaction.findOneAndUpdate(
        {
          transactionId,
          status: "pending",
        },
        {
          status: "successful",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        },
        { new: true }
      );

      if (!transaction) {
        throw new Error("Transaction not found or already processed");
      }

      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        transaction: {
          id: transaction.transactionId,
          status: transaction.status,
        },
      });
    } catch (error) {
      console.error("Payment verification error:", error);
      res.status(400).json({ error: error.message });
    }
  }

  static async getTransactionStatus(req, res) {
    try {
      const { transactionId } = req.params;
      const transaction = await Transaction.findOne({ transactionId });

      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      res.status(200).json({
        transactionId: transaction.transactionId,
        status: transaction.status,
        amount: transaction.amount,
        createdAt: transaction.createdAt,
      });
    } catch (error) {
      console.error("Transaction status check error:", error);
      res.status(500).json({ error: "Failed to get transaction status" });
    }
  }

  static async initiateRefund(req, res) {
    try {
      const { transactionId, reason } = req.body;

      const transaction = await Transaction.findOne({ transactionId });
      if (!transaction || transaction.status !== "successful") {
        throw new Error("Invalid transaction or transaction not successful");
      }

      // Initiate refund through Razorpay
      const refund = await razorpay.payments.refund(
        transaction.razorpayPaymentId,
        {
          amount: transaction.amount * 100,
          notes: {
            reason: reason,
            transactionId: transactionId,
          },
        }
      );

      // Update transaction record
      transaction.status = "refunded";
      transaction.refundId = refund.id;
      transaction.refundReason = reason;
      await transaction.save();

      res.status(200).json({
        success: true,
        message: "Refund initiated successfully",
        refundId: refund.id,
      });
    } catch (error) {
      console.error("Refund initiation error:", error);
      res.status(500).json({ error: "Failed to initiate refund" });
    }
  }
}

module.exports = PaymentController;
