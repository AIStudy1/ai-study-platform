const express = require("express");
const router = express.Router();

// Import middleware
const { protect } = require("../middleware/authMiddleware");

// Example protected route
router.get("/", protect, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user });
});

module.exports = router;
