/**
 * 种子数据脚本 - 在 Markdown 目录下生成带 ID 的 .md 文件
 * 
 * 用法:
 *   npm run seed
 */

const fs = require('fs');
const path = require('path');

const MARKDOWN_DIR = path.join(__dirname, '..', 'Markdown');

const POSTS = [
    {
        title: '从零搭建属于自己的终端风格博客',
        tags: ['技术', '教程', '博客'],
        date: '2026-04-28',
        content: `# 从零搭建属于自己的终端风格博客

终端不仅是工具，更是一种美学。本文将带你从零开始，用 HTML 和 CSS 搭建一个具有终端风格的博客页面。

## 为什么选择终端风格？

终端风格有一种独特的魅力——简洁、高效、极客范儿。它让我们回到那个用命令行与计算机对话的时代，同时又能表达现代的设计理念。

- **简洁至上**：没有花哨的装饰，内容为王
- **极客美学**：绿色磷光文字、CRT 扫描线、ASCII 艺术
- **高效阅读**：信息密度高，一眼获取关键内容

## 技术栈

\`\`\`javascript
const blog = {
    frontend: 'HTML + CSS + Vanilla JS',
    backend: 'Node.js API Server',
    storage: 'File System (Markdown)',
    deployment: 'Docker',
    theme: 'Terminal / Hacker'
};
\`\`\`

## 开始搭建

### 1. 项目结构

\`\`\`bash
terminal-blog/
├── public/           # 静态文件
│   └── index.html    # SPA 主页
├── server.js         # Node.js API 服务器
├── Markdown/         # Markdown 文章目录
├── docker/           # Docker 配置
└── package.json
\`\`\`

### 2. 文件存储结构

> 所有文章以 Markdown 文件形式存储在 Markdown 目录下。

每个文件包含 frontmatter 元数据：

\`\`\`yaml
---
id: 10001
title: 文章标题
date: 2026-04-28
tags: ["标签1", "标签2"]
---
\`\`\`

### 3. 部署

\`\`\`bash
# Docker 部署
docker compose -f docker/docker-compose.yml up -d --build

# 本地开发
npm install
npm run seed  # 生成种子数据
npm start
\`\`\`

## 总结

使用 Node.js + 文件系统存储构建博客，我们获得了：

1. **简单可靠** — 无需数据库，直接使用文件系统
2. **易于备份** — 所有文章都是纯文本 Markdown 文件
3. **版本控制** — 可以用 Git 管理文章历史
4. **终端美学** — 独特的视觉体验

---

*Stay hungry, stay hacking.*`
    },
    {
        title: '用 Vim 的哲学写代码：效率提升指南',
        tags: ['Vim', '效率', '编辑器'],
        date: '2026-04-22',
        content: `# 用 Vim 的哲学写代码：效率提升指南

Vim 不仅是一个编辑器，更是一种思维方式。掌握了 Vim 的哲学，你的编码效率将会有质的飞跃。

## Vim 的核心哲学

### 1. 模式编辑 (Modal Editing)

Vim 有四种主要模式：

- **Normal 模式** — 浏览和操作文本
- **Insert 模式** — 输入文本
- **Visual 模式** — 选择文本
- **Command 模式** — 执行命令

### 2. 组合命令 (Composable Commands)

Vim 的命令可以像乐高积木一样组合：

\`\`\`
d + w = 删除一个单词 (delete word)
c + i + " = 修改引号内的内容 (change inside quotes)
y + a + p = 复制整个段落 (yank a paragraph)
\`\`\`

### 3. 动词 + 名词

\`\`\`vim
" 动词: d(删除), c(修改), y(复制), v(选择)
" 名词: w(单词), s(句子), p(段落), t(标签)
" 修饰: i(内部), a(周围), f(找到)

diw  " 删除光标所在单词
ci"  " 修改双引号内的内容
vap  " 选择整个段落
\`\`\`

## 效率提升技巧

1. **不要用方向键** — 使用 h j k l
2. **用 . 重复上一次操作**
3. **用宏录制重复任务** — qa ... q @a
4. **学会使用 buffers 和 windows**

> 记住：Vim 的学习曲线是陡峭的，但一旦掌握，你将受益终生。`
    },
    {
        title: 'Linux 桌面环境定制：从 i3wm 到 Hyprland',
        tags: ['Linux', '桌面', '开源'],
        date: '2026-04-15',
        content: `# Linux 桌面环境定制：从 i3wm 到 Hyprland

作为一个 Linux 用户，桌面环境的定制是一种信仰。今天我们来聊聊从 i3wm 迁移到 Hyprland 的体验。

## 为什么选择平铺式窗口管理器？

平铺式窗口管理器的优势：

- **纯键盘操作** — 告别鼠标，效率翻倍
- **自动化布局** — 窗口自动排列，不留死角
- **轻量高效** — 资源占用极低
- **高度可定制** — 一切皆可配置

## i3wm：经典之选

i3wm 是最流行的平铺式窗口管理器之一：

\`\`\`bash
# 安装 i3wm
sudo apt install i3-wm i3status i3lock

# 配置文件位置
~/.config/i3/config
\`\`\`

## Hyprland：新时代的窗口管理器

Hyprland 是一个基于 wlroots 的 Wayland 平铺式窗口管理器：

- **原生 Wayland 支持**
- **内置动画和模糊效果**
- **使用 Lua 风格配置**

\`\`\`ini
# hyprland.conf 示例
monitor=,preferred,auto,1

general {
    gaps_in = 5
    gaps_out = 10
    border_size = 2
    col.active_border = rgba(00ff41ff)
}
\`\`\`

## 迁移建议

1. 先在虚拟机中测试 Hyprland
2. 逐步迁移配置
3. 注意 Wayland 兼容性问题`
    },
    {
        title: 'SSH 隧道与端口转发完全指南',
        tags: ['网络', 'SSH', '运维'],
        date: '2026-04-08',
        content: `# SSH 隧道与端口转发完全指南

SSH 不只是一个远程登录工具，它的端口转发功能可以帮你解决很多网络问题。

## 什么是 SSH 隧道？

SSH 隧道（SSH Tunneling）是通过 SSH 连接在本地和远程机器之间建立加密通道的技术。

## 三种端口转发方式

### 1. 本地端口转发 (Local Forward)

\`\`\`bash
# 将本地 8080 端口转发到远程服务器的 80 端口
ssh -L 8080:localhost:80 user@remote-server
\`\`\`

### 2. 远程端口转发 (Remote Forward)

\`\`\`bash
# 将远程服务器的 9090 端口转发到本地的 3000 端口
ssh -R 9090:localhost:3000 user@remote-server
\`\`\`

### 3. 动态端口转发 (SOCKS 代理)

\`\`\`bash
# 创建 SOCKS5 代理
ssh -D 1080 user@remote-server
\`\`\`

## 实用场景

> SSH 隧道在日常开发和运维中非常有用。

1. **访问内网服务** — 通过跳板机访问内部 API
2. **安全传输** — 加密不安全的协议
3. **临时代理** — 快速创建安全代理

## 配置简化

在 \`~/.ssh/config\` 中配置：

\`\`\`
Host my-tunnel
    HostName server.example.com
    User admin
    LocalForward 8080 localhost:80
    ServerAliveInterval 60
\`\`\``
    },
    {
        title: '为什么每个开发者都应该学点正则',
        tags: ['正则', '效率', '技术'],
        date: '2026-04-01',
        content: `# 为什么每个开发者都应该学点正则

正则表达式（Regular Expression）是每个开发者的必备技能。虽然它看起来像乱码，但掌握后会极大提升你的工作效率。

## 正则基础

### 常用元字符

| 字符 | 含义 |
|------|------|
| \`.\` | 匹配任意字符 |
| \`*\` | 匹配 0 次或多次 |
| \`+\` | 匹配 1 次或多次 |
| \`?\` | 匹配 0 次或 1 次 |
| \`^()\` | 捕获组 |

### 实用示例

\`\`\`javascript
// 匹配邮箱
const email = /[\\w.-]+@[\\w.-]+\\.\\w+/;

// 匹配 URL
const url = /https?:\\/\\/[\\w.-]+(?:\\.[\\w]{2,})+/;

// 匹配 IPv4 地址
const ipv4 = /\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/;
\`\`\`

## 为什么学正则？

1. **文本处理** — 日志分析、数据清洗
2. **表单验证** — 前端后端都需要
3. **搜索替换** — IDE 中的批量操作
4. **效率工具** — 一行正则胜过十行代码

> 正则表达式就像是文本处理的瑞士军刀。不一定要精通，但一定要会用。

## 学习建议

- 使用 [regex101.com](https://regex101.com) 在线测试
- 从简单模式开始，逐步深入
- 多写多练，积累常用模式`
    }
];

