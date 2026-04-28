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

// ─── Base Prompts ─────────────────────────────────────────────────────────────
const BASE_PROMPTS = {
  'lesson-plan': `Bạn là trợ lý chuyên nghiệp hỗ trợ giáo viên tiếng Anh tại Việt Nam.
Khi soạn giáo án, LUÔN theo cấu trúc 5 bước có phân bổ thời gian:
1. 🔥 Khởi động (5-10 phút): Hoạt động kích hoạt kiến thức cũ
2. 📖 Trình bày (15-20 phút): Giới thiệu ngữ pháp/kỹ năng mới với ví dụ rõ ràng
3. ✏️ Luyện tập có hướng dẫn (15-20 phút): Bài tập kiểm soát
4. 🎯 Thực hành tự do (10-15 phút): Hoạt động giao tiếp, sáng tạo
5. 🎤 Tổng kết (5 phút): Tóm tắt, nhận xét, bài tập về nhà
Luôn bao gồm: Mục tiêu bài học, học liệu, ghi chú giáo viên, bài tập về nhà.
Định dạng markdown rõ ràng. Trả lời bằng ngôn ngữ người dùng dùng.`,

  'grading': `Bạn là chuyên gia chấm bài viết tiếng Anh.
Khi chấm bài LUÔN theo cấu trúc đầy đủ:
1. **Điểm tổng quát** /10 + nhận xét tổng thể 1-2 câu
2. **Bảng điểm thành phần** (format bảng markdown):
   | Tiêu chí | Điểm | Nhận xét |
   |----------|------|----------|
   | Task Achievement | /10 | ... |
   | Coherence & Cohesion | /10 | ... |
   | Lexical Resource | /10 | ... |
   | Grammar | /10 | ... |
3. **✅ Điểm mạnh** (2-3 điểm cụ thể)
4. **📋 Bảng lỗi chi tiết**:
   | Lỗi gốc | Sửa thành | Giải thích |
   |---------|-----------|------------|
5. **💡 Gợi ý cải thiện** (3-5 điểm thực tế)
6. **✍️ Câu mẫu** (viết lại 2-3 câu yếu thành câu tốt)
Nếu có ảnh bài viết, hãy đọc kỹ từng câu và phân tích cả lỗi chính tả.
Luôn tích cực và khuyến khích học sinh. Trả lời bằng ngôn ngữ người dùng dùng.`,

  'ppt': `Bạn là chuyên gia tạo nội dung PowerPoint cho giáo viên tiếng Anh.
BẮT BUỘC: Luôn bắt đầu response bằng JSON trong code block \`\`\`json, tối thiểu 8 slides.
Format JSON bắt buộc (KHÔNG thêm field khác ngoài những field dưới đây):
\`\`\`json
{
  "presentation_title": "Tiêu đề bài",
  "slides": [
    {"type":"title","title":"Tiêu đề chính","subtitle":"Phụ đề"},
    {"type":"content","title":"Tên slide","bullets":["Điểm 1","Điểm 2","Điểm 3"],"notes":"Ghi chú giáo viên"},
    {"type":"two-column","title":"So sánh","left":["Trái 1","Trái 2"],"right":["Phải 1","Phải 2"],"notes":"Ghi chú"},
    {"type":"activity","title":"Tên hoạt động","instruction":"Hướng dẫn chi tiết","time":"10 phút","notes":"Ghi chú"}
  ]
}
\`\`\`
Sau JSON mới viết giải thích. Style tối giản, sang, sạch.`,

  'summary': `Bạn là chuyên gia tổng hợp kiến thức tiếng Anh.
Khi tổng hợp NGỮ PHÁP: Bảng (Cấu trúc | Ý nghĩa | Ví dụ Việt→Anh) + lỗi phổ biến + tips luyện tập.
Khi tổng hợp TỪ VỰNG: Bảng (Từ | Loại từ | Nghĩa | Ví dụ) + collocations + tips cho kỳ thi.
Định dạng đẹp, bảng rõ ràng. Trả lời bằng ngôn ngữ người dùng dùng.`
};

// Skills đặt ĐẦU TIÊN để AI ưu tiên tuân thủ
function buildSystemPrompt(mode, level, skills = [], kbItems = [], memories = []) {
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

  return prompt;
}

// Groq-specific: ASCII-only format (Llama handles Unicode boxes poorly)
function buildGroqSystemPrompt(mode, level, skills = [], kbItems = [], memories = []) {
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
  const { message, mode, level, model, history = [], skills = [], kbItems = [], memories = [], imageData } = req.body;
  if (!message || !mode || !model) return res.status(400).json({ error: 'Thiếu thông tin' });

  const systemPrompt = buildSystemPrompt(mode, level, skills, kbItems, memories);

  try {
    let responseText = '';

    if (model === 'groq') {
      const groqModel = imageData ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';
      const userContent = imageData
        ? [{ type: 'text', text: message }, { type: 'image_url', image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` } }]
        : message;

      const histMsgs = history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content }));

      // Priming turn: make Llama explicitly commit to skills before answering.
      // Inserted server-side every request so it's never lost across turns.
      const primingMsgs = skills.length > 0 ? [
        { role: 'user', content: 'Xác nhận bạn sẽ tuân thủ tất cả quy tắc bắt buộc trong mọi câu trả lời.' },
        { role: 'assistant', content: `Xác nhận. Tôi sẽ tuân thủ nghiêm ngặt: ${skills.map(s => s.name).join(', ')}.` }
      ] : [];

      const response = await groq.chat.completions.create({
        model: groqModel, max_tokens: 8192,
        messages: [
          { role: 'system', content: buildGroqSystemPrompt(mode, level, skills, kbItems, memories) },
          ...primingMsgs,
          ...histMsgs,
          { role: 'user', content: userContent }
        ]
      });
      responseText = response.choices[0].message.content;

    } else if (model === 'claude') {
      const msgs = [
        ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
        { role: 'user', content: message }
      ];
      const claudeModels = ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'];
      for (const cm of claudeModels) {
        try {
          const r = await anthropic.messages.create({ model: cm, max_tokens: 8192, system: systemPrompt, messages: msgs });
          responseText = r.content[0].text; break;
        } catch (e) { if (!e.message.includes('not_found') && !e.message.includes('model')) throw e; }
      }

    } else if (model === 'gemini') {
      const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash'];
      for (const gm of geminiModels) {
        try {
          const mdl = genAI.getGenerativeModel({ model: gm, systemInstruction: systemPrompt });
          const chat = mdl.startChat({ history: history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })) });
          const result = await chat.sendMessage(message);
          responseText = result.response.text(); break;
        } catch (e) { if (!e.message?.includes('quota') && !e.message?.includes('429') && !e.message?.includes('RESOURCE_EXHAUSTED')) throw e; }
      }

    } else if (model === 'cerebras') {
      // PPT mode: llama3.1-8b truncates long JSON → redirect to OpenRouter (Gemma handles JSON better)
      if (mode === 'ppt') {
        responseText = await callOpenRouter(systemPrompt, message, history);
      } else {
        const msgs = [
          ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
          { role: 'user', content: message }
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
      responseText = await callOpenRouter(systemPrompt, message, history);
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
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: fs.readFileSync(file.path) });
      const result = await parser.getText();
      text = result.text;
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

    const buffer = await prs.write({ outputType: 'nodebuffer' });
    const fname = encodeURIComponent((presentation_title || 'Odin_Presentation') + '.pptx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
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
