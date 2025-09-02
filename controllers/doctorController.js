const mongoose = require("mongoose");
const Doctor = require("../models/doctorModel");
const Appointment = require("../models/appointmentModel.js");
const Patient = require("../models/patientModel.js");
const patientDetails = require("../models/patientDetails"); // clinical info
const moment = require("moment-timezone");
const cloudinary = require("cloudinary").v2;
const Prescription = require("../models/Prescription.js");
const fs = require("fs");
const NotificationReminderSettings = require("../models/NotificationReminderSettings");
const MedicinePreparationSummary = require('../models/MedicinePreparationSummary');
const Payment = require("../models/Payment.js");
const ConsultationNote = require("../models/ConsultationNots.js")

// ... other controller functions

/**
 * @desc    Get all payments for a specific doctor
 * @route   GET /api/payments/doctor/:doctorId
 * @access  Private
 */
exports.getPaymentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    // Validate if the provided doctorId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid Doctor ID format." });
    }

    // Find all appointment IDs associated with the doctor
    const appointments = await Appointment.find({ doctor: doctorId }).select('_id');

    // If no appointments are found for the doctor, they have no payments.
    if (!appointments || appointments.length === 0) {
      return res.json({
        success: true,
        message: "No payments found for this doctor.",
        data: [],
      });
    }

    // Extract just the IDs from the appointment documents
    const appointmentIds = appointments.map(app => app._id);

    // Find all payments where the appointmentId is in our list of appointmentIds
    const payments = await Payment.find({ appointmentId: { $in: appointmentIds } })
      .populate({
        path: 'appointmentId',
        select: 'appointmentDate timeSlot patient', // Select which appointment fields to return
        populate: {
          path: 'patient',
          select: 'name phone' // Select which patient fields to return for the doctor's view
        }
      })
      .sort({ createdAt: -1 }); // Sort by most recent payment first

    res.json({
      success: true,
      message: "Payments retrieved successfully.",
      count: payments.length,
      data: payments,
    });

  } catch (err) {
    console.error("Error fetching doctor payments:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ... other controller functions

/**
 * @desc    Get all payments made to any doctor
 * @route   GET /api/payments/doctors
 * @access  Private (e.g., for Admin)
 */
exports.getAllDoctorPaymentsTotal = async (req, res) => {
  try {
    // Find all payments and populate details
    const payments = await Payment.find({}) // 👈 Find all documents
      .populate({
        path: 'appointmentId',
        select: 'appointmentDate timeSlot patient doctor', // Select fields from appointment
        populate: [ // 👈 We can populate multiple fields within the appointment
          {
            path: 'patient',
            select: 'name phone' // Select fields from patient
          },
          {
            path: 'doctor',
            select: 'name specialization' // Select fields from doctor
          }
        ]
      })
      .sort({ createdAt: -1 }); // Sort by most recent payment first

    res.json({
      success: true,
      message: "All doctor-related payments retrieved successfully.",
      count: payments.length,
      data: payments,
    });

  } catch (err) {
    console.error("Error fetching all doctor payments:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.addDoctor = async (req, res) => {
  const { name, age, gender, photo, specialization, bio, phone, role } =
    req.body;

  try {
    // Check if the requesting doctor is an admin
    const requestingDoctor = await Doctor.findOne({ phone: req.user.phone });
    if (!requestingDoctor || requestingDoctor.role !== "admin-doctor") {
      return res
        .status(403)
        .json({ message: "Only admin doctors can add new doctors" });
    }

    // Check if a doctor with the same phone number already exists
    const checkDoctor = await Doctor.findOne({ phone });
    if (checkDoctor) {
      return res.status(400).json({ message: "Doctor already exists!" });
    }

    // Create and save the new doctor
    const newDoctor = new Doctor({
      name,
      age,
      gender,
      photo,
      specialization,
      bio,
      phone,
      role: role || "assistant-doctor", // Default to "assistant-doctor" if no role is provided
    });

    await newDoctor.save();
    res
      .status(201)
      .json({ message: `${role || "Assistant"} doctor added successfully` });
  } catch (error) {
    // Improved error handling for validation errors
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation failed", error: error.message });
    }
    res
      .status(500)
      .json({ message: "Failed to add doctor", error: error.message });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    // console.log(doctor);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const { dateFilter, typeFilter } = req.query;
    const doctorRole = doctor.role;

    let query = {};
    let startDate, endDate;
    const now = new Date();

    switch (dateFilter) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        query.appointmentDate = { $gte: startDate, $lte: endDate };
        break;
      case "this week":
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        endDate.setHours(23, 59, 59, 999);
        query.appointmentDate = { $gte: startDate, $lte: endDate };
        break;
      case "this month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        query.appointmentDate = { $gte: startDate, $lte: endDate };
        break;
      case "past":
        endDate = new Date(now.setHours(0, 0, 0, 0));
        query.appointmentDate = { $lt: endDate };
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        query.appointmentDate = { $gte: startDate, $lte: endDate };
    }

    if (
      typeFilter === "mine" ||
      (doctorRole !== "admin-doctor" && typeFilter !== "all")
    ) {
      query.doctor = doctor._id;
    }

    const appointments = await Appointment.find(query)
      .populate({
        path: "patient",
        select: "name",
      })
      .populate({
        path: "doctor",
        select: "name",
      });

    if (appointments.length === 0) {
      return res
        .status(200)
        .json({ message: "No appointments found", appointments: [] });
    }

    const modifiedAppointments = appointments.map((appointment) => ({
      ...appointment._doc,
      canRedirect: doctorRole === "admin-doctor",
      doctorName: appointment.doctor ? appointment.doctor.name : "Unknown",
      patientName: appointment.patient ? appointment.patient.name : "Unknown",
    }));

    res.status(200).json({ appointments: modifiedAppointments });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve appointments",
      error: error.message,
    });
  }
};

