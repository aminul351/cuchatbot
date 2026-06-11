// ─── Faculty Data Index ───────────────────────────────────────────────────────
// Add new department files here as you expand the chatbot.
// Each file exports a single const string with that department's verified data.
// ─────────────────────────────────────────────────────────────────────────────

export { EEE_FACULTY } from './eee';
export { CSE_FACULTY } from './cse';
export { LAW_FACULTY } from './law';
export { ARTS_HUMANITIES_FACULTY } from './arts-humanities';
export { SCIENCE_FACULTY } from './science';  
export { BUSINESS_FACULTY } from './business';
export { BIOLOGICAL_SCIENCES_FACULTY } from './biological-sciences';
export { SOCIAL_SCIENCES_FACULTY } from './social-sciences';
export { EDUCATION_FACULTY } from './education';
export { MARINE_SCIENCES_FACULTY } from './marine-sciences';
export { UNIVERSITY_INFO } from './university-info';
export { UPDATED_NEWS } from './updated_news';
export {ADMISSION_INFO} from './admission';
export {EEE_SYLLABUS} from './eee_syllabus';

// To add a new department:
// 1. Create app/api/chat/faculty/your_dept.ts
// 2. Export YOUR_DEPT_FACULTY from it
// 3. Add: export { YOUR_DEPT_FACULTY } from './your_dept';  ← here
// 4. Add it to ALL_FACULTY in route.ts