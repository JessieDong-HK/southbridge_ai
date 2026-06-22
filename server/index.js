const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { marked } = require('marked');

loadLocalEnv();

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');
const CONSULTING_DIR = path.join(ROOT_DIR, '咨询管理');
const STUDENTS_DIR = path.join(CONSULTING_DIR, '学生');
const UPLOADS_DIR = path.join(CONSULTING_DIR, '_uploads');
const TASKS_FILE = path.join(CONSULTING_DIR, '_tasks.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const SYSTEM_DIRS = new Set(['_模板', '话术库', '跟进管理', '_uploads']);
const STAGES = ['添加微信', '筛查', '开会与发评估', '跟进', '已签约', '已流失'];
const IDENTITIES = ['学生家长', '学生本人', '家长学生群聊'];
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-1-20250805';
const AI_BASE_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const AI_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
const AI_STYLE = process.env.CLAUDE_API_STYLE || (AI_BASE_URL.includes('anthropic.com') ? 'anthropic' : 'openai');
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 120000);
const VISION_KEY = process.env.VISION_API_KEY || '';
const VISION_BASE_URL = (process.env.VISION_BASE_URL || '').replace(/\/$/, '');
const VISION_MODEL = process.env.VISION_MODEL || 'qwen-vl-plus';
const VISION_READY = Boolean(VISION_KEY && VISION_BASE_URL);

if (!fs.existsSync(STUDENTS_DIR)) fs.mkdirSync(STUDENTS_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR });
let tasks = readJson(TASKS_FILE, {});
const studentQueues = new Map();

function enqueueStudentTask(student, taskFn) {
  const prev = studentQueues.get(student) || Promise.resolve();
  const next = prev.then(() => taskFn(), () => taskFn());
  studentQueues.set(student, next.catch(() => {}));
  return next;
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    model: DEFAULT_MODEL,
    aiConfigured: Boolean(AI_KEY),
    aiStyle: AI_STYLE,
    students: getStudentNames().length,
  });
});

