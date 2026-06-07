import admin from "../firebaseAdmin.js";
import User from "../models/User.js";

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;

    const { uid, email, name, picture } = decoded;
    await User.findOneAndUpdate(
      { uid },
      {
        $setOnInsert: {
          uid,
          email: email || "",
          displayName: name || "",
          photoURL: picture || "",
          role: "user",
        },
        $set: { lastLogin: new Date() },
      },
      { upsert: true }
    );

    next();
  } catch (error) {
    res.status(401).json({
      message: "Invalid Token",
    });
  }
};

export default verifyToken;