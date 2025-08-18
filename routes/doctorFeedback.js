const express = require("express");
const validateToken = require("../middlewares/validateTokenHandler");
const { editFeedbackParticularQuestion,viewFeedbackQuestions, editDoctorFeedbackOption,createDoctorForFeedbackOption ,createDoctorFeedback} = require("../controllers/docterfeedbackController")

const router = express.Router();

router.post("/createDoctorForFeedbackOption",validateToken,createDoctorForFeedbackOption);
router.put("/editDoctorFeedbackOption/:queryId",validateToken,editDoctorFeedbackOption);


router.post("/createDoctorFeedback",validateToken,createDoctorFeedback);
router.put("/editFeedbackParticularQuestion",validateToken,editFeedbackParticularQuestion);
router.get("/viewFeedbackQuestions",validateToken,viewFeedbackQuestions);

module.exports = router;