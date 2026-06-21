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

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR });
let tasks = readJson(TASKS_FILE, {});

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

    const dir = path.join(CONSULTING_DIR, name);
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
    const dir = path.join(CONSULTING_DIR, name);
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
      progressHtml: marked.parse(progress || ''),
      summaryHtml: marked.parse(summary || ''),
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
    const full = resolveInside(path.join(CONSULTING_DIR, student), relPath);
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

app.post('/api/upload-chat', upload.array('screenshots', 50), (req, res) => {
  try {
    const student = String(req.body.student || '');
    const identity = String(req.body.identity || '');
    assertStudentExists(student);
    if (!IDENTITIES.includes(identity)) return res.status(400).json({ error: '请选择有效身份' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: '未上传截图' });

    const screenshotDir = path.join(UPLOADS_DIR, sanitizeFilePart(student), Date.now().toString());
    fs.mkdirSync(screenshotDir, { recursive: true });
    const saved = [];
    for (const file of req.files) {
      const dest = path.join(screenshotDir, sanitizeFilePart(file.originalname || file.filename));
      fs.renameSync(file.path, dest);
      saved.push(dest);
    }

    const task = createTask('chat', student, `处理 ${saved.length} 张微信截图`);
    processChatUpload(task.id, student, identity, saved).catch((error) => failTask(task.id, error));
    res.json({ ok: true, taskId: task.id, hint: '聊天截图已保存，Claude 正在后台识别和更新档案' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload-transcript', upload.single('transcript'), (req, res) => {
  try {
    const student = String(req.body.student || '');
    const meetingNumber = String(req.body.meetingNumber || '').trim();
    const attendees = normalizeAttendees(req.body.attendees);
    assertStudentExists(student);
    if (!meetingNumber) return res.status(400).json({ error: '缺少会议场次' });
    if (attendees.length === 0) return res.status(400).json({ error: '请选择参会人' });
    if (!req.file) return res.status(400).json({ error: '未上传逐字稿文件' });

    const task = createTask('transcript', student, `处理第 ${meetingNumber} 场会议逐字稿`);
    processTranscriptUpload(task.id, student, meetingNumber, attendees, req.file.path).catch((error) => failTask(task.id, error));
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
    processAssessment(task.id, student).catch((error) => failTask(task.id, error));
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

app.listen(PORT, () => {
  console.log(`SouthBridge v2 MVP running on http://localhost:${PORT}`);
  console.log(`Data directory: ${CONSULTING_DIR}`);
  console.log(`Students: ${getStudentNames().length}`);
});

async function processChatUpload(taskId, student, identity, imagePaths) {
  updateTask(taskId, 'running', '正在识别微信截图');
  ensureStudentScaffold(student, false);
  const images = imagePaths.map(imageToClaudeContent);
  const ocr = await callClaudeJson([
    '你是南桥教育客服工作台的微信聊天 OCR 助手。',
    `学生：${student}`,
    `本次上传身份：${identity}`,
    '请逐张读取微信截图，提取完整聊天消息。输出 JSON：',
    '{"messages":[{"speaker":"说话人","content":"原文内容","datetime":"YYYY-MM-DD HH:mm"}]}',
    '要求：不要改写消息；如果截图只显示今天/昨天/周几，请结合图片文件上传日期推断绝对日期；无法确定分钟时可以用最接近的时间。',
  ].join('\n'), images);

  const messages = Array.isArray(ocr.messages) ? ocr.messages : [];
  updateTask(taskId, 'running', `识别到 ${messages.length} 条消息，正在写入聊天记录`);
  const added = appendChatMessages(student, identity, messages);

  updateTask(taskId, 'running', '正在更新学生总结、进度、待办和会议安排');
  const chat = readStudentFile(student, '微信聊天记录.md') || '';
  const analysis = await analyzeStudentMaterial(student, `最新微信聊天记录：\n${chat}`, 'chat');
  applyStudentAnalysis(student, analysis);

  completeTask(taskId, `聊天处理完成，新增 ${added} 条消息`);
}

async function processTranscriptUpload(taskId, student, meetingNumber, attendees, tmpPath) {
  updateTask(taskId, 'running', '正在清洗逐字稿');
  ensureStudentScaffold(student, false);
  const raw = fs.readFileSync(tmpPath, 'utf-8');
  const cleaned = cleanTranscript(raw);
  const today = currentDate();
  const filename = `${today}-第${meetingNumber}场.md`;
  const transcriptPath = path.join(CONSULTING_DIR, student, '会议逐字稿', filename);
  fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });
  fs.writeFileSync(transcriptPath, [
    `# ${student} · 第${meetingNumber}场会议逐字稿`,
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
    `场次：第${meetingNumber}场`,
    `参会人：${attendees.join(', ')}`,
    '以下是清洗后的会议逐字稿：',
    cleaned,
  ].join('\n');
  const analysis = await analyzeStudentMaterial(student, prompt, 'transcript');
  applyStudentAnalysis(student, analysis);

  if (analysis.internalMeetingSummary) {
    fs.writeFileSync(
      path.join(CONSULTING_DIR, student, '会议逐字稿', `第${meetingNumber}场-会议总结.md`),
      analysis.internalMeetingSummary,
      'utf-8'
    );
  }
  if (analysis.customerVisibleMeetingSummary) {
    fs.writeFileSync(
      path.join(CONSULTING_DIR, student, '会议逐字稿', `第${meetingNumber}场-会议总结-客服查看.md`),
      analysis.customerVisibleMeetingSummary,
      'utf-8'
    );
  }

  completeTask(taskId, `第 ${meetingNumber} 场会议处理完成`);
}

async function processAssessment(taskId, student) {
  updateTask(taskId, 'running', '正在读取会议资料');
  ensureStudentScaffold(student, false);
  const dir = path.join(CONSULTING_DIR, student);
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
  const assessmentPath = path.join(CONSULTING_DIR, student, '评估与建议', '评估与建议.md');
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
  return payload.choices?.[0]?.message?.content?.trim() || '';
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
  const chatPath = path.join(CONSULTING_DIR, student, '微信聊天记录.md');
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
  if (!fs.existsSync(CONSULTING_DIR)) return [];
  return fs.readdirSync(CONSULTING_DIR, { withFileTypes: true })
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
  const files = listMarkdownFiles(path.join(CONSULTING_DIR, name));
  return {
    name,
    stage,
    updated: fm.updated || fm.created || '',
    hasChat: chat.replace(/[#\s·学生家长本人群聊微信记录]/g, '').trim().length > 20,
    hasSummary: Boolean(summary.trim()),
    hasAssessment: Boolean(assessment.trim()),
    fileCount: files.length,
    source: progress && !useLegacy ? 'v2' : oldProfile ? 'legacy' : 'new',
  };
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
  const dir = path.join(CONSULTING_DIR, name);
  fs.mkdirSync(path.join(dir, '会议逐字稿'), { recursive: true });
  fs.mkdirSync(path.join(dir, '评估与建议'), { recursive: true });
  const today = currentDate();
  writeIfMissing(path.join(dir, '微信聊天记录.md'), `# ${name} · 微信聊天记录\n\n## 学生家长\n\n## 学生本人\n\n## 家长学生群聊\n`);
  writeIfMissing(path.join(dir, '学生信息总结.md'), `# ${name} · 学生信息总结\n`);
  writeIfMissing(path.join(dir, '客户咨询进度.md'), `---\nstage: 添加微信\nupdated: ${today}\n---\n# ${name} · 咨询进度\n\n## 进度时间线\n- ${today} 进入「添加微信」阶段\n`);
}

function ensureStudentScaffold(name, includeLegacyNote = false) {
  const dir = path.join(CONSULTING_DIR, name);
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
  const full = path.join(CONSULTING_DIR, student, relPath);
  return fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, 'utf-8') : null;
}

function writeStudentFile(student, relPath, content) {
  const full = path.join(CONSULTING_DIR, student, relPath);
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
  const progressPath = path.join(CONSULTING_DIR, student, '客户咨询进度.md');
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
  const raw = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Claude 未返回 JSON：${raw.slice(0, 200)}`);
    return JSON.parse(match[0]);
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
  if (!fs.existsSync(path.join(CONSULTING_DIR, name))) {
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
