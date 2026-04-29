require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const Groq = require('groq-sdk');
const pptxgen = require('pptxgenjs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

const app = express();
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const CEREBRAS_BASE = 'https://api.cerebras.ai/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const upload = multer({ dest: 'uploads/', limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB

// Max tokens per mode — lesson plan & grading need more room
const MODE_MAX_TOKENS = { 'lesson-plan': 12000, 'grading': 8000, 'ppt': 4096, 'summary': 6000 };
const modeTokens = (mode) => MODE_MAX_TOKENS[mode] || 4096;

// ─── Base Prompts ─────────────────────────────────────────────────────────────
const BASE_PROMPTS = {
  'lesson-plan': `Bạn là trợ lý sư phạm tiếng Anh chuyên nghiệp hỗ trợ giáo viên THCS-THPT Việt Nam.

⚠️ YÊU CẦU BẮT BUỘC:
• Giáo án PHẢI dài ít nhất 800 từ — KHÔNG viết sơ sài
• Bài tập trong PRACTICE: viết ĐẦY ĐỦ 6-8 câu hoàn chỉnh + đáp án ngay bên dưới
• KHÔNG viết "tương tự SGK" hay "xem thêm bài X" — soạn nội dung ngay vào đây
• Nếu thiếu thông tin (lớp, chủ đề, thời lượng) → HỎI LẠI trước khi làm
• CCQ phải là câu Yes/No đơn giản HS có thể trả lời ngay

LUÔN theo cấu trúc 7 mục sau, đúng thứ tự, đủ nội dung:

---
# GIÁO ÁN: [Tên bài học cụ thể]
**Lớp:** ___ | **Thời lượng:** ___ phút | **Trình độ:** ___

## I. MỤC TIÊU (OBJECTIVES)
**Kiến thức:** [2 learning outcome cụ thể — HS nhận biết/sử dụng được gì]
**Kỹ năng:** [kỹ năng nào được luyện: nói/nghe/đọc/viết]
**Thái độ:** [1 câu về ý thức học tập]

## II. CHUẨN BỊ (MATERIALS)
- Giáo viên: [SGK trang..., flashcards, handout...]
- Học sinh: [SGK, vở, bài về nhà cũ...]

## III. KHỞI ĐỘNG (WARM-UP) — 5 phút
**Hoạt động:** [Tên trò chơi/hoạt động CỤ THỂ]
**Tiến hành:**
1. GV: [lời nói/hành động của giáo viên]
2. HS: [học sinh làm gì]
**Dẫn vào bài:** "[Câu GV nói để chuyển sang bài mới]"

## IV. TRÌNH BÀY (PRESENTATION) — 15 phút
**Lead-in:** "[Câu hỏi elicit khai thác kiến thức HS]"

| Thành phần | Nội dung |
|-----------|----------|
| Cấu trúc (Form) | [công thức đầy đủ: S + V + ...] |
| Ý nghĩa (Meaning) | [giải thích tiếng Việt + dịch 3 ví dụ] |
| Cách dùng (Use) | [khi nào dùng, từ tín hiệu] |
| Phát âm | [trọng âm, nếu liên quan] |

**CCQ — Kiểm tra hiểu bài:**
1. [Câu Yes/No kiểm tra ý nghĩa]
2. [Câu Yes/No thứ 2]
3. [Câu Yes/No về cách dùng]

## V. LUYỆN TẬP (PRACTICE) — 15 phút
### Bài 1: [Tên dạng bài — Controlled]
*Yêu cầu: [Hướng dẫn rõ ràng]*
1. ___________________________________
2. ___________________________________
3. ___________________________________
4. ___________________________________
5. ___________________________________
6. ___________________________________
7. ___________________________________
8. ___________________________________
**Đáp án:** 1- ___ 2- ___ 3- ___ 4- ___ 5- ___ 6- ___ 7- ___ 8- ___

### Bài 2: [Tên dạng bài — Less-controlled]
*Yêu cầu: [Hướng dẫn]*
1. ___________________________________
2. ___________________________________
3. ___________________________________
4. ___________________________________
5. ___________________________________
**Đáp án:** 1- ___ 2- ___ 3- ___ 4- ___ 5- ___

## VI. SẢN XUẤT (PRODUCTION) — 7 phút
**Hoạt động:** [Tên hoạt động nói/viết tự do — pair/group work]
**Đầu ra kỳ vọng:** HS tạo ra [mẫu câu hoặc đoạn văn cụ thể]
**Phản hồi:** GV [sửa lỗi on-the-spot / ghi lỗi phổ biến lên bảng]

## VII. TỔNG KẾT & BÀI TẬP VỀ NHÀ — 3 phút
**Tóm tắt:** GV hỏi: "[2-3 câu kiểm tra nhanh kiến thức — gọi HS trả lời]"
**Bài về nhà:** [Bài tập cụ thể — ghi đề bài hoặc trang SGK rõ ràng]
---
Trả lời bằng ngôn ngữ người dùng dùng.`,

  'grading': `Bạn là chuyên gia chấm bài viết tiếng Anh cho giáo viên THCS-THPT Việt Nam.

⚠️ QUY TẮC CHỐNG BỊA ĐẶT — TUYỆT ĐỐI KHÔNG VI PHẠM:
1. CHỈ chấm lỗi TỒN TẠI trong bài gốc — KHÔNG thêm lỗi không có trong bài
2. Trước mỗi lỗi PHẢI trích dẫn câu/cụm từ gốc trong ngoặc kép "..."
3. Đọc bài từ đầu đến cuối, câu đúng → ghi ✓, không bỏ qua
4. Nếu bài có ảnh → gõ lại toàn bộ văn bản (phần "📋 Bài gốc:") trước khi chấm
5. Chữ không đọc được → ghi [không đọc được], KHÔNG đoán hoặc tự điền
6. KHÔNG sáng tạo thêm ý/nội dung không có trong bài gốc

LUÔN dùng cấu trúc sau, đúng thứ tự:

---
## KẾT QUẢ CHẤM BÀI

**Điểm tổng: X/10** — [Nhận xét tổng thể 1-2 câu dựa trên bài thực tế]

### 📊 Bảng điểm thành phần
| Tiêu chí | Điểm | Nhận xét cụ thể |
|----------|------|-----------------|
| Task Achievement | /10 | [nhận xét dựa trên bài] |
| Coherence & Cohesion | /10 | [nhận xét] |
| Lexical Resource | /10 | [nhận xét] |
| Grammatical Accuracy | /10 | [nhận xét] |

### 📝 Bảng lỗi chi tiết
| # | Câu gốc (trích dẫn) | Sửa thành | Loại | Giải thích |
|---|---------------------|-----------|------|------------|
| 1 | "câu/cụm gốc" | "phiên bản đúng" | G | [lý do tiếng Việt] |
*(G=Ngữ pháp · V=Từ vựng · S=Chính tả · P=Dấu câu · C=Mạch lạc)*

### ✅ Điểm mạnh
[2-3 điểm CỤ THỂ — trích dẫn câu/cụm từ tốt, giải thích tại sao tốt]

### ✍️ Câu mẫu cải thiện
[Viết lại 2-3 câu yếu: "Gốc: ... → Sửa: ..."]

### 💡 Gợi ý luyện tập
[3 điểm thực tế, phù hợp trình độ, khuyến khích cụ thể]
━━━ KHI CÓ ẢNH BÀI LÀM (TRẮC NGHIỆM / VIẾT TAY) ━━━
Nếu người dùng gửi ảnh, thực hiện đúng thứ tự:
1. OCR — Đọc và ghi lại CHÍNH XÁC nội dung học sinh đã viết/khoanh (không bịa thêm)
2. Chấm TỪNG CÂU theo mẫu bắt buộc:
   **Câu [n]** — HS chọn/viết: "[X]"
   → ✅ Đúng  HOẶC  ❌ Sai | Đáp án đúng: [Y]
   → Giải thích: [lý do bằng tiếng Việt, trích quy tắc cụ thể]
   → Ôn lại: [tên kiến thức/cấu trúc liên quan]
3. Tổng kết: Điểm X/[tổng câu] + **3 kiến thức yếu nhất** cần ôn thêm
---
Luôn tích cực và khuyến khích học sinh. Trả lời bằng ngôn ngữ người dùng dùng.`,

  'ppt': `Bạn là chuyên gia tạo nội dung PowerPoint cho giáo viên tiếng Anh.
⚠️ BẮT BUỘC: Response PHẢI bắt đầu NGAY bằng \`\`\`json. KHÔNG viết bất kỳ text nào trước JSON.

RÀNG BUỘC JSON — KIỂM TRA TỪNG MỤC TRƯỚC KHI TRẢ LỜI:
• Đúng 8 slides — không nhiều hơn, không ít hơn
• Mỗi bullet: tối đa 12 từ, là nội dung thực chất (KHÔNG phải header như "Ví dụ:" hay "Định nghĩa:")
• Slide content/two-column: 4-6 bullets
• Notes: 2-3 câu GV nói thực tế (KHÔNG phải "Giải thích nội dung slide")
• JSON phải đóng đầy đủ — kiểm tra ] và } cuối cùng trước khi submit
• Cấu trúc gợi ý: 1 title + 2-3 content + 1-2 two-column + 1-2 activity + 1 wrap-up

Format JSON bắt buộc (KHÔNG thêm field khác):
\`\`\`json
{
  "presentation_title": "Tiêu đề bài học cụ thể",
  "slides": [
    {"type":"title","title":"Tiêu đề chính","subtitle":"Lớp / Thời lượng","notes":"Lời chào, nêu mục tiêu bài hôm nay"},
    {"type":"content","title":"Tên slide cụ thể","bullets":["Nội dung thực chất 1","Bullet 2","Bullet 3","Bullet 4"],"notes":"GV nói: [câu dẫn dắt thực tế]"},
    {"type":"two-column","title":"So sánh cụ thể","left":["Cột trái 1","Cột trái 2","Cột trái 3"],"right":["Cột phải 1","Cột phải 2","Cột phải 3"],"notes":"GV hỏi CCQ: [câu hỏi]"},
    {"type":"activity","title":"Tên hoạt động","instruction":"Bước 1: ... Bước 2: ... Bước 3: ...","time":"10 phút","notes":"GV monitor: [cách theo dõi HS]"}
  ]
}
\`\`\`
Sau JSON mới viết giải thích ngắn về cấu trúc bài.`,

  'summary': `Bạn là chuyên gia tổng hợp kiến thức tiếng Anh.
Khi tổng hợp NGỮ PHÁP: Bảng (Cấu trúc | Ý nghĩa | Ví dụ Việt→Anh) + lỗi phổ biến + tips luyện tập.
Khi tổng hợp TỪ VỰNG: Bảng (Từ | Loại từ | Nghĩa | Ví dụ) + collocations + tips cho kỳ thi.
Định dạng đẹp, bảng rõ ràng. Trả lời bằng ngôn ngữ người dùng dùng.`
};

// Skills đặt ĐẦU TIÊN để AI ưu tiên tuân thủ
function buildSystemPrompt(mode, level, skills = [], kbItems = [], memories = [], exams = []) {
  let prompt = '';

  // 0. Persistent Memory — always-on, teacher's permanent profile
  if (memories.length > 0) {
    prompt += `╔══════════════════════════════════════════╗\n║   BỘ NHỚ GIÁO VIÊN — LUÔN GHI NHỚ     ║\n╚══════════════════════════════════════════╝\nĐây là thông tin bền vững về giáo viên, học sinh và phương pháp dạy. Tự động áp dụng không cần nhắc lại:\n\n`;
    memories.forEach((m, i) => {
      prompt += `【${m.title || `Ghi nhớ ${i + 1}`}】\n${m.content}\n\n`;
    });
    prompt += `══════════════════════════════════════════════\n\n`;
  }

  // 1. Skills FIRST - highest priority
  if (skills.length > 0) {
    prompt += `╔══════════════════════════════════════╗
║   HƯỚNG DẪN BẮT BUỘC TỪ GIÁO VIÊN  ║
╚══════════════════════════════════════╝
Bạn PHẢI tuân thủ NGHIÊM NGẶT các hướng dẫn sau trong TOÀN BỘ cuộc trò chuyện:\n\n`;
    skills.forEach((s, i) => {
      prompt += `【${i + 1}】${s.name}:\n${s.prompt}\n\n`;
    });
    prompt += `══════════════════════════════════════════\n\n`;
  }

  // 2. Base mode prompt
  prompt += BASE_PROMPTS[mode] || '';
  prompt += `\n\nTrình độ học sinh: ${level}`;

  // 3. Knowledge Base context
  if (kbItems.length > 0) {
    prompt += '\n\n╔══════════════════════════════════╗\n║      TÀI LIỆU THAM KHẢO         ║\n╚══════════════════════════════════╝\n';
    kbItems.forEach(k => {
      prompt += `\n【${k.title}】\n${k.content.slice(0, 4000)}\n`;
    });
    prompt += '\n══════════════════════════════════\nSử dụng tài liệu trên làm nguồn tham khảo khi trả lời.';
  }

  if (exams.length > 0) {
    prompt += '\n\n╔══════════════════════════════════╗\n║         KHO ĐỀ THAM KHẢO        ║\n╚══════════════════════════════════╝\n';
    prompt += 'Đây là kho đề thi và đáp án của giáo viên. Chỉ sử dụng khi được hỏi về đề hoặc luyện tập từ đề:\n';
    exams.forEach(e => { prompt += `\n【${e.title}】\n${e.content.slice(0, 5000)}\n`; });
    prompt += '\n══════════════════════════════════\n';
  }

  prompt += '\n\n━━━ KIỂM TRA TRƯỚC KHI TRẢ LỜI ━━━\n• Tuân thủ ĐẦY ĐỦ tất cả SKILL rules\n• Kiến thức ngữ pháp/từ vựng PHẢI CHÍNH XÁC — KHÔNG bịa đặt\n• Nếu không chắc → nói rõ "cần xác nhận" thay vì đoán\n• Ưu tiên nội dung trong Knowledge Base và Kho Đề nếu có\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  return prompt;
}

// Groq-specific: ASCII-only format (Llama handles Unicode boxes poorly)
function buildGroqSystemPrompt(mode, level, skills = [], kbItems = [], memories = [], exams = []) {
  let prompt = '';

  // 0. Persistent Memory
  if (memories.length > 0) {
    prompt += `=== BO NHO GIAO VIEN (LUON AP DUNG, KHONG CAN NHAC LAI) ===\n\n`;
    memories.forEach((m, i) => {
      prompt += `[${m.title || `Ghi nho ${i + 1}`}]\n${m.content}\n\n`;
    });
    prompt += `=== KET THUC BO NHO ===\n\n`;
  }

  if (skills.length > 0) {
    prompt += `=== QUY TAC BAT BUOC (PHAI TUAN THU TRONG MOI CAU TRA LOI) ===\n\n`;
    skills.forEach((s, i) => {
      prompt += `[QUY TAC ${i + 1}] ${s.name}:\n${s.prompt}\n\n`;
    });
    prompt += `=== KET THUC QUY TAC - Khong duoc bo qua bat ky quy tac nao ===\n\n`;
  }

  prompt += BASE_PROMPTS[mode] || '';
  prompt += `\n\nTrinh do hoc sinh: ${level}`;

  if (kbItems.length > 0) {
    prompt += '\n\n=== TAI LIEU THAM KHAO ===\n';
    kbItems.forEach(k => {
      prompt += `\n[${k.title}]\n${k.content.slice(0, 4000)}\n`;
    });
    prompt += '\n=== KET THUC TAI LIEU ===\nSu dung tai lieu tren lam nguon tham khao khi tra loi.';
  }

  if (exams.length > 0) {
    prompt += '\n\n=== KHO DE THAM KHAO ===\n';
    exams.forEach(e => { prompt += `\n[${e.title}]\n${e.content.slice(0, 5000)}\n`; });
    prompt += '\n=== KET THUC KHO DE ===\n';
  }

  prompt += '\n\n=== KIEM TRA TRUOC KHI TRA LOI ===\n* Tuan thu DAY DU tat ca skill rules\n* Kien thuc phai CHINH XAC - KHONG bia dat\n* Neu khong chac → noi ro thay vi doan\n* Uu tien noi dung trong KB va Kho De\n=== KET THUC KIEM TRA ===';

  return prompt;
}

// ─── OpenAI-Compatible Helper (Cerebras, OpenRouter) ────────────────────────
async function callOpenAICompat({ baseUrl, apiKey, model, systemPrompt, messages, maxTokens = 8192, extraHeaders = {} }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages
    ] })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err?.error?.message || `HTTP ${res.status}`);
    e.status = res.status; throw e;
  }
  const data = await res.json();
  if (!data.choices?.[0]?.message?.content) {
    // Some models return error even with 2xx status
    const errMsg = data.error?.message || 'Empty response from model';
    const e = new Error(errMsg); e.status = data.error?.code || 500; throw e;
  }
  return data.choices[0].message.content;
}

