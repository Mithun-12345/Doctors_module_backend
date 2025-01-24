const express = require("express");
const router = express.Router();
const { checkIn, checkOut, getAssistantDoctorDetails } = require("../controllers/attendanceController");
const validateToken = require("../middlewares/validateTokenHandler");


router.post("/checkin",validateToken, checkIn);
router.post("/checkout",validateToken, checkOut);
router.get("/getAttendance",validateToken, getAssistantDoctorDetails);
module.exports = router;
