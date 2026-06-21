# Follow.art 首页克隆

> 克隆时间：2026-06-19  
> 原站：https://follow.art/  
> 工具：AI Website Cloner Template + Playwright

## 项目说明

FOLLOW.ART 是面向策展人 (Curators) 和艺术家 (Artists) 的数字基础设施平台——用一个 Card 整合作品集、联系方式、直接赞助等功能。

本克隆还原了其首页所有视觉 Section 和关键动效。

## 运行方式

```bash
cd "Mentorship网络/参考素材/克隆网站/follow-art"
npm install
npm run dev
# → http://localhost:3000
```

## 页面结构 (8 Sections)

| 顺序 | Section | 背景色 | 核心动效 |
|------|---------|--------|----------|
| 1 | Hero | `#f4793a` 橙色 | 浮动图标 + 视差滚动 + 淡入 |
| 2 | How It Works | `#000` 黑色 | IntersectionObserver 滚动触发 |
| 3 | Testimonials | `#8e9487` 绿色 | 自动轮播 (5s) + 手动切换 |
| 4 | Centralize | `#8498ac` 蓝色 | **3D 翻转卡片** (hover) |
| 5 | Card Showcase | `#c5939d` 粉色 | **鼠标跟随 3D 透视** |
| 6 | Audience Support | `#fff` 白色 | **无限循环滚动** 轮播 |
| 7 | Connectory | `#fff` 白色 | 滚动入场交互动画 |
| 8 | Join Us + Footer | `#f4793a` 橙色 | CTA hover 缩放 |

## 文件清单

```
src/
  app/
    globals.css          # 品牌色系 + 动画关键帧
    layout.tsx           # 根布局（Inter 字体）
    page.tsx             # 主页面组装
  components/
    Header.tsx           # 固定导航栏（滚动变色）
    HeroSection.tsx      # 首屏英雄区
    HowItWorksSection.tsx
    TestimonialsSection.tsx
    CentralizeSection.tsx # 翻转卡片
    CardShowcaseSection.tsx # 3D 鼠标跟随
    AudienceSupportSection.tsx # 无限滚动轮播
    ConnectorySection.tsx
    JoinUsSection.tsx    # CTA + 页脚
  types/
    index.ts             # TypeScript 类型定义
docs/
  research/              # Playwright 提取的原始数据
    DESIGN_TOKENS.json   # 色彩/字体
    PAGE_TOPOLOGY.json   # 页面拓扑
    IMAGES.json          # 图片资源
    HEADER.json          # 导航内容
    TEXT_STYLES.json     # 文字样式
    COMPONENT_DETAILS.json
  design-references/     # 全页截图
    full-page-desktop.png
    full-page-mobile.png
scripts/
  extract-site.mjs       # Playwright 提取脚本
  extract-details.mjs    # 深度提取脚本
```

## 与原站差异

- **字体**：原站使用付费字体 HeadingNow + Hardbop，克隆版使用 Inter 替代
- **视频**：How It Works 区的视频预览已用静态占位符替代
- **WebGL**：Card Showcase 区的 WebGL 动画已用 CSS 3D 透视替代
- **响应式**：已适配桌面/平板/手机三端

## 设计 Token

- 品牌橙 `#f4793a` — CTA、强调
- 鼠尾草绿 `#8e9487` — Testimonials 区
- 钢蓝 `#8498ac` — Centralize 区
- 玫瑰 `#c5939d` — Card Showcase 区
- 大标题：225-257px / weight 900 / line-height 0.78
- 标签文字：26px / weight 400 / letter-spacing -0.03em
- 正文：13-16px
