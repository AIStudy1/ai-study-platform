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
import {
  getUserCourses,
  createCourse,
  getCourseById,
  deleteCourse,
  completeChapter,
  submitQuiz,
  generateEntryQuiz,
  submitEntryQuiz,
} from "../controllers/aiCourseController.js";

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

// aiCourseController routes 
router.get("/ai-courses", getUserCourses);
router.post("/ai-courses", createCourse);
router.get("/ai-courses/:id", getCourseById);
router.delete("/ai-courses/:id", deleteCourse);
router.patch("/ai-courses/:courseId/chapters/:chapterId/complete", completeChapter);
router.post("/ai-courses/:courseId/entry-quiz/generate", generateEntryQuiz);
router.post("/ai-courses/:courseId/entry-quiz/submit", submitEntryQuiz);
router.patch("/ai-courses/:courseId/quizzes/:quizId/submit", submitQuiz);

// Chat history / threads
router.get("/conversations", listConversations);
router.post("/conversations", createConversation);
router.get("/conversations/:id/messages", getConversationMessages);

export default router;