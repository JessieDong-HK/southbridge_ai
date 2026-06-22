export const meta = {
  name: '会议记录处理',
  description: 'W2：上传会议逐字稿 → 预处理去时码 → 信息提取 → 会议总结/进度/待办/会议安排并行',
  phases: [
    { title: '预处理', detail: 'TXT 去时码 → 转干净 MD，删除临时 TXT' },
    { title: '信息提取', detail: '信息提取Agent（W2）从逐字稿提取新学生信息' },
    { title: '并行生成', detail: '会议总结/进度更新/待办提取/会议安排 四个 Agent 并行' },
  ],
};

const STUDENT = args.student;
const MEETING_NUMBER = args.meetingNumber;
const ATTENDEES = Array.isArray(args.attendees) ? args.attendees : [args.attendees];
const TMP_PATH = args.tmpPath;
const CONSULTING_DIR = '../咨询管理';

const fs = require('fs');
const path = require('path');

// ── Phase 1: 定位原始逐字稿 ──
phase('预处理');

if (!TMP_PATH || !fs.existsSync(TMP_PATH)) {
  log('❌ 临时 TXT 文件不存在');
  return { ok: false, error: 'TXT 文件丢失，请重新上传' };
}

const rawText = fs.readFileSync(TMP_PATH, 'utf-8');
log(`原始 TXT 大小：${rawText.length} 字符`);

// ── Phase 2: 预处理 ──

// ① 提取基础信息
const today = new Date().toISOString().split('T')[0];
const attendeesStr = ATTENDEES.join(', ');

// ② 清洗：删除每行时码（如 "00:15:23"、"[00:15:23]"）、空行、分隔符
const lines = rawText.split('\n');
const cleaned = [];
for (const line of lines) {
  let cleaned_line = line
    .replace(/^\s*\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*/g, '')  // 去时码
    .replace(/^\s*\d{1,2}:\d{2}(:\d{2})?\s*/g, '')           // 去无括号时码
    .trim();

  // 跳过空行和纯分隔符
  if (!cleaned_line || /^[-=*_]{3,}$/.test(cleaned_line)) continue;
  // 跳过纯数字行
  if (/^\d+$/.test(cleaned_line)) continue;

  cleaned.push(cleaned_line);
}

// ③ 生成干净 MD
const mdFileName = `${today}-第${MEETING_NUMBER}场.md`;
const mdFilePath = path.join(CONSULTING_DIR, STUDENT, '会议逐字稿', mdFileName);

const mdContent = `# ${STUDENT} · 第${MEETING_NUMBER}场
> 日期：${today}
> 参会人：${attendeesStr}

${cleaned.join('\n\n')}
`;

// 确保目录存在
const transcriptDir = path.join(CONSULTING_DIR, STUDENT, '会议逐字稿');
if (!fs.existsSync(transcriptDir)) fs.mkdirSync(transcriptDir, { recursive: true });

fs.writeFileSync(mdFilePath, mdContent, 'utf-8');
log(`✅ 干净 MD 已保存：${mdFileName}`);

// ④ 删除临时 TXT
fs.unlinkSync(TMP_PATH);
log('🗑️ 临时 TXT 已删除');

// ── Phase 3: 信息提取（Agent A 单独跑） ──
phase('信息提取');

const infoResult = await agent(
  `你是南桥教育的 AI 助手。请从以下会议逐字稿中提取关于学生 ${STUDENT} 的新事实。

已有学生信息总结：
${fs.existsSync(path.join(CONSULTING_DIR, STUDENT, '学生信息总结.md')) ? fs.readFileSync(path.join(CONSULTING_DIR, STUDENT, '学生信息总结.md'), 'utf-8') : '（暂无）'}

会议逐字稿：
${mdContent}

从会议中提取关于这个学生的新事实（已有总结里没有的）：
- 成绩变化（新分数、排名等）
- 活动更新（新竞赛、项目、奖项）
- 关注点变化（本来只考虑上纽，现在考虑上纽和昆杜）
- 家庭新情况（预算变化、家长态度变化）
- 学生在会议中主动提出的问题或顾虑
- 家长透露的新背景信息

只输出"已有总结里没有的新信息"。

请输出更新后的完整学生信息总结（Markdown 格式，以 # ${STUDENT} · 学生信息总结 开头）。`,
  { label: '信息提取Agent（W2）', phase: '信息提取' }
);

// 写入学生信息总结
if (infoResult && infoResult.trim()) {
  const summaryPath = path.join(CONSULTING_DIR, STUDENT, '学生信息总结.md');
  fs.writeFileSync(summaryPath, infoResult.trim(), 'utf-8');
  log('✅ 学生信息总结已更新');
}

// ── Phase 4: 并行生成 ──
phase('并行生成');

