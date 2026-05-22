# Terminal Blog (Docker 版本) 部署说明书

> 📟 **极客黑客帝国的浪漫，复古拟真 CRT 终端风格的极致博客系统。**
> 
> 本文档旨在指导如何通过 Docker/Docker Compose 容器化技术完美部署 Terminal Blog，并详细阐明最新研发的 **「文件管理」** 与 **「远程 Git 仓库同步」** 模块在生产环境中的数据持久化要求与免密 SSH 同步配置指南。

---

## 🏗️ 容器化架构概览

| 容器属性 | 配置参数 |
| :--- | :--- |
| **基础镜像** | `node:24-alpine` |
| **容器名称** | `terminal-blog-fs` |
| **内置依赖** | `bash`, `sed`, `git`, `openssh-client` |
| **对外暴露端口**| `8788` |
| **数据持久化挂载卷** | 📁 `Markdown/` (文章数据库)<br>📁 `blogimgs/` (博客图片仓)<br>📁 `blogfiles/` (博客文件区)<br>📁 `.ssh_key/` (免密 SSH 专属密钥对)<br>📄 `git_config.json` (仓库同步配置文件) |

---

## 🛠️ 数据持久化与挂载要求 (CRITICAL)

为保证容器在重启、更新或重新构建镜像时，您的**文章、上传的文件、Git 同步配置以及 SSH 密钥对**不会永久丢失，必须在宿主机上对数据进行持久化挂载。

> [!WARNING]
> **关于 `git_config.json` 挂载的重要提醒：**
> 在首次运行 `docker compose up` 或 `docker run` 之前，**必须**先在宿主机项目的根目录下手动创建一个有效的 `git_config.json` 空文件。
> 如果该文件在宿主机上不存在，Docker 引擎会默认在宿主机上自动创建一个名为 `git_config.json` 的**空文件夹**来映射，这会导致 Node.js 后端在写入配置时抛出目录写冲突异常！
> 
> **初始化指令（宿主机根目录执行）：**
> ```bash
> echo "{}" > git_config.json
> ```

### 挂载矩阵

| 宿主机路径 (相对根目录) | 容器内目标路径 | 挂载用途与核心数据 |
| :--- | :--- | :--- |
| `../Markdown` | `/app/Markdown` | 存放所有博客文章（`.md` 文件）。 |
| `../blogimgs` | `/app/blogimgs` | 文件管理器中上传的博客图片，用于在文章中显示。 |
| `../blogfiles` | `/app/blogfiles` | 文件管理器中上传的博客文件，用于分享或文章链接。 |
| `../.ssh_key` | `/app/.ssh_key` | 系统自动为私有仓库生成的独立免密 SSH 密钥对（`id_git_blog` / `id_git_blog.pub`）。 |
| `../git_config.json` | `/app/git_config.json` | 远程同步控制台的同步分支、用户名及仓库 URL 等配置数据。 |

---

## 🚀 部署配置方式

在部署前，建议将整个项目克隆到宿主机。项目包中已内置了完美的 `docker-compose.yml` 和 `Dockerfile`。

### 方式一：Docker Compose（推荐，极简优雅）

使用 Docker Compose 可以自动编排容器服务、配置环境变量、管理挂载卷并配置自动健康检查。本方式分为**本地源码直接部署**与**外服拷贝单 YAML 独立部署**两种方式。

#### 1. 前置环境初始化 (CRITICAL)
无论哪种部署方式，运行容器前必须执行以下命令初始化本地文件夹与关键的 Git 挂载配置文件，以防御 Docker 引擎将缺失挂载文件误创建为同名空目录：
```bash
# 手动创建各挂载卷文件夹
mkdir -p Markdown blogimgs blogfiles .ssh_key

# 预先生成空的 git 配置文件，防止 Docker 引擎误自动创建为同名文件夹
echo "{}" > git_config.json
```

