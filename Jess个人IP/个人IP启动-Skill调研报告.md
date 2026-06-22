# Jess 个人IP启动 — Skill 调研报告

> 调研日期：2026-06-22
> 调研范围：skills.sh 排行榜 + `npx skills find` 多关键词搜索 + WebSearch 交叉验证 + GitHub 仓库核实
> 搜索关键词覆盖：content creation, social media, video script, personal branding, content calendar, multi-platform publishing, newsletter, podcast, SEO, copywriting, audience growth, Chinese platforms (小红书/抖音/B站/微信), brand identity, workflow automation, indie hacker, founder skills

---

## 当前已安装

| Skill | 用途 | 状态 |
|-------|------|------|
| `script-writing` | 视频脚本创作 | 已安装 |
| `xhs` / `xhs-analyze` / `xhs-batch` / `xhs-cover` | 小红书内容提取与分析 | 已安装 |
| `agent-reach` | 全网调研（13平台） | 已安装 |
| `deep-research` | 深度调研报告 | 已安装 |
| `baoyu-youtube-transcript` | YouTube 字幕提取 | 已安装 |
| `douyin-video-summary` | 抖音视频总结 | 已安装 |
| `wechat-article-extractor` | 微信文章提取 | 已安装 |
| `find-skills` | Skill 搜索发现 | 已安装 |

---

## Tier 1 — 必装核心（策略 + 写作 + 日历）

### 1. coreyhaines31/marketingskills
- **安装量**：281,900+
- **GitHub Stars**：12,200+
- **Skills 数量**：35-40+
- **作者**：Corey Haines（Conversion Factory 创始人，B2B SaaS 营销 agency）
- **许可证**：MIT
- **架构特点**：层级式，`product-marketing` skill 位于顶端，所有其他 skill 执行前先读取产品定位
- **覆盖领域**：

| 类别 | Skills |
|------|--------|
| 转化优化 | `cro`, `signup`, `onboarding`, `popups`, `paywalls` |
| 内容与文案 | `copywriting`, `copy-editing`, `cold-email`, `emails`, `social`, `image`, `sms`, `video` |
| SEO与发现 | `seo-audit`, `ai-seo` (GEO/LLMO), `programmatic-seo`, `site-architecture`, `competitors`, `schema` |
| 付费与分发 | `ads`, `ad-creative` |
| 数据分析 | `analytics`, `ab-testing` |
| 留存 | `churn-prevention` |
| 增长工程 | `co-marketing`, `free-tools`, `referrals`, `community-marketing`, `lead-magnets` |
| 策略与变现 | `marketing-ideas`, `marketing-psychology`, `launch`, `pricing` |
| 销售与RevOps | `revops`, `sales-enablement`, `competitor-profiling`, `directory-submissions` |

- **版本**：v2.1.0（2026年5月），支持 Claude Code / OpenAI Codex / Cursor / Windsurf / Gemini CLI
- **媒体评价**：被 The Automation Exchange 评为 "One-Person Marketing Team"，被 Growth Boss Podcast 深度报道
- **安装**：
```bash
npx skills add coreyhaines31/marketingskills
```

### 2. ognjengt/founder-skills
- **Skills 数量**：20+
- **定位**：专为 founder、内容创作者、企业主设计
- **核心 Skills**：

| Skill | 功能 |
|-------|------|
| `x-writer` | X/Twitter 病毒式帖子，51+模板，8种格式，支持 Hormozi/Naval/Gazdecki 等风格克隆 |
| `linkedin-writer` | LinkedIn 病毒式帖子，8+模板，7种格式（Lessons Learned, Blueprint, Story, Strategy, Case Study, Hot Take, Quick Hack） |
| `viral-hook-creator` | 病毒式 hook 生成器 |
| `lead-magnet-generator` | 引流磁铁帖子 |
| `brand-copywriter` | 营销文案（AIDA, PAS, BAB 框架） |
| `sop-creator` | 业务流程 SOP 生成 |
| `strategic-planning` | 3个高影响力增长策略 |
| `go-to-market-plan` | 3个最佳GTM策略 |
| `outreach-specialist` | 高转化冷启动外联序列 |
| `competitor-intel` | 竞品分析 |
| `pricing-strategist` | 分层定价与收入优化 |
| `product-hunt-launch-plan` | Product Hunt 发布策略 |
| `marketing-ideas` | 160+已验证策略中精选5个 |

