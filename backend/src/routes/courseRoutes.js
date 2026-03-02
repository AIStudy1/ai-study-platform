import express from "express";
import { createCourse, getAllCourses } from "../controllers/courseController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post(
    "/",
    authenticateUser,
    authorizeRoles("admin"),
    createCourse
  );
router.get("/", getAllCourses);

export default router;