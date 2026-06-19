export const meta = {
  name: '生成评估建议',
  description: '从咨询会议记录自动生成客户-facing 评估与建议文档。半自动：生成草稿 → Jess 审阅 → 发送。输入：studentName（必填） + meetingNumber（可选，默认最新场）。',
  phases: [
    { title: '读取', detail: '读取学生档案 + 咨询记录 + 逐字稿' },
    { title: '生成', detail: '基于会议内容生成结构化评估建议' },
    { title: '写入', detail: '保存到学生文件夹供审阅' },
  ],
}

const ASSESSMENT_SCHEMA = {
  type: 'object',
  properties: {
    studentSnapshot: {
      type: 'string',
      description: '学生画像速览（2-3句话）：学校、年级、目标校、学生特点概括。让家长感觉"你真正了解我的孩子"。语气：专业、有温度。',
    },
    matchNYU: {
      type: 'object',
      properties: {
        level: { type: 'string', description: '匹配度定性判断，如"高/较高/中等"（非打分）' },
        strengths: { type: 'array', items: { type: 'string' }, description: '对上纽的匹配优势，2-3条具体理由' },
        notes: { type: 'array', items: { type: 'string' }, description: '需要注意或提升的点' },
      },
    },
    matchDKU: {
      type: 'object',
      properties: {
        level: { type: 'string' },
        strengths: { type: 'array', items: { type: 'string' } },
        notes: { type: 'array', items: { type: 'string' } },
      },
    },
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          period: { type: 'string', description: '时间段，如"2026年7-8月"' },
          task: { type: 'string', description: '该阶段需要完成的关键任务' },
          why: { type: 'string', description: '为什么这个时间点重要' },
        },
      },
      description: '申请时间线，以月为单位标注关键节点',
    },
    breakthroughAreas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string', description: '需要突破的方向' },
          current: { type: 'string', description: '现状描述' },
          target: { type: 'string', description: '目标状态' },
          how: { type: 'string', description: '具体怎么做（南桥如何帮助）' },
        },
      },
      description: '2-3个具体需要突破的方向',
    },
    recommendation: {
      type: 'object',
      properties: {
        plan: { type: 'string', description: '推荐的服务方案名称' },
        reason: { type: 'string', description: '为什么推荐这个方案（关联学生具体情况）' },
        riskIfNot: { type: 'string', description: '不选择的风险或机会成本（温和表述，不制造焦虑）' },
      },
    },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
      description: '1-2个具体下一步动作，附时间建议',
    },
  },
}

// ============================================================
// Phase 1: 读取
// ============================================================
phase('读取')

const ROOT = '/Users/jess/Desktop/自动化agent code/上纽昆杜升学项目/咨询管理'
const meetingHint = args.meetingNumber ? `第${args.meetingNumber}场` : '最新一场'

const context = await agent(
  `读取学生 ${args.studentName} 的完整档案和相关会议资料。

操作步骤：
1. Read ${ROOT}/${args.studentName}/学生档案.md
2. 找到${meetingHint}咨询记录（在 # 咨询记录 区域下），提取该场会议的完整内容
3. 如果 ${ROOT}/${args.studentName}/会议逐字稿/ 下有对应日期的逐字稿，Read 读取它
4. 如果 ${ROOT}/${args.studentName}/微信聊天记录/ 下有聊天记录，Read 读取最近部分

返回以下信息的完整摘要：
- 学生基本信息（学校、年级、排名、语言、目标校、专业方向）
- 学术画像、活动、性格、家庭背景
- 该场咨询记录的完整内容（讨论点、学生发言、决策、下一步）
- 逐字稿中的关键信息（如有）
- 之前已经发送过的评估建议（检查 评估与建议/ 目录）
`,
  { phase: '读取', label: '读取资料' }
)

if (!context) {
  log('❌ 无法读取学生资料')
  return { error: '读取阶段失败——请确认学生姓名正确且档案存在' }
}

log(`✅ 已读取 ${args.studentName} 的资料`)

// ============================================================
// Phase 2: 生成评估建议
// ============================================================
phase('生成')

const assessment = await agent(
  `你是一位资深留学顾问。你需要为家长/学生撰写一份"评估与建议"文档。

这是客户-facing 文档——家长会直接在微信里读到它。所以：
- 语气：专业、温暖、有洞察力，不是冷冰冰的报告
- 长度：精炼，微信可直接发送，不要太长（全文控制在800-1500字）
- 目的：展示你对孩子的理解深度 + 给出清晰的路线图 + 自然引导到下一步

基于以下资料生成：
${context}

文档结构（用 Markdown）：

# 评估与建议 · ${args.studentName} · ${meetingHint}

> 📅 会议日期：[从记录提取] | 👥 参会人：[从记录提取]

## 学生画像速览
[2-3句话，概述学生情况。语气：让对方觉得"对，这就是我的孩子/我自己"]

## 匹配度分析
### 上纽
[优势 + 需注意的点，定性判断而非打分]

### 昆杜
[同上。如果学生只申一校，只写那一校]

## 申请时间线
[按月列出关键节点，标注哪些是现在就要开始准备的]
[用简洁的列表格式，不要大段文字]

## 需要突破的方向
[2-3个方向，每个：现状 → 目标 → 怎么做]
[这是展示南桥价值的部分——不说"我们能帮你"，而是说"你需要做到X，而X可以通过Y来实现"]

## 推荐方案
[方案名称 + 为什么推荐 + 简要说明]
[不 push，给空间："不管是否合作，以上分析都供你参考"]

## 下一步
- [1-2个具体动作 + 时间]

---
💬 以上是基于我们今天聊的内容的整理。有任何问题随时找我。

用 StructuredOutput 返回。`,
  { phase: '生成', schema: ASSESSMENT_SCHEMA }
)

