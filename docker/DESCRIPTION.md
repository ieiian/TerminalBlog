# Terminal Blog Docker 部署说明

> 📟 复古拟真 CRT 终端风格博客系统

---

## 快速开始

### 前置准备

```bash
# 创建必要目录（config 目录用于存放配置文件）
mkdir -p Markdown blogimgs blogfiles guestuploads .ssh_key config
```

---

## 部署方式

### 方式一：Docker Compose（推荐）

#### 完整版（含所有参数）

```yaml
# docker-compose.yml
services:
  blog:
    image: ieiian/terminal-blog-fs:latest
    container_name: terminal-blog-fs
    restart: unless-stopped
    ports:
      - "8788:8788"
    volumes:
      # 配置目录映射（宿主机 config/ → 容器 /app/.config/）
      - ./config:/app/.config
      - ./Markdown:/app/Markdown
      - ./blogimgs:/app/blogimgs
      - ./blogfiles:/app/blogfiles
      - ./guestuploads:/app/guestuploads
      - ./.ssh_key:/app/.ssh_key
    environment:
      # 基础配置
      - SITE_TITLE=TerminalBlog
      - WELCOME_MESSAGE=欢迎来到我的终端博客
      - SITE_URL=https://your-domain.com
      - ICP_NUMBER=ICP备xxxx号
      - ADMIN_USER=admin
      - ADMIN_PASS=admin123
      # 字符雨配置
      - MATRIX_RAIN_STARTUP_RANDOM=true
      - MATRIX_RAIN_RANDOM_ALGORITHM=decay
      - MATRIX_RAIN_RANDOM_POOL=1,2,3,4,2+3,1+4,1+2+3+4
      - MATRIX_RAIN_FIXED_MODE=2+3
      - MATRIX_RAIN_ENABLE_BUDDHA_EFFECT=true
      # AI 大模型配置
      - AI_ENABLED=true
      - AI_API_BASE_URL=https://api.deepseek.com
      - AI_API_KEY=your-api-key-here
      - AI_MODEL=deepseek-chat
      - AI_MAX_TOKENS=2048
      - AI_TEMPERATURE=0.7
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:8788/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

#### 简化版（推荐 config 目录方式）

当 `config/` 目录映射后，启动脚本会自动处理软链接：

```yaml
# docker-compose.yml
services:
  blog:
    image: ieiian/terminal-blog-fs:latest
    container_name: terminal-blog-fs
    restart: unless-stopped
    ports:
      - "8788:8788"
    volumes:
      # 配置目录映射（宿主机 config/ → 容器 /app/.config/）
      - ./config:/app/.config
      - ./Markdown:/app/Markdown
      - ./blogimgs:/app/blogimgs
      - ./blogfiles:/app/blogfiles
      - ./guestuploads:/app/guestuploads
      - ./.ssh_key:/app/.ssh_key
```

启动：
```bash
docker compose up -d
```

> 💡 **提示**：在宿主机 `config/` 目录放置 `config.js`，启动脚本自动创建软链接。

---

### 方式二：Docker Run

#### 完整版

```bash
docker run -d \
  --name terminal-blog-fs \
  --restart unless-stopped \
  -p 8788:8788 \
  -v $(pwd)/config:/app/.config \
  -v $(pwd)/Markdown:/app/Markdown \
  -v $(pwd)/blogimgs:/app/blogimgs \
  -v $(pwd)/blogfiles:/app/blogfiles \
  -v $(pwd)/guestuploads:/app/guestuploads \
  -v $(pwd)/.ssh_key:/app/.ssh_key \
  -e SITE_TITLE="TerminalBlog" \
  -e WELCOME_MESSAGE="欢迎来到我的终端博客" \
  -e SITE_URL="https://your-domain.com" \
  -e ICP_NUMBER="ICP备xxxx号" \
  -e ADMIN_USER="admin" \
  -e ADMIN_PASS="admin123" \
  -e MATRIX_RAIN_STARTUP_RANDOM=true \
  -e MATRIX_RAIN_RANDOM_ALGORITHM=decay \
  -e MATRIX_RAIN_RANDOM_POOL=1,2,3,4,2+3,1+4,1+2+3+4 \
  -e MATRIX_RAIN_FIXED_MODE=2+3 \
  -e MATRIX_RAIN_ENABLE_BUDDHA_EFFECT=true \
  -e AI_ENABLED=true \
  -e AI_API_BASE_URL=https://api.deepseek.com \
  -e AI_API_KEY="your-api-key" \
  -e AI_MODEL="deepseek-chat" \
  -e AI_MAX_TOKENS=2048 \
  -e AI_TEMPERATURE=0.7 \
  ieiian/terminal-blog-fs
