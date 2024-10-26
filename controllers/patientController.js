const asyncHandler = require("express-async-handler");
const Patient = require("../models/patientModel");
const ChronicPatient = require("../models/chronicModel");
const FamilyLink = require("../models/FamilyLink");
const Appointment = require("../models/appointmentModel");
const Referral = require("../models/referralModel");
require("dotenv").config({ path: "./config/.env" });
const Doctor = require("../models/doctorModel");
const moment = require("moment");
const momentIST = require("moment-timezone");
const twilio = require("twilio");
const crypto = require("crypto");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

//Initial Form
exports.sendForm = asyncHandler(async (req, res) => {
  const { name, age, phone, email, gender, diseaseName, diseaseType } =
    req.body;
  const { referralCode, familyToken } = req.query; // Get the referral code from query params

  // Check if referral code is provided
  let friendDetails = null;
  if (referralCode) {
    // Find the referral record by the referral code
    const referral = await Referral.findOne({ code: referralCode });

    if (referral) {
      // Fetch the referred friend's phone number from the referral document
      friendDetails = {
        name: referral.referredFriendName,
        phone: referral.referredFriendPhone,
      };
    }
  }

  const familyLink = await FamilyLink.findOne({ token: familyToken });

  let familyDetails = null;
  if (familyToken && familyLink) {
    const familyDetails = {
      name: familyLink.name,
      phone: familyLink.phone,
    };
  }

  // Check if the patient with the given phone already exists
  const existingPatient = await Patient.findOne({ phone });

  if (existingPatient) {
    // If patient already exists, return an error response
    return res.status(400).json({
      message: "Patient with this mobile number already exists",
    });
  }

  // Create a new patient document
  const patientDocument = new Patient({
    name,
    age,
    phone,
    email,
    gender,
    diseaseName,
    diseaseType,
  });

  if (referralCode) {
    //await Patient.save({ coupon: referralCode });
    patientDocument.coupon = referralCode;
  }

  await patientDocument.save();

  if (familyToken && familyLink) {
    const senderId = familyLink.userId;
    await Patient.findByIdAndUpdate(senderId, {
      $push: {
        familyMembers: {
          memberId: patientDocument._id, // Add patient ID as memberId
          IndividulAccess: true, // Set IndividulAccess to true
          relationship: familyLink.relationship, // Include relationship role
        },
      },
    });
  }

  res.status(201).json({
    message: "Patient data saved successfully",
    patient: patientDocument,
  });
});

//Patient Profile
exports.patientDetails = asyncHandler(async (req, res) => {
  console.log("Patient Details endpoint reached");
  const phone = req.user.phone;
  if (!phone) {
    return res.status(400).json({ message: "Phone number not available" });
  }

  // Fetch the patient
  const patient = await Patient.findOne({ phone });

  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  let chronicPatient = false;

  if (patient.diseaseType.name.toLowerCase() === "chronic") {
    const chronicPatientRecord = await ChronicPatient.findOne({ phone });
    if (chronicPatientRecord) {
      chronicPatient = true;
    }
  }

  res.status(200).json({ patient, chronicPatient });
});

