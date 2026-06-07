import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import dns from "dns";
import Faculty from "../models/Faculty.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACULTY_DIR = path.resolve(__dirname, "../../app/api/faculty");

const FACULTY_FILES = [
  { file: "cse.ts", slug: "cse", name: "Computer Science & Engineering", type: "department" },
  { file: "eee.ts", slug: "eee", name: "Electrical & Electronic Engineering", type: "department" },
  { file: "law.ts", slug: "law", name: "Law", type: "department" },
  { file: "arts-humanities.ts", slug: "arts-humanities", name: "Arts & Humanities", type: "faculty" },
  { file: "science.ts", slug: "science", name: "Science", type: "faculty" },
  { file: "business.ts", slug: "business", name: "Business Administration", type: "faculty" },
  { file: "biological-sciences.ts", slug: "biological-sciences", name: "Biological Sciences", type: "faculty" },
  { file: "social-sciences.ts", slug: "social-sciences", name: "Social Sciences", type: "faculty" },
  { file: "education.ts", slug: "education", name: "Education", type: "faculty" },
  { file: "marine-sciences.ts", slug: "marine-sciences", name: "Marine Sciences & Fisheries", type: "faculty" },
  { file: "university-info.ts", slug: "university-info", name: "University Information", type: "info" },
];

function extractRawText(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/export\s+const\s+\w+\s*=\s*`([\s\S]*?)`;/);
  return match ? match[1].trim() : "";
}

function parseTeachers(text) {
  const teachers = [];
  const lines = text.split("\n");
  let currentCategory = "";

  for (const line of lines) {
    const trimmed = line.trim();
    const catMatch = trimmed.match(/^==\s*(.+?)\s*==$/);
    if (catMatch) {
      currentCategory = catMatch[1].trim();
      continue;
    }

    const teacherMatch = trimmed.match(/^\d+\.\s+(.+?)\s*\|\s*(.+?)(?:\s*\|\s*(.+?))?(?:\s*\|\s*(.+?))?$/);
    if (teacherMatch) {
      const entry = {
        name: teacherMatch[1].trim(),
        designation: teacherMatch[2].trim(),
        email: teacherMatch[3] ? teacherMatch[3].trim() : "",
        room: teacherMatch[4] ? teacherMatch[4].trim() : "",
      };

      if (!currentCategory.toLowerCase().includes("professor") && !currentCategory.toLowerCase().includes("lecturer")) {
        entry.designation = currentCategory.trim();
      }

      teachers.push(entry);
    }
  }

  return teachers;
}

function parseFacultyData(rawText) {
  const lines = rawText.split("\n");

  const headerMatch = rawText.match(/(?:DEPARTMENT|FACULTY|INSTITUTE)\s+OF\s+(.+?)(?:\s*\((\w+)\))?\s*$/m);
  const name = headerMatch ? headerMatch[1].trim() : "";

  const sectionRegex = /━━+(.+?)━━+/gs;
  const sections = [];
  let lastIndex = 0;
  let match;

  while ((match = sectionRegex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      sections.push(rawText.slice(lastIndex, match.index).trim());
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < rawText.length) {
    sections.push(rawText.slice(lastIndex).trim());
  }

  let description = "";
  let vision = "";
  let mission = "";

  for (const section of sections) {
    const upper = section.toUpperCase();
    if (upper.includes("VISION:")) {
      vision = section.replace(/VISION:\s*/i, "").trim();
    } else if (upper.includes("MISSION:")) {
      mission = section.replace(/MISSION:\s*/i, "").trim();
    } else if (upper.includes("OVERVIEW:") || upper.includes("DEPARTMENT OVERVIEW:")) {
      description = section.replace(/DEPARTMENT OVERVIEW:\s*/i, "").replace(/OVERVIEW:\s*/i, "").trim();
    }
  }

  const departments = [];
  const deptRegex = /━━+\s*\n\s*DEPARTMENT\s+OF\s+(.+?)\s*\n\s*━━+/g;
  let deptMatch;
  while ((deptMatch = deptRegex.exec(rawText)) !== null) {
    departments.push(deptMatch[1].trim());
  }

  const teachers = parseTeachers(rawText);

  const facilities = [];
  const facMatch = rawText.match(/FACILITIES\s*\/\s*LABORATORIES:([\s\S]*?)(?:━━+|==|NOTABLE|END OF)/i);
  if (facMatch) {
    const facLines = facMatch[1].split("\n");
    for (const line of facLines) {
      const m = line.match(/^\d+\.\s+(.+)/);
      if (m) facilities.push(m[1].trim());
    }
  }

  const achievements = [];
  const achMatch = rawText.match(/NOTABLE\s+ACHIEVEMENTS:([\s\S]*?)(?:━━+|==|END OF)/i);
  if (achMatch) {
    const achLines = achMatch[1].split("\n");
    for (const line of achLines) {
      const m = line.match(/^\d+\.\s+(.+)/);
      if (m) achievements.push(m[1].trim());
    }
  }

  let statistics = "";
  const statMatch = rawText.match(/DEPARTMENT\s+STATISTICS:([\s\S]*?)(?:━━+|==|VISION|MISSION)/i);
  if (statMatch) {
    statistics = statMatch[1].trim();
  }

  return { name, description, vision, mission, departments, teachers, facilities, achievements, statistics };
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    await Faculty.deleteMany({});
    console.log("Cleared existing faculty data");

    for (const f of FACULTY_FILES) {
      const filePath = path.join(FACULTY_DIR, f.file);
      if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${f.file} - not found`);
        continue;
      }

      const rawText = extractRawText(filePath);
      if (!rawText) {
        console.log(`Skipping ${f.file} - could not extract text`);
        continue;
      }

      const parsed = parseFacultyData(rawText);

      const facultyData = {
        name: f.name,
        slug: f.slug,
        type: f.type,
        description: parsed.description,
        overview: rawText.split("\n").slice(0, 5).join("\n").replace(/[━═]/g, "").trim(),
        vision: parsed.vision,
        mission: parsed.mission,
        statistics: parsed.statistics,
        departments: parsed.departments.length > 0 ? parsed.departments : [f.name],
        courses: [],
        teachers: parsed.teachers,
        facilities: parsed.facilities,
        achievements: parsed.achievements,
        rawData: rawText,
      };

      await Faculty.create(facultyData);
      console.log(`Seeded: ${f.name} (${f.slug}) - ${parsed.teachers.length} teachers`);
    }

    console.log("\nSeeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
