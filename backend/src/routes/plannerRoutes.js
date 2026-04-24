import express from "express";
import {
  getTasks,
  createTask,
  completeTask,
  deleteTask,
  generateTasksWithAI,
} from "../controllers/plannerController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/tasks", authenticateUser, getTasks);
router.post("/tasks", authenticateUser, createTask);
router.patch("/tasks/:id/done", authenticateUser, completeTask);
router.delete("/tasks/:id", authenticateUser, deleteTask);
router.post("/ai-generate", authenticateUser, generateTasksWithAI);

export default router;