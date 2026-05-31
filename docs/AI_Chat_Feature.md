# TerminalBlog AI 聊天功能文档

> 本文档描述 AI 大模型对话功能，包括功能说明、实现细节和代码位置。

## 📌 功能概述

在 TerminalBlog 中集成了一个 AI 聊天助手功能，用户可以通过点击界面上的 `✨ AI` 按钮打开对话窗口，与 AI 进行实时对话。

### 主要特性

- **Markdown 渲染**：AI 的回复内容支持完整的 Markdown 格式渲染，包括代码块、列表、链接等
- **打字机效果**：显示 AI "思考中" 的加载动画
- **对话历史**：支持多轮对话，AI 可以理解上下文
- **错误处理**：优雅地处理网络错误和 API 配置问题
- **三层文章上下文**：L0 全站索引 + L1 文首摘要 + L2 按需正文，节省 token
- **智能边界判断**：小美人设，按问题类型调整回答策略
- **博客文章检索**：分词检索 + 显式文章 ID，命中附链接
- **特殊人称保护**：对询问站长的敏感问题进行神秘化处理
- **安全只读**：AI 路由仅读取文章并调用外部 LLM，无写入/执行权限

---

## 🔧 功能实现

### 1. 前端实现

**文件位置**：`public/index.html`

#### 核心函数

| 函数名 | 行号 | 功能描述 |
|--------|------|----------|
| `openAIModal()` | ~4880 | 打开 AI 对话模态框 |
| `closeAIModal()` | ~4905 | 关闭 AI 对话模态框 |
| `addAIMessage(role, content)` | ~4920 | 添加消息到对话列表 |
| `showAITyping()` | ~4970 | 显示 "思考中" 动画 |
| `hideAITyping()` | ~4985 | 隐藏 "思考中" 动画 |
| `showAIError(message)` | ~4995 | 显示错误消息 |
| `sendAIMessage()` | ~5007 | 发送消息到后端 |

#### 关键代码片段

**Markdown 渲染实现**（`addAIMessage` 函数中）：

```javascript
if (role === 'ai') {
    if (typeof marked !== 'undefined') {
        try {
            renderedContent = marked.parse(content);
        } catch (e) {
            renderedContent = '<pre>' + escapeHtml(content) + '</pre>';
        }
    }
}
```

**API 调用**（`sendAIMessage` 函数中）：

```javascript
const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        messages: aiMessages,
        message: content
    })
});
```

### 2. 后端实现

**文件位置**：`public/server.js`

#### API 端点

| 端点 | 方法 | 功能描述 |
|------|------|----------|
| `/api/ai/chat` | POST | 处理 AI 对话请求 |

#### 核心逻辑

1. 接收前端 `message` 与可选 `messages`（最近 6 轮历史）
2. 构建 L0/L1（每次必带）与 L2（检索命中时）
3. 按场景生成「小美」系统提示词，单次调用大模型 API
4. 返回 `reply`、`sources`（命中文章时）、可选 `type`

### 3. 三层上下文与检索

**辅助函数位置**：`public/server.js`（`getPostById` 之后）

| 层级 | 函数 | 内容 | 何时注入 |
|------|------|------|----------|
| **L0** | `buildArticleIndex` | id、标题、日期、标签、URL | 每次对话 |
| **L1** | `buildArticleHeaders` | 每篇文首约 `headerChars` 字 | 每次对话 |
| **L2** | `buildPostDetailContext` | 命中文章正文（截断） | 分词检索或显式 ID 命中 |

**检索**：`extractQueryTokens` + `searchRelevantPosts`（多词 OR、标题/标签加权）；`detectMetaIntent` 时跳过 L2，由 L0 回答列表类问题；`resolveExplicitPostIds` 解析消息中的 4 位以上数字 ID。

**配置**（`config.js` → `AI_CONFIG.search`）：

```javascript
search: {
    mode: 'keyword',
    maxDocs: 5,
    maxContextTokens: 8000,
    headerChars: 150
}
```

### 4. 小美人设与回答模式

助手名称为**小美**，Terminal Blog 的助手。默认简洁回复；只在用户直接问「你是谁」或「你叫什么」时才简短自我介绍；引用文章须附 `${SITE_URL}/文章ID`；未命中时不反复贴主页/总列表链接。

| 模式 | 触发条件 | 返回字段 |
|------|----------|----------|
| **owner** | 站长/主人等关键词 | `type: 'owner'` |
| **blog** | 检索命中文章 | `sources: [...]` |
| **tech** | 技术关键词且无文章命中 | `type: 'tech'` |
| **general** | 其他 | 仅 `reply` |

统一由 `buildXiaomeiSystemPrompt(mode, opts)` 生成系统提示词，单次 `invokeAIModel` 调用。

### 5. 安全边界

- `/api/ai/chat` **仅**调用：`getAllPosts`、`getPostById`（只读）、`invokeAIModel`（外部 HTTP）
- **不**调用：`savePost`、`deletePostFile`、Git/Shell 等
- `hidden` 文章不进入上下文；`locked` 文章 L1/L2 不注入正文，引导用户站内解锁
- 不向模型传递 `lockPassword`、服务端路径等敏感信息

#### 文章链接格式

返回的 sources 包含完整链接（URL 格式：`${siteUrl}/文章ID`，如 `https://example.com/1001`）：
```json
{
    "sources": [
        {
            "id": 10001,
            "title": "Docker 入门教程",
            "date": "2024-01-15",
            "url": "https://example.com/1001"
        }
    ]
}
```

#### 特殊人称关键词

```javascript
const ownerKeywords = [
    '站长', '管理员', '主人', '陛下',
    '博主', '作者', '老板', '老大'
];
```

