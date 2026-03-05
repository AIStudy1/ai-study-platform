import express from "express";
import {
  getProfile,
  updateProfile,
  getGoal,
  updateGoal,
  addStudyProgress,
} from "../controllers/userController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateUser);

router.get("/profile", getProfile);
router.patch("/profile", updateProfile);
router.get("/goal", getGoal);
router.patch("/goal", updateGoal);
router.post("/goal/progress", addStudyProgress);

export default router;