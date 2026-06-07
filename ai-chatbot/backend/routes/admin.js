import express from "express";
import User from "../models/User.js";
import Chat from "../models/Chat.js";
import Faculty from "../models/Faculty.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

async function requireAdmin(req, res, next) {
  let user = await User.findOne({ uid: req.user.uid });
  if (!user) {
    return res.status(403).json({ error: "Admin access required — user not registered" });
  }
  if (user.role !== "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount === 0) {
      user.role = "admin";
      await user.save();
      console.log(`Auto-promoted ${user.email} to admin (first admin)`);
    } else {
      return res.status(403).json({ error: "Admin access required" });
    }
  }
  next();
}

router.get("/users", verifyToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/user/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const user = await User.findOneAndUpdate(
      { uid: req.params.id },
      { $set: { role } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/user/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    await User.findOneAndDelete({ uid: req.params.id });
    await Chat.deleteMany({ userId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/chats", verifyToken, requireAdmin, async (req, res) => {
  try {
    const chats = await Chat.find().sort({ updatedAt: -1 });
    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/faculty", verifyToken, requireAdmin, async (req, res) => {
  try {
    const faculties = await Faculty.find().sort({ name: 1 });
    res.json({ success: true, faculties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/faculty/:slug", verifyToken, requireAdmin, async (req, res) => {
  try {
    const faculty = await Faculty.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: req.body },
      { new: true }
    );
    if (!faculty) return res.status(404).json({ error: "Faculty not found" });
    res.json({ success: true, faculty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
