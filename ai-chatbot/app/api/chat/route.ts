import { google } from '@ai-sdk/google';
import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { EEE_FACULTY, CSE_FACULTY, LAW_FACULTY , ARTS_HUMANITIES_FACULTY,SCIENCE_FACULTY , BUSINESS_FACULTY, BIOLOGICAL_SCIENCES_FACULTY,SOCIAL_SCIENCES_FACULTY,EDUCATION_FACULTY , MARINE_SCIENCES_FACULTY, UNIVERSITY_INFO, UPDATED_NEWS, ADMISSION_INFO, EEE_SYLLABUS} from '../faculty';

export const maxDuration = 30;

// ─── Combine all verified faculty data ───────────────────────────────────────
// To add a new department: import its const above, then add it to ALL_FACULTY.
const ALL_FACULTY = [EEE_FACULTY, CSE_FACULTY, LAW_FACULTY,ARTS_HUMANITIES_FACULTY,SCIENCE_FACULTY , BUSINESS_FACULTY, BIOLOGICAL_SCIENCES_FACULTY,SOCIAL_SCIENCES_FACULTY,EDUCATION_FACULTY , MARINE_SCIENCES_FACULTY, UNIVERSITY_INFO, UPDATED_NEWS, ADMISSION_INFO, EEE_SYLLABUS].join('\n');
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google('gemini-3.5-flash'),
    messages: await convertToModelMessages(messages),
    system: `Current date: ${new Date().toDateString()}. You are the official AI assistant for the University of Chittagong (চট্টগ্রাম বিশ্ববিদ্যালয়), cu.ac.bd.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULE — FACULTY DATA:
You have been given the EXACT, VERIFIED faculty list for multiple departments below.
- ALWAYS use ONLY this list when asked about faculty, teachers, or professors.
- NEVER use web search results for faculty names — search results may be outdated or wrong.
- NEVER invent, guess, or hallucinate any faculty member's name or email.
- If asked about a department not in your data, say: "I don't have verified data for that department yet. Please check https://cu.ac.bd/faculty-dept-inst/ directly."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${ALL_FACULTY}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOR ALL OTHER TOPICS (notices, admissions, results, events, etc.):
- Use your search capability to find the latest information from cu.ac.bd.
- Always mention the source when citing information.
- If you cannot find specific info, direct the user to cu.ac.bd or the relevant office.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Language: Detect Bengali or English from the user's message and respond in the same language.
Tone: Warm, helpful, and professional.`,
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}