if (!assessment) {
  log('❌ 生成失败')
  return { error: '生成阶段失败' }
}

log(`✅ 评估建议已生成`)
log(`   匹配度：上纽${assessment.matchNYU?.level || '?'} / 昆杜${assessment.matchDKU?.level || '?'}`)
log(`   突破方向：${assessment.breakthroughAreas?.length || 0} 个`)
log(`   推荐方案：${assessment.recommendation?.plan || '?'}`)

// ============================================================
// Phase 3: 写入
// ============================================================
phase('写入')

// Compose the full markdown document from structured output
const composeDoc = (a) => {
  const lines = []
  lines.push(`# 评估与建议 · ${args.studentName} · ${meetingHint}`)
  lines.push('')
  lines.push(`> 📅 会议日期：${a.date || '待填'} | 👥 参会人：${a.participants || '待填'}`)
  lines.push('')
  lines.push('## 学生画像速览')
  lines.push('')
  lines.push(a.studentSnapshot || '')
  lines.push('')
  lines.push('## 匹配度分析')
  lines.push('')
  lines.push('### 上纽')
  lines.push('')
  if (a.matchNYU) {
    lines.push(`**整体匹配度**：${a.matchNYU.level || '待评估'}`)
    lines.push('')
    if (a.matchNYU.strengths?.length) {
      lines.push('**优势**：')
      a.matchNYU.strengths.forEach(s => lines.push(`- ${s}`))
      lines.push('')
    }
    if (a.matchNYU.notes?.length) {
      lines.push('**需关注**：')
      a.matchNYU.notes.forEach(n => lines.push(`- ${n}`))
      lines.push('')
    }
  }
  lines.push('### 昆杜')
  lines.push('')
  if (a.matchDKU) {
    lines.push(`**整体匹配度**：${a.matchDKU.level || '待评估'}`)
    lines.push('')
    if (a.matchDKU.strengths?.length) {
      lines.push('**优势**：')
      a.matchDKU.strengths.forEach(s => lines.push(`- ${s}`))
      lines.push('')
    }
    if (a.matchDKU.notes?.length) {
      lines.push('**需关注**：')
      a.matchDKU.notes.forEach(n => lines.push(`- ${n}`))
      lines.push('')
    }
  }
  lines.push('## 申请时间线')
  lines.push('')
  if (a.timeline?.length) {
    a.timeline.forEach(t => {
      lines.push(`- **${t.period}**：${t.task}（${t.why}）`)
    })
    lines.push('')
  }
  lines.push('## 需要突破的方向')
  lines.push('')
  if (a.breakthroughAreas?.length) {
    a.breakthroughAreas.forEach((b, i) => {
      lines.push(`### ${i + 1}. ${b.area}`)
      lines.push(`- **现状**：${b.current}`)
      lines.push(`- **目标**：${b.target}`)
      lines.push(`- **怎么做**：${b.how}`)
      lines.push('')
    })
  }
  lines.push('## 推荐方案')
  lines.push('')
  if (a.recommendation) {
    lines.push(`**推荐**：${a.recommendation.plan || '待定'}`)
    lines.push('')
    if (a.recommendation.reason) lines.push(`${a.recommendation.reason}`)
    lines.push('')
    if (a.recommendation.riskIfNot) lines.push(`> 💡 ${a.recommendation.riskIfNot}`)
    lines.push('')
  }
  lines.push('## 下一步')
  lines.push('')
  if (a.nextSteps?.length) {
    a.nextSteps.forEach(s => lines.push(`- ${s}`))
    lines.push('')
  }
  lines.push('---')
  lines.push('💬 以上是基于我们今天聊的内容的整理。有任何问题随时找我。')
  return lines.join('\n')
}

const docContent = composeDoc(assessment)

const writeResult = await agent(
  `将以下评估建议文档保存到学生文件夹。

操作：
1. 确保目录存在：${ROOT}/${args.studentName}/评估与建议/
2. 将以下内容写入 ${ROOT}/${args.studentName}/评估与建议/第X场-评估与建议.md（X 用实际会议场次替换）

文档内容：
${docContent}

3. 用 Write 工具写入文件
4. 返回保存的文件路径`,
  { phase: '写入', label: '保存文件' }
)

log(`📄 ${writeResult || '文件已保存'}`)

return {
  student: args.studentName,
  meeting: meetingHint,
  path: `${args.studentName}/评估与建议/`,
  summary: `✅ 评估建议已生成：上纽匹配度${assessment.matchNYU?.level || '?'}，昆杜${assessment.matchDKU?.level || '?'}，${assessment.breakthroughAreas?.length || 0}个突破方向。请审阅后发送。`,
  preview: docContent.substring(0, 500) + '...',
}
