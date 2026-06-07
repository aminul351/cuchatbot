import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      unique: true,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    displayName: String,
    photoURL: String,
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    faculty: {
      type: String,
      default: null,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    lastLogin: Date,
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
