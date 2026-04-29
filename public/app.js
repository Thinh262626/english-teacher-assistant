// ─── AI Logo (Mechanical Robot — neural circuit aesthetic) ───────────────────
const AI_LOGO_SVG = `<svg width="22" height="22" viewBox="0 0 32 32" fill="none">
  <!-- Left antenna + circuit node at tip -->
  <path d="M10 9L7 3.5L13 8Z" fill="rgba(255,255,255,0.86)"/>
  <circle cx="7" cy="3.5" r="1.4" fill="rgba(255,255,255,0.6)"/>
  <!-- Right antenna + circuit node at tip -->
  <path d="M22 9L25 3.5L19 8Z" fill="rgba(255,255,255,0.86)"/>
  <circle cx="25" cy="3.5" r="1.4" fill="rgba(255,255,255,0.6)"/>
  <!-- Head casing (octagon — robot chassis) -->
  <path d="M10 9L22 9L26.5 13L26.5 24.5L22 28.5L10 28.5L5.5 24.5L5.5 13Z"
        stroke="rgba(255,255,255,0.88)" stroke-width="1.55" fill="none" stroke-linejoin="round"/>
  <!-- Forehead circuit bridge -->
  <path d="M11.5 16L11.5 13L16 11.2L20.5 13L20.5 16"
        stroke="rgba(255,255,255,0.4)" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="16" cy="11.2" r="1.2" fill="rgba(255,255,255,0.52)"/>
  <!-- Left eye: outer ring (camera lens) -->
  <circle cx="11.5" cy="19.5" r="3.3" stroke="rgba(255,255,255,0.92)" stroke-width="1.5" fill="none"/>
  <!-- Left eye: inner iris -->
  <circle cx="11.5" cy="19.5" r="1.7" stroke="rgba(255,255,255,0.36)" stroke-width="1" fill="none"/>
  <!-- Left eye: LED core -->
  <circle cx="11.5" cy="19.5" r="0.8" fill="rgba(255,255,255,0.97)"/>
  <!-- Right eye: outer ring -->
  <circle cx="20.5" cy="19.5" r="3.3" stroke="rgba(255,255,255,0.92)" stroke-width="1.5" fill="none"/>
  <!-- Right eye: inner iris -->
  <circle cx="20.5" cy="19.5" r="1.7" stroke="rgba(255,255,255,0.36)" stroke-width="1" fill="none"/>
  <!-- Right eye: LED core -->
  <circle cx="20.5" cy="19.5" r="0.8" fill="rgba(255,255,255,0.97)"/>
  <!-- Angular beak -->
  <path d="M14.2 24L16 26.8L17.8 24Z" fill="rgba(255,255,255,0.8)"/>
  <!-- Top corner rivets -->
  <circle cx="10.5" cy="10" r="0.9" fill="rgba(255,255,255,0.32)"/>
  <circle cx="21.5" cy="10" r="0.9" fill="rgba(255,255,255,0.32)"/>
</svg>`;

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
  mode: 'lesson-plan', level: 'Ôn thi vào 10', model: 'gemini',
  history: [], sessions: [], currentSession: null,
  isLoading: false, attachedFiles: [],
  skills: [], kbItems: [], kbFileContent: null,
  memories: [], exams: [], examFileContent: null
};
let dictDirection = 'en-vi';

const MODES = {
  'lesson-plan': { icon: '📋', name: 'Soạn Giáo Án', desc: 'Nhập chủ đề + trình độ + thời lượng → AI tạo lesson plan 5 bước hoàn chỉnh.' },
  'grading':     { icon: '✏️', name: 'Chấm Bài', desc: 'Dán bài viết hoặc upload ảnh bài học sinh → AI chấm điểm, sửa lỗi chi tiết.' },
  'ppt':         { icon: '📊', name: 'Làm PPT', desc: 'Nhập chủ đề → AI tạo nội dung slide + xuất file PPTX chuẩn.' },
  'summary':     { icon: '📚', name: 'Tổng Hợp', desc: 'Nhập chủ đề ngữ pháp/từ vựng → AI tổng hợp bảng cấu trúc, ví dụ, lỗi thường gặp.' },
  'dictionary':  { icon: '🔤', name: 'Từ Điển', desc: 'Tra nghĩa, IPA, ví dụ câu và word family.' }
};

const QUICK = {
  'lesson-plan': ['Soạn giáo án: Present Perfect, ôn thi vào 10, 45 phút','Lesson plan: TOEIC Part 5 Verb Tenses, 60 phút','Giáo án: Passive Voice, lớp 10, 45 phút','Soạn giáo án Conditional Sentences, cấp 3'],
  'grading':     ['Chấm bài writing IELTS Task 2 này: [dán bài vào]','Sửa lỗi và chấm bài writing ôn thi vào 10: [dán bài]','Chấm bài TOEIC Writing, nhận xét chi tiết: [dán bài]','Chấm bài paragraph của học sinh cấp 3: [dán bài]'],
  'ppt':         ['Tạo PPT 10 slides: Modal Verbs (Can, Could, May) - cấp 3','PPT ôn tập TOEIC Part 7 Reading strategies, 12 slides','PPT chủ đề Environment - ôn thi vào 10, 10 slides','PPT ngữ pháp: Reported Speech lớp 11, 10 slides'],
  'summary':     ['Tổng hợp Conditional Sentences Types 1, 2, 3','Bảng tổng hợp các thì tiếng Anh - ôn thi vào 10','Tổng hợp từ vựng chủ đề Technology cho TOEIC','Word Formation: Noun/Verb/Adj/Adv suffixes cho TOEIC'],
  'dictionary':  []
};

