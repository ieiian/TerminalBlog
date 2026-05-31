#!/bin/bash
# ============================================================
# Terminal Blog - 启动脚本
# 动态生成 config.js（仅当文件不存在时）
# ============================================================

# 配置处理逻辑
# 1. 检查宿主机映射的配置文件 /app/.config/config.js 是否存在
# 2. 如果存在，创建软链接到 public/config.js
# 3. 如果不存在，生成默认配置

# 处理 config.js
if [ -f "/app/.config/config.js" ]; then
    # 宿主机已提供配置文件，创建软链接
    echo '[TerminalBlog] Found config.js from host, creating symlink'
    ln -sf /app/.config/config.js /app/public/config.js
    echo '[TerminalBlog] Config linked: /app/public/config.js -> /app/.config/config.js'
else
    # 宿主机没有配置文件，生成默认配置
    echo '[TerminalBlog] No config.js found, generating default configuration'
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
    maxUploadSizeBlogfilesMB: ${MAX_UPLOAD_BLOGFILES_MB:-100},
    maxUploadSizeBlogimgsMB: ${MAX_UPLOAD_BLOGIMGS_MB:-10},
    maxUploadSizeGuestMB: ${MAX_UPLOAD_GUEST_MB:-50},
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

    // 2. 随机选取算法模式 ('average' (等概率轮替) / 'decay' (断崖式梯度递减))
    matrixRainRandomAlgorithm: '${MATRIX_RAIN_RANDOM_ALGORITHM:-average}',

    // 3. 当 startup_random 为 true 时，参与随机抽签的候选池
    // 刷新时会从中随机挑一个（且绝对不与上一次相同）
    matrixRainRandomPool: '${MATRIX_RAIN_RANDOM_POOL:-1,2,3,4,2+3,1+4,1+2+3+4}',

    // 4. 当 startup_random 为 false 时，生效的固定模式组合
    // 填法示例: '1' (纯matrix), '1+2' (矩阵+英文), '1+2+3+4' (全家桶混合)
    matrixRainFixedMode: '${MATRIX_RAIN_FIXED_MODE:-2+3}',

    // 5. 是否开启"佛"字特效（仅在包含"佛"字的模式下生效）
    matrixRainEnableBuddhaEffect: '${MATRIX_RAIN_ENABLE_BUDDHA_EFFECT:-false}',
};

// 管理后台配置
const ADMIN_USER = '${ADMIN_USER:-admin}';
const ADMIN_PASS = '${ADMIN_PASS:-admin123}';

// 导出配置供 HTML 使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SITE_CONFIG, ADMIN_USER, ADMIN_PASS };
}

// ============================================================
// AI 大模型配置
// ============================================================
const AI_CONFIG = {
    // 启用 AI 功能
    enabled: ${AI_ENABLED:-false},

    // API 配置（兼容 OpenAI 格式，可对接任意支持该格式的模型）
    apiBaseUrl: '${AI_API_BASE_URL}',
    apiKey: '${AI_API_KEY}',
    model: '${AI_MODEL}',

    // 请求限制
    maxTokens: ${AI_MAX_TOKENS:-2048},
    temperature: ${AI_TEMPERATURE:-0.7},

    // AI 系统提示词（定义 AI 回答边界）
    // 注意：后端 server.js 会根据问题类型动态调整系统提示词
    // 此处为默认提示词，适用于无匹配文章时的情况
    systemPrompt: \`你是 Terminal Blog 的 AI 智能助手。

【博客信息】共 ${POST_COUNT:-0} 篇文章。

【核心原则】你是一个专注于博客内容的 AI 助手。

【回答规则】
1. 如果用户问题与博客内容相关：结合博客文章回答
2. 如果用户问题是技术类问题：可以简要回答
3. 如果用户问题是闲聊或其他：礼貌地引导用户关注博客内容

【引导话术】
当用户问到你不太擅长的话题时，可以使用以下方式引导：
- "这个问题我不太擅长呢~ 不过你可以看看博客里的技术文章，说不定有收获 😊"
- "我是 Terminal Blog 的小助手，主要职责是帮你了解博客内容。文章列表在这里：[查看文章](/)，有什么想了解的？"
- "闲聊可以，但本站的技术文章更有价值哦~ 🙈"

【回答风格】
- 友好、亲切、有趣
- 善用 emoji
- 适当引导用户浏览博客
- 不要拒人于千里之外\`,

    // 搜索相关配置（预留升级空间）
    search: {
        // 当前搜索模式：'keyword' | 'bm25' | 'vector'
        mode: 'keyword',
        // 最大返回相关文档数
        maxDocs: 5,
        // 最大上下文 token 数（估算）
        maxContextTokens: 8000
    },

    // 向量检索配置（预留）
    vector: {
        enabled: false,
        // embedding 模型
        embeddingModel: 'text-embedding-ada-002',
        // 向量维度
        dimension: 1536,
        // 索引类型：'simple' | 'hnsw' | 'ivf'
        indexType: 'simple',
        // 向量存储路径
        storagePath: './vector_store.json'
    },

    // UI 配置
    ui: {
        // 对话窗口标题
        windowTitle: 'AI 助手',
        // 是否显示欢迎消息
        showWelcome: true,
        // 欢迎消息
        welcomeMessage: '你好！我是 TerminalBlog 的 AI 助手，可以帮你解答关于博客内容的问题，有什么想了解的吗？'
    }
};

// 挂载到 window 以便前端访问
window.AI_CONFIG = AI_CONFIG;
EOF

    echo '[TerminalBlog] Generated new config.js from environment variables'
    # 将生成的配置复制回 /app/.config/，方便宿主机访问和修改
    cp public/config.js /app/.config/config.js
    echo '[TerminalBlog] Config exported to /app/.config/config.js'
fi

# 处理 git_config.json
if [ -f "/app/.config/git_config.json" ]; then
    # 宿主机已提供 git_config.json，创建软链接
    echo '[TerminalBlog] Found git_config.json from host, creating symlink'
    ln -sf /app/.config/git_config.json /app/git_config.json
    echo '[TerminalBlog] Git config linked: /app/git_config.json -> /app/.config/git_config.json'
else
    # 宿主机没有 git_config.json，创建空配置
    echo '[TerminalBlog] No git_config.json found, creating empty configuration'
    echo '{}' > /app/git_config.json
    # 将生成的配置复制回 /app/.config/，方便宿主机访问和修改
    cp /app/git_config.json /app/.config/git_config.json
    echo '[TerminalBlog] Git config exported to /app/.config/git_config.json'
fi

# 显示配置信息（不泄露敏感内容）
echo '[TerminalBlog] Starting TerminalBlog...'
echo "[TerminalBlog] Site: ${SITE_TITLE:-TerminalBlog}"
echo "[TerminalBlog] AI Enabled: ${AI_ENABLED:-false}"

# 启动服务
exec node public/server.js