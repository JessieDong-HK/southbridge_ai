const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

const CONSULTING_DIR = path.join(__dirname, '..', '咨询管理');
const UPLOADS_DIR = path.join(__dirname, '..', '咨询管理', '_uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR });

/** 在后台调用 Claude Code 运行 Workflow */
function runWorkflow(name, args) {
  const argsJson = JSON.stringify(args).replace(/'/g, "'\\''");
  const cmd = `claude workflow run ${name} --args '${argsJson}'`;
  const cwd = path.join(__dirname, '..');
  exec(cmd, { cwd }, (err, stdout, stderr) => {
    if (err) {
      console.error(`❌ Workflow ${name} failed:`, stderr || err.message);
    } else {
      console.log(`✅ Workflow ${name} completed`);
    }
  });
}
const SYSTEM_DIRS = ['_模板', '话术库', '跟进管理'];

app.use(express.json());

// ── 工具函数 ──

/** 扫描学生列表：读咨询管理/下的子目录，过滤系统目录 */
function getStudentList() {
  if (!fs.existsSync(CONSULTING_DIR)) return [];
  return fs.readdirSync(CONSULTING_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !SYSTEM_DIRS.includes(d.name) && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map(d => d.name);
}

/** 读学生的 Markdown 文件，转为 HTML */
function readStudentFile(name, filename) {
  const p = path.join(CONSULTING_DIR, name, filename);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf-8');
}

// ── API 路由 ──

/** GET /api/students — 获取学生列表 */
app.get('/api/students', (req, res) => {
  try {
    const students = getStudentList().map(name => {
      const progressFile = path.join(CONSULTING_DIR, name, '客户咨询进度.md');
      let stage = '添加微信';
      let updated = '';
      if (fs.existsSync(progressFile)) {
        const content = fs.readFileSync(progressFile, 'utf-8');
        const stageMatch = content.match(/stage:\s*(.+)/);
        if (stageMatch) stage = stageMatch[1].trim();
        const updatedMatch = content.match(/updated:\s*(.+)/);
        if (updatedMatch) updated = updatedMatch[1].trim();
      }
      // 检查是否缺聊天记录
      const chatFile = path.join(CONSULTING_DIR, name, '微信聊天记录.md');
      const hasChat = fs.existsSync(chatFile) && fs.statSync(chatFile).size > 200;
      return { name, stage, updated, hasChat };
    });
    res.json(students);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/students/:name — 获取学生详情 */
app.get('/api/students/:name', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const studentDir = path.join(CONSULTING_DIR, name);
    if (!fs.existsSync(studentDir)) {
      return res.status(404).json({ error: '学生不存在' });
    }

    // 列出该学生的所有文件
    const files = [];
    function walk(dir, prefix = '') {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) {
          walk(full, rel);
        } else {
          files.push({ name: e.name, path: rel });
        }
      }
    }
    walk(studentDir);

    // 读学生信息总结、客户咨询进度
    const infoSummary = readStudentFile(name, '学生信息总结.md');
    const progress = readStudentFile(name, '客户咨询进度.md');

    res.json({
      name,
      files,
      infoSummary: infoSummary || '',
      progress: progress || '',
      hasChat: files.some(f => f.name === '微信聊天记录.md')
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/students — 新建学生 */
app.post('/api/students', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '学生姓名不能为空' });
    }

    const studentName = name.trim();
    const studentDir = path.join(CONSULTING_DIR, studentName);

    if (fs.existsSync(studentDir)) {
      return res.status(409).json({ error: `学生 "${studentName}" 已存在` });
    }

    // 创建文件夹
    fs.mkdirSync(studentDir);
    fs.mkdirSync(path.join(studentDir, '会议逐字稿'));
    fs.mkdirSync(path.join(studentDir, '评估与建议'));

    // 创建 微信聊天记录.md（含三部分空标题）
    const chatContent = `# ${studentName} · 微信聊天记录

## 学生家长

## 学生本人

## 家长学生群聊
`;
    fs.writeFileSync(path.join(studentDir, '微信聊天记录.md'), chatContent, 'utf-8');

    // 创建 学生信息总结.md（仅标题）
    const summaryContent = `# ${studentName} · 学生信息总结
`;
    fs.writeFileSync(path.join(studentDir, '学生信息总结.md'), summaryContent, 'utf-8');

    // 创建 客户咨询进度.md（初始状态）
    const today = new Date().toISOString().split('T')[0];
    const progressContent = `---
stage: 添加微信
updated: ${today}
---
# ${studentName} · 咨询进度

## 进度时间线
- ${today} 进入「添加微信」阶段
`;
    fs.writeFileSync(path.join(studentDir, '客户咨询进度.md'), progressContent, 'utf-8');

    res.json({
      ok: true,
      student: studentName,
      message: `已创建学生：${studentName}`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/upload-chat — 上传微信聊天截图，触发 W1 */
app.post('/api/upload-chat', upload.array('screenshots', 50), (req, res) => {
  try {
    const student = req.body.student;
    const identity = req.body.identity;
    if (!student || !identity) {
      return res.status(400).json({ error: '缺少 student 或 identity' });
    }

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '未上传截图' });
    }

    // 将截图移到学生专属临时目录
    const screenshotDir = path.join(UPLOADS_DIR, student, Date.now().toString());
    fs.mkdirSync(screenshotDir, { recursive: true });
    for (const f of files) {
      fs.renameSync(f.path, path.join(screenshotDir, f.originalname));
    }

    // 即刻触发 W1
    runWorkflow('聊天记录处理', { student, identity, screenshotDir });

    res.json({
      ok: true,
      student,
      screenshotCount: files.length,
      hint: '聊天截图已保存，AI 正在后台处理',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/upload-transcript — 上传会议逐字稿，触发 W2 */
app.post('/api/upload-transcript', upload.single('transcript'), (req, res) => {
  try {
    const { student, meetingNumber, attendees } = req.body;
    if (!student || !meetingNumber || !attendees) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: '未上传逐字稿文件' });
    }

    // 即刻触发 W2
    runWorkflow('会议记录处理', {
      student,
      meetingNumber,
      attendees: Array.isArray(attendees) ? attendees : [attendees],
      tmpPath: file.path,
    });

    res.json({
      ok: true,
      student,
      meetingNumber,
      hint: '逐字稿已保存，AI 正在后台处理',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/trigger-assessment — 手动触发 W3 */
app.post('/api/trigger-assessment', (req, res) => {
  try {
    const { student } = req.body;
    if (!student) {
      return res.status(400).json({ error: '缺少 student' });
    }

    runWorkflow('生成评估与建议', { student });

    res.json({ ok: true, student, hint: 'AI 正在生成评估与建议' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 启动 ──
app.listen(PORT, () => {
  console.log(`SouthBridge server running on http://localhost:${PORT}`);
  console.log(`Data directory: ${CONSULTING_DIR}`);
  console.log(`Students: ${getStudentList().length}`);
});
