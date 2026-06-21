export const meta = {
  name: '聊天记录处理',
  description: 'W1：上传微信聊天截图 → OCR 提取 → 追加聊天记录 → 更新信息总结/进度/待办/会议',
  phases: [
    { title: 'OCR 提取', detail: 'OCR提取Agent（W1）读取截图，输出结构化聊天消息' },
    { title: '写入聊天记录', detail: '将 OCR 结果追加到微信聊天记录.md' },
    { title: '分析并写入', detail: '信息提取/进度判断/待办提取/会议提取 四个 Agent 并行' },
  ],
};

const STUDENT = args.student;
const IDENTITY = args.identity;
const SCREENSHOT_DIR = args.screenshotDir;
const CONSULTING_DIR = '../咨询管理';

// ── Phase 1: OCR 提取 ──
phase('OCR 提取');

const ocrResult = await agent(
  `你需要从微信聊天截图中提取对话内容。

截图目录：${SCREENSHOT_DIR}

请逐张读取截图，提取每一条消息的结构化信息：
- speaker: 说话人（根据微信备注名或昵称判断）
- content: 说话内容（完整原话，不要改写）
- datetime: 消息时间。注意微信截图中的时间是相对的（"今天""昨天""周三"），
  请根据截图的文件创建时间推算具体日期，输出格式为 "YYYY-MM-DD HH:MM"

输出 JSON 数组：
[{ "speaker": "家长", "content": "你好，我想咨询一下上纽的申请", "datetime": "2026-06-20 14:30" }, ...]

如果某条消息没有显示具体时间，根据上下文推算。按时间顺序排列。`,
  {
    label: 'OCR提取Agent（W1）',
    phase: 'OCR 提取',
    schema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              speaker: { type: 'string' },
              content: { type: 'string' },
              datetime: { type: 'string' },
            },
            required: ['speaker', 'content', 'datetime'],
          },
        },
      },
      required: ['messages'],
    },
  }
);

if (!ocrResult || !ocrResult.messages || ocrResult.messages.length === 0) {
  log('⚠️ OCR 未提取到任何消息，Workflow 终止');
  return { ok: false, error: 'OCR 无结果' };
}

log(`OCR 完成，提取到 ${ocrResult.messages.length} 条消息`);

// ── Phase 2: 写入聊天记录 ──
phase('写入聊天记录');

const fs = require('fs');
const path = require('path');

const chatFilePath = path.join(CONSULTING_DIR, STUDENT, '微信聊天记录.md');

// 读取已有聊天记录用于去重
let existingChat = '';
if (fs.existsSync(chatFilePath)) {
  existingChat = fs.readFileSync(chatFilePath, 'utf-8');
}

// 身份 → 文件内 ## 标题映射
const sectionMap = {
  '学生家长': '## 学生家长',
  '学生本人': '## 学生本人',
  '家长学生群聊': '## 家长学生群聊',
};

const targetSection = sectionMap[IDENTITY] || '## 学生家长';

// 去重：检查每条消息是否已存在
const newMessages = ocrResult.messages.filter(msg => {
  const line = `**${msg.datetime}** ${msg.speaker}：`;
  return !existingChat.includes(line);
});

if (newMessages.length === 0) {
  log('所有消息已存在，无需追加');
} else {
  // 生成新消息的 Markdown
  const newLines = newMessages.map(msg =>
    `**${msg.datetime}** ${msg.speaker}：\n${msg.content}\n`
  ).join('\n');

  // 找到目标 section，在其末尾追加
  const sectionIndex = existingChat.indexOf(targetSection);
  if (sectionIndex === -1) {
    // section 不存在，追加到文件末尾
    fs.appendFileSync(chatFilePath, `\n${targetSection}\n\n${newLines}`, 'utf-8');
  } else {
    // 找到下一个 ## 的位置，在此之前插入
    const afterSection = existingChat.indexOf('\n## ', sectionIndex + targetSection.length);
    if (afterSection === -1) {
      // 这是最后一个 section
      fs.appendFileSync(chatFilePath, `\n${newLines}`, 'utf-8');
    } else {
      const before = existingChat.substring(0, afterSection);
      const after = existingChat.substring(afterSection);
      fs.writeFileSync(chatFilePath, `${before}\n${newLines}\n${after}`, 'utf-8');
    }
  }

  log(`追加了 ${newMessages.length} 条新消息到 ${IDENTITY} 部分`);
}

// ── Phase 3: 并行分析 ──
phase('分析并写入');