- **安装**：
```bash
npx skills add ognjengt/founder-skills
```

### 3. Darthflute/social-calendar-skill
- **版本**：v1.0（2026年4月）
- **功能**：一键生成整月社媒内容日历
- **四种模式**：

| 命令 | 功能 |
|------|------|
| `/social-calendar` | 整月内容日历 |
| `/social-audit` | 现有社媒账号审计评分 |
| `/competitor-audit` | 竞品对比矩阵 + 差距分析 |
| `/social-suite` | 一键运行全部三个 |

- **覆盖平台**：LinkedIn, X/Twitter, Instagram (Feed/Reels/Stories), Facebook, TikTok, YouTube Shorts, YouTube 长视频, Threads, Pinterest, Reddit
- **5阶段日历构建流程**：品牌研究 → 关键词提取 → 社区调研（Reddit/X/YouTube）→ 叙事简报（你审批后才会写帖）→ 日历生成 + Excel 输出
- **核心差异化**：每个平台生成真正原生内容，不是同一段话复制粘贴
- **安装**：
```bash
npx skills add Darthflute/social-calendar-skill
```

---

## Tier 2 — 内容创作引擎

### 4. vyralcontent/content-skills
- **功能**：专攻 TikTok/Reels/YouTube Shorts 短视频脚本
- **核心能力**：
  - 6-10个不同角度的 hook 生成
  - 留存曲线脚本结构
  - 自我批判审核
  - 9种格式：talking head, demo, unboxing, before/after, tutorial, storytime, listicle, carousel, meme
- **安装**：
```bash
npx skills add vyralcontent/content-skills --skill viral-short-form
```

### 5. samber/cc-skills@substack-ghostwriting
- **安装量**：1,900+
- **功能**：Substack/Newsletter 代笔写作
- **安装**：
```bash
npx skills add samber/cc-skills --skill substack-ghostwriting
```

### 6. kostja94/marketing-skills@content-marketing
- **安装量**：852
- **功能**：内容营销全流程策略与执行
- **安装**：
```bash
npx skills add kostja94/marketing-skills --skill content-marketing
```

### 7. kostja94/marketing-skills@podcast-marketing
- **安装量**：1,100+
- **功能**：播客内容营销策略
- **安装**：
```bash
npx skills add kostja94/marketing-skills --skill podcast-marketing
```

### 8. GoldLegendW80/llm-video-maker
- **功能**：一句话生成完整 MP4 视频（TikTok/Reels/Shorts/YouTube intro）
- **能力**：AI 语音（Kokoro TTS 多语言）、逐词同步字幕、背景音乐、授权素材、Playwright 屏幕录制
- **支持比例**：9:16, 16:9, 1:1
- **许可证**：MIT
- **安装**：
```bash
npx skills add GoldLegendW80/llm-video-maker
```

---

## Tier 3 — 中国平台专项

### 9. chenjin-cmd/agent-skills-launch-pack_ — 起号专家
- **覆盖四大平台**：
  - **微信公众号**：定位、选题库、文章简报、发布节奏、周复盘
  - **小红书**：账号定位、笔记简报、内容日历、转化路径、复盘
  - **抖音**：冷启动、观看理由、9条视频实验、互动设计、复盘
  - **X/Twitter**：中文冷启动、回复区曝光、主贴转化、7天执行计划
- **安装**：
```bash
git clone https://github.com/chenjin-cmd/agent-skills-launch-pack_.git
cd agent-skills-launch-pack_ && ./install.sh --all
```

### 10. op7418/guizang-social-card-skill — 归藏社交卡片
- **功能**：
  - 小红书图文组图（3:4 1080×1440）— 28种版式骨架
  - 公众号封面对（21:9 + 1:1）— 双尺寸一次性渲染
  - 两套视觉系统：电子杂志风（叙事/生活方式）+ 瑞士国际主义（数据/产品测评）
  - 10套主题预设、Playwright 渲染、校验脚本
  - 覆盖 11 个小红书品类
