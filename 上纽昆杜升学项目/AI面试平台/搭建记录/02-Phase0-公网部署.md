# AI 面试平台 · 公网部署记录

> 日期：2026-06-23
>
> 从 localhost 到公网可访问

---

## 部署方案

```
阿里云轻量服务器 · 东京
  0.9GB 内存 / 2 核 / 30GB SSD
  IP：47.245.42.243
  OS：Alibaba Cloud Linux 3 (CentOS/Anolis)
  ¥34/月
```

## 部署步骤

### 1. 服务器环境

| 步骤 | 命令 |
|------|------|
| 创建 4GB swap | `dd + mkswap + swapon` |
| 安装 Node.js 20 | `curl -fsSL rpm.nodesource.com/setup_20.x \| bash; dnf install nodejs` |
| 安装 pnpm | `npm install -g pnpm` |
| 安装 pm2 | `npm install -g pm2`（进程守护，崩溃自动重启） |
| 安装 tsx | `npm install -g tsx`（跑 TypeScript 语音中继） |

### 2. 构建策略

服务器 0.9GB 内存不够跑 `next build`（Webpack 吃 2GB+），采用**本地构建 → 上传方案**：

```
Mac 本地：
  cp .env.production .env.local → pnpm run build → .next/standalone/

上传到服务器：
  /.next/standalone/  → /opt/lingwu-app/.next/standalone/
  /.next/static/       → /opt/lingwu-app/.next/standalone/.next/static/
  /public/             → /opt/lingwu-app/.next/standalone/public/
  .env.local           → /opt/lingwu-app/.next/standalone/.env.local
```

### 3. 启动方式

```bash
# Web 应用（Next.js standalone）
cd /opt/lingwu-app/.next/standalone
PORT=4010 pm2 start server.js --name lingwu-web

# 语音中继（WebSocket）
cd /opt/lingwu
pm2 start "npx tsx server/voice-relay.ts" --name lingwu-voice
```

### 4. 防火墙

阿里云安全组开放：
- 4010 TCP（网页）
- 8766 TCP（语音 WebSocket）

### 5. Supabase Auth 回调

添加 `http://47.245.42.243:4010/**` 到 Supabase → Authentication → URL Configuration → Redirect URLs

---

## 访问地址

| 入口 | URL |
|------|-----|
| 管理后台 | http://47.245.42.243:4010 |
| 学生面试 | http://47.245.42.243:4010/i/[slug] |
| 语音中继 | ws://47.245.42.243:8766 |

演示账号：`demo@lingwu.local` / `Demo123456`

---

## 踩坑记录

| 问题 | 原因 | 解决 |
|------|------|------|
| 服务器只有 0.9GB 内存，构建失败 | Next.js build 需要 2GB+ | 本地构建 standalone → 上传 |
| standalone 上传后静态文件 404 | `.next/static` 不在 standalone 目录内 | 手动 `cp -r .next/static .next/standalone/.next/static/` |
| 语音中继找不到 tsx | 未全局安装 | `npm install -g tsx` |
| html2canvas-pro 404 | 商业版许可证问题 | 替换为免费版 `html2canvas` |
| DeepSeek 图片报 500 | 不支持 vision | summarize route：任意错误 fallback 纯文字 |
| PDF 导出 0 字节 | 动态 import chunk 加载失败 | 改为静态 `import html2canvas from "html2canvas"` |
