import express from "express";
import { createCourse, getAllCourses } from "../controllers/courseController.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authenticateUser, requireRole("admin"), createCourse);
router.get("/", authenticateUser, getAllCourses);

export default router;