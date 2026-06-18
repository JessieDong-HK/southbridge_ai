# 02 · ADPList 深度调研

> 调研日期：2026-06-18。来源：官网 + 博客 + 第三方 UX 评审 + Trustpilot + Mentor 入驻指南。

---

## 一、ADPList 是什么

- 2020 年由 Felix Lee 创立，使命「democratize mentorships for all」
- **免费** 1v1 视频 mentorship 平台，连接 mentee 和 mentor
- 覆盖设计、产品、工程、AI、市场营销、领导力等领域
- 规模：**40,000+ mentor**，140+ 国家，累计 100 万+ session、5 亿+ 分钟

---

## 二、Mentor 发现 & 浏览

### 首页 / 浏览入口
- 按 **expertise（专业领域）** 浏览：Design、Product、Engineering、AI、Marketing、Leadership 等
- 按 **location / company** 筛选（如 Google、Meta、Amazon）
- 搜索栏（随意输入，无 autocomplete——被批评为模糊）

### Mentor 卡片（列表页）

每张 mentor 卡片展示的信息：

```
┌──────────────────────────────────┐
│ [头像]  姓名                      │
│         职位 @ 公司                │
│         🇺🇸 位置                   │
│                                  │
│ 📊 383 sessions (110 reviews)    │
│ 🕐 20 years experience           │
│ ✅ 95% Avg. Attendance           │
│                                  │
│ [🏷 Top rated] [Available ASAP]  │
└──────────────────────────────────┘
```

**卡片的信任信号**：
- Session 总数 + review 数
- 工作经验年限
- 平均出勤率（对 no-show 问题的重要回应）
- Badge：Top rated / Available ASAP / New mentor / Advance

**卡片设计原则**：
- 整张卡片可点击 → 进入完整 profile
- 卡片是浏览入口，不是信息终点——信息精简
- 移动端垂直堆叠

### Mentor Profile 页（详情页）

滚动式单页布局，结构如下：

| 区域 | 内容 |
|------|------|
| **Header** | 头像、姓名、职位、公司、位置、关键数据 |
| **About / Bio** | 个人介绍（默认只展示前 2 行，点开看全部）|
| **Ask Me About** | 具体技能/话题标签 |
| **Work Experience & Education** | 职业履历 |
| **Reviews** | 星级评分 + 文字评价 |
| **Availability Calendar** | 类似 Calendly 的日历选时间 |
| **Session Types / Topic Packs** | mentor 提供的 session 类型 |

---

## 三、标签 / 分类体系

### 一级分类（Expertise）
Design、Product、Engineering、AI、Marketing、Leadership、Career Development、No/Low Code、Talent Acquisition 等

### 二级分类（Sub-categories）
每个一级分类下有细分——2023 夏季版新增

### Mentor 侧标签
- **Ask Me About**： mentor 自填的能力/话题标签
- **Languages**： mentor 会说的语言（后来才加到卡片上，之前是痛点）
- **Topic Packs**： ADPList 提供的预定义 session 模板

### 筛选器
- Expertise（专业领域）
- Location / Company
- Gender（2023 夏季新增）
- Language（2023 夏季新增——之前需要点进 profile 才知道语言，被广泛批评）

### 过滤器 UX
- 推荐使用 **chips / pills** 而非 sidebar filter（移动端友好）
- 显示每个筛选项的**结果数量**
- 已选 filter 显示为**可移除的 pill**
- 支持一键清除所有 filter

---

## 四、预约流程

```
浏览 → Mentor Card → Profile 页 → View Available Sessions
  → 选日期 → 选时间 → 填写目标/问题 → Confirm → 加入视频
```

### 关键设计

- **Calendar sync**：mentor 链接 Google Calendar / Outlook → 只显示真实空闲时段
- **Auto-accept**：mentor 可选自动确认，跳过人工审核
- **时区自动处理**
- **Booking limits**：mentor 可分别设置新 mentee 和回头 mentee 的预约上限
- **Block-out dates**：mentor 可封锁不可用时段

### 预约 UX 问题（来自第三方评审）

| 问题 | 描述 |
|------|------|
| ⚠️ 欺骗性 CTA | "Book Session" 按钮在未登录时实际是强制注册——应该写"Sign Up to Book" |
| ⚠️ 表单数据丢失 | 填了 Step 3 的问题 → 回去改日期 → 所有输入全丢 |
| ⚠️ Booking 状态不同步 | 预约成功后回到首页，卡片状态不更新——需手动刷新 |
| ⚠️ 一次只能约一个 | 必须等当前 session 窗口过了才能约下一个 |
| ⚠️ 多 session 预约困难 | 约完一个被扔回首页顶部，不能连续约相邻时段 |

---

## 五、Mentor 入驻流程

