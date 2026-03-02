const express = require("express");
const cors = require("cors");
require("dotenv").config();
import supabase from './config/supabaseClient.js';
import courseRoutes from "./routes/courseRoutes.js";


const authRoutes = require("./routes/authRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const testRoutes = require("./routes/testRoutes");

const app = express();
app.get("/test-db", async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Middleware
app.use(cors());
app.use(express.json());


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/assessment", assessmentRoutes);
app.use("/api/test", testRoutes);
app.use("/api/courses", courseRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("LearnFlow API Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

