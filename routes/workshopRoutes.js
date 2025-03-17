const express = require("express");
const router = express.Router();
const workshopController = require("../controllers/workshopController");
const validateToken = require("../middlewares/validateTokenHandler");

router.post("/postWorkshop", validateToken, workshopController.createWorkshop);
router.post("/viewAll", validateToken, workshopController.viewPendingWorkshops);
router.post("/book", validateToken, workshopController.bookWorkshop);
router.get("/view", validateToken, workshopController.viewOwnWorkshops);

module.exports = router;
