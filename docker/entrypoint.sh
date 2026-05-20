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
};

window.SITE_CONFIG = {
    // 终端雨配置项
    // ============================================================
    // 0. 终端雨模式说明：
    //    '1' - 纯 Matrix 雨（绿色字符雨）: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミ姆メモヤユヨラリルレロワヲン'
    //    '2' - 英文雨（随机英文字符雨）: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    //    '3' - 数字雨（随机数字字符雨）: '01'
    //    '4' - 混合雨（随机字母数字混合雨）: '一二三四五六七八九十零甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥临兵斗者皆阵列在前'

    // 1. 是否开启启动随机切换模式: true (每次刷新必换个花样) / false (固定走下方配置)
    matrixRainStartupRandom: '${MATRIX_RAIN_STARTUP_RANDOM:-true}',

    // 2. 当 startup_random 为 false 时，生效的固定模式组合。
    // 填法示例: '1' (纯matrix), '1+2' (矩阵+英文), '1+2+3+4' (全家桶混合)
    matrixRainFixedMode: '${MATRIX_RAIN_FIXED_MODE:-1+2}',

    // 3. 当 startup_random 为 true 时，参与随机抽签的候选池
    // 刷新时会从中随机挑一个（且绝对不与上一次相同）
    matrixRainRandomPool: '${MATRIX_RAIN_RANDOM_POOL:-1,1+2,3+4,1+2+3+4}'
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