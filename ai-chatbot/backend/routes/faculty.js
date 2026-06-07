import express from "express";
import Faculty from "../models/Faculty.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const faculties = await Faculty.find().select("-rawData").sort({ name: 1 });
    res.json({ success: true, faculties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ slug: req.params.slug });
    if (!faculty) return res.status(404).json({ error: "Faculty not found" });
    res.json({ success: true, faculty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:slug", verifyToken, async (req, res) => {
  try {
    const user = await import("../models/User.js").then((m) =>
      m.default.findOne({ uid: req.user.uid })
    );
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

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
