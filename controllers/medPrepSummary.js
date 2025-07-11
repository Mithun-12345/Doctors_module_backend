const MedicinePreparationSummary = require('../models/MedicinePreparationSummary');

exports.createSummary = async (req, res) => {
  try {
    const {
      appointmentId,
      prescriptionId,
      patientId,
      selectedMedicine,
      rawMaterialsUsed,
      totalCost,
      preparationNotes
    } = req.body;

    console.log("user re req", req.user);
    const preparedBy = req.user.id;
    const preparedByName = req.user.name;
    // const preparedByRole = req.user.role; must change

    const preparationSummary = new MedicinePreparationSummary({
      patientId,
      appointmentId,
      prescriptionId,
      medicineName: selectedMedicine.rawMaterialName,
      medicineForm: selectedMedicine.form,
      medicineQuantity: selectedMedicine.quantity,
      medicineFrequency: selectedMedicine.frequencyDuration,
    //   medicineDuration: selectedMedicine.duration,
      rawMaterialsUsed: rawMaterialsUsed.map(item => ({
        materialId: item._id,
        materialName: item.name,
        quantityUsed: item.quantity,
        unitOfMeasure: item.uom,
        costPerUnit: item.pricePerUnit,
        totalCost: item.totalPrice,
        expiryDate: item.expiryDate,
        batchNumber: item.batchNumber || null,
        lotNumber: item.lotNumber || null
      })),
      totalRawMaterialCost: totalCost,
      preparationDate: new Date(),
      preparationTime: new Date().toISOString(),
      preparationNotes: preparationNotes || '',
      preparedBy: {
        userId: preparedBy,
        userName: preparedByName,
        // userRole: preparedByRole,
        timestamp: new Date()
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID,
      status: 'COMPLETED',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedSummary = await preparationSummary.save();

    console.log(`Medicine Preparation Summary Created:`, {
      summaryId: savedSummary._id,
      patientId,
      medicineName: selectedMedicine.name,
      preparedBy: preparedByName,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Medicine preparation summary saved successfully',
      data: {
        summaryId: savedSummary._id,
        preparationDate: savedSummary.preparationDate,
        totalCost: savedSummary.totalRawMaterialCost
      }
    });
  } catch (error) {
    console.error('Error saving medicine preparation summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save medicine preparation summary',
      error: error.message
    });
  }
};

exports.getSummaryById = async (req, res) => {
  try {
    const { summaryId } = req.params;
    
    const summary = await MedicinePreparationSummary.findById(summaryId)
      .populate('patientId', 'name email phone')
      .populate('preparedBy.userId', 'name email role');
    
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Medicine preparation summary not found'
      });
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching medicine preparation summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medicine preparation summary',
      error: error.message
    });
  }
};

exports.getSummariesByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const summaries = await MedicinePreparationSummary.find({ patientId })
      .sort({ preparationDate: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate('preparedBy.userId', 'name role');
    
    const total = await MedicinePreparationSummary.countDocuments({ patientId });

    res.json({
      success: true,
      data: {
        summaries,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Error fetching patient preparation summaries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preparation summaries',
      error: error.message
    });
  }
};
