const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
// const { authenticateUser, authorizeAdmin } = require('../middleware/auth');
// const { validatePaymentRequest } = require('../middleware/validators');
// const rateLimiter = require('../middleware/rateLimiter');
const validateToken = require("../middlewares/validateTokenHandler");
// Apply rate limiting to all payment routes
// router.use(rateLimiter);

// Payment routes
router.post(
  '/create-order',
  validateToken,
//   authenticateUser,
//   validatePaymentRequest,
  PaymentController.createPaymentOrder
);

router.post(
  '/createDraftAppointment',
  validateToken,
//   authenticateUser,
//   validatePaymentRequest,
  PaymentController.createDraftAppointment
);


router.post(
  '/verify-payment',
//   authenticateUser,
validateToken,
  PaymentController.verifyPayment
);

router.get(
  '/transaction/:transactionId',
//   authenticateUser,
validateToken,
  PaymentController.getTransactionStatus
);

router.post(
  '/refund',
//   authenticateUser,
//   authorizeAdmin,
validateToken,
  PaymentController.initiateRefund
);

module.exports = router;