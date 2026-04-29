# CLAUDE.md — Odin English Teacher Assistant

## Tổng quan
Trợ lý sư phạm tiếng Anh (Odin) cho giáo viên THCS & THPT Việt Nam. Chủ dự án: **Thịnh** — xưng hô thân thiện, giao tiếp bằng **Tiếng Việt**.

## Cấu trúc dự án

```
english-teacher-assistant/
├── server.js          # Express backend — tất cả API endpoints
├── public/
│   ├── index.html     # UI chính
│   └── app.js         # Frontend logic (state, chat, export, dictionary)
├── uploads/           # Temp files từ multer (tự xoá sau khi xử lý)
├── package.json
└── .env               # API keys (KHÔNG commit)
```

## Tech stack

| Layer | Công nghệ |
|---|---|
| Backend | Node.js, Express.js |
| Frontend | Vanilla JS, HTML5, CSS3 |
| AI models | Groq (Llama 3.3 / Llama 4), Gemini 2.0/1.5, Claude (Sonnet → Opus → Haiku), Cerebras (Llama 3.1), OpenRouter (Gemma) |
| Export | pptxgenjs (PPTX), docx (DOCX) |
| Upload | multer + mammoth (DOCX) + pdf-parse (PDF) |

## API Endpoints (server.js)

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/chat` | Chat chính — nhận `message, mode, level, model, history, skills, kbItems, memories, exams, imageData` |
| POST | `/api/groq-query` | Query nhanh cho từ điển, fallback Cerebras khi Groq rate-limit |
| POST | `/api/upload` | Upload file (PDF/DOCX/ảnh) → trả text hoặc base64 |
| POST | `/api/export/pptx` | Nhận `slides[]` JSON → trả file .pptx |
| POST | `/api/export/docx` | Nhận `content` markdown → trả file .docx |
| GET | `/api/dictionary/:word` | Proxy tới dictionaryapi.dev |

## Modes & System Prompts (BASE_PROMPTS trong server.js)

- **lesson-plan** — Giáo án 7 mục, ≥800 từ, bài tập đầy đủ đáp án
- **grading** — Chấm bài, trích dẫn câu gốc trước mỗi lỗi, bảng điểm thành phần
- **ppt** — JSON 8 slides chuẩn (title/content/two-column/activity), response BẮT ĐẦU ngay bằng ```json
- **summary** — Bảng ngữ pháp/từ vựng + lỗi phổ biến + tips

## Model routing logic (server.js)

- **Groq**: Dùng `llama-3.3-70b-versatile`; nếu có ảnh → `llama-4-scout-17b-16e-instruct`. Thêm priming turn khi có skills.
- **Claude**: Thử lần lượt `claude-sonnet-4-6` → `claude-opus-4-7` → `claude-haiku-4-5-20251001`.
- **Gemini**: Thử `gemini-2.0-flash` → `gemini-1.5-flash`.
- **Cerebras** + mode `ppt`: Redirect sang OpenRouter (Gemma) vì llama3.1-8b cắt ngắn JSON dài.
- **Groq rate-limit (429)**: `/api/groq-query` tự fallback sang Cerebras.

## Quy tắc bắt buộc (STRICT RULES)

1. **Anti-hallucination**: Khi chấm bài — chỉ chỉ lỗi TỒN TẠI trong bài gốc, phải trích dẫn `"câu gốc"` trước mỗi lỗi.
2. **Ngữ pháp**: Chính xác 100%. Không bao giờ dùng "ago" với Present Perfect.
3. **PPT JSON**: Response phải bắt đầu bằng ` ```json ` ngay lập tức, không có text trước.
4. **API Keys**: Không hardcode. Luôn dùng `process.env.XXX_API_KEY`.
5. **Skill injection**: Tên skill được inject vào cuối mỗi user message (`[Áp dụng bắt buộc: ...]`) và vào system prompt.

## UI/UX

- Dark mode: `#1a1d2e` (nền), `#6c63ff` (accent purple/indigo)
- PPTX theme colors: `dark=#1a1d2e`, `accent=#6c63ff`, `gold=#fbbf24`, `green=#10d9a0`
- State frontend (`app.js`): `{ mode, level, model, history, sessions, skills, kbItems, memories, exams, attachedFile }`

## Workflow khi sửa code

- **Luôn đọc file gốc trước** — không viết lại từ đầu khi chỉ cần sửa một phần.
- **Kiểm tra tương thích** `server.js` ↔ `public/app.js` trước khi thay đổi API endpoint hoặc request/response format.
- **Sau thay đổi UI/logic lớn** → nhắc Thịnh chụp screenshot để đối chiếu.

## Khởi động local

```bash
npm run dev     # nodemon server.js — hot reload
# hoặc
npm start       # node server.js
```

Server chạy tại `http://localhost:3000` (mặc định, có thể override bằng `PORT` trong .env).

## Biến môi trường (.env)

```
GROQ_API_KEY=
GEMINI_API_KEY=
CLAUDE_API_KEY=
CEREBRAS_API_KEY=
OPENROUTER_API_KEY=
PORT=3000
```