#### 2. 本地克隆源码直接运行
如果您已经将整个项目克隆到了本地，您可以直接使用内置的复合配置启动：
```bash
# 动态注入安全管理员身份并构建启动容器
ADMIN_USER="admin" ADMIN_PASS="your_secure_password" docker compose -f docker/docker-compose.yml up -d --build
```
*注：内置的 `docker/docker-compose.yml` 中默认的宿主机卷路径指向上级目录（如 `../Markdown` 等），方便与项目源码平级共用。*

#### 3. 单 YAML 独立文件拷贝部署 (适合远程 VPS 快速建站)
如果您没有克隆项目源码，只想在远程服务器上极速部署，您只需在服务器的空目录中创建一个 `docker-compose.yml` 文件：

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
      # 映射当前目录下的各数据文件夹与配置文件
      - ./Markdown:/app/Markdown
      - ./blogimgs:/app/blogimgs
      - ./blogfiles:/app/blogfiles
      - ./.ssh_key:/app/.ssh_key
      - ./git_config.json:/app/git_config.json
    environment:
      - SITE_TITLE=我的拟真终端空间
      - WELCOME_MESSAGE=欢迎来到我的复古极客博客
      - SITE_URL=https://myblog.com
      - ICP_NUMBER=ICP备xxxxx号
      - ADMIN_USER=admin
      - ADMIN_PASS=admin123
      # 字符雨参数配置
      # MATRIX_RAIN_STARTUP_RANDOM: true/false 是否开启启动随机切换模式
      - MATRIX_RAIN_STARTUP_RANDOM=true
      # 控制算法开关：想用等概率就写 average，想用递减概率就写 decay
      - MATRIX_RAIN_RANDOM_ALGORITHM=decay
      # MATRIX_RAIN_RANDOM_POOL: 当 startup_random 为 true 时，参与随机抽签的候选池(1, 2, 3, 4, 1+2, 1+3...)
      - MATRIX_RAIN_RANDOM_POOL=1,2,3,4,2+3,1+4,1+2+3+4
      # MATRIX_RAIN_FIXED_MODE: 当 startup_random 为 false 时生效(1, 2, 3, 4, 1+2, 1+3...)
      - MATRIX_RAIN_FIXED_MODE=2+3
      # MATRIX_RAIN_ENABLE_BUDDHA_EFFECT: 是否开启“佛”字特效（true/false）
      - MATRIX_RAIN_ENABLE_BUDDHA_EFFECT=true
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:8788/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

启动命令极其优雅：
```bash
# 在该目录下直接后台运行容器 (自动拉取公网上编译好的 DockerHub 镜像)
docker compose up -d
```

#### 4. 常见管理指令
```bash
# 实时跟踪拟真终端服务的流日志
docker compose logs -f

# 停止并摧毁容器实例（数据在宿主机卷中安然无恙）
docker compose down

# 重启博客服务
docker compose restart
```

---

### 方式二：Docker Run（单容器极速部署）

若您的环境没有安装 Docker Compose，可直接通过原生的 `docker run` 命令启动。

```bash
# 1. 初始化文件与文件夹
mkdir -p Markdown blogimgs blogfiles .ssh_key
echo "{}" > git_config.json

# 2. 构建镜像 (在项目根目录下)
docker build -t terminal-blog-fs -f docker/Dockerfile .

# 3. 运行容器
docker run -d \
  --name terminal-blog-fs \
  --restart unless-stopped \
  -p 8788:8788 \
  -v $(pwd)/Markdown:/app/Markdown \
  -v $(pwd)/blogimgs:/app/blogimgs \
  -v $(pwd)/blogfiles:/app/blogfiles \
  -v $(pwd)/.ssh_key:/app/.ssh_key \
  -v $(pwd)/git_config.json:/app/git_config.json \
  -e SITE_TITLE="终端博客" \
  -e WELCOME_MESSAGE="欢迎来到我的复古极客空间" \
  -e ADMIN_USER="admin" \
  -e ADMIN_PASS="my_secure_pass_123" \
  terminal-blog-fs
```

---

## 🔑 免密 SSH 远程仓库同步指南 (GitHub 绑定流程)

如果您的 GitHub 仓库是**私有仓库**，或者您想避免在容器中保存密码/Token，系统内置了强大的独立免密 SSH 秘钥挂载技术。

