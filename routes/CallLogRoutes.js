const router = require('express').Router();
const express = require('express');

const {
    sendMessage,
    verifyAppointmentbooking,
    getFollowUpStatus,
    incrementCallCount,
    updateEnquiryStatus,
    login,
    getPatientStats,
    listPatients,
    updateDiseaseType,
    patientProfile
    // getTwimlResponse,
    // makeCall
} = require('../controllers/CallLogController');

router.post('/send-message/:id', sendMessage);
router.get('/check/:userId', verifyAppointmentbooking);
router.get('/follow-up/:patientId', getFollowUpStatus);
router.post('/increment-call-count/:patientId', incrementCallCount);
router.put('/update-status/:patientId', updateEnquiryStatus);
router.post('/login', login);
router.get('/dashboard', getPatientStats);
router.get('/list', listPatients);
router.put('/update-disease-type/:id', updateDiseaseType);
router.get('/patientProfile/:id', patientProfile);

// router.post("/twiml", getTwimlResponse);
// router.post("/make-call", makeCall);

module.exports = router;