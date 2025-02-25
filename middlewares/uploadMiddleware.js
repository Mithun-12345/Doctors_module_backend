const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const {cloudinary} = require('../configs/cloudinaryConfig');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'doctor_posts', // Cloudinary folder
    allowed_formats: ['jpg', 'png', 'mp4', 'mov'],
    resource_type: 'auto', // Auto-detect file type
  },
});

const upload = multer({ storage });

module.exports = upload;
