const express = require("express");
const router = express.Router();

// 🔹 Path must point to controllers folder correctly
const { register, login } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);

module.exports = router;
