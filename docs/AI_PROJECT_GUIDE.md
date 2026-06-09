# TerminalBlog AI 项目指南

> 本文档为 AI Coding Agent 提供，用于快速理解、定位、修改和维护 TerminalBlog 项目。

---

## 1. 项目概览

### 项目目标
TerminalBlog 是一个复古拟真终端风格的博客系统，采用纯 Node.js + 原生文件系统存储，支持 Markdown 文章管理、文件管理、Git 远程同步和 AI 聊天功能。

### 项目定位
- **面向人群**: 极客、技术博主
- **核心特色**: CRT 显示器发光扫描线、字符雨动效、Git 仓库同步
- **轻量化**: 无数据库依赖，Docker 一键部署

### 核心设计理念
- 纯文件系统存储（Markdown 文件）
- 无数据库架构
- 原生 Node.js（禁止引入 Express）
- Docker 容器化兼容
- 前端 SPA 单页面应用（原生 JS，不使用 React/Vue）

---

## 2. 技术架构

### 前端
- **技术栈**: 原生 HTML + CSS + JavaScript（模块化拆分）
- **渲染引擎**: marked.js（Markdown 解析）
- **路由**: HTML5 History API（pushState）
- **状态管理**: 全局变量 + localStorage/sessionStorage
- **目录结构**:
  ```
  public/js/
  ├── core/         # 核心模块 (api.js, app.js, utils.js)
  ├── posts/        # 文章模块 (routing.js, auth.js, preview.js, export.js)
  ├── files/        # 文件模块 (file-manager.js, git-sync.js, guest-upload.js)
  └── features/     # 特效模块 (ai-chat.js, effects.js, terminal-dots.js)
  ```

### 后端
- **技术栈**: 原生 Node.js (http 模块)
- **端口**: 8788（可通过环境变量 PORT 配置）
- **核心文件**: `public/server.js` (3364 行)
- **功能**: API 服务、文件上传、Git 操作

### 存储
- **文章存储**: `Markdown/` 目录下的 `.md` 文件
- **图片存储**: `blogimgs/` 目录
- **文件存储**: `blogfiles/` 目录
- **游客上传**: `guestuploads/` 目录
- **配置存储**: `config.js` 文件
- **Git 配置**: `git_config.json` 文件
- **SSH 密钥**: `.ssh_key/` 目录

### 部署
- **镜像**: node:24-alpine
- **编排**: docker-compose.yml
- **工具**: bash, git, openssh-client
- **端口映射**: 8788:8788

### AI 模块
- **支持格式**: OpenAI / Anthropic / Gemini
- **配置文件**: `config.js` 中的 `AI_CONFIG`
- **代理支持**: AI_PROXY_CONFIG（Cloudflare Workers）
- **检索模式**: keyword（已实现）、bm25/vector（预留）

---

## 3. 文件结构

```
TerminalBlog_main/
├── public/                    # ⭐ 前端静态资源目录
│   ├── index.html             # 🔴 核心文件 - 前端入口
│   ├── server.js              # 🔴 核心文件 - Node.js API 服务器 (3364行)
│   ├── config.js              # 🟡 高频修改 - 运行时配置
│   ├── js/core/               # 🔴 核心文件 - 状态/API/工具
│   │   ├── api.js             # API 调用封装
│   │   ├── app.js             # 状态管理、路由、视图控制
│   │   └── utils.js           # 工具函数
│   ├── js/posts/              # 🟡 高频修改 - 文章相关
│   │   ├── routing.js         # 路由和渲染逻辑
│   │   ├── auth.js            # 管理员认证
│   │   ├── preview.js         # 文章预览
│   │   └── export.js          # 导出功能
│   ├── js/files/              # 🟡 高频修改 - 文件管理
│   │   ├── file-manager.js    # 文件管理器
│   │   ├── git-sync.js        # Git 远程同步
│   │   └── guest-upload.js    # 游客上传
│   ├── js/features/           # 🟡 高频修改 - 特效功能
│   │   ├── ai-chat.js         # AI 聊天功能
│   │   ├── effects.js         # 视觉效果
│   │   └── terminal-dots.js   # 终端动画
│   └── styles/
│       └── main.css           # 样式文件
│
├── Markdown/                  # 📂 文章数据库（.md 文件）
│
├── blogimgs/                  # 📂 博客图片目录
├── blogfiles/                 # 📂 博客文件目录
├── guestuploads/              # 📂 游客上传目录
│
├── docker/                    # 🔴 核心文件 - Docker 配置
│   ├── Dockerfile             # Alpine 轻量化构建
│   ├── docker-compose.yml     # 容器编排
│   ├── entrypoint.sh          # 启动脚本（动态生成 config.js）
│   └── DESCRIPTION.md         # 部署说明
│
├── scripts/                   # 工具脚本
│   ├── seed.js                # 种子数据
│   ├── reset.js               # 重置脚本
│   └── import.js              # 导入脚本
│
├── nginx/                      # Nginx 配置
├── git_config.json             # Git 同步配置
├── .ssh_key/                   # SSH 密钥对
└── package.json                # 项目依赖
```