const [summaryResult, progressResult, todoResult, meetingResult] = await Promise.all([
  // Agent B: 会议总结
  agent(
    `你是南桥教育的 AI 助手。请为 ${STUDENT} 的第${MEETING_NUMBER}场会议生成两份总结。

会议逐字稿：
${mdContent}

学生信息总结：
${fs.existsSync(path.join(CONSULTING_DIR, STUDENT, '学生信息总结.md')) ? fs.readFileSync(path.join(CONSULTING_DIR, STUDENT, '学生信息总结.md'), 'utf-8') : ''}

请生成两个文件的内容：

① 会议总结（内部版）— 读者：Jess、客服
   内容：讨论要点、学生/家长发言摘要、我方回应要点、待解决问题、决策结论
   语气：中性、全面

② 会议总结（客户版）— 读者：学生/家长（可微信发送）
   内容：本次会议讨论了什么、达成了什么共识、接下来的时间安排、学生需要做什么
   语气：专业、有温度、易读

请以 JSON 格式输出：
{ "internal": "内部版 Markdown 内容", "external": "客户版 Markdown 内容" }`,
    {
      label: '会议总结Agent（W2）',
      phase: '并行生成',
      schema: {
        type: 'object',
        properties: {
          internal: { type: 'string' },
          external: { type: 'string' },
        },
        required: ['internal', 'external'],
      },
    }
  ),

  // Agent C: 进度更新
  agent(
    `你是南桥教育的 AI 助手。${STUDENT} 刚刚完成了第${MEETING_NUMBER}场会议。

当前进度：
${fs.existsSync(path.join(CONSULTING_DIR, STUDENT, '客户咨询进度.md')) ? fs.readFileSync(path.join(CONSULTING_DIR, STUDENT, '客户咨询进度.md'), 'utf-8') : '（新学生）'}

会议信息：
- 日期：${today}
- 参会人：${attendeesStr}

规则：上传了逐字稿 → 至少推进到"开会与发评估"
子状态："会议已开（${today}，参会人：${attendeesStr}），待生成评估"
⚠️ "评估已发送"由客服手动触发 W3，不自动判定

请输出更新后的完整 客户咨询进度.md（保持原有 frontmatter 格式，更新 stage 和时间线）。`,
    { label: '进度更新Agent（W2）', phase: '并行生成' }
  ),

  // Agent D: 待办提取
  agent(
    `你是南桥教育的 AI 助手。请从 ${STUDENT} 的会议逐字稿中提取待办事项。

会议逐字稿：
${mdContent}

全局待办清单：
${fs.existsSync(path.join(CONSULTING_DIR, '待办清单.md')) ? fs.readFileSync(path.join(CONSULTING_DIR, '待办清单.md'), 'utf-8') : '（暂无）'}

重要：只提取标准流程外的特殊事项
❌ 不算待办（仅这两项）：发送会议总结、发送评估报告
✅ 其他全部算待办：约下次会议、发服务手册、发案例、任何额外需求

输出：更新后的全局待办清单（Markdown 格式），每个学生一个 ## 部分。
如果没有新待办，返回原文件内容不变。`,
    { label: '待办提取Agent（W2）', phase: '并行生成' }
  ),

  // Agent E: 会议安排
  agent(
    `你是南桥教育的 AI 助手。请从 ${STUDENT} 的会议逐字稿中提取会议时间。

会议逐字稿：
${mdContent}

全局会议安排：
${fs.existsSync(path.join(CONSULTING_DIR, '会议安排.md')) ? fs.readFileSync(path.join(CONSULTING_DIR, '会议安排.md'), 'utf-8') : '（暂无）'}

提取：
- 本次会议的时间 + 参会人（状态：已发生）
- 如果逐字稿中提到了下次会议时间 → 一并提取（状态：待定）
- 如果没提到 → 只记录本次已发生的会议

输出：更新后的全局会议安排（Markdown 表格格式）：
| 时间 | 学生 | 参会人 | 状态 |`,
    { label: '会议安排Agent（W2）', phase: '并行生成' }
  ),
]);

// ── 写入 Phase 4 结果 ──

// 会议总结Agent → 两个文件
if (summaryResult) {
  const internalPath = path.join(CONSULTING_DIR, STUDENT, '会议逐字稿', `第${MEETING_NUMBER}场-会议总结.md`);
  const externalPath = path.join(CONSULTING_DIR, STUDENT, '会议逐字稿', `第${MEETING_NUMBER}场-会议总结-客户版.md`);

  fs.writeFileSync(internalPath, summaryResult.internal || '', 'utf-8');
  fs.writeFileSync(externalPath, summaryResult.external || '', 'utf-8');
  log('✅ 会议总结（内部版 + 客户版）已生成');
}

// 进度更新Agent
if (progressResult && progressResult.trim()) {
  const progressPath = path.join(CONSULTING_DIR, STUDENT, '客户咨询进度.md');
  fs.writeFileSync(progressPath, progressResult.trim(), 'utf-8');
  log('✅ 客户咨询进度已更新');
}

// 待办提取Agent
if (todoResult && todoResult.trim()) {
  const todoPath = path.join(CONSULTING_DIR, '待办清单.md');
  fs.writeFileSync(todoPath, todoResult.trim(), 'utf-8');
  log('✅ 待办清单已更新');
}

// 会议安排Agent
if (meetingResult && meetingResult.trim()) {
  const meetingPath = path.join(CONSULTING_DIR, '会议安排.md');
  fs.writeFileSync(meetingPath, meetingResult.trim(), 'utf-8');
  log('✅ 会议安排已更新');
}

log('W2 会议记录处理完成');
return { ok: true, student: STUDENT, meetingNumber: MEETING_NUMBER };
