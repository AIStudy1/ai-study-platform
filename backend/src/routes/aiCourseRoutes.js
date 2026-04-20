import express from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
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

// ─── Courses ──────────────────────────────────────────────────────────────────
router.get("/",          getUserCourses);
router.post("/",         createCourse);
router.get("/:id",       getCourseById);
router.delete("/:id",    deleteCourse);

// ─── Chapter completion ───────────────────────────────────────────────────────
router.patch("/:courseId/chapters/:chapterId/complete", completeChapter);

// ─── Entry quiz ───────────────────────────────────────────────────────────────
router.post("/:courseId/entry-quiz/generate", generateEntryQuiz);
router.post("/:courseId/entry-quiz/submit",   submitEntryQuiz);

// ─── Chapter quizzes ──────────────────────────────────────────────────────────
router.patch("/:courseId/quizzes/:quizId/submit", submitQuiz);

export default router;