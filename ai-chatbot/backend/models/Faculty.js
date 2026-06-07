import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    name: String,
    designation: String,
    email: String,
    room: String,
  },
  { _id: false }
);

const facultySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    shortName: String,
    type: {
      type: String,
      enum: ["faculty", "department", "institute", "info"],
      default: "department",
    },
    parentFaculty: String,
    description: String,
    overview: String,
    vision: String,
    mission: String,
    statistics: String,
    departments: [String],
    courses: [String],
    teachers: [teacherSchema],
    facilities: [String],
    achievements: [String],
    contactInfo: String,
    rawData: String,
  },
  { timestamps: true }
);

export default mongoose.model("Faculty", facultySchema);
