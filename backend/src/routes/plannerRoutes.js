import express from "express";
import {
  getTasks,
  createTask,
  completeTask,
  deleteTask,
  
} from "../controllers/plannerController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/tasks", authenticateUser, getTasks);
router.post("/tasks", authenticateUser, createTask);
router.patch("/tasks/:id/done", authenticateUser, completeTask);
router.delete("/tasks/:id", authenticateUser, deleteTask);


export default router;0