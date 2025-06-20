const Prescription = require('../models/Prescription');
const Patient = require('../models/patientModel');
const Doctor = require('../models/doctorModel');
const Appointment = require('../models/appointmentModel');
const RawMaterial = require('../models/RawMaterial');
const Medicine = require('../models/Medicine');

// Create a new prescription
const createPrescription = async (req, res) => {
  try {
    console.log("createPrescription reached");
    const {
      patientId,
      prescriptionItems,
      followUpDays,
      medicineCharges,
      shippingCharges,
      notes,
      medicineCourse,
      action,
      parentPrescriptionId,
      consultingType,
      consultingFor
    } = req.body;

    // Get doctor ID from auth token
    const doctorId = req.user._id;
    console.log("doctorId: ", req.user._id);
    
    // Validate required fields
    if (!patientId || !prescriptionItems || !prescriptionItems.length || !medicineCourse) {
      console.log("Missing required fields");
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Validate doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Validate raw materials exist
    for (const item of prescriptionItems) {
      if (item.rawMaterialDetails && item.rawMaterialDetails.length > 0) {
        for (const rmDetail of item.rawMaterialDetails) {
          const rawMaterial = await RawMaterial.findById(rmDetail._id);
          if (!rawMaterial) {
            return res.status(404).json({
              success: false,
              message: `Raw material ${rmDetail.name} not found`
            });
          }
        }
      }
    }

    // Get appointment ID if patient has an active appointment
    let appointmentId = null;
    if (patient.appointmentId) {
      const appointment = await Appointment.findById(patient.appointmentId);
      if (appointment) {
        appointmentId = appointment._id;
      }
    }

    // Create prescription with proper item mapping
    const prescription = new Prescription({
      patientId,
      doctorId,
      appointmentId,
      prescriptionItems: prescriptionItems.map(item => {
        console.log("Processing item:", item.medicineName);
        console.log("Item frequencyType:", item.frequencyType);
        console.log("Item standardSchedule:", item.standardSchedule);
        console.log("Item frequentSchedule:", item.frequentSchedule);

        // Normalize frequency type
        let normalizedFrequencyType = 'Standard';
        if (item.frequencyType) {
          normalizedFrequencyType = item.frequencyType.toLowerCase() === 'frequent' ? 'Frequent' : 'Standard';
        }

        // Prepare schedule arrays
        let standardSchedule = [];
        let frequentSchedule = [];

        if (normalizedFrequencyType === 'Standard') {
          standardSchedule = item.standardSchedule || [];
          // Ensure each schedule item has proper structure
          standardSchedule = standardSchedule.map(schedule => ({
            day: schedule.day,
            timing: {
              morning: {
                food: schedule.timing?.morning?.food || "",
                time: schedule.timing?.morning?.time || "",
              },
              afternoon: {
                food: schedule.timing?.afternoon?.food || "",
                time: schedule.timing?.afternoon?.time || "",
              },
              evening: {
                food: schedule.timing?.evening?.food || "",
                time: schedule.timing?.evening?.time || "",
              },
              night: {
                food: schedule.timing?.night?.food || "",
                time: schedule.timing?.night?.time || "",
              },
            }
          }));
        } else {
          frequentSchedule = item.frequentSchedule || [];
          // Ensure each schedule item has proper structure
          frequentSchedule = frequentSchedule.map(schedule => ({
            day: schedule.day,
            frequency: schedule.frequency || "",
          }));
        }

        console.log("Processed standardSchedule:", standardSchedule);
        console.log("Processed frequentSchedule:", frequentSchedule);

        return {
          medicineName: item.medicineName || '',
          rawMaterialDetails: (item.rawMaterialDetails || []).map(rm => ({
            _id: rm._id,
            name: rm.name,
            quantity: rm.quantity || 0,
            pricePerUnit: rm.pricePerUnit || 0,
            totalPrice: rm.totalPrice || 0
          })),
          form: item.form || 'Tablets',
          dispenseQuantity: item.dispenseQuantity || '',
          duration: item.duration || '',
          uom: item.uom || 'Pieces',
          price: item.price || 0,
          additionalComments: item.additionalComments || '',
          frequencyType: normalizedFrequencyType,
          standardSchedule: standardSchedule,
          frequentSchedule: frequentSchedule,
          // Individual item fields
          prescriptionType: item.prescriptionType || 'Only Prescription',
          consumptionType: item.consumptionType || 'Sequential',
          label: item.label || 'A',
        };
      }),
      followUpDays: followUpDays || 10,
      medicineCharges: medicineCharges || 0,
      shippingCharges: shippingCharges || 0,
      notes: notes || '',
      medicineCourse,
      action: action || { status: 'In Progress', closeComment: '' },
      consultingType: consultingType || '',
      consultingFor: consultingFor || ''
    });

    // Save prescription
    const savedPrescription = await prescription.save();

    console.log("Prescription saved successfully:");
    console.log("Prescription ID:", savedPrescription._id);
    
    // Log each item's schedule data for debugging
    savedPrescription.prescriptionItems.forEach((item, index) => {
      console.log(`Item ${index + 1} (${item.medicineName}):`);
      console.log("  FrequencyType:", item.frequencyType);
      console.log("  StandardSchedule:", item.standardSchedule);
      console.log("  FrequentSchedule:", item.frequentSchedule);
    });

    // If this is a sub-prescription, update parent prescription
    if (parentPrescriptionId) {
      await Prescription.findByIdAndUpdate(
        parentPrescriptionId,
        { $push: { subPrescriptionID: savedPrescription._id } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: savedPrescription
    });

  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all prescriptions for a patient
const getPatientPrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Get prescriptions with populated data
    const prescriptions = await Prescription.find({ patientId })
      .populate('doctorId', 'name email')
      .populate('appointmentId', 'consultingType consultingFor appointmentDate')
      .sort({ createdAt: -1 });

    // Format prescriptions for response
    const formattedPrescriptions = prescriptions.map(prescription => ({
      _id: prescription._id,
      consultingType: prescription.consultingType || prescription.appointmentId?.consultingType || 'N/A',
      consultingFor: prescription.consultingFor || prescription.appointmentId?.consultingFor || 'N/A',
      medicineCourse: prescription.medicineCourse,
      action: prescription.action,
      createdAt: prescription.createdAt,
      doctorName: prescription.doctorId?.name || 'Unknown',
      prescriptionType: prescription.prescriptionType,
      medicineCharges: prescription.medicineCharges,
      isPaymentDone: prescription.isPaymentDone,
      subPrescriptionCount: prescription.subPrescriptionID?.length || 0
    }));

    res.status(200).json({
      success: true,
      data: formattedPrescriptions
    });

  } catch (error) {
    console.error('Error fetching patient prescriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get prescription by ID
const getPrescriptionById = async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    const prescription = await Prescription.findById(prescriptionId)
      .populate('patientId', 'name age phone email')
      .populate('doctorId', 'name email')
      .populate('appointmentId', 'consultingType consultingFor appointmentDate')
      .populate('subPrescriptionID');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.status(200).json({
      success: true,
      data: prescription
    });

  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update prescription
const updatePrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const updateData = req.body;

    // Validate prescription exists
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Check if doctor is authorized to update this prescription
    if (prescription.doctorId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this prescription'
      });
    }

    // Update prescription
    const updatedPrescription = await Prescription.findByIdAndUpdate(
      prescriptionId,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate('patientId', 'name age phone email')
     .populate('doctorId', 'name email');

    res.status(200).json({
      success: true,
      message: 'Prescription updated successfully',
      data: updatedPrescription
    });

  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Close prescription
const closePrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { closeComment } = req.body;

    // Validate prescription exists
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Check if doctor is authorized
    if (prescription.doctorId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to close this prescription'
      });
    }

    // Update prescription status
    prescription.action.status = 'Close';
    prescription.action.closeComment = closeComment || '';
    prescription.updatedAt = Date.now();

    await prescription.save();

    res.status(200).json({
      success: true,
      message: 'Prescription closed successfully',
      data: prescription
    });

  } catch (error) {
    console.error('Error closing prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get available medicines
const getMedicines = async (req, res) => {
  try {
    const medicines = await Medicine.find()
      .select('name form ingredients dosage')
      .sort({ name: 1 });
    console.log(medicines);
    res.status(200).json({
      success: true,
      data: medicines
    });

  } catch (error) {
    console.error('Error fetching medicines:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get available raw materials
const getRawMaterials = async (req, res) => {
  try {
    const rawMaterials = await RawMaterial.find({})
      .select('name uom currentQuantity costPerUnit description')
      .sort({ name: 1 });

      console.log("rawMaterials:",rawMaterials);
    res.status(200).json({
      success: true,
      data: rawMaterials
    });

  } catch (error) {
    console.error('Error fetching raw materials:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get doctor's prescriptions
const getDoctorPrescriptions = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const { page = 1, limit = 10, status, patientName } = req.query;

    // Build query
    let query = { doctorId };
    
    if (status) {
      query['action.status'] = status;
    }

    // Get prescriptions with pagination
    const prescriptions = await Prescription.find(query)
      .populate('patientId', 'name age phone')
      .populate('appointmentId', 'consultingType consultingFor')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter by patient name if provided
    let filteredPrescriptions = prescriptions;
    if (patientName) {
      filteredPrescriptions = prescriptions.filter(prescription =>
        prescription.patientId?.name?.toLowerCase().includes(patientName.toLowerCase())
      );
    }

    const total = await Prescription.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        prescriptions: filteredPrescriptions,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching doctor prescriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get prescription statistics
const getPrescriptionStats = async (req, res) => {
  try {
    const doctorId = req.user.userId;

    const stats = await Prescription.aggregate([
      { $match: { doctorId: mongoose.Types.ObjectId(doctorId) } },
      {
        $group: {
          _id: '$action.status',
          count: { $sum: 1 },
          totalCharges: { $sum: '$medicineCharges' }
        }
      }
    ]);

    const totalPrescriptions = await Prescription.countDocuments({ doctorId });
    const recentPrescriptions = await Prescription.find({ doctorId })
      .populate('patientId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        stats,
        totalPrescriptions,
        recentPrescriptions
      }
    });

  } catch (error) {
    console.error('Error fetching prescription stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const postMedicine = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Medicine name is required" });

  try {
    const existing = await Medicine.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ error: "Medicine name already exists" });
    }

    const newMedicine = new Medicine({ name });
    await newMedicine.save();
    res.status(201).json(newMedicine);
  } catch (error) {
    console.error("Error creating medicine:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const updateCloseComment = async (req, res) => {
  const { status, closeComment } = req.body;
  const { prescriptionId } = req.params;

  console.log("updateCloseComment reached");
  console.log("Request body:", req.body);
  console.log("Request params:", req.params);

  if (!status) {
    return res.status(400).json({ success: false, message: "Status is required" });
  }

  if (!['In Progress', 'Close'].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status value" });
  }

  try {
    const updatedPrescription = await Prescription.findByIdAndUpdate(
      prescriptionId,
      {
        $set: {
          "action.status": status,
          "action.closeComment": closeComment || "",
          updatedAt: Date.now(),
        },
      },
      { new: true }
    );

    if (!updatedPrescription) {
      return res.status(404).json({ success: false, message: "Prescription not found" });
    }

    res.status(200).json({ success: true, data: updatedPrescription });
  } catch (error) {
    console.error("Error updating prescription action:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createPrescription,
  getPatientPrescriptions,
  getPrescriptionById,
  updatePrescription,
  closePrescription,
  getMedicines,
  getRawMaterials,
  getDoctorPrescriptions,
  getPrescriptionStats,
  postMedicine,
  updateCloseComment
};