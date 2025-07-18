const mongoose = require("mongoose");
const Doctor = require("../models/doctorModel");
const Appointment = require("../models/appointmentModel.js");
const Patient = require("../models/patientModel.js");
const moment = require("moment");
const cloudinary = require("cloudinary").v2;
const Prescription = require('../models/Prescription.js');
const fs = require("fs");
const NotificationReminderSettings = require('../models/NotificationReminderSettings');

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
  const phone = req.user.phone; // Use the phone from the token
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
    const { trackingId } = req.body;

    if (!trackingId) {
      return res.status(400).json({ message: "Tracking ID is required." });
    }

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found." });
    }

    prescription.trackingId = trackingId;
    prescription.isProductShipped = true;
    prescription.shippedDate = new Date();

    await prescription.save({ validateBeforeSave: false });

    res.json({ message: "Tracking ID updated successfully." });
  } catch (err) {
    console.error("Error updating tracking ID:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.startPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { startDate } = req.body;

    console.log('📥 Start Prescription Request Received');
    console.log('🔍 Prescription ID:', prescriptionId);
    console.log('🗓️  Provided Start Date:', startDate);

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      console.log('❌ Prescription not found');
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (!startDate) {
      console.log('⚠️  Start date is missing in request');
      return res.status(400).json({ message: 'Start date is required' });
    }

    // Set and compute dates
    prescription.startDate = new Date(startDate);
    console.log('✅ Start Date Set:', prescription.startDate);

    if (prescription.medicineCourse) {
      prescription.endDate = moment(prescription.startDate)
        .add(prescription.medicineCourse, 'days')
        .toDate();
      console.log('📆 Calculated End Date:', prescription.endDate);
    } else {
      console.log('⚠️  No medicineCourse found in prescription; End Date not calculated');
    }

    await prescription.save({ validateBeforeSave: false });
    console.log('💾 Prescription saved successfully');

    const finalSchedule = [];

    for (const item of prescription.prescriptionItems || []) {
      const {
        medicineName,
        frequencies,
        standardSchedule,
        frequentSchedule,
        parallelConsumption,
      } = item;
      const medicineSchedule = [];

      if (frequencies?.length > 0) {
        for (const freq of frequencies) {
          const {
            day,
            frequencyType,
            standardFrequency,
            frequentFrequency,
            parallelConsumption: nestedParallel,
            timings,
          } = freq;

          if (!day) continue;
          const date = moment(prescription.startDate).add(day - 1, 'days').format('YYYY-MM-DD');

          if (frequencyType === 'standard' && standardFrequency) {
            const timeSlots = ['morning', 'afternoon', 'evening', 'night'];
            for (const slot of timeSlots) {
              const timing = standardFrequency?.[slot];
              if (timing?.from) {
                medicineSchedule.push({ date, time: timing.from, day });
              }
            }
          }

          if (nestedParallel?.schedule?.length > 0) {
            for (const nested of nestedParallel.schedule) {
              const nestedDate = moment(prescription.startDate)
                .add(nested.day - 1, 'days')
                .format('YYYY-MM-DD');
              if (nested.time) {
                medicineSchedule.push({
                  date: nestedDate,
                  time: nested.time,
                  day: nested.day,
                });
              }
            }
          }

          if (frequencyType === 'frequent') {
            if (timings?.length > 0) {
              for (const time of timings) {
                medicineSchedule.push({ date, time, day });
              }
            } else if (
              frequentFrequency?.doses &&
              (frequentFrequency.hours || frequentFrequency.minutes)
            ) {
              const totalDoses = frequentFrequency.doses;
              const intervalMinutes =
                (frequentFrequency.hours || 0) * 60 + (frequentFrequency.minutes || 0);
              const startTime = timings?.[0] || '08:00';
              const firstDose = moment(startTime, 'HH:mm');

              for (let i = 0; i < totalDoses; i++) {
                const doseTime = firstDose.clone().add(i * intervalMinutes, 'minutes');
                medicineSchedule.push({
                  date,
                  time: doseTime.format('HH:mm'),
                  day,
                });
              }
            }
          }
        }
      }

      if (standardSchedule?.length > 0) {
        for (const sched of standardSchedule) {
          const legacyDate = moment(prescription.startDate)
            .add(sched.day - 1, 'days')
            .format('YYYY-MM-DD');
          for (const time of sched.times || []) {
            medicineSchedule.push({ date: legacyDate, time, day: sched.day });
          }
        }
      }

      if (parallelConsumption?.schedule?.length > 0) {
        for (const dateStr of parallelConsumption.schedule) {
          const time = moment(dateStr).format('HH:mm');
          const date = moment(dateStr).format('YYYY-MM-DD');
          medicineSchedule.push({
            date,
            time,
            day: moment(dateStr).diff(moment(prescription.startDate), 'days') + 1,
          });
        }
      }

      if (medicineSchedule.length > 0) {
        finalSchedule.push({
          medicineName,
          schedule: medicineSchedule,
        });
      }
    }

    // ✅ Apply proper IST → UTC conversion for reminder insertion
    const remindersToInsert = finalSchedule.flatMap((entry) =>
      entry.schedule.map((s) => ({
        prescriptionId: prescription._id,
        patientId: prescription.patientId,
        doctorId: prescription.doctorId,
        medicineName: entry.medicineName,
        date: moment.tz(`${s.date} ${s.time}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata').toDate(),
        doseTime: s.time,
        day: s.day,
      }))
    );

    if (remindersToInsert.length > 0) {
      await NotificationReminderSettings.insertMany(remindersToInsert);
      console.log(`✅ ${remindersToInsert.length} reminders created`);
    } else {
      console.log('⚠️ No reminders to insert');
    }

    return res.status(200).json({
      message: 'Start date set and reminders generated successfully',
      startDate: prescription.startDate,
      endDate: prescription.endDate,
    });
  } catch (err) {
    console.error('🔥 Error in startPrescription:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};


exports.getDeliveryStatusByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const objectId = new mongoose.Types.ObjectId(patientId);
    console.log(req.params.patientId);

    const prescriptions = await Prescription.find({ patientId: objectId })
      .select('trackingId isProductReceived shippedDate prescriptionItems');

    if (!prescriptions.length) {
      return res.status(404).json({ message: "No prescriptions found for this patient." });
    }

    const simplified = prescriptions.map((prescription) => ({
      id: prescription._id,
      trackingId: prescription.trackingId,
      shippedDate: prescription.shippedDate || null, 
      isProductReceived: prescription.isProductReceived,
      items: prescription.prescriptionItems.map((item) => ({
        name: item.medicineName,
        qty: item.dispenseQuantity,
        uom: item.uom
      }))
    }));

    res.json(simplified);
  } catch (error) {
    console.error("❌ Error fetching delivery status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

