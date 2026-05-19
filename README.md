# Terminal Blog - 终端风格博客

一个基于 Node.js + 文件系统存储的终端风格博客系统，使用 Docker 部署。

## 🏗️ 项目结构

```
public/
├── index.html          # 终端风格 SPA 前端
├── _worker.api.js      # API 逻辑（保留用于参考）
server.js               # ⭐ Node.js API 服务器
scripts/
├── seed.js             # 种子数据脚本
├── reset.js            # 重置脚本
└── import.js           # 导入脚本
Markdown/               # ⭐ Markdown 文章目录
docker/
├── Dockerfile          # Docker 镜像构建文件
├── docker-compose.yml  # Docker Compose 配置
└── entrypoint.sh       # 容器启动脚本
```

## 📝 文章格式

所有文章以 Markdown 文件形式存储在 `Markdown/` 目录下。文件必须包含 frontmatter 元数据：

```yaml
---
id: 10001
title: 文章标题
date: 2026-04-28
tags: ['标签1', '标签2']
---

文章内容...
```

**注意**：`id` 字段是必需的，没有 `id` 的文件不会被识别。

##  快速开始

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 生成种子数据
npm run seed

# 3. 启动服务器
npm start
```

访问 http://localhost:8788

### Docker 部署

#### 方式一：Docker Compose（推荐）

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

自定义管理员密码：

```bash
ADMIN_USER=myuser ADMIN_PASS=mypassword docker compose -f docker/docker-compose.yml up -d --build
```

#### 方式二：Docker Run

```bash
# 从源码构建镜像
docker build -t terminal-blog -f docker/Dockerfile .

# 运行
docker run -d \
  --name terminal-blog \
  -p 8788:8788 \
  -v "$(pwd)/Markdown:/app/Markdown" \
  -v "$(pwd)/download:/app/download" \
  -e ADMIN_USER=myuser \
  -e ADMIN_PASS=mypassword \
  terminal-blog
```

访问 http://localhost:8788

#### 发布镜像

```bash
docker build -t ieiian/terminal-blog:latest -f docker/Dockerfile .
docker push ieiian/terminal-blog:latest
```

#### 管理命令

```bash
# 查看日志
docker logs -f terminal-blog

# 停止
docker compose -f docker/docker-compose.yml down
# 或
docker stop terminal-blog
```

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ADMIN_USER` | 管理员用户名 | `admin` |
| `ADMIN_PASS` | 管理员密码 | `admin123` |
| `PORT` | 服务端口 | `8788` |
| `MARKDOWN_DIR` | Markdown 文件目录 | `/app/Markdown` |

## 📋 命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动服务器 |
| `npm run seed` | 生成种子数据 |
| `npm run reset` | 清空所有文章 |
| `npm run import` | 导入 Markdown 文件 |

## 🔧 开发说明

- 修改前端：编辑 `public/index.html`
- 修改后端 API：编辑 `server.js`
- 文章存储：`Markdown/` 目录下的 `.md` 文件

## 📦 数据管理

### 添加新文章

在 `Markdown/` 目录下创建新的 `.md` 文件：

```markdown
---
id: 10006
title: 我的新文章
date: 2026-05-18
tags: ['技术', '教程']
---

文章内容...
```

### 批量导入

将已有的 Markdown 文件放入 `Markdown/` 目录，然后运行：

```bash
npm run import
```

脚本会自动为没有 ID 的文件分配新的 ID。