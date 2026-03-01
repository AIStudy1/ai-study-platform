const Assessment = require("../models/Assessment");

exports.saveAssessment = async (req, res) => {
  try {
    const { subject, score, level, learningPoints } = req.body;

    const newAssessment = new Assessment({
      subject,
      score,
      level,
      learningPoints
    });

    await newAssessment.save();

    res.status(201).json({
      message: "Assessment saved successfully",
      assessment: newAssessment
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