### 1. 为什么是安全的？
系统的 SSH 秘钥只生成在 `/app/.ssh_key` 独立专属目录中。系统在执行 Git 同步时，使用内部环境变量 `GIT_SSH_COMMAND="ssh -i /app/.ssh_key/id_git_blog -o StrictHostKeyChecking=no"`，**完美实现免交互且绝对不冲突、不污染**您容器宿主机的全局 `~/.ssh/config` 配置。

### 2. 绑定核心步骤：
1. **启动并登录后台**：输入设置的 `ADMIN_USER` 和 `ADMIN_PASS` 登录。
2. **打开控制台**：点击顶部导航栏的 **`[远程仓库]`**。
3. **输入配置**：
   - 填写远程 GitHub 仓库的 SSH 地址，如 `git@github.com:username/repo.git`。
   - 填写自定义同步的分支（如 `markdown`，若远程不存在，系统会自动推上去建分支）。
   - 填写 GitHub 用户名（仅用作非必填标识）。
4. **获取与复制部署密钥 (Deploy Key)**：
   - 点击 **`[保存配置]`** 后，若检测到是 SSH 地址，界面上将显示手风琴式折叠的 **「SSH 专属公钥与配置指引」**。
   - 点击该折叠栏展开，点击 **`📋 复制 SSH 公钥`** 一键复制框中的公钥内容。
5. **挂载到 GitHub**：
   - 打开您的 GitHub 博客仓库页面。
   - 依次点击：**Settings** → **Deploy keys** → **Add deploy key**。
   - **Title** 填入标识名（如：`Terminal-Blog-Docker-Key`）。
   - **Key** 粘贴刚才复制的 SSH 公钥。
   - **CRITICAL**：**务必勾选 `Allow write access`** （允许写入权限），否则系统将无法向 GitHub Push 推送本地文章！
   - 点击 **Add key** 完成绑定。
6. **非破坏性连通性测试**：
   - 在控制台中点击 **「非破坏性连接测试」**。
   - 拟真终端控制台将输出测试日志。如果显示握手成功，即代表宿主机网络、容器网络、SSH 专属密钥与远程 GitHub 安全握手完美打通！

---

## 📁 文件管理使用指南

您新增的 **`[文件管理]`** 面板提供极简的双栏布局，将 `blogfiles/` (博客文件) 与 `blogimgs/` (博客图片) 隔离管理。

*   **极简上传**：点击上传按钮，或直接**拖拽**一个或多个文件到专属文件上传框中，即可实现高效的多文件批量异步上传。
*   **安全中文文件名支持**：采用原生的 Buffer 指针精细裁剪和编码处理，完美兼容所有中文字符文件名，在上传和删除时均能保障文件名完好无损。
*   **一键复制 URL**：上传成功的文件会在上下两栏菜单中动态显示。点击文件右侧的 **`📋 复制链接`**，即可瞬间复制其在博客中的路径（如 `/blogimgs/my-pic.png` 或 `/blogfiles/doc.pdf`），供您在 Markdown 文章中流畅引用。

---

## 🛡️ 三大同步策略说明

| 同步策略 | 安全徽章 | 行为特征与数据流向 |
| :--- | :--- | :--- |
| **本地覆盖远程 (Push)** | ⚠️ **高危操作** | **`本地 Markdown` ➔ `远程仓库`**<br>强制推送到 GitHub 对应分支。若中途有人修改过远程仓库，此操作会暴力覆盖，请谨慎使用。 |
| **远程覆盖本地 (Pull)** | 🔥 **极度危险** | **`远程仓库` ➔ `本地 Markdown`**<br>彻底拉取 GitHub 上的文章并强行重置覆盖本地的 Markdown 目录。本地未同步的修改将彻底丢失，适合多端创作时一键同步到最新状态。 |
| **双向智能合并 (Merge)** | 🟢 **推荐/安全** | **`本地 Markdown` ⇆ `远程仓库`**<br>执行智能的双向合并（基于 Git 三路合并算法）。在合并冲突时，系统具备零污染安全撤销（`git merge --abort`）保护，确保冲突时绝对不损坏您的本地文章。 |
