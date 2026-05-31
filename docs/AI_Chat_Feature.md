# TerminalBlog AI 聊天功能文档

> 本文档描述 AI 大模型对话功能，包括功能说明、实现细节和代码位置。

## 📌 功能概述

在 TerminalBlog 中集成了一个 AI 聊天助手功能，用户可以通过点击界面上的 `✨ AI` 按钮打开对话窗口，与 AI 进行实时对话。

### 主要特性

- **Markdown 渲染**：AI 的回复内容支持完整的 Markdown 格式渲染，包括代码块、列表、链接等
- **打字机效果**：显示 AI "思考中" 的加载动画
- **对话历史**：支持多轮对话，AI 可以理解上下文
- **错误处理**：优雅地处理网络错误和 API 配置问题
- **智能边界判断**：根据问题类型采用不同的回答策略
- **博客文章检索**：自动检索相关内容并提供链接
- **特殊人称保护**：对询问站长的敏感问题进行神秘化处理

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

1. 接收前端发送的对话历史和最新消息
2. 调用 AI 大模型 API（支持 OpenAI 兼容格式）
3. 返回 AI 的回复内容

### 3. 智能边界判断系统

**实现位置**：`public/server.js` 中的 `/api/ai/chat` 路由（约第 2249 行起）

#### 判断流程

```
用户提问
    ↓
检测问题类型：
├─ 包含"站长/管理员/主人/陛下/博主/作者/老板/老大"
│   → 特殊人称保护模式（神秘化回复）
│
├─ 匹配博客文章内容
│   → 博客内容优先模式（引用文章+链接）
│
├─ 包含技术关键词（系统/网络/编程/代码等）
│   → 技术问答模式（简要回答）
│
└─ 其他问题
    → 礼貌引导模式（引导浏览博客）
```

#### 三种回答模式

| 模式 | 触发条件 | 回答策略 | 返回字段 |
|------|----------|----------|----------|
| **特殊人称保护** | 询问站长相关信息 | 神秘化、模糊化回复，不透露真实信息 | `type: 'owner'` |
| **博客内容优先** | 匹配到相关文章 | 结合文章内容，附上链接 | `sources: [...]` |
| **技术问答** | 包含技术关键词 | 简要专业回答，可适当引导 | `type: 'tech'` |
| **礼貌引导** | 其他问题 | 友好引导浏览博客 | 无特殊字段 |

#### 文章检索逻辑

```javascript
// 检索相关文章
const relevantPosts = [];
posts.forEach(post => {
    const titleMatch = post.title.toLowerCase().includes(messageLower);
    const contentMatch = post.body.toLowerCase().includes(messageLower);
    const tagMatch = post.tags.some(t => t.toLowerCase().includes(messageLower));
    
    if (titleMatch || contentMatch || tagMatch) {
        let score = 0;
        if (titleMatch) score += 3;   // 标题匹配权重最高
        if (contentMatch) score += 1;   // 内容匹配权重
        if (tagMatch) score += 2;       // 标签匹配权重
        
        relevantPosts.push({ post, score });
    }
});

// 按分数排序，返回最高匹配的前 N 篇
relevantPosts.sort((a, b) => b.score - a.score);
const topPosts = relevantPosts.slice(0, aiConfig.maxDocs || 5);
```

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
window.AI_CONFIG = {
    apiKey: 'your-api-key-here',     // API 密钥（必填）
    model: 'gpt-3.5-turbo',          // 使用的模型
    apiUrl: 'https://api.openai.com', // API 地址
    enabled: true,                    // 是否启用
    ui: {
        windowTitle: 'AI 助手',       // 窗口标题
        showWelcome: true,            // 显示欢迎语
        welcomeMessage: '你好！...'    // 欢迎语内容
    }
};
```

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

1. **流式输出**：使用 Server-Sent Events 实现打字机效果
2. **对话导出**：支持导出对话记录
3. **多 AI 支持**：支持切换不同 AI 提供商
4. **快捷指令**：预设常用问题的快捷按钮

---

*文档更新时间：2026-05-31*