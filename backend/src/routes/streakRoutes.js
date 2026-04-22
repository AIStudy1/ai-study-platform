import express from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
import {
  getStreak,
  recordStudyActivity,
  buyStreakFreeze,
  getLeaderboard,
  weeklyReset,
} from "../controllers/streakController.js";

const streakRouter = express.Router();
streakRouter.use(authenticateUser);

streakRouter.get("/",             getStreak);
streakRouter.post("/record",      recordStudyActivity);
streakRouter.post("/freeze",      buyStreakFreeze);
streakRouter.get("/leaderboard",  getLeaderboard);
streakRouter.post("/weekly-reset", weeklyReset); // protected by secret header

export { streakRouter };