app.get('/api/ai/models', async (req, res) => {
  try {
    if (!AI_KEY) return res.status(400).json({ error: '未配置 ANTHROPIC_API_KEY' });
    const response = await fetchWithTimeout(`${AI_BASE_URL}/v1/models`, {
      headers: getAuthHeaders(),
    }, 30000);
    const text = await response.text();
    res.status(response.status).type('application/json').send(text);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students', (req, res) => {
  try {
    const students = getStudentNames().map(getStudentCard);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students', (req, res) => {
  try {
    const name = normalizeName(req.body.name);
    if (!name) return res.status(400).json({ error: '学生姓名不能为空' });
    assertSafeName(name);

    const dir = path.join(STUDENTS_DIR, name);
    if (fs.existsSync(dir)) return res.status(409).json({ error: `学生 "${name}" 已存在` });

    createStudentScaffold(name);
    res.json({
      ok: true,
      student: getStudentCard(name),
      message: `已创建学生：${name}`,
      uploadHint: '上传前请先在微信中把对方备注改成「学生姓名 + 关系」，例如「阎浩翔妈妈」。',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/:name', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    assertStudentExists(name);
    const dir = path.join(STUDENTS_DIR, name);
    const files = listMarkdownFiles(dir);
    const summary = readStudentPreferred(name, '学生信息总结.md', '学生档案.md');
    const progress = readStudentPreferred(name, '客户咨询进度.md', '学生档案.md');
    const chat = readStudentFile(name, '微信聊天记录.md') || '';
    const assessment = readStudentFile(name, path.join('评估与建议', '评估与建议.md')) || '';

    res.json({
      ...getStudentCard(name),
      files,
      summary,
      progress,
      chat,
      assessment,
      todos: getTodosForStudent(name),
      meetings: getMeetings().filter((m) => m.student === name),
      progressHtml: marked.parse(stripFrontmatter(progress || '')),
      summaryHtml: marked.parse(stripFrontmatter(summary || '')),
      assessmentHtml: marked.parse(assessment || ''),
    });
  } catch (error) {
    const status = error.code === 'NOT_FOUND' ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.get('/api/files', (req, res) => {
  try {
    const student = String(req.query.student || '');
    const relPath = String(req.query.path || '');
    assertStudentExists(student);
    const full = resolveInside(path.join(STUDENTS_DIR, student), relPath);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return res.status(404).json({ error: '文件不存在' });
    }
    const content = fs.readFileSync(full, 'utf-8');
    res.json({ student, path: relPath, content, html: marked.parse(content) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/board', (req, res) => {
  try {
    const groups = Object.fromEntries(STAGES.map((stage) => [stage, []]));
    for (const name of getStudentNames()) {
      const card = getStudentCard(name);
      const stage = STAGES.includes(card.stage) ? card.stage : '添加微信';
      groups[stage].push(card);
    }
    res.json({ stages: STAGES, groups });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/todos', (req, res) => {
  try {
    res.json(getTodos());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/meetings', (req, res) => {
  try {
    res.json(getMeetings());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks', (req, res) => {
  res.json(Object.values(tasks).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.get('/api/tasks/:id', (req, res) => {
  const task = tasks[req.params.id];
  if (!task) return res.status(404).json({ error: '任务不存在' });
  res.json(task);
});

app.post('/api/upload-chat', upload.array('screenshots', 4), (req, res) => {
  try {
    const student = String(req.body.student || '');
    const identity = String(req.body.identity || '');
    assertStudentExists(student);
    if (!IDENTITIES.includes(identity)) return res.status(400).json({ error: '请选择有效身份' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: '未上传截图' });

    const task = createTask('chat', student, `处理 ${req.files.length} 张微信截图`);
    const screenshotDir = path.join(UPLOADS_DIR, sanitizeFilePart(student), task.id);
    fs.mkdirSync(screenshotDir, { recursive: true });
    const saved = [];
    for (const [index, file] of req.files.entries()) {
      const dest = path.join(screenshotDir, `${String(index + 1).padStart(2, '0')}-${sanitizeFilePart(file.originalname || file.filename)}`);
      fs.renameSync(file.path, dest);
      saved.push(dest);
    }

    enqueueStudentTask(student, () => processChatUpload(task.id, student, identity, saved)).catch((error) => failTask(task.id, error));
    res.json({ ok: true, taskId: task.id, hint: '聊天截图已保存，Claude 正在后台识别和更新档案' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload-transcript', upload.single('transcript'), (req, res) => {
  try {
    const student = String(req.body.student || '');
    const meetingNumber = String(req.body.meetingNumber || '').trim() || null;
    const attendees = normalizeAttendees(req.body.attendees);
    assertStudentExists(student);
    if (attendees.length === 0) return res.status(400).json({ error: '请选择参会人' });
    if (!req.file) return res.status(400).json({ error: '未上传逐字稿文件' });

    const taskLabel = meetingNumber ? `处理第 ${meetingNumber} 场会议逐字稿` : '处理会议逐字稿';
    const task = createTask('transcript', student, taskLabel);
    enqueueStudentTask(student, () => processTranscriptUpload(task.id, student, meetingNumber, attendees, req.file.path)).catch((error) => failTask(task.id, error));
    res.json({ ok: true, taskId: task.id, hint: '逐字稿已接收，原始 TXT 将清洗为 Markdown 后删除' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/trigger-assessment', (req, res) => {
  try {
    const student = String(req.body.student || '');
    assertStudentExists(student);
    const task = createTask('assessment', student, '生成评估与建议（仅客服查看）');
    enqueueStudentTask(student, () => processAssessment(task.id, student)).catch((error) => failTask(task.id, error));
    res.json({ ok: true, taskId: task.id, hint: 'Claude 正在生成评估与建议，仅在客服工作台展示' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/dev/scaffold-missing', (req, res) => {
  try {
    const result = [];
    for (const name of getStudentNames()) {
      result.push({ name, created: ensureStudentScaffold(name, false) });
    }
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: '消息不能为空' });
    if (!AI_KEY) return res.status(400).json({ error: '未配置 AI 接口，无法使用聊天功能' });

    const history = Array.isArray(req.body.history) ? req.body.history.slice(-20) : [];
    const context = buildChatContext();
    const systemPrompt = [
      '你是南桥教育（SouthBridge Consulting）客服工作台的 AI 助手。',
      '你可以查阅以下数据库内容来回答客服的问题：学生档案、咨询进度、待办清单、会议安排。',
      '',
      '规则：',
      '1. 回答简洁、结构化，用中文。涉及具体学生时引用姓名。',
      '2. 如果数据库中没有相关信息，如实告知，不要编造。',
      '3. 绝对禁止：修改任何文件、调整学生状态、删除数据、写文件。你只能读取信息。',
      '4. 如果客服要求你修改数据（例如"把学生A改为已签约"），礼貌拒绝并告知：',
      '   "我无法修改系统数据。如需更新学生状态，请通过界面上传聊天记录或逐字稿，系统会自动更新。"',
      '5. 如果客服问"你能做什么"，列出你可以回答的问题类型：学生概况、进度查询、待办提醒、会议安排、数据统计、学生对比。',
      '',
      '当前数据库内容：',
      context,
    ].join('\n');

    const messages = [
      { role: 'user', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];
    const prompt = messages.map((m) => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`).join('\n\n');

    const reply = await callClaudeText(prompt);
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`SouthBridge v2 MVP running on http://localhost:${PORT}`);
  console.log(`Data directory: ${CONSULTING_DIR}`);
  console.log(`Students: ${getStudentNames().length}`);
});

function buildChatContext() {
  const students = getStudentNames().map(getStudentCard);
  const stages = {};
  for (const s of students) {
    stages[s.stage] = (stages[s.stage] || 0) + 1;
  }

  let ctx = '';
  ctx += `## 系统概览\n学生总数：${students.length}\n`;
  for (const [stage, count] of Object.entries(stages)) {
    ctx += `- ${stage}：${count} 人\n`;
  }

  ctx += '\n## 学生详情\n';
  for (const s of students) {
    const summary = readStudentPreferred(s.name, '学生信息总结.md', '学生档案.md') || '';
    const preview = summary.replace(/^#.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 400);
    const assessment = readStudentFile(s.name, '评估与建议/评估与建议.md') || '';
    ctx += `### ${s.name}\n`;
    ctx += `阶段：${s.stage} | 更新：${s.updated} | 聊天记录：${s.hasChat ? '已上传' : '待上传'} | 评估：${s.hasAssessment ? '已生成' : '未生成'} | 文件数：${s.fileCount}\n`;
    if (preview) ctx += `信息摘要：${preview}\n`;
    if (assessment) ctx += `评估节选：${assessment.trim().slice(0, 500)}\n`;
    ctx += '\n';
  }

  const todos = getTodos();
  if (todos.length) {
    ctx += '## 全局待办清单\n';
    for (const t of todos.slice(0, 20)) {
      ctx += `- [${t.done ? 'x' : ' '}] ${t.student || '全局'}：${t.text}\n`;
    }
    ctx += '\n';
  }

  const meetings = getMeetings();
  if (meetings.length) {
    ctx += '## 会议安排\n';
    for (const m of meetings.slice(0, 15)) {
      ctx += `| ${m.time} | ${m.student} | ${m.attendees} | ${m.status} |\n`;
    }
    ctx += '\n';
  }

  const checklist = readGlobalFile('学生筛选检查清单.md');
  if (checklist) {
    ctx += `## 筛查清单（参考）\n${checklist.trim().slice(0, 600)}\n`;
  }

  return ctx;
}

async function processChatUpload(taskId, student, identity, imagePaths) {
  ensureStudentScaffold(student, false);

  // ── Step 1: OCR raw extraction ──
  updateTask(taskId, 'running', 'Step 1/2: 通义千问 OCR 逐字提取截图文字');
  const ocrRaw = await callVision([
    '请逐张读取微信聊天截图中的所有文字，并按气泡颜色区分说话人。',
    '',
    '识别方法：',
    '- 微信聊天截图右侧的绿色气泡 = 己方发送的消息，标记为"南桥"',
    '- 微信聊天截图左侧的白色气泡 = 对方发送的消息，标记为对方的微信备注名或昵称',
    '- 每条消息的格式：说话人：消息内容',
    '',
    '其他要求：',
    '- 按照截图顺序，将能看到的文字全部逐行输出',
    '- 保留截图中的日期标签和时间',
    '- 不要输出微信界面固定文字（如头像里的品牌名、状态栏、底部菜单栏等 UI 装饰）',
  ].join('\n'), imagePaths);

  // Save raw OCR output for debugging
  const ocrTimestamp = Date.now();
  const ocrPath = path.join(STUDENTS_DIR, student, `微信聊天记录-OCR-${ocrTimestamp}.txt`);
  fs.writeFileSync(ocrPath, [
    `# OCR 原始输出 · ${student} · ${identity}`,
    `> 上传时间：${currentDateTime()}`,
    `> 截图数量：${imagePaths.length}`,
    '',
    ocrRaw,
  ].join('\n'), 'utf-8');

  // ── Step 2: Structure raw OCR into chat messages ──
  updateTask(taskId, 'running', 'Step 2/2: DeepSeek 将原始 OCR 整理为结构化聊天记录');
  const step2Prompt = [
    '你是一个微信聊天记录整理助手。以下是 OCR 从微信截图中提取的原始文字，比较碎片化。',
    '请把它整理成完整的聊天消息列表。输出纯 JSON（不要 Markdown 代码块，不要 ``` 包裹）：',
    '',
    '{"messages":[{"speaker":"说话人（昵称或备注名）","content":"完整消息内容","datetime":"YYYY-MM-DD HH:MM"}]}',
    '',
    '规则：',
    '- 截图中日期如 "6/9" 应转为 "2026-06-09"，时间如 "17:46" 保持 24 小时制',
    '- 根据上下文合并碎片化的多行文字为完整消息。例如 OCR 把一条长消息拆成了多行，你要合并回一条',
    '- 判断说话人：备注名/昵称是对方（学生家长或学生本人），"南桥""南桥|上纽昆杜工作室"是己方',
    '- 系统消息（如"你已添加了xxx"）也作为一条消息',
    '- 按时间顺序排列',
    '',
    'OCR 原始输出：',
    ocrRaw,
  ].join('\n');
  let step2Raw = '';
  let messages = [];
  try {
    step2Raw = await callClaudeText(step2Prompt);
  } catch (e) {
    step2Raw = `API 调用失败: ${e.message}`;
  }
  // Save Step 2 raw output for debugging
  const step2Path = path.join(STUDENTS_DIR, student, `微信聊天记录-Step2-${ocrTimestamp}.txt`);
  fs.writeFileSync(step2Path, `字数：${step2Raw.length}\n---\n${step2Raw}`, 'utf-8');

  if (step2Raw && step2Raw.length > 10 && !step2Raw.startsWith('API 调用失败')) {
    try {
      const structured = parseJsonFromText(step2Raw);
      messages = Array.isArray(structured.messages) ? structured.messages : [];
    } catch (e) {
      updateTask(taskId, 'running', `JSON 解析失败（${e.message.slice(0,50)}），使用原始 OCR 降级处理`);
    }
  }
  // Fallback: if no messages parsed, log error but don't dump raw data
  if (messages.length === 0 && ocrRaw.trim()) {
    messages = [{ datetime: currentDateTime(), speaker: '系统', content: `⚠️ 本次上传的截图未能自动整理为结构化消息。请重新上传，或检查截图是否清晰。` }];
    updateTask(taskId, 'failed', 'Step 2 未能解析出有效消息，原始 OCR 已保存至 txt 文件');
    return;
  }
  updateTask(taskId, 'running', `整理出 ${messages.length} 条消息，正在写入聊天记录`);
  const added = appendChatMessages(student, identity, messages);

  // ── Step 3: Update AI docs ──
  updateTask(taskId, 'running', '正在更新学生总结、进度、待办和会议安排');
  const chat = readStudentFile(student, '微信聊天记录.md') || '';
  const analysis = await analyzeStudentMaterial(student, `最新微信聊天记录：\n${chat}`, 'chat');
  applyStudentAnalysis(student, analysis);

  completeTask(taskId, `聊天处理完成，新增 ${added} 条消息（OCR 原始输出已保存）`);
}

async function processTranscriptUpload(taskId, student, num, attendees, tmpPath) {
  updateTask(taskId, 'running', '正在清洗逐字稿');
  ensureStudentScaffold(student, false);
  const meetingNum = num || String(getExistingMeetingCount(student) + 1);
  const raw = fs.readFileSync(tmpPath, 'utf-8');
  const cleaned = cleanTranscript(raw);
  const today = currentDate();
  const filename = `${today}-第${meetingNum}场.md`;
  const transcriptPath = path.join(STUDENTS_DIR, student, '会议逐字稿', filename);
  fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });
  fs.writeFileSync(transcriptPath, [
    `# ${student} · 第${meetingNum}场会议逐字稿`,
    `> 日期：${today}`,
    `> 参会人：${attendees.join(', ')}`,
    '',
    cleaned,
    '',
  ].join('\n'), 'utf-8');
  fs.unlinkSync(tmpPath);

  updateTask(taskId, 'running', '正在生成会议总结并更新档案');
  const prompt = [
    `学生：${student}`,
    `场次：第${meetingNum}场`,
    `参会人：${attendees.join(', ')}`,
    '以下是清洗后的会议逐字稿：',
    cleaned,
  ].join('\n');
  const analysis = await analyzeStudentMaterial(student, prompt, 'transcript');
  applyStudentAnalysis(student, analysis);

  if (analysis.internalMeetingSummary) {
    fs.writeFileSync(
      path.join(STUDENTS_DIR, student, '会议逐字稿', `第${meetingNum}场-会议总结.md`),
      analysis.internalMeetingSummary,
      'utf-8'
    );
  }
  if (analysis.customerVisibleMeetingSummary) {
    fs.writeFileSync(
      path.join(STUDENTS_DIR, student, '会议逐字稿', `第${meetingNum}场-会议总结-客服查看.md`),
      analysis.customerVisibleMeetingSummary,
      'utf-8'
    );
  }

  completeTask(taskId, `第 ${meetingNum} 场会议处理完成`);
}

async function processAssessment(taskId, student) {
  updateTask(taskId, 'running', '正在读取会议资料');
  ensureStudentScaffold(student, false);
  const dir = path.join(STUDENTS_DIR, student);
  const transcriptDir = path.join(dir, '会议逐字稿');
  let material = '';
  if (fs.existsSync(transcriptDir)) {
    for (const file of fs.readdirSync(transcriptDir).filter((f) => f.endsWith('.md')).sort()) {
      material += `\n\n===== ${file} =====\n${fs.readFileSync(path.join(transcriptDir, file), 'utf-8')}`;
    }
  }
  if (!material.trim()) throw new Error('没有找到会议资料，请先上传逐字稿');

  updateTask(taskId, 'running', '正在生成评估与建议');
  const summary = readStudentPreferred(student, '学生信息总结.md', '学生档案.md') || '';
  const prompt = [
    '你是南桥教育的资深升学顾问。请生成一份仅供客服查看的评估与建议文档，不要写成直接发送给家长的口吻。',
    `学生：${student}`,
    '学生信息：',
    summary,
    '会议资料：',
    material,
    '输出 Markdown，结构必须包含：学生画像速览、匹配度分析（上纽/昆杜）、申请时间线、需要突破的方向、推荐方案、下一步客服动作。',
  ].join('\n');
  const content = await callClaudeText(prompt);
  const assessmentPath = path.join(STUDENTS_DIR, student, '评估与建议', '评估与建议.md');
  fs.mkdirSync(path.dirname(assessmentPath), { recursive: true });
  fs.writeFileSync(assessmentPath, content.trim(), 'utf-8');
  markAssessmentGenerated(student);
  completeTask(taskId, '评估与建议已生成');
}

async function analyzeStudentMaterial(student, material, source) {
  const summary = readStudentPreferred(student, '学生信息总结.md', '学生档案.md') || '';
  const progress = readStudentFile(student, '客户咨询进度.md') || '';
  const todos = readGlobalFile('待办清单.md') || '# 待办清单\n';
  const meetings = readGlobalFile('会议安排.md') || '# 会议安排\n\n| 时间 | 学生 | 参会人 | 状态 |\n|------|------|--------|------|\n';
  const prompt = [
    '你是南桥教育客服工作台的资料更新助手。所有输出只供客服内部查看，不直接触达家长。',
    `学生：${student}`,
    `资料来源：${source}`,
    '现有学生信息总结/旧档案：',
    summary,
    '现有客户咨询进度：',
    progress,
    '现有全局待办：',
    todos,
    '现有会议安排：',
    meetings,
    '本次新资料：',
    material,
    '请输出 JSON，不要包裹 Markdown 代码块。字段：',
    '{',
    ' "studentSummary": "更新后的完整学生信息总结 Markdown",',
    ' "progress": "更新后的完整客户咨询进度 Markdown，frontmatter 含 stage 和 updated",',
    ' "todos": "更新后的完整待办清单 Markdown",',
    ' "meetings": "更新后的完整会议安排 Markdown 表格",',
    ' "internalMeetingSummary": "如资料是会议，生成内部会议总结 Markdown；否则为空",',
    ' "customerVisibleMeetingSummary": "如资料是会议，生成客服可查看的简明总结 Markdown；否则为空"',
    '}',
    '阶段只能是：添加微信、筛查、开会与发评估、跟进、已签约、已流失。未回复不能判为已流失。',
  ].join('\n');
  return callClaudeJson(prompt);
}

function applyStudentAnalysis(student, analysis) {
  if (analysis.studentSummary) writeStudentFile(student, '学生信息总结.md', analysis.studentSummary);
  if (analysis.progress) writeStudentFile(student, '客户咨询进度.md', analysis.progress);
  if (analysis.todos) writeGlobalFile('待办清单.md', analysis.todos);
  if (analysis.meetings) writeGlobalFile('会议安排.md', analysis.meetings);
}

async function callClaudeText(prompt, imageParts = []) {
  if (!AI_KEY) throw new Error('未配置 ANTHROPIC_API_KEY');
  if (AI_STYLE === 'anthropic') return callAnthropicMessages(prompt, imageParts);
  return callOpenAiCompatible(prompt, imageParts);
}

async function callClaudeJson(prompt, imageParts = []) {
  const text = await callClaudeText(`${prompt}\n\n只输出可解析 JSON。`, imageParts);
  return parseJsonFromText(text);
}

async function callAnthropicMessages(prompt, imageParts = []) {
  const response = await fetchWithTimeout(`${AI_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'content-type': 'application/json',
      'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 4096),
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...imageParts] }],
    }),
  }, AI_TIMEOUT_MS);
  const payload = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok) throw new Error(payload.error?.message || JSON.stringify(payload));
  return payload.content?.map((part) => part.text || '').join('\n').trim() || '';
}

async function callOpenAiCompatible(prompt, imageParts = []) {
  const content = [{ type: 'text', text: prompt }];
  for (const part of imageParts) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
    });
  }
  const response = await fetchWithTimeout(`${AI_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0.2,
    }),
  }, AI_TIMEOUT_MS);
  const payload = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok) throw new Error(payload.error?.message || JSON.stringify(payload));
  const raw = payload.choices?.[0]?.message?.content ?? payload.output_text ?? payload.output?.text ?? payload.output ?? '';
  return normalizeAssistantText(raw);
}

async function callVision(prompt, imagePaths) {
  if (!VISION_READY) throw new Error('未配置 Vision API');
  const content = [{ type: 'text', text: prompt }];
  for (const filePath of imagePaths) {
    const ext = path.extname(filePath).toLowerCase();
    const mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const data = fs.readFileSync(filePath).toString('base64');
    content.push({ type: 'image_url', image_url: { url: `data:${mediaType};base64,${data}` } });
  }
  const response = await fetchWithTimeout(`${VISION_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${VISION_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: VISION_MODEL, messages: [{ role: 'user', content }], temperature: 0.1 }),
  }, 120000);
  const payload = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok) throw new Error(payload.error?.message || JSON.stringify(payload));
  let raw = payload.choices?.[0]?.message?.content ?? payload.output?.text ?? payload.output ?? '';
  raw = normalizeVisionText(raw);
  return raw;
}

function normalizeVisionText(raw) {
  if (raw && typeof raw !== 'string') {
    const extracted = extractTextFields(raw);
    if (extracted.length) return dedupeLines(extracted).join('\n');
    raw = JSON.stringify(raw);
  }
  const text = String(raw || '').trim();
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    const extracted = extractTextFields(parsed);
    return extracted.length ? dedupeLines(extracted).join('\n') : text;
  } catch {}
  try {
    const parsed = parseJsonFromText(text);
    const extracted = extractTextFields(parsed);
    return extracted.length ? dedupeLines(extracted).join('\n') : text;
  } catch {
    return text;
  }
}

function normalizeAssistantText(raw) {
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object') {
    const extracted = extractTextFields(raw);
    if (extracted.length) return dedupeLines(extracted).join('\n').trim();
    return JSON.stringify(raw);
  }
  return String(raw || '').trim();
}

function extractTextFields(value, result = []) {
  if (!value) return result;
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (cleaned) result.push(cleaned);
    return result;
  }
  if (Array.isArray(value)) {
    for (const item of value) extractTextFields(item, result);
    return result;
  }
  if (typeof value !== 'object') return result;

  const textKeys = new Set(['text', 'content', 'words', 'word', 'value']);
  const skipKeys = new Set(['pos', 'bbox', 'box', 'position', 'coordinates', 'coordinate', 'confidence', 'score', 'x', 'y', 'w', 'h', 'width', 'height']);
  for (const key of textKeys) {
    if (typeof value[key] === 'string') {
      const cleaned = value[key].trim();
      if (cleaned) result.push(cleaned);
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (skipKeys.has(key)) continue;
    if (textKeys.has(key) && typeof child === 'string') continue;
    extractTextFields(child, result);
  }
  return result;
}

function dedupeLines(lines) {
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    const cleaned = String(line || '').trim();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

function getAuthHeaders() {
  if (AI_STYLE === 'anthropic') return { 'x-api-key': AI_KEY };
  return { authorization: `Bearer ${AI_KEY}` };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Claude 接口请求超时（${Math.round(timeoutMs / 1000)}秒）：${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function imageToClaudeContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType,
      data: fs.readFileSync(filePath).toString('base64'),
    },
  };
}

function appendChatMessages(student, identity, messages) {
  ensureStudentScaffold(student, false);
  const chatPath = path.join(STUDENTS_DIR, student, '微信聊天记录.md');
  let content = fs.readFileSync(chatPath, 'utf-8');
  const cleanMessages = messages
    .filter((m) => m && m.content)
    .map((m) => ({
      speaker: String(m.speaker || '未知'),
      content: String(m.content || '').trim(),
      datetime: String(m.datetime || currentDateTime()),
    }));
  const fresh = cleanMessages.filter((m) => !content.includes(`**${m.datetime}** ${m.speaker}：`) && !content.includes(m.content));
  if (fresh.length === 0) return 0;

  const block = fresh.map((m) => `**${m.datetime}** ${m.speaker}：\n${m.content}\n`).join('\n');
  const heading = `## ${identity}`;
  const index = content.indexOf(heading);
  if (index === -1) {
    content += `\n\n${heading}\n\n${block}`;
  } else {
    const next = content.indexOf('\n## ', index + heading.length);
    if (next === -1) content += `\n${block}`;
    else content = `${content.slice(0, next).trimEnd()}\n\n${block}\n${content.slice(next)}`;
  }
  fs.writeFileSync(chatPath, content, 'utf-8');
  return fresh.length;
}

function getExistingMeetingCount(student) {
  const dir = path.join(STUDENTS_DIR, student, '会议逐字稿');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.includes('会议总结')).length;
}

function parseChatTranscript(text) {
  const messages = [];
  const lines = String(text || '').split(/\r?\n/);
  let curDate = currentDate();
  const dateTag = /^---\s*日期[：:]\s*(\d{1,2})[\/-](\d{1,2})\s*---/;
  const msgLine = /^(.+?)[：:]\s*(.+?)(?:\s*\((\d{1,2}:\d{2})\))?\s*$/;
  for (const line of lines) {
    const dateMatch = line.trim().match(dateTag);
    if (dateMatch) {
      const month = String(Number(dateMatch[1])).padStart(2, '0');
      const day = String(Number(dateMatch[2])).padStart(2, '0');
      curDate = `2026-${month}-${day}`;
      continue;
    }
    const msgMatch = line.trim().match(msgLine);
    if (msgMatch) {
      const speaker = msgMatch[1].trim();
      const content = msgMatch[2].trim();
      const time = msgMatch[3] || '00:00';
      messages.push({ datetime: `${curDate} ${time}`, speaker, content });
    }
  }
  return messages;
}

function cleanTranscript(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/g, '')
      .replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?\s*/g, '')
      .trim())
    .filter((line) => line && !/^[-=*_]{3,}$/.test(line) && !/^\d+$/.test(line))
    .join('\n\n');
}

function getStudentNames() {
  if (!fs.existsSync(STUDENTS_DIR)) return [];
  return fs.readdirSync(STUDENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => !SYSTEM_DIRS.has(d.name) && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function getStudentCard(name) {
  const progress = readStudentFile(name, '客户咨询进度.md') || '';
  const oldProfile = readStudentFile(name, '学生档案.md') || '';
  const useLegacy = oldProfile && isPlaceholderProgress(progress, name);
  const source = useLegacy ? oldProfile : (progress || oldProfile);
  const fm = parseFrontmatter(source);
  const stage = normalizeStage(fm.stage || legacyStatusToStage(fm.status) || '添加微信');
  const chat = readStudentFile(name, '微信聊天记录.md') || '';
  const summary = readStudentPreferred(name, '学生信息总结.md', '学生档案.md') || '';
  const assessment = readStudentFile(name, path.join('评估与建议', '评估与建议.md')) || '';
  const files = listMarkdownFiles(path.join(STUDENTS_DIR, name));
  const chatPath = path.join(STUDENTS_DIR, name, '微信聊天记录.md');
  const chatStat = fs.existsSync(chatPath) ? fs.statSync(chatPath) : null;
  const transcriptDir = path.join(STUDENTS_DIR, name, '会议逐字稿');
  const transcripts = fs.existsSync(transcriptDir)
    ? fs.readdirSync(transcriptDir).filter(f => f.endsWith('.md') && !f.includes('会议总结') && !f.includes('客服查看'))
    : [];
  const latestTranscript = [...transcripts].sort().pop() || '';
  return {
    name,
    stage,
    updated: fm.updated || fm.created || '',
    hasChat: chat.replace(/[#\s·学生家长本人群聊微信记录]/g, '').trim().length > 20,
    chatUpdated: chatStat ? formatDate(chatStat.mtime) : '',
    hasSummary: Boolean(summary.trim()),
    hasAssessment: Boolean(assessment.trim()),
    hasTranscript: transcripts.length > 0,
    latestTranscript,
    fileCount: files.length,
    source: progress && !useLegacy ? 'v2' : oldProfile ? 'legacy' : 'new',
  };
}

function stripFrontmatter(content) {
  const match = String(content || '').match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return match ? content.slice(match[0].length) : content;
}

function parseFrontmatter(content) {
  const match = String(content || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  return Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const index = line.indexOf(':');
    if (index === -1) return null;
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }).filter(Boolean));
}

function normalizeStage(stage) {
  if (STAGES.includes(stage)) return stage;
  return legacyStatusToStage(stage) || '添加微信';
}

function legacyStatusToStage(status) {
  const map = {
    新线索: '添加微信',
    初步接触: '添加微信',
    已筛查: '筛查',
    已咨询: '开会与发评估',
    已发手册: '开会与发评估',
    已约会议: '开会与发评估',
    方案沟通中: '跟进',
    已签约: '已签约',
    已流失: '已流失',
    沉睡: '跟进',
  };
  return map[status];
}

function getTodos() {
  const file = readGlobalFile('待办清单.md') || '';
  const parsed = parseTodoMarkdown(file);
  const derived = getStudentNames()
    .map(getStudentCard)
    .filter((s) => !s.hasChat)
    .map((s) => ({ student: s.name, text: '待上传：聊天记录', done: false, source: 'system' }));
  return [...parsed, ...derived];
}

function getTodosForStudent(student) {
  return getTodos().filter((todo) => todo.student === student);
}

function parseTodoMarkdown(content) {
  const todos = [];
  let current = '';
  for (const line of String(content || '').split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) current = heading[1].trim();
    const item = line.match(/^-\s+\[([ xX])\]\s+(.+)/);
    if (item) todos.push({ student: current || '全局', done: item[1].toLowerCase() === 'x', text: item[2].trim(), source: 'file' });
  }
  return todos;
}

function getMeetings() {
  const content = readGlobalFile('会议安排.md') || '';
  const rows = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim().startsWith('|') || line.includes('---') || line.includes('时间')) continue;
    const cols = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cols.length >= 4) rows.push({ time: cols[0], student: cols[1], attendees: cols[2], status: cols[3] });
  }
  return rows;
}

function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  function walk(current, prefix = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.name.endsWith('.md')) files.push({ name: entry.name, path: rel, size: fs.statSync(full).size });
    }
  }
  walk(dir);
  return files.sort((a, b) => a.path.localeCompare(b.path, 'zh-Hans-CN'));
}

function createStudentScaffold(name) {
  const dir = path.join(STUDENTS_DIR, name);
  fs.mkdirSync(path.join(dir, '会议逐字稿'), { recursive: true });
  fs.mkdirSync(path.join(dir, '评估与建议'), { recursive: true });
  const today = currentDate();
  writeIfMissing(path.join(dir, '微信聊天记录.md'), `# ${name} · 微信聊天记录\n\n## 学生家长\n\n## 学生本人\n\n## 家长学生群聊\n`);
  writeIfMissing(path.join(dir, '学生信息总结.md'), `# ${name} · 学生信息总结\n`);
  writeIfMissing(path.join(dir, '客户咨询进度.md'), `---\nstage: 添加微信\nupdated: ${today}\n---\n# ${name} · 咨询进度\n\n## 进度时间线\n- ${today} 进入「添加微信」阶段\n`);
}

function ensureStudentScaffold(name, includeLegacyNote = false) {
  const dir = path.join(STUDENTS_DIR, name);
  if (!fs.existsSync(dir)) return [];
  const before = new Set(fs.readdirSync(dir));
  createStudentScaffold(name);
  const created = fs.readdirSync(dir).filter((item) => !before.has(item));
  if (includeLegacyNote && created.length) {
    const note = path.join(dir, '学生信息总结.md');
    if (fs.existsSync(path.join(dir, '学生档案.md')) && fs.readFileSync(note, 'utf-8').trim().endsWith('学生信息总结')) {
      fs.appendFileSync(note, '\n> 旧版资料仍保留在 `学生档案.md`，本文件将由后续上传自动更新。\n', 'utf-8');
    }
  }
  return created;
}

function readStudentPreferred(student, preferred, fallback) {
  const preferredContent = readStudentFile(student, preferred);
  if (preferredContent && !isPlaceholderStudentDoc(preferredContent, student, preferred)) {
    return preferredContent;
  }
  return readStudentFile(student, fallback) || preferredContent || '';
}

function isPlaceholderProgress(content, name) {
  const compact = String(content || '').replace(/\s/g, '');
  return compact.includes('stage:添加微信') &&
    compact.includes(`#${name}·咨询进度`) &&
    compact.includes('进入「添加微信」阶段') &&
    compact.length < 140;
}

function isPlaceholderStudentDoc(content, student, filename) {
  const compact = String(content || '').replace(/\s/g, '');
  if (filename === '学生信息总结.md') return compact === `#${student}·学生信息总结`;
  if (filename === '微信聊天记录.md') return compact === `#${student}·微信聊天记录##学生家长##学生本人##家长学生群聊`;
  return false;
}

function readStudentFile(student, relPath) {
  const full = path.join(STUDENTS_DIR, student, relPath);
  return fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, 'utf-8') : null;
}

function writeStudentFile(student, relPath, content) {
  const full = path.join(STUDENTS_DIR, student, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, String(content).trim() + '\n', 'utf-8');
}

function readGlobalFile(relPath) {
  const full = path.join(CONSULTING_DIR, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : null;
}

function writeGlobalFile(relPath, content) {
  const full = path.join(CONSULTING_DIR, relPath);
  fs.writeFileSync(full, String(content).trim() + '\n', 'utf-8');
}

function writeIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, content, 'utf-8');
}

function markAssessmentGenerated(student) {
  const progressPath = path.join(STUDENTS_DIR, student, '客户咨询进度.md');
  if (!fs.existsSync(progressPath)) return;
  let content = fs.readFileSync(progressPath, 'utf-8');
  const now = currentDateTime();
  content = content.replace(/updated:\s*.*/, `updated: ${currentDate()}`);
  if (!content.includes('评估与建议已生成')) content += `\n- ${now} 评估与建议已生成（仅客服查看）\n`;
  fs.writeFileSync(progressPath, content, 'utf-8');
}

function createTask(type, student, message) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const task = { id, type, student, status: 'queued', message, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  tasks[id] = task;
  saveTasks();
  return task;
}

function updateTask(id, status, message) {
  if (!tasks[id]) return;
  tasks[id] = { ...tasks[id], status, message, updatedAt: new Date().toISOString() };
  saveTasks();
}

function completeTask(id, message) {
  updateTask(id, 'completed', message);
}

function failTask(id, error) {
  updateTask(id, 'failed', error.message || String(error));
}

function saveTasks() {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

function parseJsonFromText(text) {
  let raw = String(text || '').trim();
  // Remove markdown code fences more aggressively
  raw = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  // Remove any leading/trailing non-JSON text (common with reasoning models)
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    raw = raw.slice(jsonStart, jsonEnd + 1);
  }
  try {
    return JSON.parse(raw);
  } catch (e1) {
    // Last resort: try to fix common issues and re-parse
    try {
      const cleaned = raw.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');
      return JSON.parse(cleaned);
    } catch (e2) {
      throw new Error(`Claude 未返回 JSON（前200字）：${String(text).trim().slice(0, 200)}`);
    }
  }
}

function normalizeAttendees(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

function normalizeName(name) {
  return String(name || '').trim().replace(/[\\/:*?"<>|]/g, '');
}

function assertSafeName(name) {
  if (!name || name.includes('..') || /[\\/:*?"<>|]/.test(name)) throw new Error('学生姓名包含非法字符');
}

function assertStudentExists(name) {
  assertSafeName(name);
  if (!fs.existsSync(path.join(STUDENTS_DIR, name))) {
    const error = new Error('学生不存在');
    error.code = 'NOT_FOUND';
    throw error;
  }
}

function resolveInside(base, relPath) {
  const full = path.resolve(base, relPath);
  const root = path.resolve(base);
  if (!full.startsWith(root)) throw new Error('非法文件路径');
  return full;
}

function sanitizeFilePart(value) {
  return String(value || 'file').replace(/[\\/:*?"<>|]/g, '_');
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function currentDateTime() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function readJson(filePath, fallback) {
  try {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : fallback;
  } catch {
    return fallback;
  }
}

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).replace(/^\uFEFF/, '').trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = value;
  }
}
