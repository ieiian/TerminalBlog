# 📟 Terminal Blog - 复古拟真终端风格博客系统

```
=============================================================================
 _____                         _               _   ______  _                 
|_   _|                       (_)             | |  | ___ \| |                
  | |   ___  _ __  _ __ ___    _  _ __   __ _ | |  | |_/ /| |  ___   __ _  
  | |  / _ \| '__|| '_ ` _ \  | || '_ \ / _` || |  | ___ \| | / _ \ / _` | 
  | | |  __/| |   | | | | | | | || | | | (_| || |  | |_/ /| || (_) | (_| | 
  \_/  \___||_|   |_| |_| |_| |_||_| |_|\__,_||_|  \____/ |_| \___/ \__, | 
                                                                     __/ | 
                                                                    |___/  
=============================================================================
```

> **黑客帝国的浪漫，绿字流瀑的复古情怀。**
>
> **Terminal Blog** 是一个基于 **Node.js** 的高度定制化博客系统。前台采用单页面应用（SPA）架构，结合原生 CSS 渲染，完美重塑了复古 CRT 显示器的发光扫描线、微颤与字符雨瀑动效；后台数据由纯文本 **Markdown 文件系统** 直接驱动。
> 
> 本系统完美适配 Docker 容器化一键部署，并深度集成 **「文件管理系统」** 与 **「远程 Git 仓库多策略安全同步控制台」**，让极客创作随时随地、高效无缝。

---

## ✨ 核心特色与新增模块

### 📁 极简文件管理器 (File Manager)
在博客管理后台中完美集成的多栏目文件管理系统：
- **双栏安全隔离**：独立管理 `/app/blogfiles`（博客文件）和 `/app/blogimgs`（博客图片）两个文件夹。
- **批量异步上传**：支持多文件批量上传；完美适配**文件拖拽 (Drag & Drop)** 上传，辅以终端高亮微光动画。
- **全方位中文文件名支持**：采用底层的 Buffer 指针流精确剪裁机制，完全攻克了中文文件名上传/删除过程中的乱码与 `400 Bad Request` 问题。
- **一键路径复制**：文件列表中内置 `📋 复制` 按钮，可一键复制博客引用路径（例如 `/blogimgs/my_photo.png`），方便直接在 Markdown 写作中引用。

### 🔄 远程 Git 仓库同步控制台 (Git Sync Control Panel)
极具科幻感的控制台界面，支持本地 Markdown 与远程 GitHub 仓库一键同步：
- **自定义分支同步**：支持灵活配置您想要同步的分支名称（如 `markdown`），并在远程无对应分支时提供自动创建与绑定支持。
- **公共仓库无凭据连接**：公开 GitHub 仓库可直接使用 HTTPS 或 SSH 地址，无需账号密码。
- **私有仓库 PAT / SSH 支持**：HTTPS 私有仓库支持 Personal Access Token；SSH 私有仓库继续使用专属部署密钥。
- **GitHub / AI 独立代理配置**：`config.js` 中分别提供 GitHub 仓库代理和 AI baseURL 代理开关，支持 Cloudflare Workers 的 Query / Path 两种模式，默认 Query；GitHub 仓库代理仅适用于 HTTPS 地址，SSH 不走 HTTP 代理。
- **专属 SSH 密钥对隔离**：自动为私有仓库生成专属的 RSA/Ed25519 秘钥对，使用单独环境变量在免交互环境下工作，**绝不污染或冲突**宿主机及容器内的全局 `~/.ssh/config` 配置。
- **GitHub 部署密钥一键绑定**：控制台提供一键复制 SSH 公钥功能，只需粘贴到 GitHub 的 **`Deploy Keys`** 并授权写入，即可直接打通私有/公开仓库的免密 Push 和 Pull。
- **非破坏性连通性测试**：一键测试网络与秘钥，精准拦截并抛出因 HTTPS 验证挂起导致的后台卡死错误。
- **三大精细化同步策略卡片**：
  1. 🟢 **远程增量至本地**【本地操作】：从远程读取文件补充到本地，可选择“本地优先”跳过同名文件，或“远程优先”覆盖同名文件；不会推送远程。
  2. ⚠️ **本地覆盖远程 (Push)**【高危】：将本地最新的文章强制覆盖推送到 GitHub 远程仓库分支。
  3. 🔥 **远程覆盖本地 (Pull)**【极度高危】：从 GitHub 远程拉取文章，强行用远程覆盖并重置本地 Markdown 文件夹，丢失本地未同步的修改。

---

## 🏗️ 目录结构

```
TerminalBlog_fs/
├── Markdown/               # ⭐ 文章数据库 (.md Markdown 原生文件)
├── blogimgs/               # 📂 博客图片目录 (文件管理专属)
├── blogfiles/              # 📂 博客文件目录 (文件管理专属)
├── public/                 # 📂 极客终端 SPA 静态前端
│   ├── index.html          # 📟 复古终端渲染主页面与控制台 UI
│   └── server.js           # 🚀 Node.js 后端服务器 & 同步 API
├── docker/                 # 📂 Docker 部署配置目录
│   ├── Dockerfile          # 🐳 Alpine 极致轻量化构建文件
│   ├── docker-compose.yml  # 🛠️ Docker 复合容器编排配置
│   ├── DESCRIPTION.md      # 📄 容器挂载与部署说明
│   └── entrypoint.sh       # ⚙️ 容器动态参数注入脚本
├── .ssh_key/               # 🔒 [安全过滤] 系统自动生成的专属 SSH 秘钥对
└── git_config.json         # ⚙️ [安全过滤] 远程同步控制台配置参数
```

---

## ⚙️ 核心环境变量说明

在 Docker 部署或启动时，您可以通过环境变量动态配置您的站点：

| 环境变量名 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `ADMIN_USER` | 后台管理用户名（用于文件管理与远程同步） | `admin` |
| `ADMIN_PASS` | 后台管理安全密码 | `admin123` |
| `PORT` | 博客 Node.js 后端端口 | `8788` |
| `SITE_TITLE` | 站点标题（显示在复古终端顶部） | `TerminalBlog` |
| `WELCOME_MESSAGE`| 欢迎栏打印的黑客风打字机欢迎语 | `欢迎来到我的终端博客` |
| `SITE_URL` | 站点外部访问域名 | `-` |
| `ICP_NUMBER` | ICP 备案号 | `-` |
| `MATRIX_RAIN_STARTUP_RANDOM` | 每次刷新页面时是否随机选择字符雨背景（`true`/`false`）| `true` |
| `MATRIX_RAIN_RANDOM_ALGORITHM` | 字符雨随机权重算法（`average` 等概率 / `decay` 断崖递减） | `average` |
| `MATRIX_RAIN_RANDOM_POOL` | 刷新时参与随机抽签的候选池（数字组合模式）| `1,2,3,4,2+3,1+4` |

---

## 🚀 部署指南

### 方式一：Docker Compose 部署（推荐，极简优雅）

> [!IMPORTANT]
> **首次部署的重要挂载准备：**
> 在首次运行 `docker compose up` 之前，必须在宿主机的项目根目录下创建空的配置文件，否则 Docker 会误将缺失挂载文件创建为同名空目录：
> ```bash
> mkdir -p Markdown blogimgs blogfiles .ssh_key
> echo "{}" > git_config.json
> ```

```bash
# 1. 动态设置管理员凭证并后台构建启动
ADMIN_USER="my_user" ADMIN_PASS="my_secure_password" docker compose -f docker/docker-compose.yml up -d --build

# 2. 追踪拟真复古终端服务的后台输出日志
docker compose -f docker/docker-compose.yml logs -f

# 3. 停止容器服务
docker compose -f docker/docker-compose.yml down
```

---

### 方式二：Docker Run 原生部署

```bash
# 1. 前置准备
mkdir -p Markdown blogimgs blogfiles .ssh_key
echo "{}" > git_config.json

# 2. 构建 Terminal Blog 专属镜像
docker build -t terminal-blog-fs -f docker/Dockerfile .

# 3. 运行容器并映射宿主机持久化目录
docker run -d \
  --name terminal-blog-fs \
  --restart unless-stopped \
  -p 8788:8788 \
  -v $(pwd)/Markdown:/app/Markdown \
  -v $(pwd)/blogimgs:/app/blogimgs \
  -v $(pwd)/blogfiles:/app/blogfiles \
  -v $(pwd)/.ssh_key:/app/.ssh_key \
  -v $(pwd)/git_config.json:/app/git_config.json \
  -e SITE_TITLE="极客博客" \
  -e WELCOME_MESSAGE="欢迎连接至主机" \
  -e ADMIN_USER="admin" \
  -e ADMIN_PASS="your_secure_password" \
  terminal-blog-fs
```

---

### 方式三：本地极速开发与测试

若您希望在宿主机本地直接测试：

```bash
# 1. 安装项目 Node 依赖
npm install

# 2. 注入预设的种子数据与文章模板
npm run seed

# 3. 启动本地守护进程
npm start
```
*本地启动后，直接在浏览器中访问：`http://localhost:8788`*

---

## 🔑 绑定 GitHub Deploy Key 远程免密同步

当您成功部署了 Terminal Blog 并在后台的 **`[远程仓库]`** 配置中填入您博客的 **SSH 地址**（例如 `git@github.com:username/my-blog-repo.git`）时，绑定流程如下：

1. **保存配置**：在页面控制台上点击 **`[保存配置]`**。
2. **复制公钥**：由于是 SSH 协议，控制台左侧将自动亮起折叠展示区。点击 **「SSH 专属公钥与配置指引」** 触发条将其展开，点击 **`📋 复制 SSH 公钥`** 一键复制。
3. **前往 GitHub 授权**：
   - 打开您的博客 GitHub 仓库，前往 **Settings** → **Deploy keys** → **Add deploy key**。
   - **Title** 随意命名，在 **Key** 输入框中粘贴刚才复制的 SSH 公钥。
   - 🌟 **核心关键**：**务必勾选 `Allow write access`** （必须勾选，允许写入才能 Push 本地修改）。
   - 点击 **Add key** 保存。
4. **连通测试**：回到博客控制台，点击 **「非破坏性连接测试」**。控制台以炫酷打字机流式输出测试结果，提示 `测试成功` 后，您便可以随心所欲进行 Merge / Push / Pull 操作了！

---

## 📝 博客文章写作规范

博客的文章存放于 `Markdown/` 目录下，文件需为 `.md` 后缀，且顶部**必须**包含 YAML Frontmatter 格式的元数据头部，以便博客系统准确索引与显示：

```markdown
---
id: 10001
title: 这是我的第一篇黑客帝国式文章
date: 2026-05-22
tags: ['极客', '终端', '部署']
---

# 欢迎来到拟真终端！

在这里，你可以自由书写 Markdown 代码...

## 插入上传的图片
在前台[文件管理]中上传图片后复制路径，可直接引用：
![展示图](/blogimgs/screenshot.png)

## 提供资源下载
[点击下载本站独家配置](/blogfiles/config_backup.zip)
```

> [!NOTE]
> **关于文章 `id` 属性的重要约束：**
> - 文章的 `id` 必须是唯一的整数。
> - 未设置有效 `id` 头部的 Markdown 文件将**无法**被博客系统检测和加载。

---

## 🛡️ 安全合规与技术支持

- **本地独立文件安全**：`.ssh_key` 中的私钥完全隔离，且通过 API 动态注入 `GIT_SSH_COMMAND` 挂载，不污染宿主机系统环境。
- **本地配置文件防泄漏**：项目已配置 `.gitignore` 规则，`.ssh_key/` 和 `git_config.json` 将**永远不会**被意外推送到您的远程公共代码仓库中。

*Terminal Blog - 用最硬核的黑客情怀，写最有温度的极客文字。*
