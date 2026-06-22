export const meta = {
  name: '生成评估与建议',
  description: 'W3：手动触发，读取该学生全部会议资料，生成/更新一份完整评估与建议文档',
  phases: [
    { title: '读取资料', detail: '读取全部会议逐字稿、会议总结、学生信息总结' },
    { title: '生成评估', detail: '基于全部会议资料生成 6 节评估文档' },
    { title: '更新进度', detail: '更新客户咨询进度子状态' },
  ],
};

const STUDENT = args.student;
const CONSULTING_DIR = '../咨询管理';

const fs = require('fs');
const path = require('path');

// ── Phase 1: 读取全部相关资料 ──
phase('读取资料');

const studentDir = path.join(CONSULTING_DIR, STUDENT);
const transcriptDir = path.join(studentDir, '会议逐字稿');

let allTranscripts = '';
let allSummaries = '';
let existingAssessment = '';

if (fs.existsSync(transcriptDir)) {
  const files = fs.readdirSync(transcriptDir).filter(f => f.endsWith('.md') && !f.includes('会议总结'));
  for (const f of files.sort()) {
    allTranscripts += `\n\n=== ${f} ===\n\n`;
    allTranscripts += fs.readFileSync(path.join(transcriptDir, f), 'utf-8');
  }
  const summaryFiles = fs.readdirSync(transcriptDir).filter(f => f.includes('会议总结') && !f.includes('客户版'));
  for (const f of summaryFiles.sort()) {
    allSummaries += `\n\n=== ${f} ===\n\n`;
    allSummaries += fs.readFileSync(path.join(transcriptDir, f), 'utf-8');
  }
}

// 已有评估（如有）
const assessmentDir = path.join(studentDir, '评估与建议');
const assessmentPath = path.join(assessmentDir, '评估与建议.md');
if (fs.existsSync(assessmentPath)) {
  existingAssessment = fs.readFileSync(assessmentPath, 'utf-8');
}

const infoSummary = fs.existsSync(path.join(studentDir, '学生信息总结.md'))
  ? fs.readFileSync(path.join(studentDir, '学生信息总结.md'), 'utf-8')
  : '';

log(`会议场次：${allTranscripts ? allTranscripts.split('=== ').length - 1 : 0}`);
log(`已有评估：${existingAssessment ? '是（将更新）' : '否（新建）'}`);

if (!allTranscripts) {
  log('❌ 没有找到任何会议逐字稿，请先上传会议记录');
  return { ok: false, error: '没有会议逐字稿' };
}

// ── Phase 2: 生成评估与建议 ──
phase('生成评估');

const assessmentResult = await agent(
  `你是南桥教育的升学顾问 AI。请基于 ${STUDENT} 的全部会议资料生成一份评估与建议文档。

学生信息总结：
${infoSummary || '（暂无）'}

全部会议逐字稿：
${allTranscripts}

全部会议总结：
${allSummaries}

${existingAssessment ? `已有评估与建议（请在此基础上更新）：\n${existingAssessment}` : '（这是首次生成评估）'}

生成的文档是客户-facing 的，会发送给学生/家长阅读。语气：专业、有温度。

文档结构（6 节）：

## 学生画像速览
（学生基本情况、成绩、活动、性格特点的简要总结）

## 匹配度分析
（与上纽/昆杜的匹配程度，优势和差距分别是什么）

## 申请时间线
（从现在到申请截止的关键时间节点）

## 需要突破的方向
（学生目前最需要在哪些方面加强）

## 推荐方案
（南桥可以为学生提供什么辅导方案）

## 下一步
（建议学生/家长接下来做什么）

请输出完整的 Markdown 文档，以 # ${STUDENT} · 评估与建议 开头。`,
  { label: '评估生成Agent（W3）', phase: '生成评估' }
);

if (!assessmentResult || !assessmentResult.trim()) {
  log('❌ 评估生成失败');
  return { ok: false, error: '评估生成无结果' };
}

// 确保目录存在
if (!fs.existsSync(assessmentDir)) fs.mkdirSync(assessmentDir, { recursive: true });

fs.writeFileSync(assessmentPath, assessmentResult.trim(), 'utf-8');
log('✅ 评估与建议已生成');

// ── Phase 3: 更新进度 ──
phase('更新进度');

const progressPath = path.join(studentDir, '客户咨询进度.md');
if (fs.existsSync(progressPath)) {
  let progressContent = fs.readFileSync(progressPath, 'utf-8');
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 更新子状态
  progressContent = progressContent.replace(
    /待生成评估/g,
    `评估已于 ${timeStr} 生成并发送`
  );

  // 追加时间线
  if (!progressContent.includes('评估已生成')) {
    progressContent += `\n- ${timeStr} 评估已生成并发送`;
  }

  fs.writeFileSync(progressPath, progressContent, 'utf-8');
  log('✅ 客户咨询进度已更新');
}

log('W3 评估与建议生成完成');
return { ok: true, student: STUDENT, path: '评估与建议/评估与建议.md' };
