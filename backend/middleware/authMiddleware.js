const jwt = require("jsonwebtoken");
require("dotenv").config();

// Middleware to protect routes
const protect = (req, res, next) => {
  let token;

  // Check if header has token
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // { id, role }
      next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    return res.status(401).json({ message: "No token, authorization denied" });
  }
};

module.exports = { protect };