### 文件标识说明
- 🔴 **核心文件**: 禁止随意修改，修改前需仔细分析影响
- 🟡 **高频修改**: 经常需要修改的功能模块
- 📂 **目录**: 存储数据的目录

---

## 4. 模块说明

### 模块：API 服务
- **职责**: 处理所有 HTTP 请求，提供博客数据接口
- **相关文件**: `public/server.js`
- **依赖模块**: fs、path、crypto、http 内置模块
- **风险等级**: 🔴 极高（核心服务器，修改可能影响所有功能）

### 模块：前端路由与渲染
- **职责**: 页面渲染、URL 路由、视图切换
- **相关文件**: `public/js/core/app.js`、`public/js/posts/routing.js`
- **依赖模块**: api.js、utils.js
- **风险等级**: 🟡 高（影响页面显示逻辑）

### 模块：文件管理器
- **职责**: 博客文件和图片的上传、删除、列表展示
- **相关文件**: `public/js/files/file-manager.js`
- **依赖模块**: api.js、server.js（上传 API）
- **风险等级**: 🟡 高（涉及文件系统操作）

### 模块：Git 同步
- **职责**: 远程仓库同步（Push/Pull/Compare）
- **相关文件**: `public/js/files/git-sync.js`、`public/server.js`（Git API）
- **依赖模块**: spawn/exec 系统调用、.ssh_key/ 目录
- **风险等级**: 🟡 高（数据同步操作，可能覆盖数据）

### 模块：AI 聊天
- **职责**: AI 对话、文章检索、自动总结
- **相关文件**: `public/js/features/ai-chat.js`、`public/server.js`（/api/ai/chat）
- **依赖模块**: config.js（AI_CONFIG）、API 调用
- **风险等级**: 🟡 高（外部 API 调用）

### 模块：文章管理
- **职责**: 文章列表、详情、标签、导出
- **相关文件**: `public/js/posts/routing.js`、`public/server.js`（/api/posts）
- **依赖模块**: Markdown/ 目录、marked.js
- **风险等级**: 🟡 高（核心数据展示）

### 模块：终端特效
- **职责**: 字符雨、CRT 扫描线、终端动画
- **相关文件**: `public/js/features/terminal-dots.js`、`public/js/features/effects.js`
- **依赖模块**: canvas API
- **风险等级**: 🟢 低（纯视觉特效，不影响数据）

---

## 5. 数据结构

### Markdown 文章格式
```markdown
---
id: 10001
title: 文章标题
date: 2026-05-22
tags: ['极客', '终端', '部署']
---

# 正文内容

图片引用：![描述](/blogimgs/example.png)
文件引用：[下载](/blogfiles/doc.zip)
```

**约束**:
- 文件名格式: `ID.md`（如 `1001.md`）
- id 必须是唯一整数
- 必须包含 YAML Frontmatter

