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
  agentChat,
} from "../controllers/aiController.js";
import {
  listConversations,
  createConversation,
  getConversationMessages,
} from "../controllers/aiConversationController.js";

const router = express.Router();

router.use(authenticateUser);

router.post("/chat", chatWithAI);
router.post("/generate-course", generateCourse);
router.post("/diagnostic", generateDiagnostic);
router.post("/study-plan", generateStudyPlan);
router.post("/exam-readiness", getExamReadiness);
router.post("/quiz-from-file", generateQuizFromFile);
router.post("/save-diagnostic", saveDiagnosticResult);
router.post("/agent-chat", agentChat);

// Chat history / threads
router.get("/conversations", listConversations);
router.post("/conversations", createConversation);
router.get("/conversations/:id/messages", getConversationMessages);

export default router;