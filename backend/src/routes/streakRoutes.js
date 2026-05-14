import express from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
import {
  getStreak,
  recordStudyActivity,
  buyStreakFreeze,
  getLeaderboard,
  weeklyReset,
  getFriends,
  searchUsers,
  addFriend,
  respondToFriend,
  getInviteCode,
} from "../controllers/streakController.js";

const streakRouter = express.Router();
streakRouter.use(authenticateUser);

streakRouter.get("/",                    getStreak);
streakRouter.post("/record",             recordStudyActivity);
streakRouter.post("/freeze",             buyStreakFreeze);
streakRouter.get("/leaderboard",         getLeaderboard);
streakRouter.post("/weekly-reset",       weeklyReset);

// Friends
streakRouter.get("/invite-code",         getInviteCode);
streakRouter.get("/friends",             getFriends);
streakRouter.get("/friends/search",      searchUsers);
streakRouter.post("/friends",            addFriend);
streakRouter.patch("/friends/:id",       respondToFriend);

export { streakRouter };