- **安装**：
```bash
npx skills add https://github.com/op7418/guizang-social-card-skill
```

### 11. jihe520/social-push — 多平台一键发布
- **支持平台**：小红书（图文/长文）、X/Twitter、知乎、微博、微信公众号、掘金、Linux.do
- **特点**：仅暂存草稿不自动发布（你最终确认）、Self-Evolution 机制（平台改版自动修复）
- **安装**：
```bash
npx skills add jihe520/social-push
```

### 12. op7418/Youtube-clipper-skill — YouTube 视频转中文内容
- **功能**：YouTube → 中文社交平台内容
  - AI 语义章节分析（非机械切分）
  - 中英双语字幕翻译与烧录
  - 自动生成适配小红书/抖音/微信公众号的文案和金句提炼
  - 帧级精准剪辑
- **安装**：
```bash
npx skills add https://github.com/op7418/Youtube-clipper-skill
```

### 13. autoclaw-cc/xiaohongshu-mcp-skills@xiaohongshu
- **安装量**：2,600+
- **功能**：小红书 MCP 集成（当前已安装 `xhs` 系列 skill，这个可作为补充参考）

---

## Tier 4 — 品牌视觉与差异化

### 14. travisjneuman/.claude@brand-identity
- **安装量**：780
- **功能**：品牌识别系统建立
- **安装**：
```bash
npx skills add travisjneuman/.claude --skill brand-identity
```

### 15. kostja94/marketing-skills@brand-visual-generator
- **安装量**：982
- **功能**：品牌视觉资产生成
- **安装**：
```bash
npx skills add kostja94/marketing-skills --skill brand-visual-generator
```

### 16. arnabbagxd/brand-building-skills@personal-brand
- **安装量**：137
- **功能**：个人品牌建设专项
- **安装**：
```bash
npx skills add arnabbagxd/brand-building-skills --skill personal-brand
```

---

## Tier 5 — 增长、分析与自动化

### 17. kostja94/marketing-skills@indie-hacker-strategy
- **安装量**：862
- **功能**：独立开发者/个体创业者增长策略
- **安装**：
```bash
npx skills add kostja94/marketing-skills --skill indie-hacker-strategy
```

### 18. blacktwist/social-media-skills@audience-growth-tracker-sms
- **安装量**：625
- **功能**：受众增长追踪
- **安装**：
```bash
npx skills add blacktwist/social-media-skills --skill audience-growth-tracker-sms
```

### 19. claude-office-skills/skills@social-publisher
- **安装量**：3,400+
- **功能**：多平台社交内容发布调度（安装量最高的发布类 skill）
- **安装**：
```bash
npx skills add claude-office-skills/skills --skill social-publisher
```

### 20. inference-sh/skills@ai-social-media-content
- **安装量**：525
- **功能**：AI 社媒内容生成

### 21. wshobson/agents@social-publishing
- **安装量**：530
- **功能**：社交发布代理

### 22. jonathimer/devmarketing-skills@linkedin-technical
- **安装量**：73
- **功能**：LinkedIn 技术内容专项

---

## 补充工具

### 中文敏感词检测
- **包名**：`chinese-sensitive-words-mcp`
- **功能**：小红书/抖音/快手/B站 专属词库，风险等级分类（封号/限流/建议修改），谐音变体检测
- **安装**：
```bash
claude mcp add chinese-sensitive-words -- npx -y chinese-sensitive-words-mcp
```

---

## V3 内容流程 × Skill 对应

