<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Chat setup
- **Route**: `app/api/chat/route.ts` — uses `@ai-sdk/google` with `google('gemini-2.5-flash')`
- **RAG**: `app/api/rag.ts` — keyword-matches faculty data chunks, returns top 8 (≤3000 chars total, ~750 tokens). No API calls.
- **Chunks**: Data split on `━`/`==` lines, min 80 chars. Tokens are lowercased, stripped of non-{a-z,0-9,Bengali}.
- **Scoring**: Count of matched non-stopword query tokens. No bonuses. Skips chunks with score 0.
- **Bengali support**: `bnEnMap` translates ~30 common Bengali university terms to English in the query (e.g. `শাটল` → `shuttle`).
- **System prompt**: Conditional. If context present: "use this data when relevant, for other questions use own knowledge". If empty: "answer using own knowledge".
- **Model**: `gemini-2.5-flash` (stable). Old `gemini-3.5-flash` was deprecated.
- **Keys**: `.env` has `GOOGLE_GENERATIVE_AI_API_KEY` active. Groq/Ollama keys are commented out.
- **Caching**: Built chunks are cached in module scope (`cachedChunks`) — survives HMR, resets on server restart.
- **Known limitation**: `== SECTION ==` lines are treated as separators (same as `━`), so faculty sections like `== PROFESSORS ==` become separate chunks. This is fine — each section stands alone well.
