import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import User from "../models/User.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dotenv.config();

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/seedAdmin.js <email>");
  process.exit(1);
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const user = await User.findOneAndUpdate(
    { email },
    { $set: { role: "admin" } },
    { new: true }
  );

  if (user) {
    console.log(`User ${user.email} (${user.displayName || "no name"}) is now admin`);
  } else {
    console.log(`No user found with email: ${email}`);
    console.log("First register via the app, then run this script.");
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