//Chronic Form
exports.sendChronicForm = asyncHandler(async (req, res) => {
  const {
    dob,
    weight,
    height,
    occupation,
    country,
    state,
    city,
    complaint,
    symptoms,
    associatedDisease,
    allopathy,
    diseaseHistory,
    surgeryHistory,
    allergies,
    bodyType,
  } = req.body;

  console.log("Endpoint reached");

  const phone = req.user.phone;

  // Check if the patient with the provided phone number exists
  const existingPatient = await Patient.findOne({ phone });
  if (!existingPatient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  // Ensure the patient is classified as chronic
  if (existingPatient.diseaseType.name.toLowerCase() !== "chronic") {
    return res.json({ message: "Patient isn't chronic!" });
  }

  // Create a new chronic patient document
  const chronicPatientDocument = new ChronicPatient({
    phone,
    dob,
    weight,
    height,
    occupation,
    country,
    state,
    city,
    complaint,
    symptoms,
    associatedDisease,
    allopathy,
    diseaseHistory,
    surgeryHistory,
    allergies,
    bodyType,
  });

  // Save the chronic patient document to the "chronics" collection in the database
  await chronicPatientDocument.save();

  // Send a success response
  res.status(201).json({
    success: true,
    message: "Data saved successfully",
    patient: chronicPatientDocument,
  });
});

// Check Available Slots
exports.checkAvailableSlots = asyncHandler(async (req, res) => {
  const { appointmentDate } = req.body;
  const phone = req.user.phone;

  const patient = await Patient.findOne({ phone });
  const diseaseType = patient.diseaseType.name.toLowerCase();

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
  const appointments = await Appointment.find({ appointmentDate });

  const isMorningSlot = (slot) => timeSlots.indexOf(slot) < 4;

  const availableSlots = timeSlots.filter((slot) => {
    const isBooked = appointments.some((appt) => appt.timeSlot === slot);

    if (isBooked) return false;

    if (diseaseType === "chronic") {
      // If chronic patient, check if there is a chronic booking in the morning or afternoon session
      const chronicBookingInMorning = appointments.some(
        (appt) => appt.isChronic && isMorningSlot(appt.timeSlot)
      );
      const chronicBookingInAfternoon = appointments.some(
        (appt) => appt.isChronic && !isMorningSlot(appt.timeSlot)
      );

      if (
        (chronicBookingInMorning && isMorningSlot(slot)) ||
        (chronicBookingInAfternoon && !isMorningSlot(slot))
      ) {
        return false;
      }
    }

    return true;
  });

  res.status(200).json({ availableSlots });
});

// Book appointment
exports.bookAppointment = asyncHandler(async (req, res) => {
  const phone = req.user.phone;
  const { appointmentDate, timeSlot, relationship } = req.body;
  const doctorId = "66c8312667b91b0b7730e725";
  let patient;

  const user = await Patient.findOne({ phone });
  if (!user) return res.status(404).json({ message: "Patient not found" });
  patient = user;
  if (relationship) {
    const familyMember = user.familyMembers.find(
      (member) => member.relationship === relationship
    );
    if (!familyMember || familyMember.IndividulAccess) {
      return res.status(400).json({
        message: "Cannot book appointment for this family member.",
      });
    }
    patient = await Patient.findOne({ _id: familyMember.memberId });
    console.log(patient);
  } else {
    patient = user;
  }

  // Find the doctor by ID
  const doctor = await Doctor.findById(doctorId);
  if (!doctor || doctor.role !== "admin-doctor") {
    return res.status(404).json({ message: "Doctor not found" });
  }

  // Check if the patient has a chronic condition
  patient.diseaseType.name = "acute"; //comment it later
  const isChronic = patient.diseaseType.name.toLowerCase() === "chronic";

  // Validate the requested time slot
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

  // Fetch existing appointments for that date
  const appointments = await Appointment.find({ appointmentDate });
  const isMorningSlot = (slot) => timeSlots.indexOf(slot) < 4;

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
        message: "The selected time slot is not available for chronic patients",
      });
    }
  } else {
    const isSlotBooked = appointments.some(
      (appt) => appt.timeSlot === timeSlot
    );

    // For acute patients, only check if the specific slot is booked
    if (isSlotBooked) {
      return res.status(400).json({ message: "Time slot is not available" });
    }
  }

  // ------------------------------
  // Auto-apply coupon logic starts here
  // ------------------------------

  // Find available coupons for the referrer
  const referrerCoupons = await Referral.find({
    referrerId: patient._id,
    isUsed: false,
    firstAppointmentDone: true,
  });

  let appliedCoupon = null;

  // Check if there are any available coupons
  if (referrerCoupons.length > 0) {
    // Automatically apply the first available coupon
    appliedCoupon = referrerCoupons[0];
    appliedCoupon.isUsed = true; // Mark the coupon as used
    await appliedCoupon.save();

    // Notify user that the coupon has been applied
    console.log(
      `Coupon ${appliedCoupon.code} automatically applied for referrer ${patient.name}.`
    );
  }

  // ------------------------------
  // Appointment booking logic
  // ------------------------------

  //referee
  const previousAppointments = await Appointment.findOne({
    patient: patient._id,
  });

  console.log("Previous Appointments:", previousAppointments);

  const couponCode = patient.coupon;

  if (!previousAppointments && couponCode) {
    const referral = await Referral.findOne({
      code: couponCode,
      isUsed: false,
    });
    // const senderId = referral.referrerId;
    // console.log("Sender ID", senderId);
    // const sender = await Patient.findById({ _id: senderId });
    // sender.coupon = couponCode;
    // await sender.save();
    // console.log("Coupon:", sender.coupon);
    referral.firstAppointmentDone = true;
    referral.save();
    //patient.coupon = "";
  }

  //book appointment
  const newAppointment = new Appointment({
    patient: patient._id,
    doctor: doctor._id,
    appointmentDate,
    timeSlot,
    isChronic,
  });

  try {
    // Save the appointment
    await newAppointment.save();

    // If everything goes well, update the patient's follow-up status
    patient.follow = "Follow up-C"; // Update follow status
    await patient.save(); // Save the updated patient

    // Return success response with applied coupon info
    res.status(201).json({
      message: "Appointment booked successfully",
      appointment: newAppointment,
      appliedCoupon: appliedCoupon ? appliedCoupon.code : null,
    });
  } catch (error) {
    // If an error occurs, revert coupon status
    if (appliedCoupon) {
      appliedCoupon.isUsed = false; // Revert coupon usage
      await appliedCoupon.save();
      return res.status(500).json({
        message: "Failed to book appointment, coupon reverted.",
        error: error.message,
      });
    }
    if (!previousAppointments && couponCode) {
      const referral = await Referral.findOne({
        code: couponCode,
        isUsed: false,
      });
      referral.firstAppointmentDone = false;
      referral.save();
    }

    console.error("Failed to book appointment:", error);
  }
});

