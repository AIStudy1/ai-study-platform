const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/database"); // <--- Import
const authRoutes = require("./routes/authRoutes");
const testRoutes = require("./routes/testRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB(); // <--- Connect

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
