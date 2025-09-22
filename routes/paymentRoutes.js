const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const razorpay = require("../utils/razorpay");
const Payment = require("../models/Payment");
const Appointment = require("../models/appointmentModel");
const Doctor = require("../models/doctorModel");
const Prescription = require("../models/Prescription");
const Notification = require("../models/notificationHub");
const authMiddleware = require("../middlewares/validateTokenHandler");
const MedicalDetails = require("../models/patientDetails");

const router = express.Router();

// Create order endpoint (unchanged)
router.post("/create-order", authMiddleware, async (req, res) => {
  try {
    const { amount, appointmentId } = req.body;

    // Verify appointment exists and is still reserved
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    if (appointment.status !== "reserved") {
      return res.status(400).json({
        success: false,
        message: "Appointment is not in reserved state",
      });
    }

    if (appointment.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Appointment reservation has expired",
      });
    }

    const options = {
      amount: amount, // Convert to smallest currency unit
      currency: "INR",
      receipt: `receipt_${appointmentId}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/verify-payment", authMiddleware, async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    appointmentId,
  } = req.body;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Verify Razorpay signature
      const sign = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        throw new Error("Invalid payment signature");
      }

      const appointment = await Appointment.findById(appointmentId).session(
        session
      );
      if (!appointment) throw new Error("Appointment not found");

      if (appointment.status !== "reserved") {
        throw new Error("Appointment is not in reserved state");
      }

      if (appointment.expiresAt < new Date()) {
        throw new Error("Appointment reservation has expired");
      }

      if (appointment.isPaid) {
        throw new Error("Appointment is already paid");
      }

      const conflictingAppointments = await Appointment.find({
        appointmentDate: appointment.appointmentDate,
        timeSlot: appointment.timeSlot,
        status: "confirmed",
        _id: { $ne: appointmentId },
      }).session(session);

      if (conflictingAppointments.length > 0) {
        throw new Error(
          "Slot is no longer available. Payment will be refunded."
        );
      }

      // Create payment record
      const newPayment = new Payment({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        amount: appointment.payment,
        appointmentId,
        createdAt: new Date(),
        paidFor: "Consultation"
      });
      await newPayment.save({ session });

      // Update appointment
      appointment.status = "confirmed";
      appointment.isPaid = true;
      appointment.paymentId = newPayment._id;
      appointment.expiresAt = undefined;
      await appointment.save({ session });
      
      // --- NEW LOGIC ADDED HERE ---
      // Find the patient associated with the appointment and update their status
      if (appointment.patient) {
          await Patient.findByIdAndUpdate(
              appointment.patient,
              { appointmentFixed: "Yes" },
              { session } // Ensure this operation is part of the transaction
          );
      }
      // ----------------------------

      // Calendar integration (remains unchanged)
      const doctor = await Doctor.findById(appointment.doctor).session(session);
      if (doctor) {
        console.log("📅 Doctor found:", { id: doctor._id, platform: doctor.videoPlatform });
        let calendarEvent = null;
        console.log("📅 Calendar event created:", calendarEvent);
      }
    });

    res.json({
      success: true,
      message: "Payment verified and appointment confirmed",
    });
  } catch (err) {
    console.error("❌ Payment verification error:", err);
    res.status(400).json({
      success: false,
      message: err.message || "Payment verification failed",
    });
  } finally {
    await session.endSession();
  }
});

// New endpoint to check appointment status
router.get(
  "/appointment-status/:appointmentId",
  authMiddleware,
  async (req, res) => {
    try {
      const { appointmentId } = req.params;

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }

      const isExpired =
        appointment.expiresAt && appointment.expiresAt < new Date();

      res.json({
        success: true,
        status: appointment.status,
        isPaid: appointment.isPaid,
        isExpired,
        expiresAt: appointment.expiresAt,
      });
    } catch (err) {
      console.error("Status check error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
router.post("/create-prescription-order", authMiddleware, async (req, res) => {
  try {
    const { amount, prescriptionId } = req.body;

    // Validate the prescription
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }
    if (prescription.isPayementDone) {
      return res.status(400).json({ message: "This prescription has already been paid for." });
    }

    // Razorpay requires amount in the smallest currency unit (paise)
    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_pres_${prescriptionId}`,
    };

    const order = await razorpay.orders.create(options);

    // --- MODIFIED LINE ---
    // Now the frontend receives both the order and the ID it's associated with.
    res.json({ success: true, order, prescriptionId: prescriptionId });

  } catch (err) {
    console.error("Create prescription order error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post("/verify-prescription-payment", authMiddleware, async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    prescriptionId,
  } = req.body;

  // 1. Start a session for the transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify the signature from Razorpay
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      throw new Error("Invalid payment signature");
    }

    // 2. Find the prescription using the session
    const prescription = await Prescription.findById(prescriptionId).session(session);
    if (!prescription) {
      throw new Error("Prescription not found");
    }
    
    // Find the associated appointment using the session
    const appointment = await Appointment.findOne({ prescriptionID: prescriptionId }).session(session);
    if (!appointment) {
      throw new Error("Associated appointment for this prescription could not be found.");
    }

    // 3. Find and update the patient's medical details using the session
    await MedicalDetails.findOneAndUpdate(
      { patientId: prescription.patientId },
      { medicalPayment: "Yes" },
      { session } // Use the session here
    );

    // 4. Update the prescription to mark it as paid
    prescription.isPayementDone = true;
    const savedPrescription = await prescription.save({ session }); // Use the session here

    // 5. Create a record in your Payment collection
    const newPayment = new Payment({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      amount: savedPrescription.medicineCharges + savedPrescription.shippingCharges + savedPrescription.additionalCharges,
      prescriptionId: savedPrescription._id,
      appointmentId: appointment._id,
      paidFor: "Medicine"
    });
    await newPayment.save({ session }); // Use the session here

    // 6. Create a notification for the user
    await Notification.create([{ // Using array to create within session
        recipient: savedPrescription.patientId,
        message: "Payment received! Our pharmacy has begun preparing your medicines.",
        type: "MEDICINE_PREPARATION_STARTED",
        link: `/track-order/${savedPrescription._id}`
    }], { session });

    // 7. If everything succeeded, commit the transaction
    await session.commitTransaction();

    res.json({
      success: true,
      message: "Payment successful! Your prescription is being processed.",
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id
    });

  } catch (err) {
    // 8. If any step failed, abort the entire transaction
    await session.abortTransaction();
    console.error("Prescription payment verification error:", err);
    res.status(400).json({ success: false, message: err.message });
  } finally {
    // 9. Always end the session
    session.endSession();
  }
});
module.exports = router;
