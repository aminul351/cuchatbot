import express from 'express';
import serverless from 'serverless-http';
import mongoose from 'mongoose';
import authRoutes from '../backend/routes/auth.js';
import chatRoutes from '../backend/routes/chat.js';
import facultyRoutes from '../backend/routes/faculty.js';
import adminRoutes from '../backend/routes/admin.js';

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers.host;
    if (origin === `https://${host}` || origin === `http://${host}`) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    }
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
    } catch (err) {
      return res.status(500).json({ error: "Database connection failed" });
    }
  }
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
  res.json({ message: "CU Chatbot API" });
});

export const handler = serverless(app);