exports.redirectAppointment = async (req, res) => {
  const { assistantDoctorId, appointmentId } = req.body;
  console.log("Assistant Doctor ID:", assistantDoctorId);
  console.log("Appointment ID:", appointmentId);

  try {
    const assistantDoctor = await Doctor.findOne({ _id: assistantDoctorId });
    const appointment = await Appointment.findById(appointmentId);

    // console.log("Assistant Doctor found:", assistantDoctor);
    // console.log("Appointment found:", appointment);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    if (!assistantDoctor) {
      return res.status(404).json({
        message: "No such doctor found or doctor is not allowed to redirect",
      });
    }

    appointment.doctor = assistantDoctorId;
    appointment.status = `redirected`;
    await appointment.save();

    res
      .status(200)
      .json({ message: "Appointment redirected successfully", appointment });
  } catch (e) {
    console.error("Error redirecting appointment:", e.message);
    res.status(500).json({
      message: "Failed to redirect appointment",
      error: e.message,
    });
  }
};

exports.getDoctorAppointments = async (req, res) => {
  try {
    // 1. Get the logged-in doctor's ID from the token
    const doctorId = req.user._id;

    // 2. Find all appointments assigned to this doctor
    const appointments = await Appointment.find({ doctor: doctorId })
      .sort({ appointmentDate: 1 }) // Show soonest appointments first
      .populate({ 
        path: 'patient', 
        select: 'name phone age gender' // Select which patient details to show
      });

    if (!appointments || appointments.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "No appointments found.",
        appointments: [] 
      });
    }

    res.status(200).json({ success: true, appointments });

  } catch (error) {
    console.error("Error fetching doctor's appointments:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAssistantDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ role: "assistant-doctor" });
    res.status(200).json({ doctors });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to fetch assistant doctors", error: e.message });
  }
};

exports.getUserRole = async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const doctor = await Doctor.findById(decodedToken.id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.status(200).json({ role: doctor.role });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to get user role", error: e.message });
  }
};

exports.doctorDetails = async (req, res) => {
  try {
    console.log("Doctor details Endpoint reached");
    const doctorPhone = req.user.phone;
    console.log("Searching for doctor with phone:", doctorPhone);

    // Find the doctor by phone number
    const doctor = await Doctor.findOne({ phone: doctorPhone });

    if (!doctor) {
      console.log("Doctor not found for phone:", doctorPhone);
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    console.log("Doctor found:", doctor.name);

    // Return the doctor's details
    res.json({
      success: true,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        specialization: doctor.specialization,
        experience: doctor.experience,
        role: doctor.role,
        // Add any other relevant fields
      },
    });
  } catch (error) {
    console.error("Error in doctor/details:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getDoctorFollow = async (req, res) => {
  console.log("GetDoctorFollow reached");
  console.log("GetDoctorFollow reached");
  const phone = req.user.phone; // Use the phone from the token
  console.log("doctor Phone:", phone);
  console.log("doctor Phone:", phone);
  try {
    const doctor = await Doctor.findOne({ phone }); // Find by phone instead of ID
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.json({ follow: doctor.follow });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

//add/modify amount for the appointment
exports.addAmount = async (req, res) => {
  const { amount } = req.body;

  try {
    // Check if the requesting doctor is an admin
    const requestingDoctor = await Doctor.findOne({ phone: req.user.phone });
    if (!requestingDoctor || requestingDoctor.role !== "admin-doctor") {
      return res
        .status(403)
        .json({ message: "Only admin doctors can add new doctors" });
    }
  } catch (e) {
    console.log(e);
  }
};

exports.getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.doctorId);
    res.json({ videoPlatform: doctor.videoPlatform || "" });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: "Unable to fetch settings" });
  }
};