### 门槛（~30% 通过率）

| 条件 | 要求 |
|------|------|
| 工作经验 | 7+ 年（部分资料说 5-6 年） |
| 管理/领导经验 | 1+ 年管理、领导或 mentoring 经验 |
| 头像 | 清晰、专业、"有笑容"的照片 |
| Bio | 完整的个人介绍 |
| Diversity & Inclusion | 符合平台多元化标准 |

### 入驻步骤

1. **申请** → 点击"Become a Mentor"，填写背景和 expertise
2. **审核** → 约 3 周+，通过率 ~30%
3. **建 Profile** → 填写工作经历、教育、About（只有前 2 行默认可见！）、上传头像
4. **设置 Calendar** → 链接日历、设可用时段、开 auto-accept
5. **加入社区** → Mentor-only Slack + 双周 Welcome Party
6. **自我推广**（可选）→ 分享 profile 到 LinkedIn/Twitter

### Advance（付费 mentorship）
- 闭门 beta 中
- 条件：6+ 年经验、50+ session 完成、15+ 好评、90%+ 出勤率、<5% 取消率、4.8+ 评分

---

## 六、值得学的设计

| 设计 | ADPList 怎么做 | 我们可以怎么用 |
|------|-------------|--------------|
| **信任信号透明** | Session 数、review 数、出勤率全部公开 | 我们的 mentor profile 也展示 session 完成数和学生评价 |
| **日历同步** | 类似 Calendly，链接 Google/Outlook Calendar | 如果我们不做自动日历，至少要有时区 + 可用时段标记 |
| **Mentor 卡片精简** | 一张卡片 = 一个 mentor，信息精确到决策所需 | 我们的卡片：路径摘要 + 能力标签 + 活人标签 + 可约层级 |
| **Badge 体系** | Top rated / Available ASAP / New mentor | 我们可以有：Top rated / 快速响应 / Founding Mentor |
| **Ask Me About 标签** | Mentor 自填的具体能力标签 | 对应我们的「能力标签」维度 |
| **Languages 筛选** | 后来补上的关键 filter | 我们的 mentor 中英文都有，语言筛选是刚需 |
| **出勤率展示** | 解决 no-show 信任问题 | 长期来看可以加，但 MVP 先不用 |

---

## 七、应该避开的坑

| 坑 | ADPList 的问题 | 我们的对策 |
|------|-------------|----------|
| **Mentor no-show** | Trustpilot 2.6/5，大量投诉 mentor 不来 | 我们的「升级到 Jess」机制 + 出勤追踪 |
| **欺骗性 CTA** | "Book Session" 实际是强制注册 | CTA 永远写清楚下一步会发生什么 |
| **表单数据丢失** | 回退修改时间 → 输入全丢 | 前端保存表单状态 |
| **语言信息缺失** | 早期版本要点进 profile 才知道语言 | 卡片上直接展示语言 |
| **Icon 语义混乱** | 同一个 icon 在不同页面代表不同含义 | Icon 全平台一致 |
| **一次只能约一个** | 要等窗口过了才能约下一个 | 学生一次可以约多个 mentor（不同的人） |
| **审核周期长** | 3 周+ 审核 | 我们不设硬性审核门槛——靠 Jess 二次确认即可 |

---

## 八、对我们的核心启示

1. **ADPList 证明了"免费 mentorship 平台"能做到巨大规模**——但免费也带来了 mentor 质量参差和 no-show 问题。我们走付费路线，mentor 有收入激励，出勤率理论上会更好。

2. **他们的 mentor 卡片信息密度值得参考**：头像 + 姓名 + 路径 + 数据 + 标签 + badge，一张卡片讲完一个 mentor。我们的卡片信息结构可以对齐。

3. **他们的标签体系是「专业领域」而非「赛道」**——因为他们是职业 mentorship 平台。我们是教育赛道 mentorship，所以用「赛道 + 能力」双维度更合适。

4. **预约流程的核心是减少摩擦**：日历同步、时区自动处理、auto-accept——但这些在 MVP 阶段都可以先手动，跑通再加。

5. **最大的教训不是设计问题，是运营问题**：平台再好看，mentor 不来、不回复、no-show——用户一样给 2.6 分。我们的「mentor 不回复 → 升级 Jess」机制，就是在预防这个。

---

## 关联文件

- [01-竞品调研.md](01-竞品调研.md) — 之前做的 6 家竞品分析（含 ADPList 初评）
- [../产品与运营/07-Mentor分级标签系统.md](../产品与运营/07-Mentor分级标签系统.md) — 我们的标签系统
- [../产品与运营/08-平台运营流程设计.md](../产品与运营/08-平台运营流程设计.md) — 我们的预约 & 交付流程
