const mongoose = require('mongoose');

const rawMaterialUsedSchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RawMaterial',
    required: true
  },
  materialName: {
    type: String,
    required: true
  },
  quantityUsed: {
    type: Number,
    required: true,
    min: 0
  },
  unitOfMeasure: {
    type: String,
    required: true
  },
  costPerUnit: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  expiryDate: {
    type: Date,
    required: true
  },
  batchNumber: {
    type: String,
    default: null
  },
  lotNumber: {
    type: String,
    default: null
  }
});

const preparedBySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
//   userRole: {
//     type: String,
//     required: true,
//     enum: ['doctor', 'pharmacist', 'nurse', 'admin']
//   },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const medicinePreparationSummarySchema = new mongoose.Schema({
  // Patient Information
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
    index: true
  },
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: true,
    index: true
  },
  
  // Medicine Information
  medicineName: {
    type: String,
    required: true,
    index: true
  },
  medicineForm: {
    type: String,
    required: true
  },
  medicineQuantity: {
    type: Number,
    required: true
  },
  medicineFrequency: {
    type: String,
    required: true
  },
//   medicineDuration: {
//     type: String,
//     required: true
//   },
  
  // Raw Materials Used
  rawMaterialsUsed: [rawMaterialUsedSchema],
  
  // Cost Information
  totalRawMaterialCost: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Preparation Details
  preparationDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  preparationTime: {
    type: String,
    required: true
  },
  preparationNotes: {
    type: String,
    default: ''
  },
  
  // Security & Audit Information
  preparedBy: preparedBySchema,
  
  // System Information
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    default: null
  },
  
  // Status
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'COMPLETED',
    index: true
  },
  
  // Audit Trail
  auditLog: [{
    action: {
      type: String,
      required: true
    },
    performedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      userName: String,
      userRole: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'medicinePreparationSummaries'
});

// Indexes for better query performance
medicinePreparationSummarySchema.index({ patientId: 1, preparationDate: -1 });
medicinePreparationSummarySchema.index({ 'preparedBy.userId': 1, preparationDate: -1 });
medicinePreparationSummarySchema.index({ medicineName: 1, preparationDate: -1 });
medicinePreparationSummarySchema.index({ status: 1, preparationDate: -1 });

// Pre-save middleware to update the updatedAt field
medicinePreparationSummarySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get preparation statistics
medicinePreparationSummarySchema.statics.getPreparationStats = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        preparationDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: null,
        totalPreparations: { $sum: 1 },
        totalCost: { $sum: '$totalRawMaterialCost' },
        uniqueMedicines: { $addToSet: '$medicineName' },
        uniquePatients: { $addToSet: '$patientId' }
      }
    },
    {
      $project: {
        totalPreparations: 1,
        totalCost: 1,
        uniqueMedicinesCount: { $size: '$uniqueMedicines' },
        uniquePatientsCount: { $size: '$uniquePatients' }
      }
    }
  ]);
};

// Instance method to add audit log entry
medicinePreparationSummarySchema.methods.addAuditLog = function(action, userId, userName, userRole, details = {}) {
  this.auditLog.push({
    action,
    performedBy: {
      userId,
      userName,
      userRole
    },
    timestamp: new Date(),
    details
  });
  return this.save();
};

const MedicinePreparationSummary = mongoose.model('MedicinePreparationSummary', medicinePreparationSummarySchema);

module.exports = MedicinePreparationSummary;