**典型回复示例**：
- "哦，你是说主人啊~ 他是一个神秘的人，具体信息不方便透露呢。"
- "站长大人行踪神秘，我也只是他的小小助手，知道的不多哦~"

#### 技术关键词

```javascript
const techKeywords = [
    '系统', '网络', '编程', '代码', '软件',
    '服务器', 'linux', 'windows', 'mac',
    'git', 'docker', 'npm', 'node', 'python',
    'java', '前端', '后端', '数据库', '算法',
    '架构', '部署', '配置', '安装', '命令',
    '终端', 'vim', 'ssh', 'api', 'json',
    'html', 'css', 'javascript', 'typescript'
];
```

---

## 📁 相关文件

### 配置文件

**文件**：`public/config.js`

```javascript
const AI_CONFIG = {
    enabled: true,
    // API 协议：openai | anthropic | gemini
    apiFormat: 'openai',
    apiBaseUrl: 'https://api.openai.com/v1',
    apiKey: 'your-api-key-here',
    model: 'gpt-4o-mini',
    maxTokens: 1500,
    temperature: 0.7,
    search: { maxDocs: 5, maxContextTokens: 8000, headerChars: 150 },
    ui: { windowTitle: '小美', showWelcome: true, welcomeMessage: '...' }
};
```

#### API 格式说明（`apiFormat`）

| 值 | 默认 `apiBaseUrl` | 端点 | 认证方式 |
|----|-------------------|------|----------|
| `openai` | `https://api.openai.com/v1` | `{base}/chat/completions` | `Authorization: Bearer` |
| `anthropic` | `https://api.anthropic.com` | `{base}/v1/messages` | `x-api-key` + `anthropic-version` |
| `gemini` | `https://generativelanguage.googleapis.com/v1beta` | `{base}/models/{model}:generateContent` | `x-goog-api-key` |

DeepSeek、本地 Ollama OpenAI 兼容网关等仍使用 `apiFormat: 'openai'`，只需改 `apiBaseUrl` 与 `model`。

Docker 环境变量：`AI_API_FORMAT`（默认 `openai`）。

### 样式文件

**位置**：`public/index.html` 中的 `<style>` 标签（约第 700-1000 行）

包含以下样式：
- `.ai-modal` - 模态框容器
- `.ai-modal-window` - 对话窗口
- `.ai-message` - 消息气泡
- `.ai-typing` - 打字动画
- `.ai-error` - 错误提示

### CDN 依赖

```html
<script src="https://cdn.jsdelivr.net/npm/marked@3.0.8/marked.min.js"></script>
```

用于将 Markdown 文本转换为 HTML。

---

## 🔄 工作流程

```
用户点击 "✨ AI" 按钮
        ↓
openAIModal() → 显示对话窗口
        ↓
用户输入问题 → sendAIMessage()
        ↓
addAIMessage('user', content) → 显示用户消息
        ↓
showAITyping() → 显示 "思考中" 动画
        ↓
fetch('/api/ai/chat') → 后端处理
        ↓
addAIMessage('ai', reply) → 显示 AI 回复
        ↓
用户继续对话或关闭窗口
```

---

## ⚠️ 错误处理与重试机制

### 自动重试策略

后端实现了智能重试机制，针对以下情况自动重试最多 3 次：
- **429** (频率超限/余额不足) — 重试间隔 2/4/6 秒
- **500/503/529** (服务器错误/过载) — 重试间隔 2/4/6 秒
- **网络错误** (fetch failed/连接超时) — 重试间隔 2/4/6 秒

### 错误码与用户提示

| 状态码 | 错误类型 | 用户提示 |
|--------|----------|----------|
| 400 | 上下文超限/参数错误 | 建议缩短对话历史或减少引用文章内容 |
| 401 | API Key 错误或失效 | 请检查 config.js 中的 apiKey 配置 |
| 403 | 权限不足/地理封锁 | 更换代理节点或更换支持的模型 |
| 413 | 请求体过大 | 减少引用文章数量或缩短上下文长度 |
| 429 | 频率超限/余额不足 | 请稍后再试（建议间隔 30 秒以上） |
| 500 | AI 服务器错误 | AI 服务端暂时不可用，请稍后重试 |
| 503 | 服务繁忙 | AI 服务端繁忙，请稍后重试 |
| 529 | 服务器过载 | AI 服务端过载，请稍后重试 |
| 504 | 推理超时 | 可尝试简化问题或稍后重试 |

API 返回格式：
```json
{
    "error": "AI 服务请求失败: ..." ,
    "code": "RATE_LIMITED",
    "suggestion": "请稍后再试（建议间隔 30 秒以上）"
}
```

---

## 🛠️ 常见问题排查

### 1. AI 按钮不显示

检查 `config.js` 中的配置：
```javascript
AI_CONFIG.enabled = true;  // 确保已启用
```

### 2. 消息发送失败

1. 检查浏览器控制台是否有错误
2. 确认 `config.js` 中的 `apiKey` 正确
3. 检查网络连接是否正常

### 3. Markdown 没有正确渲染

1. 确认 `marked.js` CDN 正常加载
2. 检查浏览器控制台是否有 JavaScript 错误

### 4. 对话窗口样式异常

检查是否有 CSS 冲突，或查看 `public/index.html` 中的 `.ai-*` 相关样式。

---

## 📝 后续优化建议

1. **流式输出**：Server-Sent Events 打字机效果
2. **BM25 / 向量检索**：利用 `search.mode` 配置
3. **元问题短路**：列表类问题服务端直接格式化（可选省 token）
4. **Function Calling**：模型主动请求单篇文章全文

---

*文档更新时间：2026-05-31*