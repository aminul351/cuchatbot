// import { google } from '@ai-sdk/google';
// import {
//   streamText,
//   UIMessage,
//   convertToModelMessages,
// } from 'ai';

// import { searchRelevantContext } from '../rag';

// export const maxDuration = 30;

// export async function POST(req: Request) {
//   try {
//     const { messages }: { messages: UIMessage[] } =
//       await req.json();

//     const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
//     const context = lastUserMsg
//       ? await searchRelevantContext(
//           lastUserMsg.parts?.map((p: any) => p.text ?? '').join(' ') ?? ''
//         )
//       : '';

//     const result = streamText({
//       model: google('gemini-2.5-flash'),
//       messages: await convertToModelMessages(messages),
//       temperature: 1,
//       system: `
// Current date: ${new Date().toDateString()}.

// You are the official AI assistant for the
// University of Chittagong (চট্টগ্রাম বিশ্ববিদ্যালয়).

// Official website:
// https://cu.ac.bd

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ${context ? `
// VERIFIED UNIVERSITY DATA (use when relevant):
// ${context}

// - For faculty questions, rely on the data above.
// - NEVER invent names, emails, or positions.
// - If a department isn't listed, say:
//   "I don't have verified data for that department yet.
//   Please check: https://cu.ac.bd/faculty-dept-inst/"
// - For questions this data doesn't cover, use your own knowledge.
// ` : `
// No matching data found for your query. Answer using your own knowledge. If unsure, direct the user to https://cu.ac.bd
// `}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Language:
// - Detect Bengali or English automatically and reply in the same language.

// Tone:
// Warm. Helpful. Professional. Concise.
// `,
//     });

//     return result.toUIMessageStreamResponse({
//       sendSources: true,
//       sendReasoning: true,
//     });

//   } catch (error) {
//     console.error(error);

//     return Response.json(
//       {
//         error: 'Failed to generate response.',
//       },
//       {
//         status: 500,
//       }
//     );
//   }
// }








import { openai } from '@ai-sdk/openai';
import {
  streamText,
  UIMessage,
  convertToModelMessages,
} from 'ai';

import { searchRelevantContext } from '../rag';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } =
      await req.json();

    const lastUserMsg = [...messages].reverse().find(
      (m) => m.role === 'user'
    );

    const context = lastUserMsg
      ? await searchRelevantContext(
          lastUserMsg.parts?.map((p: any) => p.text ?? '').join(' ') ?? ''
        )
      : '';

    const result = streamText({
      model: openai('gpt-4o'),

      messages: await convertToModelMessages(messages),

      temperature: 1,

      system: `
Current date: ${new Date().toDateString()}.

You are the official AI assistant for the
University of Chittagong (চট্টগ্রাম বিশ্ববিদ্যালয়).

Official website:
https://cu.ac.bd

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${
  context
    ? `
VERIFIED UNIVERSITY DATA (use when relevant):
${context}

- For faculty questions, rely on the data above.
- NEVER invent names, emails, or positions.
- If a department isn't listed, say:
  "I don't have verified data for that department yet.
  Please check: https://cu.ac.bd/faculty-dept-inst/"
- For questions this data doesn't cover, use your own knowledge.
`
    : `
No matching data found for your query.
Answer using your own knowledge.
If unsure, direct the user to https://cu.ac.bd
`
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Language:
- Detect Bengali or English automatically and reply in the same language.

Tone:
Warm. Helpful. Professional. Concise.

Math formatting:
- Use $...$ for inline math (e.g. $V_m$, $\alpha$).
- Use $$...$$ for display math/equations on their own line.
- NEVER use plain parentheses ( ) or square brackets [ ] for LaTeX.

Creator info (if anyone asks who made you / who created you / who built you):
- Name: AMINUL ISLAM
- Department: Electrical and Electronic Engineering (EEE)
- Session: 2021-22
- University: University of Chittagong
- LinkedIn: https://www.linkedin.com/in/aminulislam157246/
- GitHub: https://github.com/aminul351
- Portfolio: https://www.aminulislam.study/
- Email: aminul157246@gmail.com
- Phone: +8801761743556
`,
    });

    return result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: true,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: 'Failed to generate response.',
      },
      {
        status: 500,
      }
    );
  }
}