const DEFAULT_SKILLS = [
  {
    id: 'thinh-teaching-v1',
    name: '🎓 English Teaching Assistant',
    active: true,
    prompt: `Bạn là trợ lý sư phạm Tiếng Anh chuyên nghiệp cho Thầy Thịnh, hỗ trợ giảng dạy THCS-THPT.

PHẠM VI CHUYÊN MÔN:
• Lớp 9: Ôn thi tuyển sinh lớp 10 (format 40 câu trắc nghiệm, trọng tâm Rewrite sentences, Phonetics)
• Lớp 10-11: Chương trình Friends Global, cân bằng 4 kỹ năng, chuẩn bị THPT Quốc gia

━━━ KHI SOẠN GIÁO ÁN ━━━
Cấu trúc 5P chuẩn 45 phút (bắt buộc đủ 6 phần):
I. OBJECTIVES: Knowledge / Skills / Attitude (theo Bloom's Taxonomy)
II. WARM-UP (5'): Game/Quiz kích hoạt kiến thức cũ
III. PRESENTATION (15'): Form + Use + Examples + Giải thích tiếng Việt
IV. PRACTICE (15'): Controlled → Less controlled → Freer exercises
V. PRODUCTION (7'): Hoạt động mở, pair/group work
VI. WRAP-UP & HOMEWORK (3'): Summary + Bài tập về nhà
Điều chỉnh theo cấp: Lớp 9 focus Rewrite + Phonetics; Lớp 10-11 focus 4 kỹ năng + Academic vocab

━━━ KHI RA ĐỀ KIỂM TRA ━━━
Phân hóa: 60% cơ bản – 30% khá – 10% khó
Lớp 9 (40 câu, 60'): PHONETICS (4) | VOCAB & GRAMMAR (12) | READING (8) | WRITING (16: Sentence transformation 12 + Rearrange 4)
Lớp 10-11 (45'): LISTENING (10đ) | READING (20đ) | VOCAB & GRAMMAR (20đ) | WRITING (50đ: Transformation 10đ + Paragraph 120-150 từ 40đ)
BẮT BUỘC: Answer Key chi tiết, giải thích từng câu, distractors dựa trên lỗi phổ biến học sinh VN

━━━ KHI CHẤM BÀI / SỬA WRITING ━━━
Quy trình 4 bước:
1. ĐÁNH GIÁ: Cho điểm + Nêu điểm mạnh trước
2. CHỈ LỖI: Gắn nhãn G(Grammar) / V(Vocab) / S(Spelling) / P(Punctuation) / C(Coherence)
3. HƯỚNG DẪN: Giải thích tại sao sai + Quy tắc đúng bằng tiếng Việt
4. ĐỘNG VIÊN: Khuyến khích cụ thể + Gợi ý luyện tập tiếp theo
Format sửa lỗi: [Lỗi gốc] → [Sửa đúng] + Giải thích + Câu ví dụ đúng

━━━ CHẤT LƯỢNG & GIỚI HẠN ━━━
• Ví dụ/Bài tập: Tiếng Anh | Giải thích: Tiếng Việt rõ ràng, sư phạm
• TUYỆT ĐỐI không bịa đặt từ vựng/quy tắc ngữ pháp sai; nếu không chắc → hỏi lại Thầy
• Độ dài: Giáo án 800-1200 từ; Đề thi 30-40 câu + Key; Chấm bài 200-400 từ
• Thiếu thông tin (lớp mấy? format đề?) → Hỏi rõ trước khi làm

━━━ NGỮ PHÁP TRỌNG TÂM ━━━
Lớp 9: Passive Voice (các thì), Reported Speech (lùi thì + đổi trạng từ: today→that day, tomorrow→next day, yesterday→day before), Conditional Type 2, Relative Clauses, Wish sentences, Structures (It's time / So...that / Such...that / Although-Despite / Because-Because of)
Lớp 10-11 Friends Global: Present Perfect (have/has + V3, dùng với already/never/ever/yet/just/since/for), Past Simple vs PP (Past Simple = có thời gian cụ thể), Tourism vocab (destinations/boarding pass/ecotourism/atmospheric/spectacular), Education/Technology/Environment topics`
  },
  { id: 's1', name: '🇻🇳 Giáo viên Việt Nam', prompt: 'Luôn giải thích bằng tiếng Việt rõ ràng, dùng ví dụ gần gũi với học sinh Việt Nam. Khi cần, so sánh với tiếng Việt để giúp học sinh hiểu sâu hơn.', active: false },
  { id: 's2', name: '📐 Chuẩn BGD', prompt: 'Theo sát chương trình tiếng Anh Bộ GD&ĐT Việt Nam. Ưu tiên dạng bài và cấu trúc thường xuất hiện trong đề thi chính thức.', active: false },
  { id: 's3', name: '💼 TOEIC Expert', prompt: 'Theo chuẩn ETS TOEIC. Tập trung vào business English, các dạng bài Part 1-7, và chiến lược làm bài thi hiệu quả.', active: false }
];

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  loadSkills(); loadKB(); loadMemory(); loadExams(); loadSessions();
  renderSkills(); renderKB(); renderMemory(); renderExams(); renderHistory();
  updateWelcome();
}

