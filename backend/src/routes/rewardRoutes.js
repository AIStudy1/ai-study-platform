import express from "express";
import { getUserBadges, getLeaderboard } from "../controllers/rewardController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/badges", authenticateUser, getUserBadges);
router.get("/leaderboard", authenticateUser, getLeaderboard);

export default router;