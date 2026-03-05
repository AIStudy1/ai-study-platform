import express from "express";
import {
  getActivity,
  logActivity,
  clearActivity,
} from "../controllers/activityController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateUser);

router.get("/", getActivity);
router.post("/", logActivity);
router.delete("/", clearActivity);

export default router;