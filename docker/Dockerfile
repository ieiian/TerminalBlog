# ============================================================
# Terminal Blog - Docker 构建文件
# ============================================================
# 构建: docker build -t terminal-blog-fs -f docker/Dockerfile .
# 运行: docker run -d -p 8788:8788 \
#        -v $(pwd)/Markdown:/app/Markdown \
#        -v $(pwd)/blogfiles:/app/blogfiles \
#        -v $(pwd)/blogimgs:/app/blogimgs \
#        -e SITE_TITLE="我的博客" \
#        -e WELCOME_MESSAGE="欢迎语" \
#        -e ADMIN_USER="admin" \
#        -e ADMIN_PASS="admin123" \
#        terminal-blog-fs
# ============================================================

FROM node:24-alpine

# 安装基础工具
RUN apk add --no-cache bash sed git openssh-client

# 设置工作目录
WORKDIR /app

# 复制 package.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制应用文件
COPY . .

# 复制启动脚本
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 暴露端口
EXPOSE 8788

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8788/ || exit 1

# 使用启动脚本
ENTRYPOINT ["/entrypoint.sh"]
