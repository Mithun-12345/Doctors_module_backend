const express = require("express");
const {
  sendForm,
  patientDetails,
} = require("../controllers/regformController");
const { sendChronicForm } = require("../controllers/chronicFormController");
const validateToken = require("../middlewares/validateTokenHandler");

const router = express.Router();

router.post("/sendRegForm", sendForm);
router.post("/sendChronicForm", validateToken, sendChronicForm);
router.get("/details", validateToken, patientDetails);

module.exports = router;