// exports.updateSettings = async (req, res) => {
//   try {
//     const { videoPlatform } = req.body;
//     const doctor = await Doctor.findByIdAndUpdate(
//       req.doctorId,
//       { videoPlatform },
//       { new: true }
//     );
//     res.json({ message: "Settings updated successfully", videoPlatform: doctor.videoPlatform });
//   } catch (error) {
//     console.error("Error updating settings:", error);
//     res.status(500).json({ error: "Failed to update settings" });
//   }
// };

exports.updateSettings = async (req, res) => {
  try {
    const { videoPlatform } = req.body;

    if (!videoPlatform) {
      return res.status(400).json({ error: "Video platform is required" });
    }

    console.log("Doctor ID from request:", req.doctorId);

    // Use req.doctorId, which was added by the middleware, to update the doctor’s settings
    const doctor = await Doctor.findByIdAndUpdate(
      req.doctorId, // Use the doctorId from the request
      req.doctorId, // Use the doctorId from the request
      { videoPlatform },
      { new: true }
    );

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }
    console.log("Platform:", doctor.videoPlatform);
    res.json({
      message: "Settings updated successfully",
      videoPlatform: doctor.videoPlatform,
    });
    console.log("Platform:", doctor.videoPlatform);
    res.json({
      message: "Settings updated successfully",
      videoPlatform: doctor.videoPlatform,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
};

exports.getAllAppointments = async (req, res) => {
  try {
    // Fetch all appointments and populate patient details
    const appointments = await Appointment.find()
      .populate("patient", {
        name: 1,
        age: 1,
        newExisting: 1,
        phone: 1,
        whatsappNumber: 1,
        email: 1,
        gender: 1,
        medicalRecords: 1,
        patientEntry: 1,
        currentLocation: 1,
        appointmentFixed: 1,
        appDownload: 1,
        follow: 1,
        followComment: 1,
        followUpTimestamp: 1,
        familyMembers: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .lean(); // Fetch as plain objects for easier formatting

    // Transform data into the desired format
    const formattedData = appointments.map((appointment) => {
      const patientDetails = appointment.patient || {};
      return {
        ...patientDetails,
        medicalDetails: {
          _id: appointment._id,
          patientId: appointment.patient?._id,
          consultingFor: appointment.consultingFor,
          diseaseName: appointment.diseaseName,
          diseaseType: appointment.diseaseType,
          follow: appointment.follow,
          followComment: appointment.followComment,
          followUpTimestamp: appointment.followUpTimestamp,
          medicalPayment: appointment.medicalPayment,
          callCount: appointment.callCount,
          comments: appointment.comments,
          __v: appointment.__v,
        },
      };
    });
    console.log("data:", formattedData);
    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// API endpoint to fetch patient and appointment data
exports.getAllAppointmentsWithPatientData = async (req, res) => {
  try {
    // Fetch all unique patient IDs from the appointments
    const appointments = await Appointment.find({});
    const patientIds = [
      ...new Set(
        appointments.map((appointment) => appointment.patient.toString())
      ),
    ];

    // Fetch patient data for the corresponding IDs
    const patients = await Patient.find({ _id: { $in: patientIds } });

    // Format response as required
    const response = [];

    patients.forEach((patient) => {
      const patientAppointments = appointments.filter(
        (appointment) =>
          appointment.patient.toString() === patient._id.toString()
      );

      patientAppointments.forEach((appointment) => {
        response.push({
          _id: patient._id,
          name: patient.name,
          age: patient.age,
          newExisting: patient.newExisting,
          phone: patient.phone,
          whatsappNumber: patient.whatsappNumber,
          email: patient.email,
          gender: patient.gender,
          medicalRecords: patient.medicalRecords,
          patientEntry: patient.patientEntry,
          currentLocation: patient.currentLocation,
          appointmentFixed: patient.appointmentFixed,
          appDownload: patient.appDownload,
          follow: patient.follow,
          followComment: patient.followComment,
          followUpTimestamp: patient.followUpTimestamp,
          familyMembers: patient.familyMembers,
          createdAt: patient.createdAt,
          updatedAt: patient.updatedAt,
          medicalDetails: {
            _id: appointment._id,
            patientId: appointment.patient,
            consultingFor: appointment.consultingFor,
            appointmentDate: appointment.appointmentDate,
            timeSlot: appointment.timeSlot,
            diseaseName: appointment.diseaseName,
            diseaseType: appointment.diseaseType,
            follow: appointment.follow,
            followComment: appointment.followComment,
            followUpTimestamp: appointment.followUpTimestamp,
            medicalPayment: appointment.medicalPayment,
            callCount: appointment.callCount,
            comments: appointment.comments,
            meetLink: appointment.meetLink,
            drafts: appointment.notes,
            prescriptionCreated: appointment.prescriptionCreated,
            prescription_id: appointment.prescriptionID,
            medicinePrepared:appointment.medicinePrepared
          },
        });
      });
    });

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.submitNotes = async (req, res) => {
  console.log("Reached");
  const { appointmentID, notes } = req.body;

  try {
    const appointment = await Appointment.findById(appointmentID);
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    appointment.notes = notes;
    await appointment.save();

    res
      .status(200)
      .json({ success: true, message: "Notes submitted successfully" });
  } catch (error) {
    console.error("Error submitting notes:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.fetchProfile = async (req, res) => {
  try {
    const doctorId = req.user.id; // Adjust this based on your authentication method
    console.log(doctorId);
    // const patient = await Patient.findById(doctorId);
    const doctor = await Doctor.findById(doctorId).select("-password"); // Exclude sensitive data

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json(doctor);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Destructure the fields from the request body
    const { name, age, phone, whatsappNumber, gender } = req.body;

    // Find and update the patient document
    const updatedDoctor = await Doctor.findByIdAndUpdate(
      userId,
      {
        name,
        age,
        phone,
        whatsappNumber,
        gender,
      },
      { new: true, runValidators: true }
    );

    if (!updatedDoctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      data: updatedDoctor,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    const doctorId = req.user._id; // assuming authentication middleware sets this
    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    let profilePhotoUrl = "";

    if (req.file) {
      // 📤 Upload file to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "doctor_profiles",
        resource_type: "image",
      });

      profilePhotoUrl = uploadResult.secure_url;

      // if (req.file) {
      //   const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      //     folder: "doctor_profile_photos",
      //     public_id: `${doctorId}_profile`,
      //     overwrite: true,
      //   });

      //   profilePhotoUrl = uploadResult.secure_url;

      // 🧹 Clean up local file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Failed to delete local file:", err);
      });
    } else {
      // 🖼️ Generate avatar using initials if no file uploaded
      const initials = doctor.name
        ? doctor.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
        : "P";

      profilePhotoUrl = `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff&size=128`;
    }

    // ✅ Save to doctor
    doctor.profilePhoto = profilePhotoUrl;
    await doctor.save();

    res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      profilePhoto: profilePhotoUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload profile picture",
      error: error.message,
    });
  }
};
exports.updateTrackingId = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    // ✅ 1. Get all shipping details from the request body
    const { trackingId, deliveryPartner, shippedDate, arrivalDate } = req.body;

    if (!trackingId) {
      return res.status(400).json({ message: "Tracking ID is required." });
    }

    // --- EXISTING LOGIC to update the Prescription (Core logic is unchanged) ---
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found." });
    }

    prescription.trackingId = trackingId;
    prescription.isProductShipped = true;
    // Use the shippedDate from the payload for consistency
    prescription.shippedDate = new Date(shippedDate); 
    
    await prescription.save({ validateBeforeSave: false });
    // --- END OF EXISTING LOGIC ---


    // --- NEW LOGIC ADDED HERE to update the MedicinePreparationSummary ---
    // This second, separate update adds the details to the packaging information.
    await MedicinePreparationSummary.updateOne(
      { prescriptionId: prescriptionId },
      { 
        // Using "packagingUsed.0" to target the FIRST item in the array,
        // which is assumed to be the main shipping container.
        $set: { 
          "packagingUsed.0.shipmentId": trackingId, // As you said, trackingId and shipmentId are the same
          "packagingUsed.0.deliveryPartner": deliveryPartner,
          "packagingUsed.0.shippedDate": shippedDate,
          "packagingUsed.0.arrivalDate": arrivalDate
        } 
      }
    );
    // --- END OF NEW LOGIC ---

    res.json({ message: "Tracking ID and shipping details updated successfully." });
    
  } catch (err) {
    console.error("Error updating tracking ID:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.startPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { startDate: startDatePayload } = req.body;

    if (!prescriptionId || !startDatePayload) {
      return res.status(400).json({ message: "Missing prescriptionId or startDate in request" });
    }

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }

    const startDate = moment.utc(startDatePayload).startOf("day");
    const duration = parseInt(prescription.medicineCourse, 10) || 0;
    const endDate = moment(startDate).add(duration - 1, "days");

    prescription.startDate = startDate.toDate();
    prescription.endDate = endDate.toDate();
    await prescription.save();

    const remindersToInsert = [];

    for (const [index, med] of (prescription.prescriptionItems || []).entries()) {
      const {
        medicineName = `Unnamed Medicine #${index}`,
        form, // ✅ Get the form here**
        dispenseQuantity,
        medicineConsumption: dosage = "",
        additionalComments: instructions = "",
        standardSchedule = [],
        frequentSchedule = [],
        parallelConsumption = null,
      } = med || {};

      // Standard Schedule
      for (const sched of standardSchedule) {
        const { day, timing = {} } = sched;
        if (!day || !timing || typeof timing !== "object") continue;

        const doseDate = moment(startDate).add(day - 1, "days").format("YYYY-MM-DD");

        const timeSlots = Object.values(timing)
          .map(slot => slot?.time)
          .filter(Boolean); 

        for (const time of timeSlots) {
          remindersToInsert.push({
            patientId: prescription.patientId,
            doctorId: prescription.doctorId,
            prescriptionId,
            medicineName,
            form, // ✅ Add the form to the reminder**
            dispenseQuantity,
            medicineConsumption: dosage,
            dosage,
            instructions,
            date: doseDate,
            doseTime: time,
            taken: false,
            notificationType: "reminder",
          });
        }
      }

      // Frequent Schedule
      for (const sched of frequentSchedule) {
        const { day, frequentFrequency } = sched;
        if (!day || !frequentFrequency) continue;

        const { doses = 0, hours = 0, minutes = 0 } = frequentFrequency;
        const baseDate = moment(startDate).add(day - 1, "days");
        const baseTime = moment(baseDate).hour(8).minute(0);

        for (let i = 0; i < doses; i++) {
          const doseTime = baseTime.clone().add(i * (hours * 60 + minutes), "minutes");
          remindersToInsert.push({
            patientId: prescription.patientId,
            doctorId: prescription.doctorId,
            prescriptionId,
            medicineName,
            form, // ✅ Add the form to the reminder**
            dispenseQuantity,
            medicineConsumption: dosage,
            dosage,
            instructions,
            date: doseTime.format("YYYY-MM-DD"),
            doseTime: doseTime.format("HH:mm"),
            taken: false,
            notificationType: "reminder",
          });
        }
      }

      // Parallel Consumption
      if (parallelConsumption) {
        const { schedule = [], startTime = "08:00", intervalHours = 0, intervalMinutes = 0, totalDoses = 0 } = parallelConsumption;

        if (schedule.length > 0) {
          for (const { day, time } of schedule) {
            const doseDate = moment(startDate).add(day - 1, "days").format("YYYY-MM-DD");
            remindersToInsert.push({
              patientId: prescription.patientId,
              doctorId: prescription.doctorId,
              prescriptionId,
              medicineName,
              form, // ✅ Add the form to the reminder**
              dispenseQuantity,
              medicineConsumption: dosage,
              dosage,
              instructions,
              date: doseDate,
              doseTime: time,
              taken: false,
              notificationType: "reminder",
            });
          }
        } else if (totalDoses > 0) {
          const [sh, sm] = startTime.split(":").map(Number);
          const baseTime = moment(startDate).hour(sh || 8).minute(sm || 0);

          for (let i = 0; i < totalDoses; i++) {
            const doseTime = baseTime.clone().add(i * (intervalHours * 60 + intervalMinutes), "minutes");
            remindersToInsert.push({
              patientId: prescription.patientId,
              doctorId: prescription.doctorId,
              prescriptionId,
              medicineName,
              form, // ✅ Add the form to the reminder**
              dispenseQuantity,
              medicineConsumption: dosage,
              dosage,
              instructions,
              date: doseTime.format("YYYY-MM-DD"),
              doseTime: doseTime.format("HH:mm"),
              taken: false,
              notificationType: "reminder",
            });
          }
        }
      }
    }

    if (remindersToInsert.length > 0) {
      try {
        await NotificationReminderSettings.insertMany(remindersToInsert, { ordered: false });
      } catch (insertErr) {
        console.error("Reminder Insert Error:", insertErr.message);
      }
    }

    res.status(200).json({
      message: "Prescription started. Reminders created where possible."
    });
  } catch (error) {
    console.error("Unhandled Error in startPrescription:", error.message);
    res.status(500).json({
      message: "Something went wrong while starting the prescription",
      error: error.message,
    });
  }
};
exports.getDeliveryStatusByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const objectId = new mongoose.Types.ObjectId(patientId);

    const prescriptions = await Prescription.find({
      patientId: objectId,
    }).select("trackingId isProductReceived shippedDate prescriptionItems");

    if (!prescriptions.length) {
      return res
        .status(404)
        .json({ message: "No prescriptions found for this patient." });
    }

    // ✅ 1. Use Promise.all to handle the async call inside the map
    const simplified = await Promise.all(
      prescriptions.map(async (prescription) => {
        // ✅ 2. Fetch the corresponding packaging details
        const summary = await MedicinePreparationSummary.findOne(
            { prescriptionId: prescription._id }
        ).select("packagingUsed");

        // Prepare the object with all the required data
        return {
          id: prescription._id,
          trackingId: prescription.trackingId,
          shippedDate: prescription.shippedDate || null,
          isProductReceived: prescription.isProductReceived,
          items: prescription.prescriptionItems.map((item) => ({
            name: item.medicineName,
            qty: item.dispenseQuantity,
            uom: item.uom,
          })),
          // ✅ 3. Add the packaging details to the response
          packagingDetails: summary?.packagingUsed || [],
        };
      })
    );

    res.json(simplified);
  } catch (error) {
    console.error("Error fetching delivery status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
//To check he is appointed with consultation or not
exports.getDoctorByFollow = async (req, res) => {
  try {
    const doctorId = req.user.id; // You should extract from token
    const doctor = await Doctor.findById(doctorId).select("role follow");

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json(doctor); } catch(err){
    console.error("Error fetching doctor details:", err);
    res.status(500).json({ message: "Server Error" })}};

exports.getDoctorPatientMedicationSummary = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({ message: "Doctor ID and date are required" });
    }

    const selectedDateUTC = new Date(date);
    selectedDateUTC.setUTCHours(0, 0, 0, 0);

    const nextDateUTC = new Date(selectedDateUTC);
    nextDateUTC.setUTCDate(selectedDateUTC.getUTCDate() + 1);

    const reminders = await NotificationReminderSettings.find({
      doctorId,
      date: {
        $gte: selectedDateUTC,
        $lt: nextDateUTC
      }
    }).lean();

    if (!reminders.length) {
      return res.status(404).json({ message: "No reminders found for this doctor on selected date" });
    }

    const patientIds = [...new Set(reminders.map(r => r.patientId.toString()))];

    const patients = await Patient.find({ _id: { $in: patientIds } }).lean();
    const patientDetailsDocs = await patientDetails.find({ patientId: { $in: patientIds } }).lean();

    const patientMap = Object.fromEntries(patients.map(p => [p._id.toString(), p]));
    const patientMetaMap = Object.fromEntries(patientDetailsDocs.map(p => [p.patientId.toString(), p]));

    const response = [];

    for (const pid of patientIds) {
      const patientReminders = reminders.filter(r => r.patientId.toString() === pid);

      const demo = patientMap[pid];
      const meta = patientMetaMap[pid];

      const taken = [], missed = [], pending = [], viewMedications = [];

      for (const reminder of patientReminders) {
        const base = {
          medicineName: reminder.medicineName || "",
          doseTime: reminder.doseTime || ""
        };

        if (reminder.status === true) {
          taken.push(base);
          viewMedications.push({ ...base, status: "taken" });
        } else if (reminder.status === false) {
          missed.push(base);
          viewMedications.push({ ...base, status: "missed" });
        } else {
          pending.push(base);
          viewMedications.push({ ...base, status: "pending" });
        }
      }

      response.push({
        patientId: pid,
        name: demo?.name || "",
        age: demo?.age || "",
        gender: demo?.gender || "",
        diseaseName: meta?.diseaseName || "",
        diseaseType: meta?.diseaseType?.name || "",

        doses: {
          taken: {
            count: taken.length,
            data: taken
          },
          missed: {
            count: missed.length,
            data: missed
          },
          pending: {
            count: pending.length,
            data: pending
          }
        },

        viewMedications
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error in getDoctorPatientMedicationSummary:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.getTodaysAppointments = async (req, res) => {
  try {
    // 1. Get doctorId from logged-in user and date from query
    const doctorId = req.user._id; // Assumes doctor's ID is from the auth token
    const { date } = req.query; // e.g., ?date=2025-09-01

    // 2. Validate the input date
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "Please provide a date in YYYY-MM-DD format." });
    }

    // 3. Define the date range for the entire requested day
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // 4. Find all confirmed or completed appointments for that doctor on that day
    const appointments = await Appointment.find({
      doctor: doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["confirmed", "completed"] }, // Get booked appointments
    })
      .sort({ timeSlot: 1 }) // Sort by time
      .populate({
        path: "patient",
        select: "name phone", // Select name and phone from Patient model
      })

    // 5. Format the response to match your example
    const formattedAppointments = appointments.map((appt) => ({
      appointmentId: appt._id,
      timeSlot: appt.timeSlot,
      status: appt.status,
      patient: appt.patient
        ? {
            id: appt.patient._id,
            name: appt.patient.name,
            phone: appt.patient.phone,
          }
        : null, // Handle case where patient might be deleted
    }));

    res.status(200).json({
      success: true,
      appointments: formattedAppointments,
    });
  } catch (error) {
    console.error("Error fetching doctor appointments by date:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getAppointmentWithTimedata = async (req, res) => {
  try {
    const patientId = new mongoose.Types.ObjectId(req.query.id);
    const type = req.query.type; // "past" or "future"

    const allAppointments = await Appointment.find({ patient: patientId });

    if (allAppointments.length === 0) {
      return res.json({ message: "The appointments are not found" });
    }

    const now = new Date();

    const filteredAppointments = allAppointments.filter(app => {
      const date = new Date(app.appointmentDate);
      const [hour, minute] = app.timeSlot.split(":").map(Number);
      date.setHours(hour, minute, 0, 0);
      return type === "past" ? date < now : date >= now;
    });

    res.json(filteredAppointments);

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAppointedPatients = async (req,res)=>{
  try {
    const appointments = await Appointment.find({doctor:req.query.id});
    const appointedPatients = [...new Set(appointments.map(patient => patient.patient.toString()))];
    const patientDetails = await Patient.find({_id:{$in:appointedPatients}})
    res.json(patientDetails)
  } catch (error) {
    console.log(error)
  }
}

exports.consultationNotes = async (req, res) => {
  try {
    console.log('Received consultation note data:', req.body); // Debug log
    
    // Validate required fields
    const { patientId, userId, note } = req.body;
    
    if (!patientId || !userId || !note) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: patientId, userId, and note are required',
        received: req.body
      });
    }

    // Create new consultation note
    const consultationNote = new ConsultationNote({
      patientId,
      userId,
      note,
      date: req.body.date || new Date()
    });

    console.log('Saving consultation note:', consultationNote); // Debug log
    
    const savedNote = await consultationNote.save();
    
    console.log('Successfully saved note:', savedNote); // Debug log
    
    res.status(201).json({
      success: true,
      message: 'Consultation note saved successfully',
      data: savedNote
    });
    
  } catch (error) {
    console.error('Error saving consultation note:', error); // Detailed error log
    
    // Handle different types of errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry error',
        error: error.message
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};

exports.secondFormDetails = async (req,res) =>{
  try {
    const response = await chronicModel.find({userId:req.query.id})
    res.json(response);
  } catch (error) {
    console.log(error);
  }
}
exports.getTotalAppointments = async (req, res) => {
  try {
    // Count all documents in the Appointment collection with no filter
    const totalAppointments = await Appointment.countDocuments({});

    res.status(200).json({
      success: true,
      totalAppointments: totalAppointments,
    });
  } catch (error) {
    console.error("Error fetching total appointment count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};