const express = require("express");
const validateToken = require("../middlewares/validateTokenHandler");
const {
  addDoctor,
  getAppointments,
} = require("../controllers/doctorController.js");

const router = express.Router();

router.post("/addDoctor", validateToken, addDoctor);
router.get("/getAppointments", validateToken, getAppointments);

module.exports = router;