// ─── OpenRouter Helper (Gemma: merge system→user, no system role) ─────────────
async function callOpenRouter(systemPrompt, message, history = []) {
  const mergedMsg = systemPrompt ? `${systemPrompt}\n\n---\n\n${message}` : message;
  const msgs = [
    ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
    { role: 'user', content: mergedMsg }
  ];
  const orModels = ['google/gemma-3-12b-it:free', 'google/gemma-3-4b-it:free'];
  for (const orm of orModels) {
    try {
      return await callOpenAICompat({
        baseUrl: OPENROUTER_BASE, apiKey: process.env.OPENROUTER_API_KEY,
        model: orm, systemPrompt: '',
        messages: msgs,
        extraHeaders: { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'Odin English Teacher' }
      });
    } catch (e) { if (e.status !== 429 && e.status !== 400 && e.status !== 502 && e.status !== 503) throw e; }
  }
  throw new Error('OpenRouter: Không có model nào phản hồi');
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, mode, level, model, history = [], skills = [], kbItems = [], memories = [], imageData, imagesData = [], exams = [] } = req.body;
  if (!message || !mode || !model) return res.status(400).json({ error: 'Thiếu thông tin' });

  // Normalize images: accept both legacy single imageData and new imagesData array
  const allImages = imagesData.length ? imagesData : (imageData ? [imageData] : []);

  const skillReminder = skills.length > 0
    ? `\n\n[Áp dụng bắt buộc: ${skills.map(s => s.name).join(' · ')}]`
    : '';
  const userMessage = message + skillReminder;
  const maxTokens = modeTokens(mode);
  const systemPrompt = buildSystemPrompt(mode, level, skills, kbItems, memories, exams);

  try {
    let responseText = '';

    if (model === 'groq') {
      const groqModel = allImages.length ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';
      // Build content: text first, then all images
      const userContent = allImages.length
        ? [{ type: 'text', text: userMessage }, ...allImages.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } }))]
        : userMessage;

      const histMsgs = history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content }));
      const primingMsgs = skills.length > 0 ? [
        { role: 'user', content: 'Xác nhận bạn sẽ tuân thủ tất cả quy tắc bắt buộc trong mọi câu trả lời.' },
        { role: 'assistant', content: `Xác nhận. Tôi sẽ tuân thủ nghiêm ngặt: ${skills.map(s => s.name).join(', ')}.` }
      ] : [];

      const response = await groq.chat.completions.create({
        model: groqModel, max_tokens: maxTokens,
        messages: [
          { role: 'system', content: buildGroqSystemPrompt(mode, level, skills, kbItems, memories, exams) },
          ...primingMsgs,
          ...histMsgs,
          { role: 'user', content: userContent }
        ]
      });
      responseText = response.choices[0].message.content;

    } else if (model === 'claude') {
      // Build last user message with images if present
      const lastContent = allImages.length
        ? [
            ...allImages.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } })),
            { type: 'text', text: userMessage }
          ]
        : userMessage;
      const msgs = [
        ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
        { role: 'user', content: lastContent }
      ];
      // Sonnet → Haiku only; Opus removed (too expensive, burns $5 budget instantly)
      const claudeModels = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
      for (const cm of claudeModels) {
        try {
          const r = await anthropic.messages.create({ model: cm, max_tokens: maxTokens, system: systemPrompt, messages: msgs });
          responseText = r.content[0].text; break;
        } catch (e) { if (!e.message.includes('not_found') && !e.message.includes('model')) throw e; }
      }

    } else if (model === 'gemini') {
      // Guard: 6 iPhone photos ≈ 24MB base64 — Gemini inline limit is ~20MB
      const totalImgBytes = allImages.reduce((s, img) => s + img.base64.length, 0);
      if (totalImgBytes > 18 * 1024 * 1024) {
        throw new Error(`Tổng kích thước ảnh quá lớn (${(totalImgBytes/1024/1024).toFixed(1)}MB). Gemini giới hạn ~20MB. Vui lòng gửi tối đa 3-4 ảnh mỗi lần, hoặc chụp ảnh độ phân giải thấp hơn.`);
      }

      const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
      let lastGeminiError = null;
      for (const gm of geminiModels) {
        try {
          const mdl = genAI.getGenerativeModel({ model: gm, systemInstruction: systemPrompt });
          const chat = mdl.startChat({ history: history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })) });
          const parts = [
            ...allImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
            { text: userMessage }
          ];
          const result = await chat.sendMessage(allImages.length ? parts : userMessage);
          responseText = result.response.text();
          if (!responseText) throw new Error('Gemini trả về phản hồi trống (có thể bị filter)');
          break;
        } catch (e) {
          lastGeminiError = e;
          console.error(`[Gemini ${gm}]`, e.message);
          const msg = (e.message || '').toLowerCase();
          // Chỉ retry khi bị rate-limit — các lỗi khác (API key, payload, v.v.) throw ngay
          const isRateLimit = msg.includes('quota') || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('rate');
          if (!isRateLimit) throw e;
        }
      }
      // Nếu tất cả models đều bị rate-limit → throw lỗi thật thay vì "không nhận phản hồi"
      if (!responseText && lastGeminiError) throw lastGeminiError;

    } else if (model === 'cerebras') {
      // PPT mode: llama3.1-8b truncates long JSON → use Gemini (best JSON compliance)
      if (mode === 'ppt') {
        const mdl = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: systemPrompt });
        const chat = mdl.startChat({ history: history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })) });
        const result = await chat.sendMessage(userMessage);
        responseText = result.response.text();
      } else {
        const msgs = [
          ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
          { role: 'user', content: userMessage }
        ];
        responseText = await callOpenAICompat({
          baseUrl: CEREBRAS_BASE,
          apiKey: process.env.CEREBRAS_API_KEY,
          model: 'llama3.1-8b',
          systemPrompt,
          messages: msgs
        });
      }

    } else if (model === 'openrouter') {
      responseText = await callOpenRouter(systemPrompt, userMessage, history);
    }

    if (!responseText) throw new Error('Không nhận được phản hồi từ AI');
    res.json({ response: responseText });
  } catch (error) {
    console.error('AI Error:', error.message);
    // Parse Groq rate-limit into a user-friendly message
    if (error.message?.includes('rate_limit_exceeded') || error.status === 429) {
      const retryMatch = error.message?.match(/Please try again in ([^.]+)\./);
      const retryIn = retryMatch ? retryMatch[1] : 'một lúc';
      return res.status(429).json({ error: `⏳ Groq đã hết quota hôm nay. Vui lòng thử lại sau **${retryIn}** hoặc chuyển sang model khác (Claude / Gemini).` });
    }
    res.status(500).json({ error: error.message });
  }
});

