const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Patient = require("../models/patientModel"); // Import your Patient model
const Doctor = require("../models/doctorModel"); // Import your Doctor model
const Admin = require("../models/Admin");   // Import your Admin model

const validateToken = asyncHandler(async (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
        
        if (!token) {
            return res.status(401).json({ success: false, error: "User is not authorized or token is missing" });
        }
        
        try {
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            console.log("Decoded token:", decoded);
            
            // Directly access decoded.phone
            let user = await Patient.findOne({ phone: decoded.phone });
            
            if (!user) {
                user = await Doctor.findOne({ phone: decoded.phone }); // Check doctors if not found in patients
            }

            if (!user) {
                user = await Admin.findOne({ phone: decoded.phone }); // Check admins if not found in doctors
            }

            if (!user) {
                return res.status(404).json({ success: false, error: "User not found" });
            }
            
            // Attach the found user object to the request
            req.user = user;
            next();
        } catch (error) {
            console.error("Token verification error:", error);
            return res.status(401).json({ success: false, error: "User is not authorized" });
        }
    } else {
        return res.status(401).json({ success: false, error: "Authorization header is missing or invalid" });
    }
});

module.exports = validateToken;