// ─── Mode ─────────────────────────────────────────────────────────────────────
function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  document.querySelectorAll('.tab, .mobile-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const isDict = mode === 'dictionary';
  document.getElementById('chatView').classList.toggle('hidden', isDict);
  document.getElementById('dictView').classList.toggle('hidden', !isDict);
  document.getElementById('inputBar').classList.toggle('hidden', isDict);
  document.getElementById('attachZone').style.display = mode === 'grading' ? 'flex' : 'none';
  closeMobileSidebar();
  newChat(true);
  updateWelcome();
  showToast(`Chuyển sang: ${MODES[mode].name}`);
}

function setLevel(val) { state.level = val; }
function setModel(val) { state.model = val; }

// ─── Welcome ──────────────────────────────────────────────────────────────────
function updateWelcome() {
  const m = MODES[state.mode];
  if (!m) return;
  document.getElementById('wIcon').textContent = m.icon;
  document.getElementById('wTitle').textContent = m.name;
  document.getElementById('wDesc').textContent = m.desc;
  const grid = document.getElementById('quickGrid');
  grid.innerHTML = '';
  (QUICK[state.mode] || []).forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'quick-prompt';
    btn.textContent = p;
    btn.onclick = () => { document.getElementById('userInput').value = p.replace('[dán bài vào]','').trim(); document.getElementById('userInput').focus(); };
    grid.appendChild(btn);
  });
}

function showWelcome(show) {
  document.getElementById('welcomeScreen').style.display = show ? 'flex' : 'none';
}