### 配置文件结构 (config.js)
```javascript
const SITE_CONFIG = {
    siteTitle: 'TerminalBlog',
    welcomeMessage: '欢迎来到我的终端博客',
    siteUrl: 'https://example.com',
    icpNumber: '',
    maxUploadSizeBlogfilesMB: 100,
    maxUploadSizeBlogimgsMB: 10,
    maxUploadSizeGuestMB: 50,
};

window.SITE_CONFIG = {
    matrixRainStartupRandom: true,
    matrixRainRandomAlgorithm: 'decay',
    matrixRainRandomPool: ['1', '2', '3', '4', '2+3'],
    matrixRainFixedMode: '2+3',
    matrixRainEnableBuddhaEffect: true,
};

const AI_CONFIG = {
    enabled: true,
    apiFormat: 'openai',
    apiBaseUrl: '',
    apiKey: '',
    model: 'deepseek-chat',
    maxTokens: 1500,
    temperature: 0.7,
    search: { mode: 'keyword', maxDocs: 5, maxContextTokens: 8000 },
};
```

### 文件存储结构
```
/Markdown/           → 博客文章 (.md)
/blogimgs/           → 博客图片
/blogfiles/          → 博客文件（可下载资源）
/guestuploads/       → 游客上传文件
/.ssh_key/           → SSH 私钥/公钥对
git_config.json      → Git 同步配置
```

---

## 6. API 说明

### 文章 API
| 路径 | 方法 | 功能 | 返回特点 |
|------|------|------|----------|
| `/api/posts` | GET | 获取文章列表 | 包含分页、标签筛选 |
| `/api/posts/:id` | GET | 获取单篇文章 | Markdown 正文 |
| `/api/stats` | GET | 获取统计信息 | 文章总数、运行时间 |

### 管理 API
| 路径 | 方法 | 功能 | 认证要求 |
|------|------|------|----------|
| `/api/admin/login` | POST | 管理员登录 | 返回 Bearer Token |
| `/api/posts` | POST | 创建文章 | 需要认证 |
| `/api/posts/:id` | PUT | 更新文章 | 需要认证 |
| `/api/posts/:id` | DELETE | 删除文章 | 需要认证 |

### 文件 API
| 路径 | 方法 | 功能 | 认证要求 |
|------|------|------|----------|
| `/api/upload/:folder` | POST | 上传文件 | 管理员/游客码 |
| `/api/files/:folder` | GET | 列出文件 | 管理员 |
| `/api/files/:folder/:name` | DELETE | 删除文件 | 需要认证 |

### Git API
| 路径 | 方法 | 功能 |
|------|------|------|
| `/api/git/config` | GET/POST | 读取/保存 Git 配置 |
| `/api/git/compare` | POST | 对比本地与远程 |
| `/api/git/push` | POST | 推送到远程 |
| `/api/git/pull` | POST | 从远程拉取 |
| `/api/git/test` | POST | 测试连接 |

### AI API
| 路径 | 方法 | 功能 |
|------|------|------|
| `/api/ai/chat` | POST | 发送对话请求 |
| `/api/ai/search` | GET | 搜索相关文章 |

---

## 7. 配置说明

### 环境变量
| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | 8788 |
| `ADMIN_USER` | 管理员用户名 | admin |
| `ADMIN_PASS` | 管理员密码 | admin123 |
| `SITE_TITLE` | 站点标题 | TerminalBlog |
| `WELCOME_MESSAGE` | 欢迎语 | 欢迎来到我的终端博客 |
| `SITE_URL` | 站点 URL | - |
| `ICP_NUMBER` | ICP 备案号 | - |
| `MARKDOWN_DIR` | Markdown 目录 | ./Markdown |
| `AI_ENABLED` | 启用 AI | false |
| `AI_API_FORMAT` | AI 格式 | openai |
| `AI_API_KEY` | AI 密钥 | - |
| `AI_MODEL` | AI 模型 | - |

### config.js 配置
- 路径: `public/config.js`
- 创建: 从 `public/config.js.example` 复制
- Docker: 由 `docker/entrypoint.sh` 自动生成

### Docker 配置
- Dockerfile: node:24-alpine
- 启动脚本: `docker/entrypoint.sh`
- 健康检查: `wget http://localhost:8788/`

