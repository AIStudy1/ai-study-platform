import express from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
import {
  chatWithAI,
  generateCourse,
  generateDiagnostic,
  generateStudyPlan,
  getExamReadiness,
  generateQuizFromFile,      
  saveDiagnosticResult,      
} from "../controllers/aiController.js";

const router = express.Router();

router.use(authenticateUser);

router.post("/chat", chatWithAI);
router.post("/generate-course", generateCourse);
router.post("/diagnostic", generateDiagnostic);
router.post("/study-plan", generateStudyPlan);
router.post("/exam-readiness", getExamReadiness);
router.post("/quiz-from-file", generateQuizFromFile);
router.post("/save-diagnostic", saveDiagnosticResult);
export default router;