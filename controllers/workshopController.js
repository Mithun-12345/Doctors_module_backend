const Doctor = require("../models/doctorModel");
const Patient = require("../models/patientModel");
const Workshop = require("../models/workShopModel");
const Razorpay = require('razorpay');
const dotenv = require('dotenv');
const { generateGoogleMeetLink, generateZoomMeetingLink } = require("../utils/generateMeetLinks");
dotenv.config();

exports.createWorkshop = async (req, res) => {
  try {
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    const {
      title,
      description,
      fee,
      allowedParticipants,
      scheduledDateTime,
      limit,
    } = req.body;
    console.log(allowedParticipants);
    const newWorkshop = new Workshop({
      title,
      description,
      fee,
      doctorId: doctor._id,
      allowedParticipants,
      scheduledDateTime,
      limit,
      meetLink: "https://us05web.zoom.us/j/86204841254?pwd=FkynmvbupbZllXbJEvysDTXKErAqJS.1"
    });
    try {
      await newWorkshop.save();
      console.log("saved");
    } catch (saveError) {
      console.error("Error saving workshop:", saveError);
      return res.status(500).json({
        message: "Error saving workshop",
        error: saveError.message,
        stack: saveError.stack
      });
    }
    
    console.log("saved")
    res.status(201).json({
      message: "Workshop started successfully",
      workshop: newWorkshop,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.viewPendingWorkshops = async (req, res) => {
  try {
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    const patient = await Patient.findOne({ phone });
    let userType;
    if (doctor) {
      userType = "Doctor";
    } else if (patient) {
      userType = "Patient";
    }
    const workshops = await Workshop.find({
      $or: [{ allowedParticipants: userType }, { allowedParticipants: "Everyone" }],
    });

    res.status(200).json({ workshops });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.bookWorkshop = async (req, res) => {
  try {
    const { workshopId } = req.body;
    const phone = req.user.phone;

    // Identify user type
    const doctor = await Doctor.findOne({ phone });
    const patient = await Patient.findOne({ phone });

    if (!doctor && !patient) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = doctor ? doctor._id : patient._id;
    const userType = doctor ? "Doctor" : "Patient";

    const workshop = await Workshop.findById(workshopId);
    if (!workshop) {
      return res.status(404).json({ message: "Workshop not found" });
    }

    // Check if the user is allowed to book
    if (
      workshop.allowedParticipants !== userType &&
      workshop.allowedParticipants !== "Everyone"
    ) {
      return res
        .status(403)
        .json({ message: "You are not allowed to book this workshop" });
    }

    // // Ensure participants array exists
    // if (!workshop.participants) {
    //   workshop.participants = [];
    // }

    if (new Date(workshop.scheduledDateTime) < new Date()) {
      return res.status(400).json({ message: "Workshop has already passed" });
    }

    // Check if user already booked the workshop
    if (workshop.participants.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You have already booked this workshop" });
    }

    if (workshop.limit > 0) {
      // Limited booking
      if (workshop.participants.length < workshop.limit) {
        workshop.participants.push(userId);
        await workshop.save();
        return res
          .status(200)
          .json({ message: "Workshop booked successfully", workshop });
      } else {
        return res
          .status(400)
          .json({ message: "Workshop booking limit reached" });
      }
    } else {
      // No limit case (limit is 0 or undefined)
      workshop.participants.push(userId);
      await workshop.save();
      return res
        .status(200)
        .json({ message: "Workshop booked successfully", workshop });
    }    
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

//Doctors view their own Workshops
exports.viewOwnWorkshops = async (req, res) => {
  try {
    const phone = req.user.phone;

    const doctor = await Doctor.findOne({ phone });
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const workshops = await Workshop.find({ doctor: doctor._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({ workshops });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, // Add your Razorpay Key ID here
  key_secret: process.env.RAZORPAY_KEY_SECRET, // Add your Razorpay Key Secret here
});

exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.body; // Amount in paise (1 INR = 100 paise)

    // Define Razorpay order options
    const options = {
      amount: amount * 100, // amount in paise
      currency: 'INR',
      receipt: `receipt_${new Date().getTime()}`,
    };

    // Create order via Razorpay API
    const order = await razorpay.orders.create(options);

    // Send back the order ID and amount to the client
    res.json({
      orderId: order.id,
      amount: order.amount,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).send('Server error');
  }
};

const crypto = require('crypto');
const Payment = require('../models/Payment');
exports.confirmBooking = async (req, res) => {
  try {
    const { orderId, paymentId, signature, workshopId, userId } = req.body;
    
    // Verify the payment signature using crypto
    const text = orderId + "|" + paymentId;
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");
    
    const isSignatureValid = generated_signature === signature;
    
    if (!isSignatureValid) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }
    
    // Rest of your code remains the same
    const workshop = await Workshop.findById(workshopId);
    if (!workshop) {
      return res.status(404).json({ success: false, message: 'Workshop not found' });
    }
    
    if (workshop.participants.includes(userId)) {
      return res.status(400).json({ success: false, message: 'You are already registered for this workshop' });
    }
    
    workshop.participants.push(userId);
    await workshop.save();
    
    // Make sure you have defined the Payment model
    const payment = new Payment({
      orderId,
      paymentId, 
      workshopId,
      userId,
      amount: workshop.fee,
    });
    await payment.save();
    
    res.json({ success: true, message: 'Booking confirmed' });
  } catch (error) {
    console.error('Error confirming booking:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};