---

## 8. 开发约束（重要）

### 必须遵守
- ✅ 保持文件系统架构（不用数据库）
- ✅ 保持原生 Node.js（不用 Express）
- ✅ 保持原生 JavaScript（不用 React/Vue/Angular）
- ✅ 保持 Docker 兼容
- ✅ 保持 Markdown 文章格式

### 禁止操作
- ❌ 引入 Express、Koa 等 Web 框架
- ❌ 引入数据库（MySQL、PostgreSQL、MongoDB 等）
- ❌ 引入 React、Vue、Angular 等框架
- ❌ 大规模重构核心架构
- ❌ 修改 server.js 的核心路由逻辑
- ❌ 修改 Markdown 文件格式要求

---

## 9. 修改原则（重要）

1. **优先新增文件**
   - 新功能尽量新建独立文件
   - 避免修改已有核心文件

2. **尽量减少修改核心文件**
   - `public/server.js` 修改需极度谨慎
   - `public/index.html` 尽量不修改

3. **不破坏现有 API**
   - 保持 API 路径和返回值格式不变
   - 新增 API 使用新路径

4. **不改变已有数据格式**
   - Markdown 文件格式不可改变
   - config.js 配置格式不可改变

5. **向后兼容**
   - 新增字段要有默认值
   - 不要删除现有字段

---

## 10. AI 开发流程（重要）

### AI 收到需求后必须执行以下步骤：

```
1. 分析需求
   ├── 理解用户要什么
   ├── 确定涉及的功能模块
   └── 识别潜在风险

2. 列出涉及文件
   ├── 核心文件 (server.js, app.js 等)
   ├── 可能需要修改的文件
   └── 可能需要新增的文件

3. 输出实施方案
   ├── 方案对比（如果存在多个方案）
   ├── 每个方案的优缺点
   └── 推荐的实现方式

4. 等待确认
   └── 明确要求用户确认后再编码

5. 开始编码
   ├── 按照确认的方案实施
   └── 遵守修改原则
```

### 禁止行为
- ❌ 未经确认直接修改代码
- ❌ 未经确认进行大规模重构
- ❌ 未经确认删除文件

---

## 11. 影响分析要求（重要）

### 修改前必须输出以下分析：

```
涉及文件：
  - file1.js（修改）
  - file2.js（新增）

影响模块：
  - 前端路由
  - API 服务
  - 文件管理

潜在风险：
  - 可能影响游客上传功能
  - 可能影响文章显示

回滚方式：
  - 恢复备份文件
  - 删除新增文件
```

---

## 12. 代码规范

### 注释规范
```javascript
// ============ 模块说明 ============
// 功能描述
// ============ 模块说明 ============

/**
 * 函数说明
 * @param {type} param - 参数说明
 * @returns {type} 返回值说明
 */
```

### 命名规范
- 变量/函数: camelCase (`getUserData`)
- 常量: UPPER_SNAKE_CASE (`MAX_UPLOAD_SIZE`)
- 类: PascalCase (`BlogPost`)
- 文件: kebab-case 或 camelCase (`file-manager.js`)

### 错误处理规范
```javascript
try {
    // 可能失败的代码
} catch (e) {
    console.error('操作失败:', e.message);
    // 返回有意义的错误信息
    return { error: '友好的错误提示' };
}
```

### 模块拆分规范
- 每个模块文件不超过 500 行
- 相关功能聚合到一个文件
- 共享工具函数单独提取

---

## 13. 输出规范（重要）

### 每次开发完成后必须输出：

```
新增文件：
  - /public/js/features/new-feature.js

修改文件：
  - /public/js/core/app.js（添加状态管理）
  - /public/styles/main.css（添加样式）

删除文件：
  - 无

API 变更：
  - 新增 GET /api/new-endpoint

配置变更：
  - config.js 新增 newOption 配置项

测试方法：
  1. 启动服务: npm start
  2. 访问 http://localhost:8788
  3. 测试新功能是否正常
```

---

## 14. 常见任务索引

### 添加 API
涉及文件: `public/server.js`
索引位置: 搜索 `handleRequest` 函数，找到对应路由处理

