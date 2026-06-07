import express from "express";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/save", verifyToken, async (req, res) => {
  try {
    const { title, messages, faculty } = req.body;

    let chat;
    if (req.body.chatId) {
      chat = await Chat.findOne({ _id: req.body.chatId, userId: req.user.uid });
      if (chat) {
        chat.messages = messages || chat.messages;
        chat.title = title || chat.title;
        if (faculty) chat.faculty = faculty;
        await chat.save();
      }
    }

    if (!chat) {
      chat = await Chat.create({
        userId: req.user.uid,
        title: title || "New Chat",
        messages: messages || [],
        faculty: faculty || null,
      });
    }

    await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $inc: { messageCount: (messages || []).filter((m) => m.role === "user").length } }
    );

    res.json({ success: true, chat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/history", verifyToken, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user.uid })
      .select("-messages")
      .sort({ updatedAt: -1 });
    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    res.json({ success: true, chat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await Chat.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
