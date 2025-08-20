const express = require("express");
const router = express.Router();
const {updatePaymentIntimationPanel1,createPaymentSettings3,createPaymentSettings2,createPaymentSettings1,getPaymentMsgTemplate,getPaymentIntimationPanel2,getPaymentIntimationPanel1,editPaymentIntimationPanel2,editPaymentMsgTemplate,getShipmentPanels,sendShipmentPanel,getRescheduleAndRefund,editRescheduleAndRefund,createRescheduleAndRefund,generateDoctorFeedbackQuestions,regenerateParticularQuestion,viewFeedbackQuestionsofParticularQuery,createDoctorFeedback,editFeedbackPanel,getFeedbackPanel,createFeedbackPanel,updateShipmentPanel,getConsultationPriorityMapping,editConsultationPriorityMapping,getAppointmentSlottypes,getClinicOperationalHours,createConsulationPriorityMapping,deleteSlotTypes,updateSlotType,createClinicOperationalHours,editOperationalHours,createAppointmentSlotTypes} = require("../controllers/consultationMessengerSettingsController")
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

// shipment panel 
router.post("/sendShipmentPanel",validateToken,sendShipmentPanel);
router.get("/getShipmentPanels",validateToken,getShipmentPanels);
router.patch("/updateShipmentPanel/:id",validateToken,updateShipmentPanel);

// payment intimation panel
router.post("/createPaymentSettings1",validateToken,createPaymentSettings1);
router.patch("/updatePaymentIntimationPanel1/:id",validateToken,updatePaymentIntimationPanel1);
router.post("/createPaymentSettings2",validateToken,createPaymentSettings2);
router.get("/getPaymentIntimationPanel1",validateToken,getPaymentIntimationPanel1);
router.get("/getPaymentIntimationPanel2",validateToken,getPaymentIntimationPanel2);
router.patch("/editPaymentIntimationPanel2/:id",validateToken,editPaymentIntimationPanel2);

// payment messeage template 
router.post("/createPaymentSettings3",validateToken,createPaymentSettings3);
router.patch("/editPaymentMsgTemplate/:id",validateToken,editPaymentMsgTemplate);
router.get("/getPaymentMsgTemplate",validateToken,getPaymentMsgTemplate);


module.exports = router;