```

#### 简化版

```bash
docker run -d \
  --name terminal-blog-fs \
  --restart unless-stopped \
  -p 8788:8788 \
  -v $(pwd)/config:/app/.config \
  -v $(pwd)/Markdown:/app/Markdown \
  -v $(pwd)/blogimgs:/app/blogimgs \
  -v $(pwd)/blogfiles:/app/blogfiles \
  -v $(pwd)/guestuploads:/app/guestuploads \
  -v $(pwd)/.ssh_key:/app/.ssh_key \
  ieiian/terminal-blog-fs
```

---

## config 目录配置说明

映射 `config.js` 后可直接编辑配置文件：

| 配置项 | 说明 |
|--------|------|
| `SITE_CONFIG.siteTitle` | 站点标题 |
| `SITE_CONFIG.welcomeMessage` | 欢迎语 |
| `SITE_CONFIG.siteUrl` | 站点 URL（用于生成文章链接） |
| `SITE_CONFIG.icpNumber` | ICP 备案号 |
| `AI_CONFIG.enabled` | 是否启用 AI |
| `AI_CONFIG.apiBaseUrl` | AI API 地址 |
| `AI_CONFIG.apiKey` | AI API 密钥 |
| `AI_CONFIG.model` | AI 模型名称 |
| `AI_CONFIG.maxTokens` | 最大 token 数 |
| `AI_CONFIG.temperature` | 生成随机性 |

---

## AI 大模型配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AI_ENABLED` | `false` | 启用 AI (`true`/`false`) |
| `AI_API_BASE_URL` | - | API 地址 |
| `AI_API_KEY` | - | API 密钥 |
| `AI_MODEL` | - | 模型名称 |
| `AI_MAX_TOKENS` | `2048` | 最大 token |
| `AI_TEMPERATURE` | `0.7` | 随机性 (0-2) |

### 推荐 .env 文件管理

```bash
# 创建 .env 文件
cat > .env << EOF
AI_ENABLED=true
AI_API_BASE_URL=https://api.deepseek.com
AI_API_KEY=your-api-key-here
AI_MODEL=deepseek-chat
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.7
EOF
```

docker-compose.yml 中引用：
```yaml
environment:
  - AI_ENABLED=${AI_ENABLED}
  - AI_API_BASE_URL=${AI_API_BASE_URL}
  - AI_API_KEY=${AI_API_KEY}
  - AI_MODEL=${AI_MODEL}
```

启动：
```bash
docker compose --env-file .env up -d
```

---

## 常用管理命令

```bash
# 查看日志
docker compose logs -f

# 停止容器
docker compose down

# 重启服务
docker compose restart

# 重新构建
docker compose up -d --build
```

---

## 数据持久化目录

| 宿主机目录 | 容器内路径 | 说明 |
|------------|------------|------|
| `./config/` | `/app/.config/` | 配置文件目录（config.js、git_config.json） |

---

## 配置文件说明

`config/` 目录可放置以下配置文件：

| 文件 | 说明 |
|------|------|
| `config.js` | 站点和 AI 配置 |
| `git_config.json` | Git 同步配置 |

启动脚本会自动创建软链接：
- `config.js` → `public/config.js`
- `git_config.json` → `git_config.json`

如果文件不存在，会自动生成默认配置。

---

## GitHub SSH 免密部署

1. 启动容器后，登录后台 → 点击 `[远程仓库]`
2. 填写 GitHub SSH 地址和分支，保存配置
3. 复制显示的 SSH 公钥
4. 在 GitHub 仓库 → Settings → Deploy keys → Add deploy key
5. 粘贴公钥，**勾选 Allow write access**
6. 点击「非破坏性连接测试」验证连通性

---

## 从源码构建

```bash
# 构建镜像
docker build -t terminal-blog-fs -f docker/Dockerfile .

# 运行
docker run -d -p 8788:8788 \
  -v $(pwd)/config:/app/.config \
  -v $(pwd)/Markdown:/app/Markdown \
  -v $(pwd)/blogimgs:/app/blogimgs \
  -v $(pwd)/blogfiles:/app/blogfiles \
  -v $(pwd)/guestuploads:/app/guestuploads \
  -v $(pwd)/.ssh_key:/app/.ssh_key \
  terminal-blog-fs
