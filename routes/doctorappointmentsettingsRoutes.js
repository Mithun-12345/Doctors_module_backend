const express = require("express");
const router = express.Router();
const {getAppointmentSlottypes,getClinicOperationalHours,createConsulationPriorityMapping,deleteSlotTypes,updateSlotType,createClinicOperationalHours,updateClinicOperationalHours,createAppointmentSlotTypes} = require("../controllers/doctorAppointmentSettingsController")
const validateToken = require("../middlewares/validateTokenHandler");

router.post("/createClinicOperationalHours",validateToken,createClinicOperationalHours);
router.put("/updateClinicOperationalHours",validateToken,updateClinicOperationalHours);
router.get("/getClinicOperationalHours",validateToken,getClinicOperationalHours);

router.post("/createAppointmentSlotTypes",validateToken,createAppointmentSlotTypes);
router.put("/updateSlotType",validateToken,updateSlotType);
router.delete("/deleteSlotTypes",validateToken,deleteSlotTypes);
router.post("/createConsulationPriorityMapping",validateToken,createConsulationPriorityMapping);
router.get("/getAppointmentSlottypes",validateToken,getAppointmentSlottypes);

module.exports = router;