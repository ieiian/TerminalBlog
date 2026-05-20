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
    icpNumber: '${ICP_NUMBER:-}',

    // 代码雨背景的模式控制: 'matrix' / 'latin' / 'binary' / 'chinese' / 'startup_random' / 'mixed_random'
    matrixRainCurrentMode: '${MATRIX_RAIN_MODE:-startup_random}'
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