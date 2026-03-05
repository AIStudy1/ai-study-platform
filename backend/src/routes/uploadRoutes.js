import express from "express";
import multer from "multer";
import { uploadFile } from "../controllers/uploadController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

// Store file in memory (not disk)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and PowerPoint files are allowed"));
    }
  },
});

router.post("/", authenticateUser, upload.single("file"), uploadFile);

export default router;