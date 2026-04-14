---
name: webapp-building
description: Tools for building modern React webapps with TypeScript, Tailwind CSS and shadcn/ui. Best suited for applications with complex UI components and state management.
---

# WebApp Building

**Stack** : React + TypeScript + Vite + Tailwind CSS + shadcn/ui

## Workflow

1. `scripts/init-webapp.sh <website-title>` — 在 `/mnt/okcomputer/output/app` 初始化项目，并设置网站标题  
2. 在 `src/` 目录编辑源代码  
3. 构建 React 应用  
4. 将构建产物部署到 `/mnt/okcomputer/output/app/dist/`

## Quick Start

### 1. Initialize（初始化项目）

```bash
# 在 /mnt/okcomputer/output/app 初始化项目（带网站标题）
bash scripts/init-webapp.sh <website-title>
cd /mnt/okcomputer/output/app
```

**AI Agent 注意事项**：
- 项目固定路径：`/mnt/okcomputer/output/app`
- 非交互式执行（自动确认）

初始化后会自动创建一个完整配置的项目，包含：
- ✅ React + TypeScript（基于 Vite）
- ✅ Tailwind CSS 3.4.19 + shadcn/ui 主题系统
- ✅ 路径别名（`@/`)
- ✅ 40+ 个 shadcn/ui 组件已预装
- ✅ 所有 Radix UI 依赖已包含
- ✅ Vite 生产构建优化
- ✅ Node 20+ 兼容（自动检测并固定 Vite 版本）

### 2. Develop（开发）

在 `src/` 目录下编辑文件：
- 页面区块 → `src/sections/`
- 自定义 React Hooks → `src/hooks/`
- TypeScript 类型定义 → `src/types/`

### 3. Build（构建）

```bash
cd /mnt/okcomputer/output/app && npm run build 2>&1
```

**构建输出（`dist/` 目录）**：
- `index.html` —— 入口文件
- `assets/index-[hash].js` —— 打包后的 JS
- `assets/index-[hash].css` —— 打包后的 CSS
- 优化后的图片、字体等资源

**优化项**：Tree-shaking、代码分割、资源压缩、minification、缓存破坏 hash。

### 4. Deploy（部署）

直接部署 `/mnt/okcomputer/output/app/dist/` 目录的内容即可上线。

## Debugging（调试）

1. 修改源文件  
2. 执行 `npm run build`  
3. 测试 `dist/` 目录  
4. 重新部署

## Reference（参考）

- [shadcn/ui 组件文档](https://ui.shadcn.com/docs/components)