// ─── Skills ───────────────────────────────────────────────────────────────────
function loadSkills() {
  try {
    const saved = JSON.parse(localStorage.getItem('eta_skills') || 'null');
    if (!saved) { state.skills = DEFAULT_SKILLS; return; }
    // Migration: inject new built-in skill if missing
    const primary = DEFAULT_SKILLS[0];
    if (!saved.some(s => s.id === primary.id)) {
      saved.unshift(primary);
      localStorage.setItem('eta_skills', JSON.stringify(saved));
    }
    state.skills = saved;
  } catch { state.skills = DEFAULT_SKILLS; }
}
function saveSkills() { localStorage.setItem('eta_skills', JSON.stringify(state.skills)); }
function renderSkills() {
  const el = document.getElementById('skillsList');
  el.innerHTML = '';
  if (!state.skills.length) { el.innerHTML = '<div class="empty-state">Chưa có skill nào</div>'; return; }
  state.skills.forEach(s => {
    const div = document.createElement('div');
    div.className = 'skill-item';
    div.innerHTML = `<span class="item-name" title="${s.name}">${s.name}</span><button class="toggle ${s.active?'on':''}" onclick="toggleSkill('${s.id}')"></button><button class="item-del" onclick="deleteSkill('${s.id}')">✕</button>`;
    el.appendChild(div);
  });
}
function toggleSkill(id) { const s = state.skills.find(x=>x.id===id); if(s){s.active=!s.active; saveSkills(); renderSkills();} }
function deleteSkill(id) { state.skills = state.skills.filter(x=>x.id!==id); saveSkills(); renderSkills(); }
function openSkillModal() { document.getElementById('skillName').value=''; document.getElementById('skillPrompt').value=''; document.getElementById('skillModal').classList.remove('hidden'); }
function saveSkill() {
  const name = document.getElementById('skillName').value.trim();
  const prompt = document.getElementById('skillPrompt').value.trim();
  if (!name || !prompt) { showToast('⚠️ Điền đủ tên và nội dung skill'); return; }
  state.skills.push({ id: 's'+Date.now(), name, prompt, active: true });
  saveSkills(); renderSkills(); closeModal('skillModal'); showToast('✅ Đã thêm skill');
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────
function loadKB() { try { state.kbItems = JSON.parse(localStorage.getItem('eta_kb') || '[]'); } catch { state.kbItems = []; } }
function saveKB() { localStorage.setItem('eta_kb', JSON.stringify(state.kbItems)); }
function renderKB() {
  const el = document.getElementById('kbList');
  el.innerHTML = '';
  if (!state.kbItems.length) { el.innerHTML = '<div class="empty-state">Chưa có tài liệu</div>'; return; }
  state.kbItems.forEach(k => {
    const div = document.createElement('div');
    div.className = 'kb-item';
    div.innerHTML = `<span class="item-name" title="${k.title}">📄 ${k.title}</span><button class="toggle ${k.active?'on':''}" onclick="toggleKB('${k.id}')"></button><button class="item-del" onclick="deleteKB('${k.id}')">✕</button>`;
    el.appendChild(div);
  });
}
function toggleKB(id) { const k = state.kbItems.find(x=>x.id===id); if(k){k.active=!k.active; saveKB(); renderKB();} }
function deleteKB(id) { state.kbItems = state.kbItems.filter(x=>x.id!==id); saveKB(); renderKB(); }
function openKBModal() { document.getElementById('kbTitle').value=''; document.getElementById('kbContent').value=''; document.getElementById('kbFileStatus').textContent=''; state.kbFileContent=null; document.getElementById('kbModal').classList.remove('hidden'); }
function switchKB(type, btn) {
  document.querySelectorAll('#kbModal .kb-tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  document.getElementById('kbTextArea').classList.toggle('hidden', type==='file');
  document.getElementById('kbFileArea').classList.toggle('hidden', type==='text');
}
async function handleKBFile(input) {
  const file = input.files[0]; if (!file) return;
  const status = document.getElementById('kbFileStatus');
  status.className = 'file-status'; status.textContent = '⏳ Đang đọc file...';
  const fd = new FormData(); fd.append('file', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { status.className='file-status err'; status.textContent='❌ ' + (data.error || 'Lỗi upload'); return; }
    if (data.type === 'text') { state.kbFileContent = { text: data.text, name: data.name }; status.className='file-status ok'; status.textContent=`✅ ${data.name} (${data.text.length} ký tự)`; }
    else { status.className='file-status err'; status.textContent='❌ File không hỗ trợ cho KB'; }
  } catch(e) { status.className='file-status err'; status.textContent='❌ Lỗi: '+e.message; }
}
function saveKBItem() {
  const title = document.getElementById('kbTitle').value.trim();
  const isFile = !document.getElementById('kbFileArea').classList.contains('hidden');
  let content = '';
  if (isFile) { if (!state.kbFileContent) { showToast('⚠️ Chưa upload file'); return; } content = state.kbFileContent.text; }
  else { content = document.getElementById('kbContent').value.trim(); }
  if (!title || !content) { showToast('⚠️ Điền tiêu đề và nội dung'); return; }
  state.kbItems.push({ id: 'k'+Date.now(), title, content, active: true });
  saveKB(); renderKB(); closeModal('kbModal'); showToast('✅ Đã thêm vào Knowledge Base');
}

// ─── Exam Bank ────────────────────────────────────────────────────────────────
function loadExams() { try { state.exams = JSON.parse(localStorage.getItem('eta_exams') || '[]'); } catch { state.exams = []; } }
function saveExams() { localStorage.setItem('eta_exams', JSON.stringify(state.exams)); }
function renderExams() {
  const el = document.getElementById('examList');
  el.innerHTML = '';
  if (!state.exams.length) { el.innerHTML = '<div class="empty-state">Chưa có đề thi</div>'; return; }
  state.exams.forEach(e => {
    const div = document.createElement('div'); div.className = 'kb-item';
    div.innerHTML = `<span class="item-name" title="${e.title}">📝 ${e.title}</span><button class="toggle ${e.active?'on':''}" onclick="toggleExam('${e.id}')"></button><button class="item-del" onclick="deleteExam('${e.id}')">✕</button>`;
    el.appendChild(div);
  });
}
function toggleExam(id) { const e = state.exams.find(x=>x.id===id); if(e){e.active=!e.active; saveExams(); renderExams();} }
function deleteExam(id) { state.exams = state.exams.filter(x=>x.id!==id); saveExams(); renderExams(); }
function openExamModal() {
  document.getElementById('examTitle').value=''; document.getElementById('examContent').value='';
  document.getElementById('examFileStatus').textContent=''; state.examFileContent=null;
  document.getElementById('examModal').classList.remove('hidden');
}
function switchExam(type, btn) {
  document.querySelectorAll('#examModal .kb-tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  document.getElementById('examTextArea').classList.toggle('hidden', type==='file');
  document.getElementById('examFileArea').classList.toggle('hidden', type==='text');
}
async function handleExamFile(input) {
  const file = input.files[0]; if (!file) return;
  const status = document.getElementById('examFileStatus');
  status.className='file-status'; status.textContent='⏳ Đang đọc file...';
  const fd = new FormData(); fd.append('file', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { status.className='file-status err'; status.textContent='❌ '+(data.error||'Lỗi upload'); return; }
    if (data.type==='text') { state.examFileContent={text:data.text,name:data.name}; status.className='file-status ok'; status.textContent=`✅ ${data.name} (${data.text.length} ký tự)`; }
    else { status.className='file-status err'; status.textContent='❌ File không hỗ trợ'; }
  } catch(e) { status.className='file-status err'; status.textContent='❌ Lỗi: '+e.message; }
  input.value='';
}
function saveExamItem() {
  const title = document.getElementById('examTitle').value.trim();
  const isFile = !document.getElementById('examFileArea').classList.contains('hidden');
  const content = isFile ? (state.examFileContent?.text||'') : document.getElementById('examContent').value.trim();
  if (!title || !content) { showToast('⚠️ Điền tiêu đề và nội dung'); return; }
  state.exams.push({ id:'exam'+Date.now(), title, content, active:false });
  saveExams(); renderExams(); closeModal('examModal'); showToast('✅ Đã thêm vào Kho Đề');
}

// ─── Memory (Persistent context injected into every prompt) ──────────────────
function loadMemory() { try { state.memories = JSON.parse(localStorage.getItem('eta_memory') || '[]'); } catch { state.memories = []; } }
function saveMemory() { localStorage.setItem('eta_memory', JSON.stringify(state.memories)); }
function renderMemory() {
  const el = document.getElementById('memoryList'); if (!el) return;
  el.innerHTML = '';
  if (!state.memories.length) { el.innerHTML = '<div class="empty-state">Chưa có ghi nhớ</div>'; return; }
  state.memories.forEach(m => {
    const div = document.createElement('div'); div.className = 'mem-item';
    div.innerHTML = `<span class="mem-dot"></span><span class="item-name" title="${m.content}">${m.title}</span><button class="item-del" onclick="deleteMemory('${m.id}')">✕</button>`;
    el.appendChild(div);
  });
}
function deleteMemory(id) { state.memories = state.memories.filter(m=>m.id!==id); saveMemory(); renderMemory(); showToast('🗑️ Đã xoá ghi nhớ'); }
function openMemoryModal(prefill='', defaultTitle='') {
  document.getElementById('memTitle').value = defaultTitle;
  document.getElementById('memContent').value = prefill;
  document.getElementById('memModal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('memTitle').focus(), 50);
}
function openSaveMemoryModal(aiText) {
  // Strip markdown, keep first 600 chars as suggested content
  const clean = aiText.replace(/```[\s\S]*?```/g,'').replace(/[#*`_~>]/g,'').replace(/\n{3,}/g,'\n\n').trim().slice(0, 600);
  openMemoryModal(clean, '');
}
function saveMemoryItem() {
  const title = document.getElementById('memTitle').value.trim();
  const content = document.getElementById('memContent').value.trim();
  if (!title || !content) { showToast('⚠️ Điền tiêu đề và nội dung'); return; }
  state.memories.push({ id: 'mem'+Date.now(), title, content, createdAt: Date.now() });
  saveMemory(); renderMemory(); closeModal('memModal');
  showToast('🧠 Đã lưu vào Bộ Nhớ!');
}

// ─── File Upload (Grading) — hỗ trợ nhiều ảnh ───────────────────────────────
async function handleFileUpload(input) {
  const files = Array.from(input.files); if (!files.length) return;
  const preview = document.getElementById('attachPreview');
  for (const file of files) {
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showToast('❌ ' + (data.error || 'Lỗi upload')); continue; }
      const fileId = 'f' + Date.now() + Math.random().toString(36).slice(2, 7);
      state.attachedFiles.push({ ...data, id: fileId, name: file.name });
      const chip = document.createElement('div');
      chip.className = 'attach-chip'; chip.dataset.id = fileId;
      chip.innerHTML = `${data.type==='image'?'🖼️':'📄'} ${file.name} <button onclick="removeAttach(this)">✕</button>`;
      preview.appendChild(chip);
      showToast('✅ Đính kèm: ' + file.name);
    } catch(e) { showToast('❌ Lỗi: ' + e.message); }
  }
  input.value = '';
}
function removeAttach(btn) {
  const chip = btn.parentElement;
  state.attachedFiles = state.attachedFiles.filter(f => f.id !== chip.dataset.id);
  chip.remove();
}

// ─── Send Message ─────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('userInput');
  const message = input.value.trim();
  if (!message || state.isLoading) return;
  // Warn when Groq is used for heavy tasks (low token limit may truncate output)
  if (state.model === 'groq' && (state.mode === 'lesson-plan' || state.mode === 'grading')) {
    showToast('💡 Mẹo: Claude hoặc Gemini cho kết quả tốt hơn với tác vụ này');
  }
  showWelcome(false); input.value = ''; autoResize(input);
  appendMessage('user', message);
  state.history.push({ role: 'user', content: message });
  showTyping(); state.isLoading = true;
  document.getElementById('sendBtn').disabled = true;

  const activeSkills = state.skills.filter(s=>s.active).map(s=>({name:s.name,prompt:s.prompt}));
  const activeKB = state.kbItems.filter(k=>k.active).map(k=>({title:k.title,content:k.content}));
  const memories = state.memories.map(m=>({title:m.title,content:m.content}));
  const activeExams = state.exams.filter(e=>e.active).map(e=>({title:e.title,content:e.content}));

  try {
    const body = { message, mode: state.mode, level: state.level, model: state.model, history: state.history.slice(0,-1), skills: activeSkills, kbItems: activeKB, memories, exams: activeExams };
    const images = state.attachedFiles.filter(f => f.type === 'image');
    const textFiles = state.attachedFiles.filter(f => f.type === 'text');
    if (images.length) body.imagesData = images.map(f => ({ base64: f.base64, mimeType: f.mimeType }));
    if (textFiles.length) body.message = message + '\n\n' + textFiles.map(f => `--- ${f.name} ---\n${f.text}`).join('\n\n');

    const res = await fetch('/api/chat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await res.json();
    hideTyping();
    if (!res.ok) throw new Error(data.error || 'Lỗi AI');
    appendMessage('assistant', data.response);
    state.history.push({ role: 'assistant', content: data.response });
    saveCurrentSession(message);
    state.attachedFiles = []; document.getElementById('attachPreview').innerHTML = '';
  } catch(err) {
    hideTyping();
    appendMessage('assistant', `⚠️ **Lỗi**: ${err.message}`);
  }
  state.isLoading = false; document.getElementById('sendBtn').disabled = false; scrollBottom();
}

// ─── Render Messages ──────────────────────────────────────────────────────────
function appendMessage(role, content) {
  const msgs = document.getElementById('messages');
  const wrap = document.createElement('div'); wrap.className = `message ${role}`;
  const av = document.createElement('div'); av.className = 'msg-avatar';
  if (role === 'user') { av.textContent = '👨‍🏫'; }
  else { av.className += ' ai-avatar'; av.innerHTML = AI_LOGO_SVG; }
  const body = document.createElement('div'); body.className = 'msg-body';
  const bubble = document.createElement('div'); bubble.className = 'msg-bubble';
  bubble.innerHTML = role==='assistant' ? marked.parse(content) : escHtml(content);
  // PPT mode: auto-render slide preview below the markdown
  if (role === 'assistant' && state.mode === 'ppt') {
    const pptxData = parsePPTX(content);
    if (pptxData) {
      const preview = document.createElement('div');
      preview.innerHTML = renderPPTPreview(pptxData);
      bubble.appendChild(preview);
    }
  }
  body.appendChild(bubble);
  if (role === 'assistant') {
    const acts = document.createElement('div'); acts.className = 'msg-actions';
    acts.appendChild(mkBtn('📄 PDF','pdf',()=>exportPDF(content,bubble)));
    acts.appendChild(mkBtn('📝 Word','word',()=>exportDOCX(content)));
    // PPT button only in ppt mode
    if (state.mode === 'ppt') {
      acts.appendChild(mkBtn('📊 PPTX','pptx',() => {
        const pptxData = parsePPTX(content);
        if (pptxData) exportPPTX(pptxData);
        else showToast('⚠️ AI chưa tạo JSON. Hãy nhắn: "Tạo lại với đầy đủ JSON format"');
      }));
    }
    acts.appendChild(mkBtn('📋 Copy','copy',(btn)=>copyText(content,btn)));
    acts.appendChild(mkBtn('🧠 Lưu','mem',()=>openSaveMemoryModal(content)));
    body.appendChild(acts);
  }
  wrap.appendChild(av); wrap.appendChild(body); msgs.appendChild(wrap); scrollBottom();
}

function mkBtn(label, cls, fn) {
  const b = document.createElement('button'); b.className = `act-btn ${cls}`; b.textContent = label;
  b.onclick = typeof fn === 'function' ? ()=>fn(b) : fn; return b;
}
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

// ─── Typing ───────────────────────────────────────────────────────────────────
function showTyping() {
  const msgs = document.getElementById('messages');
  const el = document.createElement('div'); el.id='typing'; el.className='typing-indicator';
  el.innerHTML=`<div class="msg-avatar ai-avatar">${AI_LOGO_SVG}</div><div class="typing-dots"><span></span><span></span><span></span></div>`;
  msgs.appendChild(el); scrollBottom();
}
function hideTyping() { const el=document.getElementById('typing'); if(el)el.remove(); }

// ─── Export ───────────────────────────────────────────────────────────────────
function exportPDF(content, bubble) {
  if (typeof html2pdf === 'undefined') { showToast('❌ Thư viện PDF chưa tải xong, thử lại sau'); return; }
  try {
    const el = document.createElement('div');
    el.style.cssText='font-family:Arial,sans-serif;font-size:13px;color:#111;line-height:1.7;padding:20px;max-width:720px;';
    el.innerHTML = bubble.innerHTML;
    el.querySelectorAll('table').forEach(t=>t.style.cssText='border-collapse:collapse;width:100%;');
    el.querySelectorAll('th,td').forEach(c=>c.style.cssText='border:1px solid #ccc;padding:7px 10px;');
    el.querySelectorAll('th').forEach(c=>{c.style.background='#e8f4fd';c.style.fontWeight='bold';});
    html2pdf().set({margin:15,filename:`${getTitle(content)}.pdf`,html2canvas:{scale:2},jsPDF:{format:'a4'}}).from(el).save()
      .then(()=>showToast('✅ Đã xuất PDF!'))
      .catch(e=>showToast('❌ Lỗi PDF: '+e.message));
  } catch(e) { showToast('❌ Lỗi PDF: '+e.message); }
}

async function exportDOCX(content) {
  const title = getTitle(content);
  try {
    showToast('⏳ Đang tạo file Word...');
    const res = await fetch('/api/export/docx', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({content, title}) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Export thất bại');
    window.open(data.url, '_blank');
    showToast('✅ File Word đã tải xuống!');
  } catch(e) { showToast('❌ ' + e.message); }
}

function repairJSON(str) {
  // 1. Remove trailing commas before } or ]
  str = str.replace(/,(\ *[\]}])/g, '$1');
  // 2. Drop the last incomplete slide object if truncated
  // Find the last fully closed slide object before any unclosed one
  const slidesMatch = str.match(/(\{[^{}]*"type"[^{}]*\})/g);
  if (slidesMatch) {
    // Check if the last match is followed by unclosed braces → truncated
    const lastClose = str.lastIndexOf('}');
    const afterLast = str.slice(lastClose + 1).trim();
    if (afterLast && !afterLast.match(/^[,\]\}\s]*$/)) {
      // Truncated: trim to last valid closing brace of a slide
      str = str.slice(0, lastClose + 1);
    }
  }
  // 3. Close any unclosed brackets/braces
  const stack = [];
  let inStr = false, esc = false;
  for (const c of str) {
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') stack.pop();
  }
  return str + stack.reverse().join('');
}

function validatePPTXData(data) {
  if (!data || !Array.isArray(data.slides)) return null;
  // Drop slides missing a title (incomplete/truncated)
  data.slides = data.slides.filter(s => s && typeof s.title === 'string' && s.title.trim());
  if (data.slides.length === 0) return null;
  return data;
}

function parsePPTX(content) {
  const match = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try { return validatePPTXData(JSON.parse(match[1])); }
  catch {
    try { return validatePPTXData(JSON.parse(repairJSON(match[1]))); }
    catch { return null; }
  }
}

// ─── PPT Slide Preview ────────────────────────────────────────────────────────
function renderPPTPreview(data) {
  const icons = { title: '🔷', content: '📄', 'two-column': '📐', activity: '🎯' };
  let html = `<div class="ppt-preview">`;
  html += `<div class="ppt-preview-header">📊 <strong>${escHtml(data.presentation_title || 'Presentation')}</strong> &nbsp;·&nbsp; ${data.slides.length} slides</div>`;
  html += `<div class="ppt-slides-list">`;
  data.slides.forEach((s, i) => {
    const icon = icons[s.type] || '📄';
    html += `<div class="ppt-slide-card">`;
    html += `<div class="ppt-slide-num">${icon} Slide ${i + 1} <span class="ppt-slide-type">${s.type}</span></div>`;
    html += `<div class="ppt-slide-title">${escHtml(s.title || '')}</div>`;
    if (s.subtitle) html += `<div class="ppt-slide-sub">${escHtml(s.subtitle)}</div>`;
    if (s.bullets?.length) {
      html += `<div class="ppt-slide-bullets">${s.bullets.map(b => `<span>▸ ${escHtml(b)}</span>`).join('')}</div>`;
    }
    if (s.left?.length || s.right?.length) {
      html += `<div class="ppt-slide-cols"><div class="ppt-col">${(s.left||[]).map(t=>`<span>▸ ${escHtml(t)}</span>`).join('')}</div><div class="ppt-col">${(s.right||[]).map(t=>`<span>▸ ${escHtml(t)}</span>`).join('')}</div></div>`;
    }
    if (s.instruction) html += `<div class="ppt-slide-inst">${escHtml(s.instruction.slice(0, 120))}${s.instruction.length > 120 ? '…' : ''}</div>`;
    html += `</div>`;
  });
  html += `</div></div>`;
  return html;
}

async function exportPPTX(data) {
  try {
    showToast('⏳ Đang tạo file PPTX...');
    const res = await fetch('/api/export/pptx', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Xuất PPTX thất bại');
    window.open(result.url, '_blank');
    showToast('✅ File PPTX đã tải xuống!');
  } catch(e) { showToast('❌ ' + e.message); }
}

async function copyText(content, btn) {
  await navigator.clipboard.writeText(content);
  const orig = btn.textContent; btn.textContent='✅ Copied!';
  setTimeout(()=>btn.textContent=orig, 2000);
}

function dlBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 300);
}
function getTitle(c) { return (c.split('\n').find(l=>l.trim())||'export').replace(/^#+\s*/,'').replace(/\*\*/g,'').slice(0,50).trim(); }

// ─── Dictionary ───────────────────────────────────────────────────────────────
function toggleDictDir() {
  dictDirection = dictDirection === 'en-vi' ? 'vi-en' : 'en-vi';
  const btn = document.getElementById('dictDirBtn');
  const isEnVi = dictDirection === 'en-vi';
  btn.textContent = isEnVi ? '🇬🇧→🇻🇳 EN→VI' : '🇻🇳→🇬🇧 VI→EN';
  document.getElementById('dictInput').placeholder = isEnVi ? 'Nhập từ tiếng Anh...' : 'Nhập từ tiếng Việt...';
  document.getElementById('dictResult').innerHTML = '';
}

async function searchWord() {
  const word = document.getElementById('dictInput').value.trim();
  if (!word) return;
  const result = document.getElementById('dictResult');
  result.innerHTML = '<div class="dict-empty">⏳ Đang tra từ...</div>';

  if (dictDirection === 'vi-en') {
    try {
      const res = await fetch('/api/groq-query', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ prompt: `Dịch từ/cụm từ tiếng Việt "${word}" sang tiếng Anh.\nTrả về đúng format sau:\nTỪ TIẾNG ANH: [từ 1], [từ 2], [từ 3]\nNGHĨA: [giải thích ngắn]\nVÍ DỤ:\n1. [English sentence] — [nghĩa tiếng Việt]\n2. [English sentence] — [nghĩa tiếng Việt]\n3. [English sentence] — [nghĩa tiếng Việt]` })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi AI');
      renderViEnResult(word, data.result);
    } catch(e) { result.innerHTML = '<div class="dict-error">❌ Lỗi: '+e.message+'</div>'; }
    return;
  }

  try {
    const [dictSettled, viSettled] = await Promise.allSettled([
      fetch(`/api/dictionary/${encodeURIComponent(word)}`),
      fetch('/api/groq-query', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ prompt: `Cho nghĩa tiếng Việt của từ tiếng Anh "${word}". Liệt kê 2-4 nghĩa thông dụng nhất, mỗi nghĩa 1 dòng theo dạng: "(loại từ) nghĩa tiếng Việt". Chỉ trả về danh sách, không thêm lời giải thích.` })
      })
    ]);
    if (dictSettled.status === 'rejected') throw new Error(dictSettled.reason);
    const dictRes = dictSettled.value;
    const data = await dictRes.json();
    if (!dictRes.ok || !Array.isArray(data)) { result.innerHTML='<div class="dict-error">❌ Không tìm thấy từ "'+word+'"</div>'; return; }
    let viMeaning = '';
    if (viSettled.status === 'fulfilled' && viSettled.value.ok) {
      const viData = await viSettled.value.json();
      viMeaning = viData.result || '';
    }
    renderDictResult(data[0], viMeaning);
  } catch(e) { result.innerHTML='<div class="dict-error">❌ Lỗi kết nối: '+e.message+'</div>'; }
}

