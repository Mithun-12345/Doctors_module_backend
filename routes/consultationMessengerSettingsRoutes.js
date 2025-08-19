const express = require("express");
const router = express.Router();
const {getRescheduleAndRefund,editRescheduleAndRefund,createRescheduleAndRefund,generateDoctorFeedbackQuestions,regenerateParticularQuestion,viewFeedbackQuestionsofParticularQuery,createDoctorFeedback,editFeedbackPanel,getFeedbackPanel,createFeedbackPanel,createShipmentPanel,editPaymentIntimationPanel,createPaymentIntimationPanel,getShipmentPanel,updateShipmentPanel,getConsultationPriorityMapping,editConsultationPriorityMapping,getAppointmentSlottypes,getClinicOperationalHours,createConsulationPriorityMapping,deleteSlotTypes,updateSlotType,createClinicOperationalHours,editOperationalHours,createAppointmentSlotTypes} = require("../controllers/consultationMessengerSettingsController")
const validateToken = require("../middlewares/validateTokenHandler");



router.post("/createFeedbackPanel",validateToken,createFeedbackPanel);
router.get("/getFeedbackPanel",validateToken,getFeedbackPanel);
router.patch("/editFeedbackPanel/:id",validateToken,editFeedbackPanel);

// feedback questions api's
router.post("/generateDoctorFeedbackQuestions",validateToken,generateDoctorFeedbackQuestions);
router.post("/createDoctorFeedback",validateToken,createDoctorFeedback);
router.get("/viewFeedbackQuestionsofParticularQuery/:id",validateToken,viewFeedbackQuestionsofParticularQuery);
router.post("/regenerateParticularQuestion",validateToken,regenerateParticularQuestion);

// clinic operational hours
router.post("/createClinicOperationalHours",validateToken,createClinicOperationalHours);
router.put("/editOperationalHours/:id",validateToken,editOperationalHours);
router.get("/getClinicOperationalHours",validateToken,getClinicOperationalHours);

// appointment slot types
router.post("/createAppointmentSlotTypes",validateToken,createAppointmentSlotTypes);
router.put("/updateSlotType/:id",validateToken,updateSlotType);
router.delete("/deleteSlotTypes/:id",validateToken,deleteSlotTypes);
router.get("/getAppointmentSlottypes",validateToken,getAppointmentSlottypes);

// consulation priority 
router.post("/createConsulationPriorityMapping",validateToken,createConsulationPriorityMapping);
router.get("/getConsultationPriorityMapping",validateToken,getConsultationPriorityMapping);
router.patch("/editConsultationPriorityMapping/:id",validateToken,editConsultationPriorityMapping);

// reschedule and refund 
router.post("/createRescheduleAndRefund",validateToken,createRescheduleAndRefund);
router.patch("/editRescheduleAndRefund/:id",validateToken,editRescheduleAndRefund);
router.get("/getRescheduleAndRefund",validateToken,getRescheduleAndRefund);

router.post("/createShipmentPanel",validateToken,createShipmentPanel);
router.get("/getShipmentPanel",validateToken,getShipmentPanel);
router.patch("/updateShipmentPanel",validateToken,updateShipmentPanel);

router.post("/createPaymentIntimationPanel",validateToken,createPaymentIntimationPanel);
router.patch("/editPaymentIntimationPanel/:id",validateToken,editPaymentIntimationPanel);

module.exports = router;