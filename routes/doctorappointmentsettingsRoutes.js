const express = require("express");
const router = express.Router();
const {createConsulationPriorityMapping,deleteSlotTypes,updateSlotType,createClinicOperationalHours,updateClinicOperationalHours,createAppointmentSlotTypes} = require("../controllers/doctorAppointmentSettingsController")
const validateToken = require("../middlewares/validateTokenHandler");

router.post("/createClinicOperationalHours",validateToken,createClinicOperationalHours);
router.put("/updateClinicOperationalHours",validateToken,updateClinicOperationalHours);

router.post("/createAppointmentSlotTypes",validateToken,createAppointmentSlotTypes);
router.put("/updateSlotType",validateToken,updateSlotType);
router.delete("/deleteSlotTypes",validateToken,deleteSlotTypes);
router.post("/createConsulationPriorityMapping",validateToken,createConsulationPriorityMapping);

module.exports = router;