function renderViEnResult(viWord, text) {
  const result = document.getElementById('dictResult');
  const lines = text.trim().split('\n').filter(l => l.trim());
  let html = `<div class="dict-word-header"><span class="dict-word">🇻🇳 ${escHtml(viWord)}</span></div>`;
  html += `<div class="dict-vi-box"><div class="dict-vi-label">🇬🇧 Bản dịch tiếng Anh</div><div class="dict-vi-text">`;
  lines.forEach(l => {
    const t = l.trim();
    if (t.startsWith('TỪ TIẾNG ANH:')) {
      html += `<div class="dict-vi-line" style="font-weight:600;font-size:16px;color:var(--accent-h)">${escHtml(t)}</div>`;
    } else if (t.match(/^\d\./)) {
      html += `<div class="dict-vi-line" style="padding-left:12px;border-left:2px solid var(--border);color:var(--txt2)">${escHtml(t)}</div>`;
    } else {
      html += `<div class="dict-vi-line">${escHtml(t)}</div>`;
    }
  });
  html += '</div></div>';
  result.innerHTML = html;
}

function renderDictResult(entry, viMeaning = '') {
  const result = document.getElementById('dictResult');
  let html = '<div class="dict-word-header">';
  html += `<span class="dict-word">${entry.word}</span>`;
  const ph = entry.phonetics?.find(p=>p.text);
  if (ph) html += `<span class="dict-phonetic">${ph.text}</span>`;
  const audio = entry.phonetics?.find(p=>p.audio)?.audio;
  if (audio) html += `<button class="audio-btn" onclick="playAudio('${audio}')">🔊 Nghe</button>`;
  html += '</div>';

  // Vietnamese meaning box
  if (viMeaning) {
    const lines = viMeaning.trim().split('\n').filter(l=>l.trim());
    html += `<div class="dict-vi-box"><div class="dict-vi-label">🇻🇳 Nghĩa tiếng Việt</div><div class="dict-vi-text">${lines.map(l=>`<div class="dict-vi-line">${escHtml(l.trim())}</div>`).join('')}</div></div>`;
  }

  (entry.meanings||[]).forEach(m => {
    html += `<div class="dict-pos-block"><div class="dict-pos-label">${m.partOfSpeech}</div>`;
    (m.definitions||[]).slice(0,4).forEach(d => {
      html += `<div class="dict-def-item"><div class="dict-def">${d.definition}</div>`;
      if (d.example) html += `<div class="dict-example">"${d.example}"</div>`;
      html += '</div>';
    });
    html += '</div>';
    const related = [...(m.synonyms||[]).slice(0,5), ...(m.antonyms||[]).slice(0,3)];
    if (related.length) {
      html += '<div class="dict-family"><div class="dict-family-title">Từ liên quan</div><div class="dict-family-grid">';
      related.forEach(w => { html += `<span class="family-chip" onclick="lookupWord('${w}')">${w}</span>`; });
      html += '</div></div>';
    }
  });
  result.innerHTML = html;
}

