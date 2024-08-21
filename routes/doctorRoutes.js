const express = require("express");
const validateToken = require("../middlewares/validateTokenHandler");
const { addDoctor } = require("../controllers/doctorController.js");

const router = express.Router();

router.post("/addDoctor", validateToken, addDoctor);

module.exports = router;