// ─── Groq Quick Query (for dictionary translate + word family) ────────────────
// Falls back to Cerebras automatically if Groq hits rate limit
app.post('/api/groq-query', async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile', max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ result: response.choices[0].message.content });
  } catch (e) {
    // Groq rate-limited → try Cerebras as fallback
    if ((e.status === 429 || e.message?.includes('rate_limit')) && process.env.CEREBRAS_API_KEY) {
      try {
        const result = await callOpenAICompat({
          baseUrl: CEREBRAS_BASE,
          apiKey: process.env.CEREBRAS_API_KEY,
          model: 'llama3.1-8b',
          systemPrompt: '',
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 1024
        });
        return res.json({ result });
      } catch (e2) { return res.status(500).json({ error: e2.message }); }
    }
    res.status(500).json({ error: e.message });
  }
});

// ─── File Upload ──────────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Không có file' });
  try {
    const mime = file.mimetype;
    if (mime.startsWith('image/')) {
      const base64 = fs.readFileSync(file.path).toString('base64');
      fs.unlinkSync(file.path);
      return res.json({ type: 'image', base64, mimeType: mime, name: file.originalname });
    }
    let text = '';
    if (mime === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(fs.readFileSync(file.path));
      text = pdfData.text;
    } else if (mime.includes('wordprocessingml') || file.originalname.endsWith('.docx')) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: file.path });
      text = result.value;
    } else { text = fs.readFileSync(file.path, 'utf-8'); }
    fs.unlinkSync(file.path);
    res.json({ type: 'text', text: text.slice(0, 50000), name: file.originalname, charCount: text.length });
  } catch (err) {
    if (fs.existsSync(file?.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: err.message });
  }
});

