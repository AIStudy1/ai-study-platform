const express = require("express");
const router = express.Router();
const { saveAssessment } = require("../controllers/assessmentController");

router.post("/save", saveAssessment);

module.exports = router;
