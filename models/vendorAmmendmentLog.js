const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EditLogSchema = new Schema({
  resourceId: {
    type: Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
  },
  // --- REMOVED ---
  // editedBy: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'User',
  //   required: true,
  // },
    vendorName: {
    type: String,
    required: true,
  },
  changes: [
    {
      _id: false,
      field: {
        type: String,
        required: true,
      },
      oldValue: {
        type: Schema.Types.Mixed,
      },
      newValue: {
        type: Schema.Types.Mixed,
      },
    },
  ],
  modifiedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('EditLog', EditLogSchema);