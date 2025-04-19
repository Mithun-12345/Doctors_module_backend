const express = require("express");
const router = express.Router();
const workshopController = require("../controllers/workshopController");
const validateToken = require("../middlewares/validateTokenHandler");

router.post("/postWorkshop", validateToken, workshopController.createWorkshop);
router.get("/viewAll", validateToken, workshopController.viewPendingWorkshops);
router.post("/book", validateToken, workshopController.bookWorkshop);
router.get("/view", validateToken, workshopController.viewOwnWorkshops);
router.post('/create-order', workshopController.createOrder);
router.post('/confirm-booking', workshopController.confirmBooking);
module.exports = router;
