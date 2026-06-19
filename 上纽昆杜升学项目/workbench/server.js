const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = !!process.env.VERCEL;

const CONSULTING_DIR = path.join(__dirname, '..', '咨询管理');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GH_OWNER = 'JessieDong-HK';
const GH_REPO = 'southbridge_ai';
const GH_PATH = '上纽昆杜升学项目/咨询管理';

// ── GitHub API helper (Vercel only) ──
function ghAPI(method, filePath, content) {
  return new Promise((resolve, reject) => {
    const fullPath = `${GH_PATH}/${filePath}`.split('/').filter(s => s).map(s => encodeURIComponent(s)).join('/');
    const p = `/repos/${GH_OWNER}/${GH_REPO}/contents/${fullPath}`;
    const headers = { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'southbridge', 'Accept': 'application/vnd.github+json' };
    const req = https.request({ hostname:'api.github.com', path:p, method, headers }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject);
    if (content) req.write(JSON.stringify({ message: 'workbench update', content: Buffer.from(content).toString('base64') }));
    req.end();
  });
}

// ── Data helpers (works on both local + Vercel) ──
async function readFile(relPath) {
  if (!IS_VERCEL) {
    const full = path.join(CONSULTING_DIR, relPath);
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : null;
  }
  const r = await ghAPI('GET', relPath);
  return r.content ? Buffer.from(r.content, 'base64').toString('utf-8') : null;
}

async function listDirs(relPath) {
  if (!IS_VERCEL) {
    const full = path.join(CONSULTING_DIR, relPath || '');
    return fs.readdirSync(full, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('_')).map(d => d.name);
  }
  const r = await ghAPI('GET', relPath || '');
  return Array.isArray(r) ? r.filter(f => f.type === 'dir' && !f.name.startsWith('_')).map(f => f.name) : [];
}

// Local-only file write (Vercel write support coming next)
function writeFileLocal(relPath, content) {
  const full = path.join(CONSULTING_DIR, relPath);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}

// ── Parse helpers ──
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  m[1].split('\n').forEach(l => { const [k,...v] = l.split(':'); if(k&&v.length) fm[k.trim()]=v.join(':').trim(); });
  return fm;
}

function extractTableField(content, fieldName) {
  let re = new RegExp(`\\|\\s*\\*\\*${fieldName}\\*\\*\\s*\\|\\s*(.+?)\\s*\\|`);
  let m = content.match(re);
  if (!m) { re = new RegExp(`\\|\\s*${fieldName}\\s*\\|\\s*(.+?)\\s*\\|`); m = content.match(re); }
  return m ? m[1].trim() : '';
}

function extractListItem(content, fieldName) {
  const m = content.match(new RegExp(`-\\s*\\*\\*${fieldName}\\*\\*[：:]\\s*(.+)`));
  return m ? m[1].trim() : '';
}

// Multer setup (local: uploads dir; Vercel: /tmp)
const uploadDir = IS_VERCEL ? '/tmp' : path.join(__dirname, 'uploads');
if (!IS_VERCEL && !fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });

app.use(express.json());
app.use(express.static(__dirname));

// ── API Routes ──

