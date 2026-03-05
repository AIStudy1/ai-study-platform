import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import supabase from './config/supabaseClient.js';
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("LearnFlow API Running");
});

// Test DB route
app.get("/test-db", async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});
app.get("/test-users", async (req, res) => {
  const { data, error, count } = await supabase
    .from("users")
    .select("*", { count: "exact" })
    .eq("role", "student");
  
  res.json({ data, error, count });
});

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`);
}).on('error', (err) => {
  console.error('Server error:', err);
});

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => process.exit(0));
});