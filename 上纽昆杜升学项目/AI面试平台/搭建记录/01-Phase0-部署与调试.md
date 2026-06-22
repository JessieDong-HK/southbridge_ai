# AI 面试平台 · Phase 0 搭建记录

> 日期：2026-06-23
> 
> 阶段：选型 → 部署基座 → 自定义题库 → 调试

---

## 做了什么

### 1. 开源方案选型

| 动作 | 结果 |
|------|------|
| 全网搜索 AI 面试开源平台 | 找到 10 个项目，筛选 4 个重点 |
| 社区验证度评估 | 聆悟 767⭐（最佳）vs DeepInterview 8⭐ vs structured-hiring 1⭐ vs InterviewGuide 2,500⭐ |
| Skills 生态评估 | AI 面试相关 skill 最高 35 installs，全部不可信 |
| 深度代码评估 | Clone 聆悟，读 AI 出题/追问/评分/报告/语音中继全链路代码 |
| **选型结论** | ✅ **聆悟（yuanzhongqiao/ai-interview-platform）** — MIT 协议，Next.js 14 + Supabase |

### 2. 基座部署

| 步骤 | 做了什么 | 问题与修复 |
|------|---------|-----------|
| Supabase 云项目 | Jess 注册 hojoalcxctzwbpgmzklz.supabase.co | — |
| 数据库迁移 | 4 个迁移文件全部推成功 | 直接连接格式 `db.xxx.supabase.co:5432`，非 pooler |
| 演示账号 | `demo@lingwu.local` / `Demo123456` 创建成功 | — |
| DeepSeek 接入 | `OPENAI_BASE_URL=https://api.deepseek.com/v1` | 模型名需指定 `deepseek-chat`，非默认 gpt-4o |
| 豆包语音 ASR | 两轮调试才通 | 见下方 |

### 3. 豆包语音 ASR — 关键调试

```
第一轮：用新版 API Key（027148b3-...）+ ASR 2.0 资源 → 403 未开通
  原因：火山引擎新账号未开通豆包流式语音识别 2.0 资源

第二轮：切换 ASR 1.0（bigasr）+ 旧版 APP ID + Access Token → 成功 ✅
  凭据：APP_ID=4027899250, ACCESS_TOKEN=TSFsbOeZuCozZf2kGg6zSaaJw3cU1rHX
  资源：volc.bigasr.sauc.duration
  认证：AppId+AccessKey 模式
```

### 4. 品牌定制

| 改动 | 文件 |
|------|------|
| 品牌名 "南桥 SouthBridge" | `.env.local` + `brand.ts` 默认值 |
| Logo 从聆悟 PNG → 文字"南桥" | `aural-logo.tsx` 重写 |
| 管理端 + 学生端统一显示南桥 | 同一套 BrandMark 组件 |

### 5. DeepSeek 兼容性修复

| 问题 | 修复 |
|------|------|
| Report 生成报 500 错误 | DeepSeek 不支持图片输入。修改 `summarize/route.ts`，任何错误自动 fallback 纯文字 |
| 模型名不匹配 | 设 `AI_GENERATOR_MODEL=deepseek-chat` + `AI_REPORT_MODEL=deepseek-chat` |

### 6. PDF 导出修复

| 问题 | 修复 |
|------|------|
| `html2canvas-pro` 商业版 chunk 加载 404 | 替换为免费版 `html2canvas` 1.4.1，静态引入 |

### 7. DKU 面试题库（基于 2025/2026 真实考题）

| 来源 | 内容 |
|------|------|
| 昆杜招生院长李含果博士官方解读 | 4 大考察维度 |
| 2025-2026 考生反馈 | 8 道确认真题 + 高频题 |
| Assessment Criteria | 4 维度：English Communication / Critical Thinking / Personal Values / Fit with DKU |

### 8. 学生端 UI 简化

| 隐藏项 | 原因 |
|--------|------|
| 白板按钮 | DKU 面试无 WHITEBOARD 题型 |
| 代码编辑器按钮 | DKU 面试无 CODING 题型 |
| Previous / Next 按钮 | 真实 DKU AI 面试不可跳题/回退 |

---

## 当前状态

| 模块 | 状态 |
|------|------|
| 管理后台 (localhost:3001) | ✅ 可登录、创建面试、查看报告 |
| AI 出题 (DeepSeek) | ✅ 可用 |
| AI 报告 (DeepSeek) | ✅ 可用 |
| 语音 ASR (豆包) | ✅ 可用 |
| 麦克风测试 | ✅ 可用 |
| 学生面试界面 | ✅ 可用（文字+语音+摄像头） |
| PDF 导出 | ✅ 修复 |
| 品牌定制 | ✅ 南桥 |
| DKU 题库 | ✅ 3 道已加入，其余 5 道待加 |
| 白板/代码/上下题按钮 | ✅ 已隐藏 |

---

## 待做

- [ ] 补充剩余 5 道 DKU 面试题
- [ ] 公网部署（Vercel）
- [ ] 接入 `@vladmandic/human` 表情/肢体分析（~150 行）
- [ ] 上纽题库
- [ ] 真实学生测试 + 题目校准