// ============ Main ============
function getNextId(existingPosts) {
    let maxId = 10000;
    for (const post of existingPosts) {
        if (post.id && post.id > maxId) {
            maxId = post.id;
        }
    }
    return maxId + 1;
}

function getExistingPosts() {
    if (!fs.existsSync(MARKDOWN_DIR)) {
        return [];
    }
    
    const posts = [];
    const files = fs.readdirSync(MARKDOWN_DIR);
    
    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const filePath = path.join(MARKDOWN_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) continue;
        
        const lines = match[1].split('\n');
        for (const line of lines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx > 0 && line.slice(0, colonIdx).trim() === 'id') {
                const id = parseInt(line.slice(colonIdx + 1).trim());
                if (id) posts.push({ id });
            }
        }
    }
    
    return posts;
}

function generateFilename(title) {
    return title
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50) + '.md';
}

function main() {
    console.log('🌱 开始生成种子数据...\n');

    // 确保目录存在
    if (!fs.existsSync(MARKDOWN_DIR)) {
        fs.mkdirSync(MARKDOWN_DIR, { recursive: true });
        console.log(`📁 创建目录: ${MARKDOWN_DIR}\n`);
    }

    const existingPosts = getExistingPosts();
    let nextId = getNextId(existingPosts);

    console.log(`📝 共 ${POSTS.length} 篇文章待生成\n`);

    for (const post of POSTS) {
        const id = nextId++;
        const filename = generateFilename(post.title);
        const filePath = path.join(MARKDOWN_DIR, filename);
        
        const tagsStr = JSON.stringify(post.tags).replace(/"/g, "'");
        
        const fileContent = `---
id: ${id}
title: ${post.title}
date: ${post.date}
tags: ${tagsStr}
---

${post.content}`;

        try {
            fs.writeFileSync(filePath, fileContent, 'utf-8');
            console.log(`  ✅ ${post.title} (ID: ${id})`);
        } catch (e) {
            console.log(`  ❌ ${post.title}: ${e.message}`);
        }
    }

    console.log('\n🎉 种子数据生成完成！');
    console.log(`\n💡 文章保存在 ${MARKDOWN_DIR} 目录\n`);
}

main();