app.get('/api/pipeline', async (req, res) => {
  try {
    const dirs = await listDirs('');
    const exclude = ['话术库','跟进管理'];
    let overBar=0, met=0, negotiating=0, signed=0;
    for (const dir of dirs) {
      if (exclude.includes(dir)) continue;
      const content = await readFile(dir + '/学生档案.md');
      if (!content) continue;
      const fm = parseFrontmatter(content);
      const status = fm.status || '';
      const hasRecords = content.includes('# 咨询记录');
      if (status && !['新线索','初步接触','已流失','沉睡'].includes(status)) overBar++;
      if (hasRecords) met++;
      if (status === '方案沟通中') negotiating++;
      if (status === '已签约') signed++;
    }
    res.json({ overBar, met, negotiating, signed });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/process', async (req, res) => {
  try {
    const steps = [
      { id:'screen',num:1,label:'筛查',icon:'🔍',desc:'收集5项基本信息，判断是否达标',detail:'学校背景（一线头部/省市重点）、校内排名（前30-40%）、语言成绩（雅思6.5+/托福85+）。达标→发服务手册。不达标→诚实告知，只推单模块。' },
      { id:'manual',num:2,label:'发手册',icon:'📘',desc:'达标后发送服务手册，截图聊天记录存档',detail:'发送服务手册PDF或公司概览+服务方案速览。话术参考：开场话术+免费评估邀约话术。发完后截图保存。' },
      { id:'book',num:3,label:'约会议',icon:'📞',desc:'邀约免费评估会议（20-30min）',detail:'所有达标的人都要尽量促成会议。话术参考：免费评估邀约话术。目标：让家长/学生体验到专业分析的价值。' },
      { id:'prep',num:4,label:'会前准备',icon:'📝',desc:'根据学生基础情况调整发言稿',detail:'基于学生档案，在会议话术手册的7模块框架上做个性化调整。重点：Gold Story方向+针对短板的策略。' },
      { id:'meeting',num:5,label:'开会',icon:'🎙️',desc:'进行免费评估会议',detail:'按会议话术手册7模块引导。核心是模块5（个性化分析）。会后保存逐字稿。' },
      { id:'assess',num:6,label:'发评估建议',icon:'📋',desc:'会议结束后将评估&建议发给家长',detail:'基于会议内容整理：学生匹配度判断、申请时间线、需要突破的方向、推荐方案。' },
      { id:'followup',num:7,label:'促单跟进',icon:'💬',desc:'持续跟进，推动签约决策',detail:'定期跟进：3天→7天→14天。每次跟进要有新信息或价值。话术参考：价格沟通话术。' },
    ];
    const dirs = await listDirs('');
    const exclude = ['话术库','跟进管理'];
    const counts = {};
    for (const dir of dirs) {
      if (exclude.includes(dir)) continue;
      const content = await readFile(dir + '/学生档案.md');
      if (!content) continue;
      const fm = parseFrontmatter(content);
      const status = fm.status || '';
      const hasRecords = content.includes('# 咨询记录');
      const student = { name: dir, status, hasRecords };
      if (status==='已签约'||status==='方案沟通中') (counts['followup']=counts['followup']||[]).push(student);
      else if (hasRecords) (counts['assess']=counts['assess']||[]).push(student);
      else if (status==='已咨询'||status==='已发手册'||status==='已约会议') (counts['book']=counts['book']||[]).push(student);
      else if (status==='已筛查') (counts['manual']=counts['manual']||[]).push(student);
      else if (status==='初步接触') (counts['screen']=counts['screen']||[]).push(student);
    }
    for (const s of steps) { s.students = counts[s.id] || []; s.count = s.students.length; }
    res.json(steps);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/todos', async (req, res) => {
  try {
    const dirs = await listDirs('');
    const exclude = ['话术库','跟进管理'];
    const todos = [];
    const now = Date.now();
    for (const dir of dirs) {
      if (exclude.includes(dir)) continue;
      const content = await readFile(dir + '/学生档案.md');
      if (!content) continue;
      const fm = parseFrontmatter(content);
      const status = fm.status || '';
      const updated = fm.updated ? new Date(fm.updated).getTime() : 0;
      const hoursAgo = (now - updated) / (60*60*1000);
      const hasRecords = content.includes('# 咨询记录');

      if (status === '初步接触' && hoursAgo > 24)
        todos.push({ student: dir, action: `追一下${dir}的回复`, urgency:'week', reason:`${Math.round(hoursAgo)}小时未回复` });
      if (status === '已咨询' && !hasRecords && hoursAgo > 72)
        todos.push({ student: dir, action: `邀约${dir}的评估会议`, urgency:'week', reason:`筛查后已过${Math.round(hoursAgo/24)}天` });
      if (hasRecords && hoursAgo < 48 && (status==='已咨询'||status==='方案沟通中'))
        todos.push({ student: dir, action: `发送"评估&建议"给${dir}`, urgency:'urgent', reason:'会议刚结束，尽快发送' });
      if (status === '方案沟通中' && hoursAgo > 72)
        todos.push({ student: dir, action: `促单跟进${dir}`, urgency:'week', reason:`方案已发${Math.round(hoursAgo/24)}天` });
    }
    todos.sort((a,b) => (a.urgency==='urgent'?-1:1) - (b.urgency==='urgent'?-1:1));
    res.json(todos);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/students', async (req, res) => {
  try {
    const dirs = await listDirs('');
    const exclude = ['话术库','跟进管理'];
    const students = [];
    for (const dir of dirs) {
      if (exclude.includes(dir)) continue;
      const content = await readFile(dir + '/学生档案.md');
      if (!content) { students.push({ name:dir, exists:false }); continue; }
      const fm = parseFrontmatter(content);
      students.push({
        name: dir, status: fm.status || '未知', updated: fm.updated || '', id: fm.id || '', dir,
        summary: (content.match(/^# .+\n\n> (.+)/m)||[])[1]||'',
        school: extractTableField(content, '学校'),
        grade: extractTableField(content, '年级'),
        target: extractTableField(content, '目标学校'),
        plan: extractListItem(content, '推荐方案'),
      });
    }
    res.json(students);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/students/:name', async (req, res) => {
  try {
    const content = await readFile(req.params.name + '/学生档案.md');
    if (!content) return res.status(404).json({ error: '学生不存在' });
    res.json({ content, html: marked.parse(content) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/upload-chat', upload.single('screenshot'), async (req, res) => {
  try {
    const { student } = req.body;
    if (!student || !req.file) return res.status(400).json({ error: '缺少参数' });
    if (IS_VERCEL) return res.json({ ok:true, hint:'截图已收到（Vercel写功能开发中）' });

    const destDir = path.join(CONSULTING_DIR, student, '微信聊天记录', '待处理截图');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const destName = `${new Date().toISOString().slice(0,10)}-${req.file.originalname}`;
    fs.copyFileSync(req.file.path, path.join(destDir, destName));
    fs.unlinkSync(req.file.path);
    res.json({ ok:true, student, savedTo:`${student}/微信聊天记录/待处理截图/${destName}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`南桥工作台已启动: http://localhost:${PORT}`);
});

module.exports = app;
