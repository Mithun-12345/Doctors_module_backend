const express = require("express");
const router = express.Router();
const {getConsultationPriorityMapping,editConsultationPriorityMapping,getAppointmentSlottypes,getClinicOperationalHours,createConsulationPriorityMapping,deleteSlotTypes,updateSlotType,createClinicOperationalHours,updateClinicOperationalHours,createAppointmentSlotTypes} = require("../controllers/doctorAppointmentSettingsController")
const validateToken = require("../middlewares/validateTokenHandler");

router.post("/createClinicOperationalHours",validateToken,createClinicOperationalHours);
router.put("/updateClinicOperationalHours",validateToken,updateClinicOperationalHours);
router.get("/getClinicOperationalHours",validateToken,getClinicOperationalHours);

router.post("/createAppointmentSlotTypes",validateToken,createAppointmentSlotTypes);
router.put("/updateSlotType",validateToken,updateSlotType);
router.delete("/deleteSlotTypes",validateToken,deleteSlotTypes);
router.get("/getAppointmentSlottypes",validateToken,getAppointmentSlottypes);


router.post("/createConsulationPriorityMapping",validateToken,createConsulationPriorityMapping);
router.get("/getConsultationPriorityMapping",validateToken,getConsultationPriorityMapping);
router.patch("/editConsultationPriorityMapping/:id",validateToken,editConsultationPriorityMapping);

module.exports = router;