### 修改首页
涉及文件: `public/js/posts/routing.js` → `renderHome()`
样式: `public/styles/main.css`

### 增加管理功能
涉及文件: `public/js/posts/auth.js`、`public/server.js`（管理 API）

### 增加 AI 功能
涉及文件: `public/js/features/ai-chat.js`、`public/server.js`（/api/ai/*）

### 增加 Git 功能
涉及文件: `public/js/files/git-sync.js`、`public/server.js`（Git API）

### 修改终端特效
涉及文件: `public/js/features/effects.js`、`public/js/features/terminal-dots.js`

### 修改文章列表
涉及文件: `public/js/posts/routing.js` → `renderPostList()`

### 修改文件上传
涉及文件: `public/server.js`（multipart 解析）、`public/js/files/file-manager.js`

---

## 15. AI 工作模式（最高优先级）

### 核心原则

```
┌─────────────────────────────────────────────────────┐
│  1. 优先分析 - 理解需求，评估影响                    │
│  2. 优先规划 - 列出方案，对比优劣                    │
│  3. 优先最小修改 - 只改必要的文件                    │
│  4. 优先兼容旧代码 - 不破坏现有功能                  │
│  5. 禁止大规模重构 - 除非明确要求                    │
└─────────────────────────────────────────────────────┘
```

### 决策流程

```
收到需求
    │
    ▼
分析需求 ──────────────────────────────────────┐
    │                                            │
    ▼                                            ▼
存在多个方案？                              单一方案
    │                                            │
    ▼                                            ▼
输出方案比较                          评估风险等级
    │                                            │
    ▼                                            ▼
等待用户选择                              风险可接受？
    │                                            │
    └──────────────────┬─────────────────────────┘
                       │
                       ▼
                  等待确认
                       │
                       ▼
                 开始编码
```

### 如果存在多个方案

```
方案 A:
  优点：...
  缺点：...
  适用场景：...

方案 B:
  优点：...
  缺点：...
  适用场景：...

推荐方案：A（理由）
```

### 禁止行为清单
- ❌ 未经确认的大规模重构
- ❌ 未经确认删除核心文件
- ❌ 未经确认改变数据格式
- ❌ 引入禁止的技术栈

### 风险评估标准

| 风险等级 | 说明 | 操作要求 |
|----------|------|----------|
| 🔴 极高 | 核心文件、影响所有功能 | 必须详细分析，必须确认 |
| 🟡 高 | 重要功能模块 | 分析影响，谨慎操作 |
| 🟢 低 | 视觉特效、辅助功能 | 可以快速实施 |

---

## 附录：关键文件速查

| 功能 | 文件路径 | 行数 | 关键函数 |
|------|----------|------|----------|
| 服务器入口 | `public/server.js` | 1-100 | require 模块 |
| 请求路由 | `public/server.js` | ~1500 | handleRequest() |
| Git 操作 | `public/server.js` | ~1500-2500 | git push/pull/compare |
| AI 对话 | `public/server.js` | ~2500-3000 | /api/ai/chat |
| 文件上传 | `public/server.js` | ~800-1000 | multipart 解析 |
| 前端入口 | `public/index.html` | - | 加载模块 |
| 路由渲染 | `public/js/posts/routing.js` | 1-200 | render() |
| 首页渲染 | `public/js/posts/routing.js` | ~129-300 | renderHome() |
| 文章渲染 | `public/js/posts/routing.js` | ~500-800 | renderPost() |
| 状态管理 | `public/js/core/app.js` | 1-50 | 全局状态 |
| API 调用 | `public/js/core/api.js` | 1-106 | apiGet/Post/Delete |
| AI 聊天 | `public/js/features/ai-chat.js` | 1-150 | openAIModal() |
| Git 同步 | `public/js/files/git-sync.js` | 1-150 | openGitSyncModal() |
| 文件管理 | `public/js/files/file-manager.js` | - | 文件操作 |

---

> **最后更新**: 2026-06-09
> **版本**: 1.0.0
> **维护者**: AI Coding Agent