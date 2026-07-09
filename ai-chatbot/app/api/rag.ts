import {
  EEE_FACULTY, CSE_FACULTY, LAW_FACULTY,
  ARTS_HUMANITIES_FACULTY, SCIENCE_FACULTY, BUSINESS_FACULTY,
  BIOLOGICAL_SCIENCES_FACULTY, SOCIAL_SCIENCES_FACULTY,
  EDUCATION_FACULTY, MARINE_SCIENCES_FACULTY,
  UNIVERSITY_INFO, UPDATED_NEWS, ADMISSION_INFO, EEE_SYLLABUS,
} from './faculty';

const DATA_SOURCES: Record<string, string> = {
  'EEE Department': EEE_FACULTY,
  'CSE Department': CSE_FACULTY,
  'Law Department': LAW_FACULTY,
  'Arts & Humanities': ARTS_HUMANITIES_FACULTY,
  'Science Faculty': SCIENCE_FACULTY,
  'Business Faculty': BUSINESS_FACULTY,
  'Biological Sciences': BIOLOGICAL_SCIENCES_FACULTY,
  'Social Sciences': SOCIAL_SCIENCES_FACULTY,
  'Education Faculty': EDUCATION_FACULTY,
  'Marine Sciences': MARINE_SCIENCES_FACULTY,
  'University Info': UNIVERSITY_INFO,
  'News & Notices': UPDATED_NEWS,
  'Admission Info': ADMISSION_INFO,
  'EEE Syllabus': EEE_SYLLABUS,
};

let cachedChunks: { text: string; source: string }[] | null = null;

function chunkText(text: string): string[] {
  const parts = text.split(/\n(?=━|==)/);
  return parts
    .map((p) => p.replace(/[━\s]+/g, ' ').trim())
    .filter((p) => p.length > 80);
}

function buildChunks(): { text: string; source: string }[] {
  if (cachedChunks) return cachedChunks;
  const result: { text: string; source: string }[] = [];
  for (const [source, data] of Object.entries(DATA_SOURCES)) {
    for (const part of chunkText(data)) {
      result.push({ text: part, source });
    }
  }
  cachedChunks = result;
  return result;
}

const BN_EN_MAP: Record<string, string> = {
  'শাটল': 'shuttle', 'ট্রেন': 'train', 'ট্রেনের': 'train',
  'সময়সূচি': 'schedule', 'সময়': 'time', 'সূচি': 'schedule',
  'বিভাগ': 'department', 'অধ্যাপক': 'professor', 'অধ্যাপনা': 'professor',
  'অনুষদ': 'faculty', 'পরীক্ষা': 'exam', 'ভর্তি': 'admission',
  'ফলাফল': 'result', 'নোটিশ': 'notice', 'সংবাদ': 'news',
  'লাইব্রেরি': 'library', 'গ্রন্থাগার': 'library',
  'হল': 'hall', 'ছাত্রাবাস': 'dormitory',
  'উপাচার্য': 'vice chancellor', 'উপ-উপাচার্য': 'pro vice chancellor',
  'রেজিস্ট্রার': 'registrar', 'কোষাধ্যক্ষ': 'treasurer',
  'বৃত্তি': 'scholarship', 'ইমেইল': 'email', 'ফোন': 'phone',
  'ঠিকানা': 'address', 'ওয়েবসাইট': 'website',
  'যোগাযোগ': 'contact', 'সভাপতি': 'president',
  'সহ-সভাপতি': 'vice president', 'সাধারণ সম্পাদক': 'general secretary',
  'শিক্ষক': 'teacher', 'ছাত্র': 'student',
  'পাঠ্যক্রম': 'syllabus', 'ক্রেডিট': 'credit',
};

const ABBREV_MAP: Record<string, string> = {
  'vc': 'vice chancellor',
  'vcs': 'vice chancellors',
  'pro vc': 'pro vice chancellor',
  'pro-vc': 'pro vice chancellor',
};

function expandQuery(text: string): string {
  let expanded = text.toLowerCase();
  for (const [bn, en] of Object.entries(BN_EN_MAP)) {
    if (expanded.includes(bn)) expanded += ' ' + en;
  }
  for (const [abbr, full] of Object.entries(ABBREV_MAP)) {
    if (expanded.includes(abbr)) expanded += ' ' + full;
  }
  return expanded;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, ' ').split(/\s+/).filter(Boolean)
  );
}

const STOPWORDS = new Set([
  'of', 'the', 'a', 'an', 'in', 'at', 'for', 'to', 'is', 'are',
  'was', 'were', 'and', 'or', 'but', 'on', 'with', 'by', 'from',
  'as', 'be', 'has', 'have', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'no', 'not',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
  'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'this',
  'that', 'these', 'those', 'am', 'been', 'being', 'had', 'having',
  'doing', 'about', 'above', 'after', 'all', 'also', 'any', 'because',
  'just', 'more', 'most', 'now', 'only', 'other', 'some', 'such',
  'than', 'then', 'there', 'very', 'what', 'when', 'where', 'which',
  'who', 'how', 'up', 'out', 'into', 'over', 'here', 'there',
]);

function keywordScore(query: string, chunk: string): number {
  const queryTokens = [...tokenize(expandQuery(query))].filter((t) => !STOPWORDS.has(t));
  const chunkTokens = tokenize(chunk);
  let score = 0;

  for (const token of queryTokens) {
    if (chunkTokens.has(token)) score++;
  }

  return score;
}

export async function searchRelevantContext(query: string, topK = 8, maxTotalChars = 3000): Promise<string> {
  const chunks = buildChunks();
  const scored = chunks
    .map((c) => ({ text: c.text, source: c.source, score: keywordScore(query, c.text) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return '';

  const selected: { text: string; source: string }[] = [];
  let total = 0;
  for (const c of scored) {
    if (selected.length >= topK) break;
    const size = c.text.length + c.source.length + 4;
    if (total + size > maxTotalChars && selected.length > 0) break;
    selected.push(c);
    total += size;
  }
  return selected.map((c) => `[${c.source}]\n${c.text}`).join('\n\n');
}
