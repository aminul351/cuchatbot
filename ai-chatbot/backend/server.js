import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, ".env") });

const app = express();

const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL || "http://localhost:3000",
  "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
  "https://cuchatbot.netlify.app",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Error:", err));

const PORT = process.env.PORT || 5001;

async function start() {
  const [authRoutes, chatRoutes, facultyRoutes, adminRoutes] = await Promise.all([
    import("./routes/auth.js"),
    import("./routes/chat.js"),
    import("./routes/faculty.js"),
    import("./routes/admin.js"),
  ]);

  app.use("/api/auth", authRoutes.default);
  app.use("/api/chat", chatRoutes.default);
  app.use("/api/faculty", facultyRoutes.default);
  app.use("/api/admin", adminRoutes.default);

  app.get("/", (req, res) => {
    res.send("Hello World!");
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
