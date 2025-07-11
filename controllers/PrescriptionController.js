const Prescription = require('../models/Prescription');
const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const Appointment = require('../models/appointmentModel');
const Doctor = require('../models/doctorModel');
const Patient = require('../models/patientModel');

// this function is to be removed in order to migrate to getPrescriptionByAppointmentId fn
// const getPrescriptionByAppointmentId = async (req, res) => {
//     console.log("Reached");
//   try {
//     const { appointmentId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
//       return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid appointment ID format' });
//     }

//     const prescription = await Prescription.findOne({ 
//       appointmentId: new mongoose.Types.ObjectId(appointmentId) 
//     });

//     if (!prescription) {
//       return res.status(StatusCodes.NOT_FOUND).json({ message: `No prescription found for appointment ID: ${appointmentId}` });
//     }

//     if (prescription.doctorId.toString() !== req.user.userId && req.user.role !== 'admin') {
//       return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Not authorized to access this prescription' });
//     }

//     res.status(StatusCodes.OK).json(prescription);
//   } catch (err) {
//     console.error('Error fetching prescription by appointment ID:', err);
//     res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error', error: err.message });
//   }
// };

const getPrescriptionByAppointmentId = async (req, res) => {
  try {
    console.log("getPrescriptionByAppointmentId is reaching");
    const { appointmentId } = req.params;
    console.log("appointmentId", appointmentId);
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid appointment ID format' });
    }

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: `Appointment not found with ID: ${appointmentId}` });
    }

    // if (
    //   appointment.patient.toString() !== req.user.id &&
    //   req.user.userRole != 'doctor' &&
    //   req.user.role !== 'admin'
    // ) {
    //   return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Not authorized to access this prescription' });
    // }

    const prescription = await Prescription.findOne({
      appointmentId: new mongoose.Types.ObjectId(appointmentId)
    })
      .populate('doctorId', 'name specialty licenseNumber')
      .populate('patientId', 'name');

    if (!prescription) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: `No prescription found for appointment ID: ${appointmentId}` });
    }

    const formattedPrescription = {
      _id: prescription._id,
      appointmentId: prescription.appointmentId,
      doctorId: prescription.doctorId._id,
      doctorName: prescription.doctorId.name,
      doctorSpecialty: prescription.doctorId.specialty,
      doctorLicense: prescription.doctorId.licenseNumber,
      patientId: prescription.patientId._id,
      patientName: prescription.patientId.name,
      // diagnosis: prescription.diagnosis,
      // medications: prescription.medications,
      // instructions: prescription.instructions,
      prescriptionItems: prescription.prescriptionItems,
      createdAt: prescription.createdAt,
      updatedAt: prescription.updatedAt
    };

    res.status(StatusCodes.OK).json(formattedPrescription);
  } catch (err) {
    console.error('Error fetching prescription by appointment ID:', err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error', error: err.message });
  }
};


const getMyPrescribedAppointments = async (req, res) => {
  try {
    const userId = req.user.id;

    const appointments = await Appointment.find({
      patient: userId,
      prescriptionCreated: true
    });

    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const getPrescribedAppointments = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    // Find appointments for the user where prescriptionCreated is true
    const appointments = await Appointment.find({
      patient: userId,
      prescriptionCreated: true
    }).sort({ appointmentDate: -1 });

    if (!appointments.length) {
      return res.status(200).json({ 
        success: true, 
        data: [],
        message: 'No prescribed appointments found' 
      });
    }

    // Fetch the prescriptions for these appointments
    const appointmentIds = appointments.map(appointment => appointment._id);
    
    const prescriptions = await Prescription.find({
      appointmentId: { $in: appointmentIds }
    });

    // Map prescriptions to their appointments
    const appointmentsWithPrescriptions = appointments.map(appointment => {
      const prescription = prescriptions.find(
        p => p.appointmentId.toString() === appointment._id.toString()
      );
      
      return {
        appointment: appointment,
        prescription: prescription || null
      };
    });

    return res.status(200).json({
      success: true,
      data: appointmentsWithPrescriptions
    });
  } catch (error) {
    console.error('Error fetching prescribed appointments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch prescribed appointments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getPrescriptionById = async (req, res) => {
  try {
    console.log("Reached");
    const { prescriptionId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
      return res.status(400).json({ success: false, message: 'Invalid prescription ID format' });
    }

    const prescription = await Prescription.findById(prescriptionId);
    
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    console.error('Error fetching prescription:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch prescription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { isPayementDone } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
      return res.status(400).json({ success: false, message: 'Invalid prescription ID format' });
    }

    const prescription = await Prescription.findByIdAndUpdate(
      prescriptionId,
      { isPayementDone },
      { new: true, runValidators: true }
    );
    
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: prescription,
      message: 'Payment status updated successfully'
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getPrescriptionByAppointmentId,
  getMyPrescribedAppointments,
  getPrescribedAppointments,
  getPrescriptionById,
  updatePaymentStatus
};