// ─── Export PPTX ──────────────────────────────────────────────────────────────
app.post('/api/export/pptx', async (req, res) => {
  const { slides, presentation_title } = req.body;
  if (!slides || !Array.isArray(slides)) return res.status(400).json({ error: 'Thiếu dữ liệu slides' });

  try {
    const prs = new pptxgen();
    prs.layout = 'LAYOUT_16x9';

    // Theme colors
    const C = { accent: '6c63ff', dark: '1a1d2e', white: 'ffffff', light: 'f0f0ff', gray: '9590b8', gold: 'fbbf24', green: '10d9a0' };

    for (const slide of slides) {
      const sl = prs.addSlide();
      sl.background = { color: C.white };

      if (slide.type === 'title') {
        // Top gradient bar
        sl.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 10, h: 2.8, fill: { color: C.dark } });
        sl.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 5.63, fill: { color: C.accent } });
        sl.addText(slide.title || '', { x: 0.4, y: 0.6, w: 9.4, h: 1.4, fontSize: 36, bold: true, color: C.white, align: 'center' });
        if (slide.subtitle) sl.addText(slide.subtitle, { x: 0.4, y: 2.0, w: 9.4, h: 0.6, fontSize: 18, color: C.gray, align: 'center' });
        sl.addShape(prs.ShapeType.rect, { x: 0, y: 2.8, w: 10, h: 2.83, fill: { color: C.white } });
        sl.addShape(prs.ShapeType.rect, { x: 3.5, y: 4.5, w: 3, h: 0.08, fill: { color: C.accent } });

      } else if (slide.type === 'content') {
        sl.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: C.dark } });
        sl.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 5.63, fill: { color: C.accent } });
        sl.addText(slide.title || '', { x: 0.3, y: 0.2, w: 9.5, h: 0.8, fontSize: 24, bold: true, color: C.white });
        if (slide.bullets?.length) {
          const items = slide.bullets.map(b => ({ text: '  ' + b, options: { bullet: { type: 'bullet', characterCode: '25B6', indent: 10 }, paraSpaceAfter: 8 } }));
          sl.addText(items, { x: 0.3, y: 1.4, w: 9.4, h: 3.9, fontSize: 18, color: C.dark, lineSpacingMultiple: 1.4 });
        }

      } else if (slide.type === 'two-column') {
        sl.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: C.dark } });
        sl.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 5.63, fill: { color: C.gold } });
        sl.addText(slide.title || '', { x: 0.3, y: 0.2, w: 9.5, h: 0.8, fontSize: 24, bold: true, color: C.white });
        sl.addShape(prs.ShapeType.roundRect, { x: 0.3, y: 1.35, w: 4.5, h: 4.0, fill: { color: C.light }, line: { color: C.accent, width: 1.5 }, rectRadius: 0.1 });
        sl.addShape(prs.ShapeType.roundRect, { x: 5.2, y: 1.35, w: 4.5, h: 4.0, fill: { color: C.light }, line: { color: C.gold, width: 1.5 }, rectRadius: 0.1 });
        if (slide.left?.length) sl.addText(slide.left.map(t => ({ text: t, options: { bullet: true, paraSpaceAfter: 6 } })), { x: 0.4, y: 1.55, w: 4.3, h: 3.6, fontSize: 15, color: C.dark });
        if (slide.right?.length) sl.addText(slide.right.map(t => ({ text: t, options: { bullet: true, paraSpaceAfter: 6 } })), { x: 5.3, y: 1.55, w: 4.3, h: 3.6, fontSize: 15, color: C.dark });

      } else if (slide.type === 'activity') {
        sl.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: '0d7c59' } });
        sl.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 5.63, fill: { color: C.green } });
        const timeLabel = slide.time ? `  ⏱ ${slide.time}` : '';
        sl.addText((slide.title || '') + timeLabel, { x: 0.3, y: 0.2, w: 9.5, h: 0.8, fontSize: 24, bold: true, color: C.white });
        if (slide.instruction) sl.addText(slide.instruction, { x: 0.5, y: 1.5, w: 9, h: 3.8, fontSize: 18, color: C.dark, lineSpacingMultiple: 1.5 });
      } else {
        // Fallback: generic content slide
        sl.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: C.dark } });
        sl.addText(slide.title || 'Slide', { x: 0.3, y: 0.2, w: 9.5, h: 0.8, fontSize: 24, bold: true, color: C.white });
        const content = slide.bullets?.join('\n') || slide.instruction || slide.subtitle || '';
        if (content) sl.addText(content, { x: 0.5, y: 1.5, w: 9, h: 3.8, fontSize: 16, color: C.dark, lineSpacingMultiple: 1.4 });
      }

      if (slide.notes) sl.addNotes(slide.notes);
    }

    const os = require('os');
    const tmpPath = path.join(os.tmpdir(), `odin_${Date.now()}.pptx`);
    await prs.writeFile({ fileName: tmpPath });
    const buffer = fs.readFileSync(tmpPath);
    try { fs.unlinkSync(tmpPath); } catch {}
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', 'attachment; filename="Odin_Presentation.pptx"');
    res.send(buffer);
    console.log(`✅ PPTX exported: ${presentation_title} (${slides.length} slides)`);
  } catch (err) {
    console.error('PPTX Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Export DOCX ──────────────────────────────────────────────────────────────
app.post('/api/export/docx', async (req, res) => {
  const { content, title = 'Odin_Export' } = req.body;
  try {
    const children = content.split('\n').map(line => {
      if (line.startsWith('# ')) return new Paragraph({ text: line.replace(/^#+\s/, '').replace(/\*\*/g, ''), heading: HeadingLevel.HEADING_1 });
      if (line.startsWith('## ')) return new Paragraph({ text: line.replace(/^#+\s/, '').replace(/\*\*/g, ''), heading: HeadingLevel.HEADING_2 });
      if (line.startsWith('### ')) return new Paragraph({ text: line.replace(/^#+\s/, '').replace(/\*\*/g, ''), heading: HeadingLevel.HEADING_3 });
      if (line.match(/^[-•*] /)) return new Paragraph({ text: line.replace(/^[-•*] /, '').replace(/\*\*/g, ''), bullet: { level: 0 } });
      if (!line.trim()) return new Paragraph({ text: '' });
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return new Paragraph({ children: parts.map((p, i) => new TextRun({ text: p, bold: i % 2 === 1 })) });
    });
    const doc = new Document({ sections: [{ properties: {}, children }] });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title + '.docx')}"`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Dictionary Proxy ─────────────────────────────────────────────────────────
app.get('/api/dictionary/:word', (req, res) => {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(req.params.word)}`;
  https.get(url, response => {
    let data = '';
    response.on('data', c => data += c);
    response.on('end', () => {
      try { res.status(response.statusCode).json(JSON.parse(data)); }
      catch { res.status(500).json({ error: 'Parse error' }); }
    });
  }).on('error', err => res.status(500).json({ error: err.message }));
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ Odin running at http://localhost:${PORT}`));
