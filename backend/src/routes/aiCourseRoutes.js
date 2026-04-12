import express from "express";
import {
  getUserCourses,
  createCourse,
  getCourseById,
  submitEntryQuiz,
  deleteCourse,
  completeChapter,
  submitQuiz,
} from "../controllers/aiCourseController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

router.get("/", getUserCourses);
router.post("/", createCourse);
router.post("/:courseId/entry-quiz/submit", submitEntryQuiz);
router.get("/:id", getCourseById);
router.delete("/:id", deleteCourse);
router.patch("/:courseId/chapters/:chapterId/complete", completeChapter);
router.patch("/:courseId/quizzes/:quizId/submit", submitQuiz);

export default router;