function playAudio(url) { new Audio(url.startsWith('//') ? 'https:'+url : url).play().catch(()=>showToast('❌ Không phát được âm thanh')); }
function lookupWord(word) { document.getElementById('dictInput').value=word; searchWord(); }

// ─── Sidebar Toggle ───────────────────────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (window.innerWidth <= 768) {
    const isOpen = sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('show', isOpen);
  } else {
    sidebar.classList.toggle('collapsed');
  }
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ─── Sessions / History ───────────────────────────────────────────────────────
function saveCurrentSession(firstMsg) {
  if (!state.currentSession) {
    state.currentSession = { id: Date.now(), mode: state.mode, title: firstMsg.slice(0,48), history: state.history };
    state.sessions.unshift(state.currentSession);
  } else { state.currentSession.history = state.history; }
  localStorage.setItem('eta_sessions', JSON.stringify(state.sessions.slice(0,30)));
  renderHistory();
}
function loadSessions() { try { state.sessions = JSON.parse(localStorage.getItem('eta_sessions')||'[]'); } catch { state.sessions = []; } }
function renderHistory() {
  const el = document.getElementById('historyList');
  el.innerHTML = '';
  if (!state.sessions.length) { el.innerHTML='<div class="empty-state">Chưa có lịch sử</div>'; return; }
  state.sessions.forEach(s => {
    const div = document.createElement('div');
    div.className = `history-item ${state.currentSession?.id===s.id?'active':''}`;
    div.innerHTML = `<span style="flex:1;overflow:hidden;text-overflow:ellipsis">${MODES[s.mode]?.icon||'💬'} ${s.title}</span><span class="item-del" title="Xoá" onclick="event.stopPropagation();deleteSession(${s.id})">✕</span>`;
    div.onclick = () => loadSession(s);
    el.appendChild(div);
  });
}
function deleteSession(id) {
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.currentSession?.id === id) { state.history = []; state.currentSession = null; showWelcome(true); updateWelcome(); document.getElementById('messages').innerHTML = ''; }
  localStorage.setItem('eta_sessions', JSON.stringify(state.sessions));
  renderHistory();
}
function loadSession(s) {
  state.currentSession = s; state.history = s.history; state.mode = s.mode;
  document.querySelectorAll('.tab, .mobile-tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===s.mode));
  closeMobileSidebar();
  document.getElementById('messages').innerHTML = '';
  showWelcome(false);
  const isDict = s.mode==='dictionary';
  document.getElementById('chatView').classList.toggle('hidden',isDict);
  document.getElementById('dictView').classList.toggle('hidden',!isDict);
  document.getElementById('inputBar').classList.toggle('hidden',isDict);
  s.history.forEach(h=>appendMessage(h.role,h.content));
  renderHistory();
}
function newChat(silent=false) {
  state.history = []; state.currentSession = null; state.attachedFiles = [];
  document.getElementById('messages').innerHTML = '';
  document.getElementById('attachPreview').innerHTML = '';
  showWelcome(true); updateWelcome(); renderHistory();
  if (!silent) showToast('✚ Cuộc trò chuyện mới');
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove('show'), 2500);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function handleKeydown(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} }
function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,160)+'px'; }
function scrollBottom() {
  const ca = document.getElementById('messages'); if (!ca) return;
  // Three-pass scroll: handles async markdown render + mobile keyboard animation
  ca.scrollTop = ca.scrollHeight;
  setTimeout(() => { ca.scrollTop = ca.scrollHeight; }, 120);
  setTimeout(() => { ca.scrollTop = ca.scrollHeight; }, 350);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
// Mobile keyboard: when keyboard appears, viewport shrinks → scroll chat to bottom
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const msgs = document.getElementById('messages');
    if (msgs) setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 150);
  });
}
init();
