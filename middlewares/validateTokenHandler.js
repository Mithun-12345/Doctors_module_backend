const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

const validateToken = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && authHeader.startsWith("Bearer")) {
    token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401);
      throw new Error("User is not authorized or token is missing");
    }

    // Debugging: Log the token and secret
    console.log("authHeader:", authHeader);
    console.log("Token received:", token);
    console.log("Secret used for verification:", process.env.ACCESS_TOKEN_SECRET);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        res.status(401);
        throw new Error("User is not authorized");
      }
      req.user = decoded.user;
      next();
    });
  } else {
    res.status(401);
    throw new Error("Authorization header is missing or invalid");
  }
});

module.exports = validateToken;
