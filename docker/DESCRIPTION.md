# Terminal Blog Docker 部署说明

## 容器说明

| 项目 | 说明 |
|------|------|
| 镜像名称 | `terminal-blog-fs` |
| 容器名称 | `terminal-blog-fs` |
| 暴露端口 | `8788` |
| 数据目录 | `/app/Markdown` (文章)、`/app/images` (图片)、`/app/download` (下载文件) |

## 目录结构

```
CloudflareBlog/
├── Markdown/          # 存放博客文章 (.md 文件)
├── download/           # 存放下载文件
├── images/             # 存放博客图片
├── public/             # 前端静态文件
├── docker/             # Docker 配置
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── entrypoint.sh
└── server.js           # Node.js 服务器
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| SITE_TITLE | 网站标题 | TerminalBlog.Docker |
| WELCOME_MESSAGE | 欢迎信息 | 欢迎来到我的终端博客docker版本 |
| SITE_URL | 网站 URL | https://docker.example.com |
| ICP_NUMBER | ICP 备案号 | ICP粤B123docker号 |
| ADMIN_USER | 管理员用户名 | admin |
| ADMIN_PASS | 管理员密码 | admin123 |

---

## 部署方式

### 方式一：docker run

```bash
docker run -d \
  --name terminal-blog-fs \
  --restart unless-stopped \
  -p 8788:8788 \
  -v $(pwd)/Markdown:/app/Markdown \
  -v $(pwd)/images:/app/images \
  -v $(pwd)/download:/app/download \
  -e SITE_TITLE="我的博客" \
  -e WELCOME_MESSAGE="欢迎访问我的博客" \
  -e ADMIN_USER="admin" \
  -e ADMIN_PASS="admin123" \
  terminal-blog-fs
```

#### 常用命令

```bash
# 查看日志
docker logs -f terminal-blog-fs

# 进入容器
docker exec -it terminal-blog-fs sh

# 停止容器
docker stop terminal-blog-fs

# 启动容器
docker start terminal-blog-fs

# 删除容器
docker rm -f terminal-blog-fs
```

---

### 方式二：docker-compose

#### 1. 创建 docker-compose.yml

```yaml
# docker/docker-compose.yml
services:
  blog:
    image: terminal-blog-fs
    container_name: terminal-blog-fs
    restart: unless-stopped
    ports:
      - "8788:8788"
    volumes:
      - ../Markdown:/app/Markdown
      - ../images:/app/images
      - ../download:/app/download
    environment:
      - SITE_TITLE=我的博客
      - WELCOME_MESSAGE=欢迎访问我的博客
      - SITE_URL=https://example.com
      - ICP_NUMBER=ICPxxxxxx号
      - ADMIN_USER=admin
      - ADMIN_PASS=admin123
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8788/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

#### 2. 运行容器

```bash
docker compose -f docker/docker-compose.yml up -d
```

#### 常用命令

```bash
# 查看日志
docker compose -f docker/docker-compose.yml logs -f

# 停止服务
docker compose -f docker/docker-compose.yml down

# 重启服务
docker compose -f docker/docker-compose.yml restart

# 查看容器状态
docker ps | grep terminal-blog
```

---

## 文章管理

### 文章格式

```markdown
---
id: 1
title: 我的第一篇文章
date: 2026-01-01
tags: ['技术', '教程']
---

# 文章正文

这里是 Markdown 格式的内容...
```

### 图片引用

在 Markdown 中使用 `/images/` 路径引用图片：

```markdown
![图片描述](/images/screenshot.png)
```

### 下载文件引用

```markdown
[下载附件](/download/file.zip)
```

---

## 数据持久化

所有数据通过 Docker volume 挂载到宿主机的本地目录：

| 宿主机目录 | 容器内路径 | 用途 |
|-----------|-----------|------|
| `Markdown/` | `/app/Markdown` | 博客文章 |
| `images/` | `/app/images` | 博客图片 |
| `download/` | `/app/download` | 下载文件 |

**重要**: 请定期备份这些目录！

---

## 故障排除

### 容器启动失败

```bash
# 查看详细错误
docker logs terminal-blog-fs

# 检查端口是否被占用
lsof -i :8788
```

### 文章不显示

1. 检查 Markdown 文件是否放在正确目录
2. 确保文件以 `.md` 结尾
3. 检查文件 frontmatter 中是否有 `id` 字段

### 图片无法加载

1. 确保图片放在 `images/` 目录
2. 检查文件名是否只包含字母、数字、点、下划线、短横线

---

## 技术栈

- **后端**: Node.js
- **前端**: 原生 HTML/CSS/JavaScript
- **容器化**: Docker
- **存储**: 文件系统 (Markdown)

## License

MIT