exports.getUserAppointments = async (req, res) => {
  console.log("User Appointments endpoint reached");
  try {
    const userId = req.user.id; // Assuming you have user authentication middleware
    const { filter } = req.query;

    let query = { patient: userId };
    const currentDate = moment().startOf("day");

    switch (filter) {
      case "past":
        query.appointmentDate = { $lt: currentDate.toDate() };
        break;
      case "today":
        query.appointmentDate = {
          $gte: currentDate.toDate(),
          $lt: moment(currentDate).endOf("day").toDate(),
        };
        break;
      case "thisWeek":
        query.appointmentDate = {
          $gte: currentDate.toDate(),
          $lt: moment(currentDate).endOf("week").toDate(),
        };
        break;
      case "thisMonth":
        query.appointmentDate = {
          $gte: currentDate.toDate(),
          $lt: moment(currentDate).endOf("month").toDate(),
        };
        break;
      default:
        // If no filter or 'all', fetch all appointments
        break;
    }

    const appointments = await Appointment.find(query)
      .populate("doctor", "name specialty") // Assuming doctor has name and specialty fields
      .sort({ appointmentDate: 1, timeSlot: 1 });

    res.json(appointments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching appointments", error: error.message });
  }
};

exports.updateFollowUpStatus = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    const exDtTm = new Date();

    // Update follow-up status
    switch (patient.follow) {
      case "Follow up-C":
        patient.follow = "Follow up-P";
        break;
      case "Follow up-P":
        patient.follow = "Follow up-Mship";
        patient.followUpTimestamp = exDtTm; // Store timestamp when status changes to Mship
        break;
      case "Follow up-Mship":
        patient.follow = "Follow up-MP";
        break;
      case "Follow up-MP":
        patient.follow = "Follow up-ship";
        break;
      default:
        return res.status(400).json({ message: "Invalid follow-up status" });
    }

    await patient.save();

    res.status(200).json({
      message: "Follow-up status updated successfully",
      patient: {
        id: patient._id,
        follow: patient.follow,
        followUpTimestamp: patient.followUpTimestamp,
      },
    });
  } catch (error) {
    console.error("Error updating follow-up status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update Call Status
exports.updateFollowPatientCall = async (req, res) => {
  const { patientId } = req.params;
  const { newCallStatus } = req.body;

  try {
    // Find the patient by ID
    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Update the call status
    patient.enquiryStatus = newCallStatus;

    // If the new call status is 'Completed', update the follow-up status
    if (newCallStatus === "Completed") {
      patient.follow = "Follow up-C"; // Change this to the desired follow-up status
    }

    // Save the updated patient record
    await patient.save();

    res
      .status(200)
      .json({ message: "Call status updated successfully", patient });
  } catch (error) {
    console.error("Error updating call status:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.referFriend = asyncHandler(async (req, res) => {
  const { friendName, friendPhone } = req.body;
  const referrerPhone = req.user.phone;

  const generateReferralCode = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // 62 characters
    let referralCode = "";
    for (let i = 0; i < 8; i++) {
      referralCode += chars[Math.floor(Math.random() * chars.length)];
    }
    return referralCode;
  };

  try {
    // Check if the referrer is a registered patient
    const referrer = await Patient.findOne({ phone: referrerPhone });
    if (!referrer) {
      return res
        .status(404)
        .json({ success: false, message: "Referrer not found" });
    }

    // Check if referrer has made at least one appointment
    const appointmentBooked = await Appointment.findOne({
      patient: referrer._id,
    });
    if (!appointmentBooked) {
      return res.status(400).json({
        success: false,
        message: "First make an appointment to refer a friend",
      });
    }

    const coupon = generateReferralCode();

    const check = await Patient.findOne({ phone: friendPhone });
    if (check) {
      res.json({ message: "Patient with this mobile number already exists!" });
    }

    // Check if a referral for this friend already exists
    let referral = await Referral.findOne({ referredFriendPhone: friendPhone });

    if (referral) {
      // Update existing referral with a new coupon code
      referral.code = coupon;
      //referral.referrerId = referrer._id; // Update the referrer if needed
      await referral.save();
    } else {
      // Create a new referral document if it doesn't exist
      referral = await Referral.create({
        code: coupon,
        referrerId: referrer._id, // The referrer's ID
        referredFriendPhone: friendPhone, // The phone of the friend being referred
        referredFriendName: friendName,
      });
    }

    // Also pass the referee phone and name via query
    // Send an SMS to the friend with the registration link
    const referralLink = `http://localhost:8000/api/patient/sendRegForm?referralCode=${coupon}`;
    // await client.messages.create({
    //   body: `Hi ${friendName}, you've been referred by ${referrer.phone}. Click here to register: ${referralLink}`,
    //   from: "+12512728851", // Replace with your Twilio phone number
    //   to: friendPhone,
    // });

    res.status(200).json({
      success: true,
      message: "Referral sent successfully",
      referralLink: referralLink,
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

exports.addFamily = async (req, res) => {
  try {
    const { IndividulAccess, familyMemberPhone, familyMemberName } = req.body;
    const { relationship } = req.body;
    const myPhone = req.user.phone;
    const User = await Patient.findOne({ phone: myPhone });
    if (!User) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if User has made at least one appointment
    const appointmentBooked = await Appointment.findOne({
      patient: User._id,
    });
    if (!appointmentBooked) {
      return res.status(400).json({
        success: false,
        message: "First make an appointment to add a family member",
      });
    }
    if (
      !relationship ||
      ![
        "Father",
        "Mother",
        "Son",
        "Daughter",
        "Father in law",
        "Mother in law",
      ].includes(relationship)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or missing relationship" });
    }
    if (IndividulAccess) {
      const check = await Patient.findOne({ phone: familyMemberPhone });
      if (check) {
        return res.json({
          message: "Patient with this mobile number already exists!",
        });
      }

      const token = crypto.randomBytes(16).toString("hex");
      let family = await FamilyLink.findOne({
        phone: familyMemberPhone,
      });

      if (family) {
        // Update existing referral with a new coupon code
        family.token = token;
        //family.referrerId = referrer._id; // Update the referrer if needed
        await family.save();
      } else {
        await FamilyLink.create({
          token,
          userId: User._id,
          name: familyMemberName,
          phone: familyMemberPhone,
          relationship,
        });
      }

      const link = `http://localhost:8000/api/patient/sendRegForm?familyToken=${token}`;

      // await client.messages.create({
      //   body: `Hi ${familyMemberName}, you've been referred by ${User.phone}. Click here to register: ${link}`,
      //   from: "+12512728851", // Replace with your Twilio phone number
      //   to: friendPhone,
      // });

      res.status(200).json({
        success: true,
        message: "Link sent successfully",
        link: link,
      });
    } else {
      const { name, age, phone, email, gender, diseaseName, diseaseType } =
        req.body;
      const {
        dob,
        weight,
        height,
        occupation,
        country,
        state,
        city,
        complaint,
        symptoms,
        associatedDisease,
        allopathy,
        diseaseHistory,
        surgeryHistory,
        allergies,
        bodyType,
      } = req.body;
      const existingPatient = await Patient.findOne({ phone });

      if (existingPatient) {
        // If patient already exists, return an error response
        return res.status(400).json({
          message: "Patient with this mobile number already exists",
        });
      }

      // Create a new patient document
      const patientDocument = new Patient({
        name,
        age,
        phone,
        email,
        gender,
        diseaseName,
        diseaseType,
      });
      await patientDocument.save();
      const chronicPatientDocument = new ChronicPatient({
        phone,
        dob,
        weight,
        height,
        occupation,
        country,
        state,
        city,
        complaint,
        symptoms,
        associatedDisease,
        allopathy,
        diseaseHistory,
        surgeryHistory,
        allergies,
        bodyType,
      });

      // Save the chronic patient document to the "chronics" collection in the database
      await chronicPatientDocument.save();
      res.status(201).json({
        message: "Patient data saved successfully",
        AcuteDetails: patientDocument,
        ChronicDetails: chronicPatientDocument,
      });
      const senderId = User._id;
      await Patient.findByIdAndUpdate(senderId, {
        $push: {
          familyMembers: {
            IndividulAccess: false,
            memberId: patientDocument._id, // Add patient ID as memberId
            relationship, // Include relationship role
          },
        },
      });
    }
  } catch (e) {
    console.log(e);
  }
};

//getting family members details while making appointments
exports.getFamilyMembers = async (req, res) => {
  try {
    const myPhone = req.user.phone;
    const user = await Patient.findOne({ phone: myPhone });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const familyMembers = user.familyMembers.map((member) => ({
      relationship: member.relationship,
      IndividulAccess: member.IndividulAccess,
    }));

    res.status(200).json({
      success: true,
      familyMembers,
    });
  } catch (error) {
    console.error("Error fetching family members:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve family members" });
  }
};

// // Update Appointment
// exports.updateAppointment = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const { status } = req.body;

//   const appointment = await Appointment.findById(id);
//   if (!appointment) {
//     return res.status(404).json({ message: "Appointment not found" });
//   }

//   appointment.status = status || appointment.status;
//   await appointment.save();

//   res.status(200).json({
//     message: "Appointment updated successfully",
//     appointment,
//   });
// });

// // Get Appointments by Date
// exports.getAppointmentsByDate = asyncHandler(async (req, res) => {
//   const { date } = req.query;

//   const appointmentDate = new Date(date);
//   const appointments = await Appointment.find({ appointmentDate });

//   res.status(200).json(appointments);
// });

// // Get Appointment by ID
// exports.getAppointmentById = asyncHandler(async (req, res) => {
//   const { id } = req.params;

//   const appointment = await Appointment.findById(id);
//   if (!appointment) {
//     return res.status(404).json({ message: "Appointment not found" });
//   }

//   res.status(200).json(appointment);
// });

// // Cancel Appointment
// exports.cancelAppointment = asyncHandler(async (req, res) => {
//   const { id } = req.params;

//   const appointment = await Appointment.findByIdAndDelete(id);
//   if (!appointment) {
//     return res.status(404).json({ message: "Appointment not found" });
//   }

//   res.status(200).json({ message: "Appointment cancelled successfully" });
// });
