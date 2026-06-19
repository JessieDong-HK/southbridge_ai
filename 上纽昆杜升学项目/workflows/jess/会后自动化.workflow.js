export const meta = {
  name: '会后自动化处理',
  description: '把咨询会议逐字稿自动处理为：追加咨询记录到学生档案 + 更新档案信息 + 更新跟进看板 + 识别话术机会。输入：transcriptPath（逐字稿路径） + studentName（学生姓名）。',
  phases: [
    { title: '分析', detail: '深度阅读逐字稿，提取结构化信息' },
    { title: '生成', detail: '并行：追加咨询记录到档案 + 识别话术机会点' },
    { title: '更新', detail: '并行：更新档案信息 + 更新跟进看板' },
  ],
}

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    meetingType: { type: 'string', description: '家长会议 | 学生会议' },
    meetingNumber: { type: 'string', description: '第X场' },
    date: { type: 'string', description: 'YYYY-MM-DD' },
    participants: { type: 'string' },
    duration: { type: 'string', description: '约X分钟' },
    background: { type: 'string' },
    discussionPoints: {
      type: 'array',
      items: { type: 'object', properties: { topic: {type:'string'}, studentSaid: {type:'string'}, weSaid: {type:'string'}, insight: {type:'string'} } },
      description: '核心讨论点',
    },
    studentQuotes: { type: 'array', items: { type: 'string' } },
    ourScripts: { type: 'array', items: { type: 'string' } },
    unresolvedIssues: { type: 'array', items: { type: 'string' } },
    decision: { type: 'string' },
    nextAction: { type: 'string' },
    responsiblePerson: { type: 'string' },
    followUpDate: { type: 'string' },
    newStudentInfo: {
      type: 'object',
      properties: { english: {type:'string'}, activities: {type:'string'}, personality: {type:'string'}, concerns: {type:'string'}, familyInfo: {type:'string'}, other: {type:'string'} },
      description: '新发现的学生信息',
    },
    reflections: {
      type: 'object',
      properties: { doneWell: {type:'string'}, improve: {type:'string'}, scriptQuality: {type:'string'} },
    },
    scriptOpportunities: {
      type: 'array',
      items: { type: 'object', properties: { script: {type:'string'}, scenario: {type:'string'}, whyEffective: {type:'string'} } },
    },
  },
}

// ============================================================
// Phase 1
// ============================================================
phase('分析')

const ROOT = '/Users/jess/Desktop/自动化agent code/上纽昆杜升学项目/咨询管理'

const analysis = await agent(
  `深度阅读逐字稿并输出结构化分析。逐字稿：${args.transcriptPath}，学生：${args.studentName}。使用 StructuredOutput 返回结果。`,
  { phase: '分析', schema: ANALYSIS_SCHEMA }
)

if (!analysis) {
  log('❌ 分析失败')
  return { error: '分析阶段失败' }
}

log(`✅ 分析完成：${analysis.discussionPoints?.length || 0} 个讨论点，${analysis.studentQuotes?.length || 0} 条发言，${analysis.scriptOpportunities?.length || 0} 个话术机会`)

// ============================================================
// Phase 2: 并行 — 追加记录 + 识别话术
// ============================================================
phase('生成')

const appendRecordPrompt = (a) => `你需要将本次咨询记录追加到学生档案中。

学生档案路径：${ROOT}/${args.studentName}/学生档案.md
分析结果：${JSON.stringify(a, null, 2)}

操作步骤：
1. Read 读取学生档案
2. 在档案的"咨询历史"表格中新增一行：
   | ${a.date || 'YYYY-MM-DD'} | ${a.meetingType || '家长会议'} | ${a.participants || ''} | ${a.decision || ''} |
3. 在档案末尾的"# 咨询记录"区域，追加以下格式的记录（如果还没有"# 咨询记录"标题则先创建）：

## ${a.date || 'YYYY-MM-DD'} · ${a.meetingNumber || '第X场'} · ${a.meetingType || '家长会议'}
**参会人**：${a.participants || ''} | **时长**：${a.duration || '约30分钟'}
### 咨询前背景
${a.background || ''}
### 核心讨论点
（遍历 discussionPoints，每个一个 #### 小节）
### 学生关键发言
（逐条 > 引用）
### 我们的话术输出
（逐条 > 引用）
### 未解决问题
（逐条 - [ ]）
### 决策与下一步
- **结论**：${a.decision || ''}
- **下一步**：${a.nextAction || ''} @${a.responsiblePerson || ''}
- **建议跟进日期**：📅 ${a.followUpDate || ''}
### 会后反思
- ✅ ${a.reflections?.doneWell || ''}
- 🔧 ${a.reflections?.improve || ''}
- 💬 ${a.reflections?.scriptQuality || ''}

4. 用 Edit 工具将改动写入学生档案
5. 返回"已追加到学生档案"`

const identifyScriptsPrompt = (a) => `识别本次咨询中值得保留的好话术：${JSON.stringify(a.scriptOpportunities || [])} / ${JSON.stringify(a.ourScripts || [])}。归类到统一话术场景，说明为什么值得保留。不需要写文件。`

const [recordResult, scriptResult] = await parallel([
  () => agent(appendRecordPrompt(analysis), { phase: '生成', label: '追加记录' }),
  () => agent(identifyScriptsPrompt(analysis), { phase: '生成', label: '识别话术' }),
])

log(`📝 咨询记录：${recordResult || '追加失败'}`)
log(`💬 话术识别：已完成`)

// ============================================================
// Phase 3: 并行 — 更新档案信息 + 更新看板
// ============================================================
phase('更新')

const updateProfilePrompt = (a) => `更新学生档案中的信息字段。

档案路径：${ROOT}/${args.studentName}/学生档案.md
新发现的信息：${JSON.stringify(a.newStudentInfo || {})}

操作：
1. Read 读取学生档案
2. 如果 newStudentInfo 中有新信息，用 Edit 更新对应字段（学术画像、活动、性格、家庭等）
3. 更新 frontmatter 的 updated 日期
4. 如果有新的待办事项，追加到"待办事项"列表
5. 返回更新了哪些字段`

const updateDashboardPrompt = (a) => `更新跟进看板。

学生：${args.studentName}
下一步：${a.nextAction || '待确认'}
责任人：${a.responsiblePerson || '待分配'}
跟进日期：${a.followUpDate || '待定'}

操作：
1. Read ${ROOT}/跟进管理/_看板-当前跟进状态.md
2. 根据跟进日期判断优先级（3天内→紧急，7天内→本周，30天内→近期），更新/新增该学生的行
3. Read ${ROOT}/跟进管理/待跟进队列.md，更新待办项
4. 返回变更摘要`

const [profileResult, dashboardResult] = await parallel([
  () => agent(updateProfilePrompt(analysis), { phase: '更新', label: '更新档案' }),
  () => agent(updateDashboardPrompt(analysis), { phase: '更新', label: '更新看板' }),
])

log(`📋 档案更新：${profileResult || '完成'}`)
log(`📊 看板更新：${dashboardResult || '完成'}`)

return {
  student: args.studentName,
  meeting: { type: analysis.meetingType, date: analysis.date },
  summary: `✅ ${args.studentName} 会后处理完成：咨询记录已追加到档案 + 档案信息更新 + 看板更新，发现 ${analysis.scriptOpportunities?.length || 0} 个话术机会`,
}
