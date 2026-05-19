#!/bin/bash
# ============================================================
# Terminal Blog - 启动脚本
# 动态生成 config.js
# ============================================================

# 生成 config.js
cat > public/config.js << EOF
// ============================================================
// Terminal Blog - 站点配置
// ============================================================

const SITE_CONFIG = {
    siteTitle: '${SITE_TITLE:-TerminalBlog}',
    welcomeMessage: '${WELCOME_MESSAGE:-欢迎来到我的终端博客}',
    siteUrl: '${SITE_URL:-}',
    icpNumber: '${ICP_NUMBER:-}'
};

// 管理后台配置
const ADMIN_USER = '${ADMIN_USER:-admin}';
const ADMIN_PASS = '${ADMIN_PASS:-admin123}';

// 导出配置供 HTML 使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SITE_CONFIG, ADMIN_USER, ADMIN_PASS };
}
EOF

echo '[TerminalBlog] Config loaded:'
cat public/config.js

# 启动服务
exec node public/server.js