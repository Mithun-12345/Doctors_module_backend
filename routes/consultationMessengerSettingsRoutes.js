const express = require("express");
const router = express.Router();
const {viewFeedbackQuestionsofParticularQuery,createDoctorFeedback,editFeedbackPanel,getFeedbackPanel,createFeedbackPanel,createShipmentPanel,editPaymentIntimationPanel,createPaymentIntimationPanel,getShipmentPanel,updateShipmentPanel,getConsultationPriorityMapping,editConsultationPriorityMapping,getAppointmentSlottypes,getClinicOperationalHours,createConsulationPriorityMapping,deleteSlotTypes,updateSlotType,createClinicOperationalHours,updateClinicOperationalHours,createAppointmentSlotTypes} = require("../controllers/consultationMessengerSettingsController")
const validateToken = require("../middlewares/validateTokenHandler");


router.post("/createFeedbackPanel",validateToken,createFeedbackPanel);
router.get("/getFeedbackPanel",validateToken,getFeedbackPanel);
router.patch("/editFeedbackPanel/:id",validateToken,editFeedbackPanel);

// feedback questions api's
router.post("/createDoctorFeedback",validateToken,createDoctorFeedback);
router.get("/viewFeedbackQuestionsofParticularQuery/:id",validateToken,viewFeedbackQuestionsofParticularQuery);

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

router.post("/createShipmentPanel",validateToken,createShipmentPanel);
router.get("/getShipmentPanel",validateToken,getShipmentPanel);
router.patch("/updateShipmentPanel",validateToken,updateShipmentPanel);

router.post("/createPaymentIntimationPanel",validateToken,createPaymentIntimationPanel);
router.patch("/editPaymentIntimationPanel/:id",validateToken,editPaymentIntimationPanel);

module.exports = router;