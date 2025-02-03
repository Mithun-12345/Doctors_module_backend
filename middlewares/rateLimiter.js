// const Redis = require("ioredis");

// const redisClient = new Redis(); // Connect to Redis

// const userRateLimiter = async (req, res, next) => {
//   try {
//     let userPhone;

//     // Check for authenticated user (attached via validateToken)
//     if (req.user && req.user.phone) {
//       userPhone = req.user.phone;
//     } 
//     // For OTP requests or login, use phone from request body
//     else if (req.body.phone) {
//       userPhone = req.body.phone;
//     } else {
//       return res.status(400).json({ message: "Invalid request - no phone number found." });
//     }

//     // Define rate limit rules
//     const windowMs = 15 * 60 * 1000; // 15 minutes
//     const maxRequests = 5; // Allow up to 5 requests per window
//     const expireTime = Math.floor(windowMs / 1000); // Convert to seconds

//     const key = `ratelimit:user:${userPhone}`; // Unique key per user
//     const currentRequests = await redisClient.incr(key);

//     if (currentRequests === 1) {
//       // Set expiry only when the key is first created
//       await redisClient.expire(key, expireTime);
//     }

//     if (currentRequests > maxRequests) {
//       return res
//         .status(429)
//         .json({ success: false, message: "Too many requests. Please try again later." });
//     }

//     next();
//   } catch (error) {
//     console.error("Rate limiting error:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// };

// module.exports = userRateLimiter;