```
V3 六步内容生产框架
═══════════════════════════════════════════════════

① 发现问题
   └─ agent-reach（已有）+ deep-research（已有）
      真实经营中遇到的重复性问题

② 分析问题为什么出现
   └─ coreyhaines31/marketingskills
      结构化分析框架

③ 提出解决思路
   └─ founder-skills（brand-copywriter）
      把你的思考转化为可传播的叙事

④ 用AI搭建解决方案
   └─ 你自己的实践 + AI辅助记录
      这是你最核心的差异化内容

⑤ 验证结果
   └─ audience-growth-tracker-sms + analytics
      数据验证 + 经验沉淀

⑥ 继续优化
   └─ social-calendar-skill + indie-hacker-strategy
      迭代内容策略


四大内容支柱
═══════════════════════════════════════════════════

支柱① 公司运营真实问题  → 你自己的经历（核心素材源，AI无法替代）
支柱② 如何解决这些问题  → AI辅助结构化记录
支柱③ 实施后的结果      → analytics + growth tracking
支柱④ AI和公司的思考    → founder-skills（thought leadership 格式）


平台分发矩阵
═══════════════════════════════════════════════════

国内
  小红书   → 起号专家 + 归藏卡片 + social-push + xhs（已有）
  抖音     → 起号专家 + vyralcontent/content-skills + douyin-video-summary（已有）
  公众号   → 起号专家 + 归藏卡片 + wechat-article-extractor（已有）
  B站      → YouTube Clipper + llm-video-maker（长视频分发）

海外
  X/Twitter    → founder-skills (x-writer)
  LinkedIn     → founder-skills (linkedin-writer)
  YouTube      → vyralcontent + llm-video-maker + baoyu-youtube-transcript（已有）
  Newsletter   → substack-ghostwriting
  Podcast      → podcast-marketing
```

---

## 分批安装建议

### 第一批：策略 + 写作核心（建议立即安装）
```bash
npx skills add coreyhaines31/marketingskills
npx skills add ognjengt/founder-skills
npx skills add Darthflute/social-calendar-skill
```

### 第二批：内容生产引擎
```bash
npx skills add vyralcontent/content-skills --skill viral-short-form
npx skills add samber/cc-skills --skill substack-ghostwriting
npx skills add kostja94/marketing-skills --skill content-marketing
npx skills add GoldLegendW80/llm-video-maker
```

### 第三批：中国平台
```bash
git clone https://github.com/chenjin-cmd/agent-skills-launch-pack_.git
cd agent-skills-launch-pack_ && ./install.sh --all
npx skills add jihe520/social-push
npx skills add https://github.com/op7418/guizang-social-card-skill
```

### 第四批：品牌 + 增长
```bash
npx skills add travisjneuman/.claude --skill brand-identity
npx skills add arnabbagxd/brand-building-skills --skill personal-brand
npx skills add kostja94/marketing-skills --skill brand-visual-generator
npx skills add kostja94/marketing-skills --skill indie-hacker-strategy
npx skills add blacktwist/social-media-skills --skill audience-growth-tracker-sms
```

---

## 参考案例与数据

### 值得关注的成功案例
- **Sandy Lee**：200 → 12,000 YouTube 订阅（1个月），$5,500/月 retainer + $3,500 品牌合作，利用 Claude Code 内容系统，边全职工作边带3个孩子
- **Nick Puru**：~400万 Instagram 播放量（30天），三 skill 流程（写脚本 → 审核 → 生成标题）
- **Corey Haines**：marketingskills 一夜爆红，被多个头部播客报道，"一人营销团队"概念引发广泛讨论
- **Flood Sung**："开源自己"模式 — 152篇文章 + 178条动态 + 254条回答训练个人数字分身

### 关键趋势（2026）
1. **GEO（生成式引擎优化）**：ChatGPT/Perplexity/AI Overviews 的搜索优化已成标配
2. **内容多平台自动分发**：Blog → X thread → LinkedIn → Newsletter → Podcast 全链路自动化
3. **"去AI化"**：AI 指纹去除、声音克隆让人声更真实
4. **上下文 > 提示词**：提供 ICP + Brand Voice + SOP > 写好单个 prompt

### 生态观察
- 大多数高安装量 skill 在 2026 年 1-5 月间密集更新
- Agent Skills 开放标准使 skill 跨 Claude Code / OpenAI Codex / Cursor / Gemini CLI 可移植
- 头部 skill 的作者普遍是真实创业者/从业者，不是纯开发者
- 中文内容 skill 生态在 2026 年上半年爆发式增长
