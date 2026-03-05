import express from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getStats,
  getStudents,
  getFeaturedCourses,
  getCourseDistribution,
  getWeeklySignups,
  getRecentActivity,
  getAnalytics,
} from "../controllers/dashboardController.js";

const router = express.Router();

router.use(authenticateUser);
router.use(requireRole("admin"));

router.get("/stats", getStats);
router.get("/students", getStudents);
router.get("/featured-courses", getFeaturedCourses);
router.get("/course-distribution", getCourseDistribution);
router.get("/weekly-signups", getWeeklySignups);
router.get("/recent-activity", getRecentActivity);
router.get("/analytics", getAnalytics);

export default router;