const [infoResult, progressResult, todoResult, meetingResult] = await Promise.all([
  // Agent B: 信息提取
  agent(
    `你是南桥教育的 AI 助手。请从以下微信聊天记录中提取关于学生 ${STUDENT} 的新事实。

已有学生信息总结：
${fs.existsSync(path.join(CONSULTING_DIR, STUDENT, '学生信息总结.md')) ? fs.readFileSync(path.join(CONSULTING_DIR, STUDENT, '学生信息总结.md'), 'utf-8') : '（暂无）'}

聊天记录：
${fs.readFileSync(chatFilePath, 'utf-8')}

从聊天中提取关于这个学生的新事实（已有总结里没有的）：
- 成绩变化（新SAT/托福/雅思分数、校内排名等）
- 活动更新（新竞赛、新项目、新奖项）
- 关注点变化（本来只考虑上纽，现在考虑上纽和昆杜）
- 家庭新情况（预算变化、家长态度变化）

只输出"已有总结里没有的新信息"。如果没有新信息，返回空。

请输出更新后的完整学生信息总结（Markdown 格式，以 # ${STUDENT} · 学生信息总结 开头）。`,
    { label: '信息提取Agent（W1）', phase: '分析并写入' }
  ),

  // Agent C: 进度判断
  agent(
    `你是南桥教育的 AI 助手。请根据 ${STUDENT} 的微信聊天记录判断当前咨询进度阶段。

当前状态（从客户咨询进度.md 读取）：
${fs.existsSync(path.join(CONSULTING_DIR, STUDENT, '客户咨询进度.md')) ? fs.readFileSync(path.join(CONSULTING_DIR, STUDENT, '客户咨询进度.md'), 'utf-8') : '（新学生）'}

聊天记录：
${fs.readFileSync(chatFilePath, 'utf-8')}

判定规则（内联，不要引用外部文档）：
① 添加微信：仅有添加微信的对话，尚未开始筛查提问
② 筛查：客服开始询问具体信息。筛查 4 项：地理位置、学校、校内排名、英语成绩
   - 未问全 → 显示"已问：X；待问：Y"
   - 已问全 → 显示"已完成筛查（时间）"
③ 开会与发评估：提到约会/发评估。子状态：待约定 → 会议时间（评估未发送）→ 会议时间+评估发送时间
④ 跟进：评估已发送即进入。两轮：第一轮资源/活动提醒，第二轮学生案例分享
   子状态：待开始第一轮/第一轮进行中/第一轮完成待第二轮/第二轮进行中/两轮完成
⑤ 已签约：聊天中明确签约确认
⑥ 已流失：家长/学生明确拒绝。未回复≠流失，保留在跟进阶段

只升不降，不回退。

请输出更新后的完整 客户咨询进度.md（保持原有 frontmatter 格式，更新 stage 和时间线）。`,
    { label: '进度判断Agent（W1）', phase: '分析并写入' }
  ),

  // Agent D: 待办提取
  agent(
    `你是南桥教育的 AI 助手。请从 ${STUDENT} 的微信聊天记录中提取待办事项。

聊天记录：
${fs.readFileSync(chatFilePath, 'utf-8')}

全局待办清单：
${fs.existsSync(path.join(CONSULTING_DIR, '待办清单.md')) ? fs.readFileSync(path.join(CONSULTING_DIR, '待办清单.md'), 'utf-8') : '（暂无）'}

重要规则：
❌ 不算待办（仅这两项是标准流程）：发送会议总结、发送评估报告
✅ 其他全部算待办，例如：约下次会议、发送服务手册、发过去学生案例、任何额外需求

输出：更新后的全局待办清单（Markdown 格式），每个学生一个 ## 部分。
如果没有新待办，返回原文件内容不变。`,
    { label: '待办提取Agent（W1）', phase: '分析并写入' }
  ),

  // Agent E: 会议提取
  agent(
    `你是南桥教育的 AI 助手。请从 ${STUDENT} 的微信聊天记录中识别会议时间约定。

聊天记录：
${fs.readFileSync(chatFilePath, 'utf-8')}

全局会议安排：
${fs.existsSync(path.join(CONSULTING_DIR, '会议安排.md')) ? fs.readFileSync(path.join(CONSULTING_DIR, '会议安排.md'), 'utf-8') : '（暂无）'}

从聊天中识别：学生、会议时间、参会人、状态（已发生/待定）。
如果没提到任何会议时间 → 返回原文件内容不变。

输出：更新后的全局会议安排（Markdown 表格格式）：
| 时间 | 学生 | 参会人 | 状态 |`,
    { label: '会议提取Agent（W1）', phase: '分析并写入' }
  ),
]);

// ── 写入 Phase 3 结果 ──

// 信息提取Agent → 学生信息总结.md
if (infoResult && infoResult.trim() && !infoResult.includes('没有新信息')) {
  const summaryPath = path.join(CONSULTING_DIR, STUDENT, '学生信息总结.md');
  fs.writeFileSync(summaryPath, infoResult.trim(), 'utf-8');
  log('✅ 学生信息总结已更新');
} else {
  log('ℹ️ 学生信息总结无更新');
}

// 进度判断Agent → 客户咨询进度.md
if (progressResult && progressResult.trim()) {
  const progressPath = path.join(CONSULTING_DIR, STUDENT, '客户咨询进度.md');
  fs.writeFileSync(progressPath, progressResult.trim(), 'utf-8');
  log('✅ 客户咨询进度已更新');
}

// 待办提取Agent → 待办清单.md
if (todoResult && todoResult.trim()) {
  const todoPath = path.join(CONSULTING_DIR, '待办清单.md');
  fs.writeFileSync(todoPath, todoResult.trim(), 'utf-8');
  log('✅ 待办清单已更新');
}

// 会议提取Agent → 会议安排.md
if (meetingResult && meetingResult.trim()) {
  const meetingPath = path.join(CONSULTING_DIR, '会议安排.md');
  fs.writeFileSync(meetingPath, meetingResult.trim(), 'utf-8');
  log('✅ 会议安排已更新');
}

log('W1 聊天记录处理完成');
return { ok: true, messagesAdded: newMessages?.length || 0 };
