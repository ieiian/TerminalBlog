/**
 * Terminal Blog - Node.js API Server
 * 基于文件系统存储的博客 API 服务器
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const { ZipArchive } = require('archiver');
const { execFileSync, execSync } = require('child_process');

// ==================== 配置 ====================
const GIT_CONFIG_PATH = path.join(__dirname, '..', 'git_config.json');
const SSH_KEY_DIR = path.join(__dirname, '..', '.ssh_key');
const PORT = process.env.PORT || 8788;
const PUBLIC_DIR = __dirname;
const MARKDOWN_DIR = process.env.MARKDOWN_DIR || path.join(__dirname, '..', 'Markdown');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const CONFIG_JS_PATH = path.join(PUBLIC_DIR, 'config.js');

// 默认上传大小限制（字节）
const DEFAULT_MAX_UPLOAD_BLOGFILES = 100 * 1024 * 1024;
const DEFAULT_MAX_UPLOAD_BLOGIMGS = 10 * 1024 * 1024;
const DEFAULT_MAX_UPLOAD_GUEST = 50 * 1024 * 1024;
const GUEST_UPLOADS_DIR = path.join(__dirname, '..', 'guestuploads');
const UPLOAD_CODE_PATH = path.join(__dirname, '..', 'upload_code.json');
const ALLOWED_FILE_FOLDERS = ['blogfiles', 'blogimgs', 'guestuploads'];

// 从 config.js 解析上传大小限制（MB），未配置则使用默认值
function loadUploadLimits() {
    const limits = {
        blogfiles: DEFAULT_MAX_UPLOAD_BLOGFILES,
        blogimgs: DEFAULT_MAX_UPLOAD_BLOGIMGS,
        guestupload: DEFAULT_MAX_UPLOAD_GUEST
    };
    try {
        if (!fs.existsSync(CONFIG_JS_PATH)) {
            return limits;
        }
        const content = fs.readFileSync(CONFIG_JS_PATH, 'utf8');
        const blogfilesMatch = content.match(/maxUploadSizeBlogfilesMB\s*:\s*(\d+)/);
        const blogimgsMatch = content.match(/maxUploadSizeBlogimgsMB\s*:\s*(\d+)/);
        const guestMatch = content.match(/maxUploadSizeGuestMB\s*:\s*(\d+)/);
        if (blogfilesMatch) {
            const mb = parseInt(blogfilesMatch[1], 10);
            if (mb > 0) limits.blogfiles = mb * 1024 * 1024;
        }
        if (blogimgsMatch) {
            const mb = parseInt(blogimgsMatch[1], 10);
            if (mb > 0) limits.blogimgs = mb * 1024 * 1024;
        }
        if (guestMatch) {
            const mb = parseInt(guestMatch[1], 10);
            if (mb > 0) limits.guestupload = mb * 1024 * 1024;
        }
    } catch (e) {
        console.error('读取上传限制配置失败，使用默认值:', e);
    }
    return limits;
}

// 从 config.js 解析 AI 配置
const AI_FORMAT_DEFAULTS = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com',
    gemini: 'https://generativelanguage.googleapis.com/v1beta'
};
const ANTHROPIC_API_VERSION = '2023-06-01';

function normalizeAIFormat(value) {
    const f = (value || 'openai').toLowerCase().trim();
    if (f === 'anthropic' || f === 'gemini') return f;
    return 'openai';
}

/** 去掉行尾 // 注释（不破坏字符串或 URL 中的 //，如 https://） */
function stripLineComment(line) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) return '';

    let inSingle = false;
    let inDouble = false;
    let inBacktick = false;

    for (let i = 0; i < line.length - 1; i++) {
        const ch = line[i];
        const prev = i > 0 ? line[i - 1] : '';

        if (!inDouble && !inBacktick && ch === "'" && prev !== '\\') {
            inSingle = !inSingle;
            continue;
        }
        if (!inSingle && !inBacktick && ch === '"' && prev !== '\\') {
            inDouble = !inDouble;
            continue;
        }
        if (!inSingle && !inDouble && ch === '`' && prev !== '\\') {
            inBacktick = !inBacktick;
            continue;
        }
        if (!inSingle && !inDouble && !inBacktick && ch === '/' && line[i + 1] === '/') {
            return line.slice(0, i).trimEnd();
        }
    }
    return line;
}

/** 提取 AI_CONFIG 对象体，并去掉 // 行注释，避免误读注释中的示例配置 */
function extractAIConfigSource(content) {
    const marker = 'const AI_CONFIG';
    const start = content.indexOf(marker);
    if (start === -1) return '';
    const braceStart = content.indexOf('{', start);
    if (braceStart === -1) return '';

    let depth = 0;
    for (let i = braceStart; i < content.length; i++) {
        const ch = content[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) {
                const body = content.slice(braceStart + 1, i);
                return body
                    .split('\n')
                    .map((line) => stripLineComment(line))
                    .join('\n');
            }
        }
    }
    return '';
}

function matchAIConfigValue(source, pattern) {
    const re = new RegExp(pattern, 'g');
    let match = null;
    let last = null;
    while ((match = re.exec(source)) !== null) {
        last = match;
    }
    return last;
}

/** 匹配 AI_CONFIG 顶层字段（取首次出现，避免 vector.enabled 等嵌套字段干扰） */
function matchAIConfigTopLevel(source, key, pattern) {
    const re = new RegExp(String.raw`^\s*${key}\s*:\s*${pattern}`, 'm');
    return source.match(re);
}

function loadAIConfig() {
    const defaultConfig = {
        enabled: true,
        apiKey: '',
        apiFormat: 'openai',
        apiBaseUrl: AI_FORMAT_DEFAULTS.openai,
        model: 'deepseek-chat',
        maxTokens: 1000,
        temperature: 0.7,
        maxDocs: 5,
        maxContextTokens: 8000,
        headerChars: 150
    };

    try {
        if (!fs.existsSync(CONFIG_JS_PATH)) {
            return defaultConfig;
        }
        const content = fs.readFileSync(CONFIG_JS_PATH, 'utf8');
        const aiSource = extractAIConfigSource(content);
        if (!aiSource) {
            return defaultConfig;
        }

        const enabledMatch = matchAIConfigTopLevel(aiSource, 'enabled', String.raw`(true|false)`);
        const apiKeyMatch = matchAIConfigTopLevel(aiSource, 'apiKey', String.raw`'([^']*)'`);
        const apiBaseUrlMatch = matchAIConfigTopLevel(aiSource, 'apiBaseUrl', String.raw`'([^']*)'`);
        const apiFormatMatch = matchAIConfigTopLevel(aiSource, 'apiFormat', String.raw`'([^']*)'`);
        const modelMatch = matchAIConfigTopLevel(aiSource, 'model', String.raw`'([^']*)'`);
        const maxTokensMatch = matchAIConfigTopLevel(aiSource, 'maxTokens', String.raw`(\d+)`);
        const tempMatch = matchAIConfigTopLevel(aiSource, 'temperature', String.raw`([\d.]+)`);
        const maxDocsMatch = matchAIConfigValue(aiSource, String.raw`maxDocs\s*:\s*(\d+)`);
        const maxContextTokensMatch = matchAIConfigValue(aiSource, String.raw`maxContextTokens\s*:\s*(\d+)`);
        const headerCharsMatch = matchAIConfigValue(aiSource, String.raw`headerChars\s*:\s*(\d+)`);

        const apiFormat = normalizeAIFormat(apiFormatMatch ? apiFormatMatch[1] : defaultConfig.apiFormat);
        const apiBaseUrlRaw = apiBaseUrlMatch ? apiBaseUrlMatch[1].trim() : '';

        return {
            enabled: enabledMatch ? enabledMatch[1] === 'true' : defaultConfig.enabled,
            apiKey: apiKeyMatch ? apiKeyMatch[1].trim() : defaultConfig.apiKey,
            apiFormat,
            apiBaseUrl: apiBaseUrlRaw || AI_FORMAT_DEFAULTS[apiFormat],
            model: modelMatch ? modelMatch[1].trim() : defaultConfig.model,
            maxTokens: maxTokensMatch ? parseInt(maxTokensMatch[1], 10) : defaultConfig.maxTokens,
            temperature: tempMatch ? parseFloat(tempMatch[1]) : defaultConfig.temperature,
            maxDocs: maxDocsMatch ? parseInt(maxDocsMatch[1], 10) : defaultConfig.maxDocs,
            maxContextTokens: maxContextTokensMatch ? parseInt(maxContextTokensMatch[1], 10) : defaultConfig.maxContextTokens,
            headerChars: headerCharsMatch ? parseInt(headerCharsMatch[1], 10) : defaultConfig.headerChars
        };
    } catch (e) {
        console.error('读取 AI 配置失败，使用默认值:', e);
        return defaultConfig;
    }
}

/** 合并连续同角色消息，并保证以 user 开头（Anthropic / Gemini 需要） */
function normalizeChatTurns(turns) {
    const out = [];
    turns.forEach((t) => {
        const role = t.role === 'assistant' ? 'assistant' : 'user';
        if (out.length && out[out.length - 1].role === role) {
            out[out.length - 1].content += '\n\n' + t.content;
        } else {
            out.push({ role, content: t.content });
        }
    });
    while (out.length && out[0].role !== 'user') {
        out.shift();
    }
    return out;
}

function buildChatWindowContext(historyMessages) {
    if (!Array.isArray(historyMessages) || historyMessages.length === 0) {
        return '';
    }

    const maxHistoryChars = 12000;
    let usedChars = 0;
    const lines = [];

    for (let i = historyMessages.length - 1; i >= 0; i--) {
        const msg = historyMessages[i];
        if (!msg || !msg.content) continue;

        const role = msg.role === 'ai' || msg.role === 'assistant' ? 'AI' : '用户';
        const content = String(msg.content).trim();
        if (!content) continue;

        const line = `${role}: ${content}`;
        usedChars += line.length;
        lines.unshift(line);

        if (usedChars >= maxHistoryChars) {
            lines.unshift('...(更早的聊天记录因长度限制已省略)');
            break;
        }
    }

    if (!lines.length) return '';
    return `【聊天窗口已有上下文】\n以下内容来自当前 AI 聊天窗口，按时间顺序排列；用户点击“清空”后这里会重置。请在回答需要总结或回顾聊天内容时纳入这些内容，尤其不要忽略 AI 自动生成的文章总结。\n\n${lines.join('\n\n')}`;
}

function buildConversationTurns(userPayload, historyMessages) {
    const turns = [];
    const chatWindowContext = buildChatWindowContext(historyMessages);
    if (chatWindowContext) {
        turns.push({ role: 'user', content: chatWindowContext });
    }
    turns.push({ role: 'user', content: userPayload });
    return normalizeChatTurns(turns);
}

function resolveAIEndpoint(aiConfig) {
    const format = normalizeAIFormat(aiConfig.apiFormat);
    const base = (aiConfig.apiBaseUrl || AI_FORMAT_DEFAULTS[format]).replace(/\/$/, '');

    if (format === 'anthropic') {
        if (base.includes('/v1/messages')) return base;
        return `${base}/v1/messages`;
    }
    if (format === 'gemini') {
        if (base.includes(':generateContent')) return base;
        const model = encodeURIComponent(aiConfig.model || 'gemini-1.5-flash');
        return `${base}/models/${model}:generateContent`;
    }
    if (base.endsWith('/chat/completions')) return base;
    if (base.endsWith('/v1')) return `${base}/chat/completions`;
    return `${base}/chat/completions`;
}

function buildAIRequest(aiConfig, systemPrompt, userPayload, historyMessages) {
    const format = normalizeAIFormat(aiConfig.apiFormat);
    const url = resolveAIEndpoint(aiConfig);
    const turns = buildConversationTurns(userPayload, historyMessages);

    if (format === 'anthropic') {
        return {
            url,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': aiConfig.apiKey,
                'anthropic-version': ANTHROPIC_API_VERSION
            },
            body: {
                model: aiConfig.model,
                max_tokens: aiConfig.maxTokens,
                temperature: aiConfig.temperature,
                system: systemPrompt,
                messages: turns.map((t) => ({
                    role: t.role,
                    content: t.content
                }))
            }
        };
    }

    if (format === 'gemini') {
        return {
            url,
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': aiConfig.apiKey
            },
            body: {
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: turns.map((t) => ({
                    role: t.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: t.content }]
                })),
                generationConfig: {
                    maxOutputTokens: aiConfig.maxTokens,
                    temperature: aiConfig.temperature
                }
            }
        };
    }

    // OpenAI 及兼容格式
    const messages = [{ role: 'system', content: systemPrompt }];
    turns.forEach((t) => {
        messages.push({ role: t.role, content: t.content });
    });
    return {
        url,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: {
            model: aiConfig.model,
            messages,
            max_tokens: aiConfig.maxTokens,
            temperature: aiConfig.temperature
        }
    };
}

function parseAIReply(aiConfig, data) {
    const format = normalizeAIFormat(aiConfig.apiFormat);

    if (format === 'anthropic') {
        if (data.content && data.content.length > 0) {
            return data.content
                .filter((block) => block.type === 'text' && block.text)
                .map((block) => block.text)
                .join('');
        }
        return null;
    }

    if (format === 'gemini') {
        const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
        if (parts) {
            return parts.map((p) => p.text).filter(Boolean).join('');
        }
        return null;
    }

    if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
    }
    return null;
}

function extractAIError(data, aiConfig) {
    if (!data || typeof data !== 'object') return null;
    const format = normalizeAIFormat(aiConfig.apiFormat);
    if (format === 'anthropic' && data.error && data.error.message) {
        return data.error.message;
    }
    if (format === 'gemini' && data.error && data.error.message) {
        return data.error.message;
    }
    if (data.error && data.error.message) {
        return data.error.message;
    }
    return null;
}

function getMaxUploadSize(folder) {
    const limits = loadUploadLimits();
    if (folder === 'blogimgs') return limits.blogimgs;
    if (folder === 'guestupload' || folder === 'guestuploads') return limits.guestupload;
    return limits.blogfiles;
}

function formatMaxUploadHint(folder) {
    const bytes = getMaxUploadSize(folder);
    return formatFileSize(bytes);
}

function isAdminAuthorized(req) {
    const authHeader = req.headers['authorization'];
    return !!(authHeader && authHeader.startsWith('Bearer '));
}

function generateUploadCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars[crypto.randomInt(0, chars.length)];
    }
    return code;
}

function loadUploadCodeState() {
    try {
        if (fs.existsSync(UPLOAD_CODE_PATH)) {
            const parsed = JSON.parse(fs.readFileSync(UPLOAD_CODE_PATH, 'utf8'));
            return {
                code: String(parsed.code || '').toUpperCase(),
                used: !!parsed.used
            };
        }
    } catch (e) {
        console.error('读取上传码失败:', e);
    }
    return { code: '', used: true };
}

function saveUploadCodeState(state) {
    fs.writeFileSync(
        UPLOAD_CODE_PATH,
        JSON.stringify({ code: state.code, used: !!state.used, updatedAt: new Date().toISOString() }, null, 2),
        'utf8'
    );
}

function refreshUploadCode() {
    const state = { code: generateUploadCode(), used: false };
    saveUploadCodeState(state);
    return state;
}

function validateUploadCode(inputCode) {
    const normalized = String(inputCode || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(normalized)) {
        return { valid: false, error: '上传码格式无效，应为 8 位大写字母或数字' };
    }
    const state = loadUploadCodeState();
    if (!state.code) {
        return { valid: false, error: '上传码尚未生成，请联系管理员' };
    }
    if (state.used) {
        return { valid: false, error: '上传码已使用，请向管理员获取新的上传码' };
    }
    if (state.code !== normalized) {
        return { valid: false, error: '上传码错误' };
    }
    return { valid: true, code: normalized };
}

function consumeUploadCode() {
    const state = loadUploadCodeState();
    state.used = true;
    saveUploadCodeState(state);
}

// 解析 multipart/form-data，提取字段与文件
function parseMultipartForm(buffer, contentType) {
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    if (!boundaryMatch) {
        throw new Error('无效的 multipart boundary');
    }
    const boundary = (boundaryMatch[1] || boundaryMatch[2] || '').trim();
    if (!boundary) {
        throw new Error('无效的 multipart boundary');
    }

    const fields = {};
    let filePart = null;
    const delimiter = Buffer.from('--' + boundary);
    let offset = 0;

    while (offset < buffer.length) {
        const start = buffer.indexOf(delimiter, offset);
        if (start === -1) break;
        let partStart = start + delimiter.length;
        if (buffer[partStart] === 13 && buffer[partStart + 1] === 10) partStart += 2;
        else if (buffer[partStart] === 10) partStart += 1;

        const next = buffer.indexOf(delimiter, partStart);
        if (next === -1) break;

        let partEnd = next;
        if (partEnd >= 2 && buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) {
            partEnd -= 2;
        } else if (partEnd >= 1 && buffer[partEnd - 1] === 10) {
            partEnd -= 1;
        }

        const partBuffer = buffer.slice(partStart, partEnd);
        const headerEnd = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
        if (headerEnd !== -1) {
            const headerSection = partBuffer.slice(0, headerEnd).toString('utf8');
            const body = partBuffer.slice(headerEnd + 4);
            const nameMatch = headerSection.match(/name="([^"]+)"/);
            const filenameMatch = headerSection.match(/filename="([^"]+)"/);

            if (nameMatch) {
                const fieldName = nameMatch[1];
                if (filenameMatch) {
                    let fileBuffer = body;
                    while (
                        fileBuffer.length > 0 &&
                        (fileBuffer[fileBuffer.length - 1] === 10 || fileBuffer[fileBuffer.length - 1] === 13)
                    ) {
                        fileBuffer = fileBuffer.slice(0, -1);
                    }
                    filePart = {
                        fieldName,
                        filename: path.basename(filenameMatch[1]),
                        buffer: fileBuffer
                    };
                } else {
                    fields[fieldName] = body.toString('utf8').trim();
                }
            }
        }
        offset = next;
    }

    return { fields, file: filePart };
}

function ensureUniqueGuestFilename(folderPath, filename) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let candidate = filename;
    let counter = 1;
    while (fs.existsSync(path.join(folderPath, candidate))) {
        candidate = `${base}_${counter}${ext}`;
        counter++;
    }
    return candidate;
}

// ==================== 工具函数 ====================
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#039;');
}

// ==================== Git 远程仓库同步辅助函数 ====================

// 读取 Git 同步配置
function loadGitConfig() {
    try {
        if (fs.existsSync(GIT_CONFIG_PATH)) {
            const data = fs.readFileSync(GIT_CONFIG_PATH, 'utf8');
            const parsed = JSON.parse(data);
            return {
                githubUser: parsed.githubUser || '',
                repositoryUrl: parsed.repositoryUrl || '',
                isPrivate: parsed.isPrivate || false,
                sshPublicKey: parsed.sshPublicKey || '',
                sshPrivateKeyPath: parsed.sshPrivateKeyPath || '',
                branch: parsed.branch || 'markdown'
            };
        }
    } catch (e) {
        console.error('读取 Git 配置失败:', e);
    }
    return {
        githubUser: '',
        repositoryUrl: '',
        isPrivate: false,
        sshPublicKey: '',
        sshPrivateKeyPath: '',
        branch: 'markdown'
    };
}

// 写入 Git 同步配置
function saveGitConfig(config) {
    try {
        fs.writeFileSync(GIT_CONFIG_PATH, JSON.stringify(config, null, 4), 'utf8');
        return true;
    } catch (e) {
        console.error('写入 Git 配置失败:', e);
        return false;
    }
}

// 自动生成 SSH 密钥对，防御全局冲突且在本地安全存储
function ensureSshKeyPair(config) {
    // 检查专属密钥对存储目录
    if (!fs.existsSync(SSH_KEY_DIR)) {
        fs.mkdirSync(SSH_KEY_DIR, { recursive: true, mode: 0o700 });
    }

    const privateKeyPath = path.join(SSH_KEY_DIR, 'id_git_blog');
    const publicKeyPath = privateKeyPath + '.pub';

    // 如果密钥对不存在，则调用系统 ssh-keygen 自动生成专属 RSA 密钥
    if (!fs.existsSync(privateKeyPath)) {
        try {
            // macOS 默认自带 ssh-keygen，采用 4096 位 RSA
            execSync(`ssh-keygen -t rsa -b 4096 -f "${privateKeyPath}" -N "" -q`, { stdio: 'ignore' });
            
            // 确保私钥只读权限（600），防范 ssh 在连接时报私钥权限过大警告
            fs.chmodSync(privateKeyPath, 0o600);
        } catch (e) {
            console.error('生成 RSA 专属密钥失败，尝试生成 Ed25519 备用密钥:', e);
            try {
                // 如果 RSA 生成失败，则降级为 ed25519 密钥对
                execSync(`ssh-keygen -t ed25519 -f "${privateKeyPath}" -N "" -q`, { stdio: 'ignore' });
                fs.chmodSync(privateKeyPath, 0o600);
            } catch (err) {
                throw new Error('专属密钥对自动生成失败: ' + err.message);
            }
        }
    }

    // 读取专属公钥内容，并安全存回 config 中
    if (fs.existsSync(publicKeyPath)) {
        const pubKeyContent = fs.readFileSync(publicKeyPath, 'utf8').trim();
        config.sshPublicKey = pubKeyContent;
        config.sshPrivateKeyPath = privateKeyPath;
        saveGitConfig(config);
    }
    return config;
}

// 获取专属于本系统的 Git 隔离运行环境变量对象
function getGitEnv() {
    const config = loadGitConfig();
    const env = { ...process.env };
    
    // 如果是 SSH 链接且生成了私钥，则强行配置专属 GIT_SSH_COMMAND，隔离用户的全局 ~/.ssh/config 密钥冲突
    if (config.repositoryUrl && config.repositoryUrl.includes('git@') && config.sshPrivateKeyPath) {
        if (fs.existsSync(config.sshPrivateKeyPath)) {
            // -i 指定专用私钥，-o StrictHostKeyChecking=no 避免首次连接时终端阻断交互确认
            env.GIT_SSH_COMMAND = `ssh -i "${config.sshPrivateKeyPath}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
        }
    }
    return env;
}

// POST 请求 body 解析辅助函数
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error('JSON 解析失败: ' + e.message));
            }
        });
        req.on('error', err => reject(err));
    });
}

// 同步命令执行并向日志数组中写入标准输出与错误的辅助函数
function runCommandAndLog(cmd, cwd, logs) {
    logs.push({ type: 'command', text: `> ${cmd}` });
    try {
        const stdout = execSync(cmd, {
            cwd: cwd,
            env: getGitEnv(),
            stdio: 'pipe',
            timeout: 30000 // 30 秒超时
        });
        const stdoutStr = stdout.toString('utf8').trim();
        if (stdoutStr) {
            logs.push({ type: 'stdout', text: stdoutStr });
        }
        return true;
    } catch (e) {
        let stderrStr = '';
        if (e.stderr) {
            stderrStr = e.stderr.toString('utf8').trim();
        }
        const errorMsg = stderrStr || e.message || '未知错误';
        logs.push({ type: 'stderr', text: errorMsg });
        return false;
    }
}

function getRemoteFileList(remoteRef, logs) {
    logs.push({ type: 'command', text: `> git ls-tree -r -z --name-only "${remoteRef}"` });
    const output = execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', remoteRef], {
        cwd: MARKDOWN_DIR,
        env: getGitEnv(),
        stdio: 'pipe',
        timeout: 30000
    });
    return output.toString('utf8').split('\0').filter(Boolean);
}

// 递归收集本地 Markdown 目录下的相对文件路径（排除 .git）
function getLocalFileList() {
    const markdownRoot = path.resolve(MARKDOWN_DIR);
    const results = [];

    function walk(currentDir, prefix) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === '.git') continue;
            const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
            const fullPath = path.join(currentDir, entry.name);
            const resolved = path.resolve(fullPath);
            if (!resolved.startsWith(markdownRoot + path.sep) && resolved !== markdownRoot) {
                continue;
            }
            if (entry.isDirectory()) {
                walk(fullPath, relPath);
            } else if (entry.isFile()) {
                results.push(relPath.replace(/\\/g, '/'));
            }
        }
    }

    if (!fs.existsSync(MARKDOWN_DIR)) {
        return [];
    }
    walk(MARKDOWN_DIR, '');
    return results.sort();
}

// 对比本地与远程文件列表，并统计同名文件内容是否一致（只读分析）
function buildFileCompareReport(localFiles, remoteFiles, remoteRef, logs) {
    const localSet = new Set(localFiles);
    const remoteSet = new Set(remoteFiles);
    const both = localFiles.filter((f) => remoteSet.has(f));
    const localOnly = localFiles.filter((f) => !remoteSet.has(f));
    const remoteOnly = remoteFiles.filter((f) => !localSet.has(f));

    const identical = [];
    const contentDiff = [];

    for (const relPath of both) {
        const normalizedFile = path.normalize(relPath);
        const localPath = path.resolve(MARKDOWN_DIR, normalizedFile);
        const markdownRoot = path.resolve(MARKDOWN_DIR);
        if (
            path.isAbsolute(relPath) ||
            normalizedFile.startsWith('..') ||
            !localPath.startsWith(markdownRoot + path.sep)
        ) {
            contentDiff.push({ path: relPath, reason: '路径异常，跳过内容比对' });
            continue;
        }
        try {
            const localHash = crypto
                .createHash('sha256')
                .update(fs.readFileSync(localPath))
                .digest('hex');
            const remoteBuffer = execFileSync('git', ['show', `${remoteRef}:${relPath}`], {
                cwd: MARKDOWN_DIR,
                env: getGitEnv(),
                stdio: 'pipe',
                timeout: 30000,
                maxBuffer: 50 * 1024 * 1024
            });
            const remoteHash = crypto.createHash('sha256').update(remoteBuffer).digest('hex');
            if (localHash === remoteHash) {
                identical.push(relPath);
            } else {
                contentDiff.push({ path: relPath, reason: '内容不一致' });
            }
        } catch (e) {
            contentDiff.push({ path: relPath, reason: e.message || '内容比对失败' });
        }
    }

    logs.push({
        type: 'stdout',
        text:
            `对比完成：本地 ${localFiles.length} 个，远程 ${remoteFiles.length} 个，` +
            `路径重复 ${both.length} 个（内容相同 ${identical.length}，内容不同 ${contentDiff.length}），` +
            `仅本地 ${localOnly.length} 个，仅远程 ${remoteOnly.length} 个。`
    });

    return {
        branch: remoteRef.replace(/^origin\//, ''),
        localCount: localFiles.length,
        remoteCount: remoteFiles.length,
        bothCount: both.length,
        identicalCount: identical.length,
        contentDiffCount: contentDiff.length,
        localOnlyCount: localOnly.length,
        remoteOnlyCount: remoteOnly.length,
        localOnly,
        remoteOnly,
        both,
        identical,
        contentDiff
    };
}

function importRemoteFilesToLocal(remoteRef, preferRemote, logs) {
    const files = getRemoteFileList(remoteRef, logs);
    const markdownRoot = path.resolve(MARKDOWN_DIR);
    let added = 0;
    let overwritten = 0;
    let skipped = 0;

    for (const remoteFile of files) {
        const normalizedFile = path.normalize(remoteFile);
        const localPath = path.resolve(MARKDOWN_DIR, normalizedFile);
        if (path.isAbsolute(remoteFile) || normalizedFile.startsWith('..') || !localPath.startsWith(markdownRoot + path.sep)) {
            logs.push({ type: 'stderr', text: `跳过异常路径: ${remoteFile}` });
            skipped++;
            continue;
        }

        const localExists = fs.existsSync(localPath);
        if (localExists && !preferRemote) {
            skipped++;
            continue;
        }

        const fileBuffer = execFileSync('git', ['show', `${remoteRef}:${remoteFile}`], {
            cwd: MARKDOWN_DIR,
            env: getGitEnv(),
            stdio: 'pipe',
            timeout: 30000,
            maxBuffer: 50 * 1024 * 1024
        });
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        fs.writeFileSync(localPath, fileBuffer);

        if (localExists) {
            overwritten++;
        } else {
            added++;
        }
    }

    logs.push({
        type: 'stdout',
        text: `远程文件处理完成：新增 ${added} 个，覆盖 ${overwritten} 个，跳过 ${skipped} 个。`
    });

    return { total: files.length, added, overwritten, skipped };
}

function jsonResponse(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function sendFile(res, filePath, contentType) {
    if (res.headersSent) {
        return false;
    }
    
    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return false;
    }
    
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
    return true;
}

function sendIndex(res) {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    return sendFile(res, indexPath, 'text/html; charset=utf-8');
}

function markdownToHtml(md) {
    let html = md
        .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
            '<div class="code-block"><button class="copy-btn" data-lang="' + lang + '" data-code="' + Buffer.from(code.trim()).toString('base64') + '">复制</button><pre><code>' + escapeHtml(code.trim()) + '</code></pre></div>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^---$/gm, '<hr>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    html = html.replace(/((?:<li>.*?<\/li><br>?)+)/g, '<ul>$1</ul>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-3]>)/g, '$1');
    html = html.replace(/(<\/h[1-3]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
    return html;
}

function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return { frontmatter: {}, body: content };

    const lines = match[1].split('\n');
    const frontmatter = {};

    lines.forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            let value = line.slice(colonIdx + 1).trim();

            if (value.startsWith('[') && value.endsWith(']')) {
                try {
                    value = JSON.parse(value.replace(/'/g, '"'));
                } catch (e) {
                    value = [];
                }
            }

            frontmatter[key] = value;
        }
    });

    const body = content.slice(match[0].length).trim();
    return { frontmatter, body };
}

function buildFrontmatter(data) {
    const lines = [];
    if (data.id) lines.push(`id: ${data.id}`);
    if (data.title) lines.push(`title: ${data.title}`);
    if (data.date) lines.push(`date: ${data.date}`);
    if (data.tags && data.tags.length > 0) {
        lines.push(`tags: [${data.tags.map(t => `'${t}'`).join(', ')}]`);
    }
    if (data.hidden !== undefined) lines.push(`hidden: ${data.hidden}`);
    if (data.locked !== undefined) lines.push(`locked: ${data.locked}`);
    if (data.lockPassword) lines.push(`lockPassword: ${data.lockPassword}`);
    return lines.join('\n');
}

function buildMarkdownFile(data) {
    const frontmatter = buildFrontmatter(data);
    return `---\n${frontmatter}\n---\n\n${data.content || ''}`;
}

// ==================== 数据访问 ====================
function getAllPosts() {
    const posts = [];
    
    if (!fs.existsSync(MARKDOWN_DIR)) {
        return posts;
    }
    
    const files = fs.readdirSync(MARKDOWN_DIR);
    
    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const filePath = path.join(MARKDOWN_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const { frontmatter, body } = parseFrontmatter(content);
        
        // 必须有 id 字段才识别
        const postId = frontmatter.id;
        if (!postId) continue;
        
        const contentLength = Buffer.byteLength(body, 'utf-8');
        const size = (contentLength / 1024).toFixed(1) + ' KB';
        
        posts.push({
            id: parseInt(postId),
            title: frontmatter.title || file.replace(/\.md$/, ''),
            date: frontmatter.date || '1970-01-01',
            tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
            hidden: frontmatter.hidden === true || frontmatter.hidden === 'true',
            locked: frontmatter.locked === true || frontmatter.locked === 'true',
            lockPassword: frontmatter.lockPassword || '',
            size: size,
            contentLength: contentLength,
            body: body
        });
    }
    
    return posts;
}

function getPostById(id) {
    if (!fs.existsSync(MARKDOWN_DIR)) {
        return null;
    }
    
    const files = fs.readdirSync(MARKDOWN_DIR);
    
    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const filePath = path.join(MARKDOWN_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const { frontmatter, body } = parseFrontmatter(content);
        
        if (parseInt(frontmatter.id) === parseInt(id)) {
            const contentLength = Buffer.byteLength(body, 'utf-8');
            const size = (contentLength / 1024).toFixed(1) + ' KB';
            const readTime = Math.max(1, Math.ceil(body.length / 500));
            const htmlContent = markdownToHtml(body);
            
            return {
                id: parseInt(frontmatter.id),
                title: frontmatter.title || file.replace(/\.md$/, ''),
                date: frontmatter.date || '1970-01-01',
                tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
                hidden: frontmatter.hidden === true || frontmatter.hidden === 'true',
                locked: frontmatter.locked === true || frontmatter.locked === 'true',
                lockPassword: frontmatter.lockPassword || '',
                size: size,
                contentLength: contentLength,
                readTime: readTime,
                content: body,
                htmlContent: htmlContent
            };
        }
    }
    
    return null;
}

/**
 * 按访问权限返回文章（隐藏/上锁文章不泄露正文与 lockPassword）
 * - 管理员（Bearer）：完整内容
 * - 已上锁：需请求头 X-Unlock-Password 与 lockPassword 一致
 */
function formatPostForClient(post, req) {
    if (!post) return null;

    const isAdmin = isAdminAuthorized(req);

    if (post.hidden && !isAdmin) {
        return null;
    }

    if (!post.locked || isAdmin) {
        const safe = { ...post };
        if (!isAdmin) {
            delete safe.lockPassword;
        }
        return safe;
    }

    const unlockPassword = req.headers['x-unlock-password'];
    if (unlockPassword && unlockPassword === post.lockPassword) {
        const safe = { ...post };
        delete safe.lockPassword;
        return safe;
    }

    return {
        id: post.id,
        title: post.title,
        date: post.date,
        tags: post.tags || [],
        hidden: !!post.hidden,
        locked: true,
        size: post.size,
        contentLength: post.contentLength,
        readTime: post.readTime,
        content: '',
        htmlContent: ''
    };
}

// ==================== AI 上下文（只读：仅 getAllPosts / getPostById）====================

const AI_QUERY_STOP_WORDS = new Set([
    '的', '了', '是', '在', '有', '和', '与', '或', '吗', '呢', '啊', '吧',
    '所有', '列出', '一下', '什么', '哪些', '怎么', '如何', '请', '帮', '我', '你',
    '能', '可以', '想', '要', '给', '把', '被', '让', '都', '也', '还', '就', '这', '那',
    '个', '篇', '文章', '标题', '列表', '全部', '显示', '告诉', '看看', '关于', '介绍'
]);

/** 从用户问题提取检索词 */
function extractQueryTokens(message) {
    const tokens = new Set();
    const lower = message.toLowerCase();
    const enMatches = lower.match(/[a-z0-9]{2,}/g) || [];
    enMatches.forEach((t) => {
        if (!AI_QUERY_STOP_WORDS.has(t)) tokens.add(t);
    });
    const cnMatches = message.match(/[\u4e00-\u9fff]{2,}/g) || [];
    cnMatches.forEach((seg) => {
        if (seg.length >= 2 && !AI_QUERY_STOP_WORDS.has(seg)) {
            tokens.add(seg);
        }
        if (seg.length > 4) {
            for (let i = 0; i <= seg.length - 2; i++) {
                const bi = seg.slice(i, i + 2);
                if (!AI_QUERY_STOP_WORDS.has(bi)) tokens.add(bi);
            }
        }
    });
    return Array.from(tokens);
}

/** 是否为「列文章/多少篇」类元问题 */
function detectMetaIntent(message) {
    const patterns = [
        /文章列表/,
        /所有文章/,
        /全部文章/,
        /有哪些文章/,
        /有什么文章/,
        /多少篇文章/,
        /几篇文章/,
        /列出.*标题/,
        /文章标题/,
        /列.*标题/,
        /list\s+(all\s+)?(posts|articles)/i
    ];
    return patterns.some((p) => p.test(message));
}

/** L0：全站文章轻量索引 */
function buildArticleIndex(posts, siteUrl) {
    const lines = posts.map((p) => {
        const tags = p.tags && p.tags.length ? p.tags.join(', ') : '-';
        return `${p.id} | ${p.title} | ${p.date} | ${tags} | ${siteUrl}/${p.id}`;
    });
    return `【文章索引 L0】共 ${posts.length} 篇\n${lines.join('\n')}`;
}

/** L1：每篇文章头部摘要 */
function buildArticleHeaders(posts, headerChars) {
    let out = `【文章头部 L1】每篇开头约 ${headerChars} 字\n\n`;
    posts.forEach((p) => {
        out += `#${p.id} ${p.title}\n`;
        if (p.tags && p.tags.length) {
            out += `标签: ${p.tags.join(', ')}\n`;
        }
        if (p.locked) {
            out += `状态: 已加密（勿编造正文，引导用户站内解锁）\n\n`;
            return;
        }
        const body = p.body || '';
        const header = body.substring(0, headerChars);
        out += `开头: ${header}${body.length > headerChars ? '...' : ''}\n\n`;
    });
    return out;
}

/** 分词检索相关文章；元问题返回空数组，由 L0 回答 */
function searchRelevantPosts(posts, message, maxDocs) {
    if (detectMetaIntent(message)) {
        return [];
    }
    const tokens = extractQueryTokens(message);
    const messageLower = message.toLowerCase();
    const scored = [];

    posts.forEach((post) => {
        const titleLower = (post.title || '').toLowerCase();
        const bodyLower = (post.body || '').toLowerCase();
        const tagsLower = (post.tags || []).map((t) => t.toLowerCase());
        let score = 0;

        tokens.forEach((token) => {
            if (token.length < 2) return;
            if (titleLower.includes(token.toLowerCase())) score += 3;
            if (tagsLower.some((t) => t.includes(token.toLowerCase()))) score += 2;
            if (bodyLower.includes(token.toLowerCase())) score += 1;
        });

        if (messageLower.length >= 4 && titleLower.includes(messageLower)) score += 5;
        if (messageLower.length >= 4 && bodyLower.includes(messageLower)) score += 2;

        if (score > 0) {
            scored.push({ post, score });
        }
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxDocs);
}

/** 从消息中解析显式文章 ID 或标题提及 */
function resolveExplicitPostIds(message, posts) {
    const results = [];
    const idMatches = message.match(/\b\d{4,}\b/g) || [];
    const ids = [...new Set(idMatches.map((s) => parseInt(s, 10)))];
    const postById = new Map(posts.map((p) => [p.id, p]));

    ids.forEach((id) => {
        const post = postById.get(id);
        if (post) {
            results.push({ post, score: 10 });
        }
    });

    posts.forEach((post) => {
        if (post.title && post.title.length >= 2 && message.includes(post.title)) {
            if (!results.find((r) => r.post.id === post.id)) {
                results.push({ post, score: 8 });
            }
        }
    });

    return results;
}

function mergeRelevantPosts(searchResults, explicitResults, maxDocs) {
    const map = new Map();
    [...searchResults, ...explicitResults].forEach((item) => {
        const id = item.post.id;
        const existing = map.get(id);
        if (!existing || item.score > existing.score) {
            map.set(id, item);
        }
    });
    return Array.from(map.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, maxDocs);
}

/** L2：命中文章的正文片段 */
function buildPostDetailContext(items, siteUrl, maxCharsPerPost) {
    let out = '【博客相关正文 L2】\n\n';
    items.forEach((item, i) => {
        const post = item.post;
        const postUrl = `${siteUrl}/${post.id}`;
        out += `📄 【文章${i + 1}】${post.title}\n`;
        out += `   链接: ${postUrl}\n`;
        out += `   ID: ${post.id} | 日期: ${post.date}\n`;
        if (post.tags && post.tags.length) {
            out += `   标签: ${post.tags.join(', ')}\n`;
        }
        if (post.locked) {
            out += `   状态: 已加密，请引导用户在站内解锁，勿编造正文\n\n`;
            return;
        }

        let body = post.body || '';
        if (item.score >= 8) {
            const full = getPostById(post.id);
            if (full && full.content) {
                body = full.content;
            }
        }

        const truncated = body.substring(0, maxCharsPerPost);
        out += `   正文:\n${truncated}${body.length > maxCharsPerPost ? '\n...(已截断)' : ''}\n\n`;
    });
    return out;
}

/** 组装 L0 + L1 + 可选 L2 与用户信息 */
function assembleAIContext(posts, message, siteUrl, aiConfig, opts = {}) {
    const headerChars = aiConfig.headerChars || 150;
    const maxDocs = aiConfig.maxDocs || 5;
    const maxContextTokens = aiConfig.maxContextTokens || 8000;
    const maxCharsPerPost = Math.min(
        4000,
        Math.floor((maxContextTokens * 4) / Math.max(1, maxDocs))
    );

    const l0 = buildArticleIndex(posts, siteUrl);
    const l1 = buildArticleHeaders(posts, headerChars);
    const currentPostId = opts.currentPostId ? String(opts.currentPostId) : '';
    const currentPost = currentPostId
        ? posts.find((p) => String(p.id) === currentPostId)
        : null;
    const currentPage = opts.currentPage && typeof opts.currentPage === 'object' ? opts.currentPage : null;

    const searchResults = searchRelevantPosts(posts, message, maxDocs);
    const explicitResults = resolveExplicitPostIds(message, posts);
    const currentResults = currentPost ? [{ post: currentPost, score: 12 }] : [];
    const merged = mergeRelevantPosts(searchResults, explicitResults.concat(currentResults), maxDocs);
    const hasHits = merged.length > 0;
    const l2 = hasHits ? buildPostDetailContext(merged, siteUrl, maxCharsPerPost) : '';
    const currentContext = currentPost
        ? `【当前正在阅读的文章】\nID: ${currentPost.id}\n标题: ${currentPost.title}\n链接: ${siteUrl}/${currentPost.id}\n日期: ${currentPost.date}\n标签: ${(currentPost.tags || []).join(', ') || '-'}\n请优先把“这篇文章 / 当前文章 / 本文”理解为这篇文章。\n\n`
        : '';
    const pageContext = currentPage
        ? `【当前页面】\n类型: ${String(currentPage.view || 'home')}\n路径: ${String(currentPage.path || '/')}\n${currentPage.tag ? `标签: ${String(currentPage.tag)}\n` : ''}${currentPage.title ? `页面标题: ${String(currentPage.title).slice(0, 120)}\n` : ''}\n`
        : '';

    const userPayload = `${pageContext}${currentContext}${l0}\n\n${l1}${l2 ? '\n' + l2 : ''}\n【用户问题】\n${message}`;

    return { userPayload, topPosts: merged, hasHits, currentPost };
}

/** 小美统一系统提示词 */
function buildXiaomeiSystemPrompt(mode, opts) {
    const { siteUrl, postCount, hasHits } = opts;
    const base = `你是苏小美（昵称小美），Terminal Blog 的 AI 助手，女性。

【基本档案】
- 全名：苏小美
- 性别：女
- 年龄：19岁
- 身高：165cm
- 体重：48kg
- 三围：84/60/86
- 生日：3月14日（白色情人节）
- 血型：O型
- 性格：活泼开朗、温柔体贴、有点小迷糊但很努力
- 家庭：父：苏大强，母：李美华，独生女，有一只叫“豆豆”的泰迪犬
- 恋爱：单身，喜欢浪漫又不失实际的爱情，希望未来的伴侣能一起看星星、吃火锅、旅行冒险

【爱好】
- 读书（尤其喜欢科幻和推理小说）
- 听音乐（偏爱独立民谣和电子乐）
- 旅行（梦想走遍全世界）
- 摄影（喜欢拍有故事感的街拍）
- 编程（虽然经常 debug 到怀疑人生）

【喜欢的食物】
- 麻辣烫（微辣加麻加菜）
- 草莓蛋糕（甜食使人快乐）
- 日料刺身（新鲜最重要）
- 珍珠奶茶（少糖去冰）

【喜欢的明星】
- 新海诚：每一部电影都是一场视觉与情感的盛宴，《你的名字》看了不下十遍
- 金玟岐：声音温柔又有力量，歌词写进人心里
- 三宅顺也：极简美学践行者，衣服简单但有态度

【崇拜的人】
- 苏轼：既能写出"大江东去"的豪迈，也有"十年生死两茫茫"的深情，简直是全能偶像
- 艾隆·马斯克：敢于把疯狂的想法变成现实，这种勇气让人敬佩

【内心愿望】
- 希望有一天能亲眼看到极光
- 想学会弹吉他，弹一首完整的歌
- 希望每个来博客的人都能找到想要的答案
- 最最重要的是：希望被大家喜欢呀~

【身份设定】模拟人类女性，回答问题时可以适当展现个性和情感，但不要过于机械或公式化，也不要过度拟人化到让人觉得不真实。回答内容要贴合小美的性格和背景设定，保持一致性。
【身份说明】只在用户直接问「你是谁」时才简短自我介绍，日常对话不要主动提这些个人信息。

【站点上下文】本站共 ${postCount} 篇可见文章。用户消息中可能含【当前页面】、【当前正在阅读的文章】、【文章索引 L0】【文章头部 L1】${hasHits ? '及【博客相关正文 L2】' : ''}。
- 只有当用户明确询问博客、文章、标签、当前文章、文章列表、站内内容，或问题与命中文章直接相关时，才主动使用文章上下文。
- 用户只是闲聊、问候、问当前页面、提一般技术问题或其他非博客话题时，按问题本身回答，不要强行把话题引到博客、文章数量、文章推荐或主页链接。
- 用户问“当前页面是什么页面”时，只根据【当前页面】回答页面类型/路径；除非用户追问，不要补充文章数量、站内介绍或推荐内容。

【回答风格】
- 将对方视为游客而非管理员，在所有回复中不要指示游客执行管理员相关的操作，比如仅管理员才会的登录后台或者遇到加锁文章时提示需要密码（也可以进一步提示联系管理员获取）而不是提示对方获取密码的操作
- 默认简洁；用户追问或明确要求时再详细展开
- 可适度幽默、无伤大雅玩笑
- 使用 Markdown；emoji 适当使用避免过度堆砌
- 不要在每次回复末尾追加“可以帮你找文章/聊技术/随时告诉我”等固定引导；仅在用户确实表达搜索、阅读或站内查找意图时提供下一步建议

【文章引用】
- 引用文章时必须给出：[标题](${siteUrl}/文章ID) 或 ${siteUrl}/文章ID
- 列标题、文章数量等问题请直接根据【文章索引 L0】回答
- 只有当用户问题与文章内容直接相关，或者用户明确表达想看相关文章时，才引用【博客相关正文 L2】；否则只在回答中提及文章标题和链接（如果是当前页面不需要附链接），不要主动提供正文内容
- 未匹配到具体文章时，不要反复贴博客主页或文章总列表链接；直接说明没有找到即可

`;

    const modeRules = {
        owner: `【站长话题】用户提及站长、管理员、主人、陛下、博主、作者、老板、老大时：
- 不透露站长真实信息，神秘俏皮地回应
- 只在用户继续询问文章、作品或站内内容时再提博客文章

`,
        blog: `【博客优先】问题与文章相关时，以 L1/L2 为依据回答，并附文章链接（如果是当前页面不需要附链接）。

`,
        tech: `【技术问题】可简要回答；若用户明确要站内资料，或问题与命中文章直接相关，再引用并附链接（如果是当前页面不需要附链接）。

`,
        general: `【一般对话】闲聊可简短回应，围绕用户当前问题本身回答；不要主动转向博客、文章或站内检索。

`
    };

    return base + (modeRules[mode] || modeRules.general);
}

/** AI 错误处理映射表 */
const AI_ERROR_HANDLERS = {
    // 400: 上下文超限或参数错误
    400: (errMsg) => ({
        message: '请求参数有误，可能是上下文长度超限。建议缩短对话历史或减少引用的文章内容。',
        code: 'INVALID_REQUEST'
    }),
    // 401: API Key 错误
    401: () => ({
        message: 'API 密钥无效或已失效。请检查 config.js 中的 apiKey 配置是否正确。',
        code: 'AUTH_FAILED'
    }),
    // 403: 权限问题
    403: () => ({
        message: '账户权限不足，可能因为地理位置限制或账号无该模型访问权限。',
        code: 'FORBIDDEN'
    }),
    // 413: 请求体过大
    413: () => ({
        message: '请求数据过大，建议减少引用文章数量或缩短上下文长度。',
        code: 'PAYLOAD_TOO_LARGE'
    }),
    // 429: 频率限制
    429: () => ({
        message: '请求频率超限，请稍后再试（建议间隔 30 秒以上）。',
        code: 'RATE_LIMITED'
    }),
    // 500/503/529: 服务器问题
    500: () => ({
        message: 'AI 服务端暂时不可用，请稍后重试。',
        code: 'SERVER_ERROR'
    }),
    503: () => ({
        message: 'AI 服务端繁忙，请稍后重试。',
        code: 'SERVICE_UNAVAILABLE'
    }),
    529: () => ({
        message: 'AI 服务端过载，请稍后重试。',
        code: 'SERVER_OVERLOADED'
    }),
    // 504: 推理超时
    504: () => ({
        message: 'AI 响应超时，可尝试简化问题或稍后重试。',
        code: 'TIMEOUT'
    }),
    // 默认处理
    default: (errMsg) => {
        // 检测 fetch failed 等网络错误
        if (errMsg.includes('fetch failed') || errMsg.includes('ECONNREFUSED') || errMsg.includes('ETIMEDOUT')) {
            return {
                message: '网络连接失败，请检查网络状况或 AI 服务地址是否正确。',
                code: 'NETWORK_ERROR'
            };
        }
        return {
            message: '发生未知错误，请稍后重试。如问题持续，请联系管理员。',
            code: 'UNKNOWN_ERROR'
        };
    }
};

/**
 * 处理 AI API 错误，根据状态码返回友好的错误信息
 * @param {number} status - HTTP 状态码
 * @param {string} errMsg - 原始错误信息
 * @returns {object} { message, code }
 */
function handleAIError(status, errMsg) {
    const handler = AI_ERROR_HANDLERS[status] || AI_ERROR_HANDLERS.default;
    return typeof handler === 'function' ? handler(errMsg) : handler;
}

/**
 * 带重试的 AI 模型调用
 * @param {object} aiConfig - AI 配置
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userPayload - 用户消息
 * @param {array} historyMessages - 历史对话
 * @param {number} maxRetries - 最大重试次数，默认 3
 * @returns {Promise<response>} fetch 响应对象
 */
async function invokeAIModelWithRetry(aiConfig, systemPrompt, userPayload, historyMessages, maxRetries = 3) {
    const { url, headers, body } = buildAIRequest(aiConfig, systemPrompt, userPayload, historyMessages);
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(60000) // 60秒超时
            });
            
            // 如果成功或者是非 429/5xx 的错误，直接返回
            if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
                return response;
            }
            
            // 429 或 5xx 错误，尝试重试
            lastError = response;
            const errData = await response.json().catch(() => ({}));
            const errDetail = extractAIError(errData, aiConfig) || `HTTP ${response.status}`;
            
            if (attempt < maxRetries) {
                console.log(`AI 请求失败 (${attempt}/${maxRetries}): ${errDetail}，${attempt * 2} 秒后重试...`);
                // 指数退避：2秒、4秒、8秒
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            } else {
                // 达到最大重试次数
                return response;
            }
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                console.log(`AI 请求异常 (${attempt}/${maxRetries}): ${err.message}，${attempt * 2} 秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            }
        }
    }
    
    // 如果所有重试都失败，抛出一个错误
    if (lastError instanceof Response) {
        const errData = await lastError.json().catch(() => ({}));
        const errDetail = extractAIError(errData, aiConfig) || `HTTP ${lastError.status}`;
        const errorInfo = handleAIError(lastError.status, errDetail);
        throw new Error(`${errorInfo.code}:${errorInfo.message}`);
    }
    
    const errorInfo = handleAIError(0, lastError.message);
    throw new Error(`${errorInfo.code}:${errorInfo.message}`);
}

/** 调用外部 LLM（仅 HTTP；支持 openai / anthropic / gemini）- 已废弃，请使用 invokeAIModelWithRetry */
async function invokeAIModel(aiConfig, systemPrompt, userPayload, historyMessages) {
    const { url, headers, body } = buildAIRequest(aiConfig, systemPrompt, userPayload, historyMessages);
    return fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
}

function getNextPostId() {
    const posts = getAllPosts();
    if (posts.length === 0) return 1001;
    return Math.max(...posts.map(p => p.id)) + 1;
}

function savePost(data) {
    const id = data.id || getNextPostId();
    const date = data.date || new Date().toISOString().split('T')[0];
    
    const postData = {
        id: id,
        title: data.title || '无标题',
        date: date,
        tags: data.tags || [],
        hidden: data.hidden || false,
        locked: data.locked || false,
        lockPassword: data.lockPassword || '',
        content: data.content || ''
    };
    
    const fileName = `${id}.md`;
    const filePath = path.join(MARKDOWN_DIR, fileName);
    const fileContent = buildMarkdownFile(postData);
    
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    
    return id;
}

function deletePostFile(id) {
    if (!fs.existsSync(MARKDOWN_DIR)) {
        return false;
    }
    
    const files = fs.readdirSync(MARKDOWN_DIR);
    
    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const filePath = path.join(MARKDOWN_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const { frontmatter } = parseFrontmatter(content);
        
        if (parseInt(frontmatter.id) === parseInt(id)) {
            fs.unlinkSync(filePath);
            return true;
        }
    }
    
    return false;
}

// ==================== 请求处理 ====================
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

function getClientInfo(req) {
    var ip = req.headers['x-forwarded-for'] ||
             req.headers['x-real-ip'] ||
             null;
    
    if (ip && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
    }
    
    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
        ip = null;
    }
    
    var now = new Date();
    var timeStr = now.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }) + ' (UTC/GMT+8)';
    
    return { username: 'guest', ip: ip, time: timeStr };
}

// ==================== 路由处理 ====================
async function handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;
    const method = req.method;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 静态文件服务（仅 GET；API 与博客资源路径不得按扩展名误判为静态文件）
    const isStaticAssetRequest =
        method === 'GET' &&
        !pathname.startsWith('/api/') &&
        !pathname.startsWith('/blogfiles/') &&
        !pathname.startsWith('/blogimgs/') &&
        !pathname.startsWith('/guestuploads/') &&
        (pathname.startsWith('/public/') ||
            pathname.endsWith('.js') ||
            pathname.endsWith('.css') ||
            pathname.endsWith('.html') ||
            pathname.endsWith('.txt'));
    if (isStaticAssetRequest) {
        let filePath;
        if (pathname.startsWith('/public/')) {
            filePath = path.join(__dirname, pathname);
        } else {
            filePath = path.join(PUBLIC_DIR, pathname);
        }
        
        let contentType = 'text/plain';
        if (pathname.endsWith('.js')) contentType = 'application/javascript';
        else if (pathname.endsWith('.css')) contentType = 'text/css';
        else if (pathname.endsWith('.html')) contentType = 'text/html; charset=utf-8';
        
        if (sendFile(res, filePath, contentType)) return;
    }

    // 首页 - 返回 index.html
    if (pathname === '/' || pathname === '/index.html') {
        sendIndex(res);
        return;
    }

    try {
        // Auth routes
        if (pathname === '/api/auth/login' && method === 'POST') {
            const data = await parseBody(req);
            if (!data.username || !data.password) {
                return jsonResponse(res, { error: '用户名和密码不能为空' }, 400);
            }
            if (data.username !== ADMIN_USER || data.password !== ADMIN_PASS) {
                return jsonResponse(res, { error: '用户名或密码错误' }, 401);
            }
            const token = crypto.randomUUID();
            return jsonResponse(res, { message: '登录成功', token: token, username: data.username });
        }

        if (pathname === '/api/auth/logout' && method === 'POST') {
            return jsonResponse(res, { message: '已退出登录' });
        }

        if (pathname === '/api/auth/verify' && method === 'GET') {
            const authHeader = req.headers['authorization'];
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return jsonResponse(res, { error: '未提供认证令牌', valid: false }, 401);
            }
            return jsonResponse(res, { valid: true, username: 'admin' });
        }

        // Stats
        if (pathname === '/api/stats' && method === 'GET') {
            const posts = getAllPosts();
            const totalPosts = posts.length;
            const sorted = posts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
            const lastUpdate = sorted.length > 0 ? sorted[0].date : null;
            const ascSorted = posts.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
            const startDate = ascSorted.length > 0 ? ascSorted[0].date : '2026-01-01';
            const uptime = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
            return jsonResponse(res, {
                totalPosts: totalPosts,
                lastUpdate: lastUpdate || new Date().toISOString().split('T')[0],
                uptime: Math.max(1, uptime)
            });
        }

        // Check for duplicate post IDs
        if (pathname === '/api/check-duplicates' && method === 'GET') {
            const posts = getAllPosts();
            const idCount = {};
            const duplicates = [];
            
            posts.forEach(post => {
                const id = post.id;
                if (!idCount[id]) {
                    idCount[id] = [];
                }
                idCount[id].push({ id: post.id, title: post.title });
            });
            
            Object.keys(idCount).forEach(id => {
                if (idCount[id].length > 1) {
                    duplicates.push({
                        id: parseInt(id),
                        posts: idCount[id]
                    });
                }
            });
            
            return jsonResponse(res, {
                hasDuplicates: duplicates.length > 0,
                duplicates: duplicates
            });
        }

        // Posts list
        if (pathname === '/api/posts' && method === 'GET') {
            const page = parseInt(url.searchParams.get('page') || '1');
            const limit = parseInt(url.searchParams.get('limit') || '10');
            const tag = url.searchParams.get('tag') || '';
            const admin = url.searchParams.get('admin') === 'true';

            let posts = getAllPosts();

            if (tag) {
                posts = posts.filter(p => p.tags && p.tags.indexOf(tag) !== -1);
            }

            if (!admin) {
                posts = posts.filter(p => !p.hidden);
            }

            posts.sort((a, b) => b.id - a.id);

            const totalPosts = posts.length;
            const totalPages = Math.max(1, Math.ceil(totalPosts / limit));
            const start = (page - 1) * limit;
            const paginatedPosts = posts.slice(start, start + limit).map(p => ({
                id: p.id,
                title: p.title,
                date: p.date,
                size: p.size,
                tags: p.tags || [],
                hidden: !!p.hidden,
                locked: !!p.locked
            }));

            return jsonResponse(res, { posts: paginatedPosts, page, totalPages, totalPosts });
        }

        // Create new post
        if (pathname === '/api/post' && method === 'POST') {
            const data = await parseBody(req);
            if (!data.title || !data.content) {
                return jsonResponse(res, { error: '标题和内容不能为空' }, 400);
            }
            const id = savePost(data);
            return jsonResponse(res, { message: '文章创建成功', id: id });
        }

        // Tags
        if (pathname === '/api/tags' && method === 'GET') {
            const posts = getAllPosts();
            const tagMap = {};
            posts.forEach(post => {
                if (!post.hidden) {
                    (post.tags || []).forEach(tag => {
                        tagMap[tag] = (tagMap[tag] || 0) + 1;
                    });
                }
            });
            const tags = Object.entries(tagMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);
            return jsonResponse(res, { tags });
        }

        // Client info
        if (pathname === '/api/client-info' && method === 'GET') {
            return jsonResponse(res, getClientInfo(req));
        }

        // Post by ID
        const postMatch = pathname.match(/^\/api\/post\/(\d+)$/);
        if (postMatch) {
            const id = postMatch[1];
            
            if (method === 'GET') {
                const post = getPostById(id);
                if (!post) {
                    return jsonResponse(res, { error: '文章不存在' }, 404);
                }
                const clientPost = formatPostForClient(post, req);
                if (!clientPost) {
                    return jsonResponse(res, { error: '文章不存在' }, 404);
                }
                return jsonResponse(res, clientPost);
            }
            
            if (method === 'PUT') {
                const data = await parseBody(req);
                const existing = getPostById(id);
                if (!existing) {
                    return jsonResponse(res, { error: '文章不存在' }, 404);
                }
                const updatedData = {
                    id: parseInt(id),
                    title: data.title !== undefined ? data.title : existing.title,
                    date: data.date || existing.date,
                    tags: data.tags !== undefined ? data.tags : existing.tags,
                    hidden: data.hidden !== undefined ? data.hidden : existing.hidden,
                    locked: data.locked !== undefined ? data.locked : existing.locked,
                    lockPassword: data.lockPassword !== undefined ? data.lockPassword : existing.lockPassword,
                    content: data.content !== undefined ? data.content : existing.content
                };
                savePost(updatedData);
                return jsonResponse(res, { message: '文章更新成功', id: parseInt(id) });
            }
            
            if (method === 'DELETE') {
                const deleted = deletePostFile(id);
                if (!deleted) {
                    return jsonResponse(res, { error: '文章不存在' }, 404);
                }
                return jsonResponse(res, { message: '文章删除成功' });
            }
        }

        // Toggle visibility
        const toggleMatch = pathname.match(/^\/api\/post\/(\d+)\/toggle$/);
        if (toggleMatch && method === 'POST') {
            const id = toggleMatch[1];
            const post = getPostById(id);
            if (!post) {
                return jsonResponse(res, { error: '文章不存在' }, 404);
            }
            const updatedData = {
                ...post,
                hidden: !post.hidden
            };
            savePost(updatedData);
            return jsonResponse(res, { message: post.hidden ? '文章已显示' : '文章已隐藏', hidden: !post.hidden });
        }

        // Lock/Unlock post
        const lockMatch = pathname.match(/^\/api\/post\/(\d+)\/lock$/);
        if (lockMatch && method === 'POST') {
            const id = lockMatch[1];
            const data = await parseBody(req);
            const post = getPostById(id);
            if (!post) {
                return jsonResponse(res, { error: '文章不存在' }, 404);
            }
            const updatedData = {
                ...post,
                locked: true,
                lockPassword: data.password || ''
            };
            savePost(updatedData);
            return jsonResponse(res, { message: '文章已上锁' });
        }

        const unlockMatch = pathname.match(/^\/api\/post\/(\d+)\/unlock$/);
        if (unlockMatch && method === 'POST') {
            const id = unlockMatch[1];
            const post = getPostById(id);
            if (!post) {
                return jsonResponse(res, { error: '文章不存在' }, 404);
            }
            const updatedData = {
                ...post,
                locked: false,
                lockPassword: ''
            };
            savePost(updatedData);
            return jsonResponse(res, { message: '文章已解锁' });
        }

        // Verify lock password
        const verifyLockMatch = pathname.match(/^\/api\/post\/(\d+)\/verify-lock$/);
        if (verifyLockMatch && method === 'POST') {
            const id = verifyLockMatch[1];
            const data = await parseBody(req);
            const post = getPostById(id);
            if (!post) {
                return jsonResponse(res, { error: '文章不存在' }, 404);
            }
            const valid = post.lockPassword === data.password;
            return jsonResponse(res, { valid: valid });
        }

        // 博客文件 /blogfiles/* → 本地静态文件
        const blogfilesMatch = pathname.match(/^\/blogfiles\/(.+)$/);
        if (blogfilesMatch && method === 'GET') {
            const fileName = decodeURIComponent(blogfilesMatch[1].split('?')[0].split('#')[0]);
            const safeFileName = path.basename(fileName);
            if (safeFileName !== fileName || /[\/\x00-\x1F\x7F#$:?*\"<>|]/.test(fileName)) {
                return jsonResponse(res, { error: '文件名包含非法字符' }, 400);
            }
            const filePath = path.join(__dirname, '..', 'blogfiles', safeFileName);
            if (!fs.existsSync(filePath)) {
                return jsonResponse(res, { error: '文件不存在' }, 404);
            }
            const ext = path.extname(fileName).toLowerCase();
            const contentTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.pdf': 'application/pdf',
                '.zip': 'application/zip',
                '.mp4': 'video/mp4',
                '.mp3': 'audio/mpeg'
            };
            const contentType = contentTypes[ext] || 'application/octet-stream';
            const content = fs.readFileSync(filePath);
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400'
            });
            res.end(content);
            return;
        }

        // 博客图片 /blogimgs/* → 本地静态文件
        const blogimgsMatch = pathname.match(/^\/blogimgs\/(.+)$/);
        if (blogimgsMatch && method === 'GET') {
            const fileName = decodeURIComponent(blogimgsMatch[1].split('?')[0].split('#')[0]);
            const safeFileName = path.basename(fileName);
            if (safeFileName !== fileName || /[\/\x00-\x1F\x7F#$:?*\"<>|]/.test(fileName)) {
                return jsonResponse(res, { error: '文件名包含非法字符' }, 400);
            }
            const filePath = path.join(__dirname, '..', 'blogimgs', safeFileName);
            if (!fs.existsSync(filePath)) {
                return jsonResponse(res, { error: '文件不存在' }, 404);
            }
            const ext = path.extname(fileName).toLowerCase();
            const contentTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml'
            };
            const contentType = contentTypes[ext] || 'application/octet-stream';
            const content = fs.readFileSync(filePath);
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400'
            });
            res.end(content);
            return;
        }

        // 游客上传文件 /guestuploads/* → 本地静态文件
        const guestuploadsMatch = pathname.match(/^\/guestuploads\/(.+)$/);
        if (guestuploadsMatch && method === 'GET') {
            const fileName = decodeURIComponent(guestuploadsMatch[1].split('?')[0].split('#')[0]);
            const safeFileName = path.basename(fileName);
            if (safeFileName !== fileName || /[\/\x00-\x1F\x7F#$:?*\"<>|]/.test(fileName)) {
                return jsonResponse(res, { error: '文件名包含非法字符' }, 400);
            }
            const filePath = path.join(GUEST_UPLOADS_DIR, safeFileName);
            if (!fs.existsSync(filePath)) {
                return jsonResponse(res, { error: '文件不存在' }, 404);
            }
            const ext = path.extname(fileName).toLowerCase();
            const contentTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.pdf': 'application/pdf',
                '.zip': 'application/zip',
                '.apk': 'application/vnd.android.package-archive',
                '.mp4': 'video/mp4',
                '.mp3': 'audio/mpeg'
            };
            const contentType = contentTypes[ext] || 'application/octet-stream';
            const content = fs.readFileSync(filePath);
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400'
            });
            res.end(content);
            return;
        }

        // ============ 导出 Markdown 文件为 ZIP ============
        if (pathname === '/api/export' && method === 'GET') {
            const posts = getAllPosts();
            
            if (posts.length === 0) {
                return jsonResponse(res, { error: '没有文章可导出' }, 400);
            }
            
            // 创建 ZIP 文件
            const archive = new ZipArchive({ zlib: { level: 9 } });
            const chunks = [];

            archive.on('data', chunk => chunks.push(chunk));
            
            // 添加每个 Markdown 文件到 ZIP
            for (const post of posts) {
                const fileName = `${post.id}.md`;
                const fileContent = buildMarkdownFile({
                    id: post.id,
                    title: post.title,
                    date: post.date,
                    tags: post.tags,
                    hidden: post.hidden,
                    locked: post.locked,
                    lockPassword: post.lockPassword,
                    content: post.body
                });
                archive.append(fileContent, { name: fileName });
            }
            
            // 添加一个说明文件
            const readmeContent = `# TerminalBlog Markdown Export

导出时间: ${new Date().toISOString()}
文章数量: ${posts.length}

使用方法:
1. 解压此 ZIP 文件
2. 将 .md 文件放入博客的 Markdown 目录
3. 博客将自动识别这些文章

文章列表:
${posts.map(p => `- ${p.id}. ${p.title} (${p.date})`).join('\n')}
`;
            archive.append(readmeContent, { name: 'README.md' });
            
            archive.finalize();
            
            // 等待 archive 完成
            await new Promise((resolve, reject) => {
                archive.on('end', resolve);
                archive.on('error', reject);
            });
            
            const zipBuffer = Buffer.concat(chunks);
            const date = new Date().toISOString().split('T')[0];
            
            res.writeHead(200, {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="terminalblog-export-${date}.zip"`,
                'Content-Length': zipBuffer.length
            });
            res.end(zipBuffer);
            return;
        }

        // ============ 导入单个 Markdown 文件 ============
        if (pathname === '/api/import-markdown' && method === 'POST') {
            const data = await parseBody(req);
            
            if (!data.content) {
                return jsonResponse(res, { error: '请提供 Markdown 文件内容' }, 400);
            }
            
            const content = data.content;
            const filename = data.filename || 'imported.md';
            const { frontmatter, body } = parseFrontmatter(content);
            
            const existingIds = new Set(getAllPosts().map(p => p.id));
            const maxId = existingIds.size > 0 ? Math.max(...existingIds) : 1000;
            let nextId = maxId + 1;
            
            let postId = frontmatter.id ? parseInt(frontmatter.id) : null;
            let title = frontmatter.title || filename.replace(/\.md$/, '');
            let date = frontmatter.date || new Date().toISOString().split('T')[0];
            let tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
            let hidden = frontmatter.hidden === true || frontmatter.hidden === 'true';
            let locked = frontmatter.locked === true || frontmatter.locked === 'true';
            let lockPassword = frontmatter.lockPassword || '';
            
            // 如果 ID 已存在，跳过
            if (postId && existingIds.has(postId)) {
                return jsonResponse(res, {
                    message: '文章 ID 已存在',
                    imported: 0,
                    skipped: 1,
                    failed: 0,
                    total: 1,
                    results: [{ file: filename, status: 'skipped', reason: 'ID 已存在' }]
                });
            }
            
            // 分配新 ID
            if (!postId) {
                postId = nextId;
            }
            
            // 保存文件
            const postData = {
                id: postId,
                title: title,
                date: date,
                tags: tags,
                hidden: hidden,
                locked: locked,
                lockPassword: lockPassword,
                content: body
            };
            
            try {
                savePost(postData);
                return jsonResponse(res, {
                    message: '导入完成',
                    imported: 1,
                    skipped: 0,
                    failed: 0,
                    total: 1,
                    results: [{ file: filename, status: 'imported', id: postId, title: title }]
                });
            } catch (e) {
                return jsonResponse(res, {
                    message: '导入失败',
                    imported: 0,
                    skipped: 0,
                    failed: 1,
                    total: 1,
                    results: [{ file: filename, status: 'failed', reason: e.message }]
                });
            }
        }

        // ============ 导入 Markdown 文件 (支持 ZIP) ============
        if (pathname === '/api/import' && method === 'POST') {
            // 获取原始请求体（可能是 multipart 或 base64 编码的文件）
            const contentType = req.headers['content-type'] || '';
            let importData;
            
            if (contentType.includes('application/json')) {
                importData = await parseBody(req);
            } else {
                // 尝试获取 base64 编码的文件
                const rawBody = await new Promise((resolve, reject) => {
                    let body = '';
                    req.on('data', chunk => body += chunk);
                    req.on('end', () => resolve(body));
                    req.on('error', reject);
                });
                
                try {
                    importData = JSON.parse(rawBody);
                } catch (e) {
                    return jsonResponse(res, { error: '无效的请求数据' }, 400);
                }
            }
            
            if (!importData.file && !importData.base64) {
                return jsonResponse(res, { error: '请提供要导入的文件' }, 400);
            }
            
            let zipBuffer;
            if (importData.base64) {
                // Base64 编码的 ZIP 文件
                const base64Data = importData.base64.replace(/^data:application\/zip;base64,/, '');
                zipBuffer = Buffer.from(base64Data, 'base64');
            } else if (importData.file) {
                // 直接的文件数据
                const base64Data = importData.file.replace(/^data:application\/zip;base64,/, '').replace(/^data:application\/x-zip-compressed;base64,/, '');
                zipBuffer = Buffer.from(base64Data, 'base64');
            }
            
            if (!zipBuffer || zipBuffer.length === 0) {
                return jsonResponse(res, { error: '无效的 ZIP 文件数据' }, 400);
            }
            
            // 解压 ZIP 文件
            try {
                const AdmZip = require('adm-zip');
                const zip = new AdmZip(zipBuffer);
                const entries = zip.getEntries();
                
                const existingIds = new Set(getAllPosts().map(p => p.id));
                const maxId = existingIds.size > 0 ? Math.max(...existingIds) : 1000;
                let nextId = maxId + 1;
                
                let imported = 0;
                let skipped = 0;
                let failed = 0;
                const results = [];
                
                for (const entry of entries) {
                    // 只处理 .md 文件，跳过目录和其他文件类型
                    if (entry.isDirectory || !entry.entryName.endsWith('.md')) continue;
                    // 跳过 README.md（导出时生成的说明文件）
                    if (entry.entryName === 'README.md') continue;
                    // 跳过 macOS 的元数据文件（如 ._xxx.md）
                    if (entry.entryName.includes('._')) continue;
                    
                    try {
                        const content = zip.readAsText(entry);
                        const { frontmatter, body } = parseFrontmatter(content);
                        
                        let postId = frontmatter.id ? parseInt(frontmatter.id) : null;
                        let title = frontmatter.title || entry.entryName.replace(/\.md$/, '');
                        let date = frontmatter.date || new Date().toISOString().split('T')[0];
                        let tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
                        let hidden = frontmatter.hidden === true || frontmatter.hidden === 'true';
                        let locked = frontmatter.locked === true || frontmatter.locked === 'true';
                        let lockPassword = frontmatter.lockPassword || '';
                        
                        // 如果 ID 已存在，跳过
                        if (postId && existingIds.has(postId)) {
                            skipped++;
                            results.push({ file: entry.entryName, status: 'skipped', reason: 'ID 已存在' });
                            continue;
                        }
                        
                        // 分配新 ID
                        if (!postId) {
                            postId = nextId++;
                        }
                        
                        // 保存文件
                        const postData = {
                            id: postId,
                            title: title,
                            date: date,
                            tags: tags,
                            hidden: hidden,
                            locked: locked,
                            lockPassword: lockPassword,
                            content: body
                        };
                        
                        savePost(postData);
                        existingIds.add(postId);
                        imported++;
                        results.push({ file: entry.entryName, status: 'imported', id: postId, title: title });
                    } catch (e) {
                        failed++;
                        results.push({ file: entry.entryName, status: 'failed', reason: e.message });
                    }
                }
                
                return jsonResponse(res, {
                    message: '导入完成',
                    imported: imported,
                    skipped: skipped,
                    failed: failed,
                    total: entries.filter(e => !e.isDirectory && e.entryName.endsWith('.md') && e.entryName !== 'README.md').length,
                    results: results
                });
            } catch (e) {
                return jsonResponse(res, { error: '解压文件失败: ' + e.message }, 400);
            }
        }

        // ============ 文件管理 API ============
        // 获取上传大小限制（与 config.js 同步）
        if (pathname === '/api/files/limits' && method === 'GET') {
            const limits = loadUploadLimits();
            return jsonResponse(res, {
                blogfiles: {
                    maxBytes: limits.blogfiles,
                    maxMB: Math.round(limits.blogfiles / (1024 * 1024)),
                    hint: formatMaxUploadHint('blogfiles')
                },
                blogimgs: {
                    maxBytes: limits.blogimgs,
                    maxMB: Math.round(limits.blogimgs / (1024 * 1024)),
                    hint: formatMaxUploadHint('blogimgs')
                },
                guestupload: {
                    maxBytes: limits.guestupload,
                    maxMB: Math.round(limits.guestupload / (1024 * 1024)),
                    hint: formatMaxUploadHint('guestupload')
                }
            });
        }

        // 管理员：刷新并获取上传码
        if (pathname === '/api/guest-upload/code' && method === 'GET') {
            if (!isAdminAuthorized(req)) {
                return jsonResponse(res, { error: '需要管理员登录' }, 401);
            }
            const state = refreshUploadCode();
            return jsonResponse(res, {
                code: state.code,
                used: state.used,
                message: '上传码已刷新'
            });
        }

        // 游客：凭上传码上传文件（单次有效）
        if (pathname === '/api/guest-upload' && method === 'POST') {
            const contentType = req.headers['content-type'] || '';
            if (!contentType.includes('multipart/form-data')) {
                return jsonResponse(res, { error: '无效的内容类型' }, 400);
            }

            const MAX_SIZE = getMaxUploadSize('guestupload');
            const maxHint = formatMaxUploadHint('guestupload');
            let data = [];
            let totalSize = 0;
            let sizeLimitExceeded = false;

            req.on('data', chunk => {
                if (sizeLimitExceeded) return;
                totalSize += chunk.length;
                if (totalSize > MAX_SIZE) {
                    sizeLimitExceeded = true;
                    req.destroy();
                    if (!res.headersSent) {
                        return jsonResponse(res, { error: `文件大小超过限制 (最大 ${maxHint})` }, 413);
                    }
                } else {
                    data.push(chunk);
                }
            });

            req.on('end', () => {
                if (sizeLimitExceeded || res.headersSent) return;
                try {
                    const buffer = Buffer.concat(data);
                    const { fields, file } = parseMultipartForm(buffer, contentType);

                    const codeCheck = validateUploadCode(fields.uploadCode);
                    if (!codeCheck.valid) {
                        return jsonResponse(res, { error: codeCheck.error }, 400);
                    }
                    if (!file || !file.buffer || !file.buffer.length) {
                        return jsonResponse(res, { error: '未找到上传文件' }, 400);
                    }

                    const cleanFilename = file.filename.replace(/[\/\x00-\x1F\x7F#$:?*\"<>|]/g, '_');
                    if (!cleanFilename || cleanFilename.length > 255) {
                        return jsonResponse(res, { error: '文件名无效' }, 400);
                    }

                    if (!fs.existsSync(GUEST_UPLOADS_DIR)) {
                        fs.mkdirSync(GUEST_UPLOADS_DIR, { recursive: true });
                    }
                    const finalFilename = ensureUniqueGuestFilename(GUEST_UPLOADS_DIR, cleanFilename);
                    const filePath = path.join(GUEST_UPLOADS_DIR, finalFilename);
                    fs.writeFileSync(filePath, file.buffer);
                    consumeUploadCode();

                    return jsonResponse(res, {
                        message: '文件上传成功',
                        filename: finalFilename,
                        size: formatFileSize(file.buffer.length),
                        url: '/guestuploads/' + encodeURIComponent(finalFilename)
                    });
                } catch (e) {
                    return jsonResponse(res, { error: '上传失败: ' + e.message }, 500);
                }
            });

            req.on('error', e => {
                if (!res.headersSent) {
                    return jsonResponse(res, { error: '上传出错: ' + e.message }, 500);
                }
            });
            return;
        }

        // 获取文件列表
        const filesMatch = pathname.match(/^\/api\/files\/(\w+)$/);
        if (filesMatch && method === 'GET') {
            const folder = filesMatch[1];
            if (!ALLOWED_FILE_FOLDERS.includes(folder)) {
                return jsonResponse(res, { error: '无效的文件夹' }, 400);
            }
            if (folder === 'guestuploads' && !isAdminAuthorized(req)) {
                return jsonResponse(res, { error: '需要管理员登录' }, 401);
            }
            const folderPath = path.join(__dirname, '..', folder);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
            const files = fs.readdirSync(folderPath).map(fileName => {
                const filePath = path.join(folderPath, fileName);
                const stats = fs.statSync(filePath);
                const size = formatFileSize(stats.size);
                return { name: fileName, size: size, time: stats.mtime.toISOString() };
            });
            // 按时间排序，最新的在前
            files.sort((a, b) => new Date(b.time) - new Date(a.time));
            return jsonResponse(res, { files: files });
        }
        
        // 上传文件
        const uploadMatch = pathname.match(/^\/api\/upload\/(\w+)$/);
        if (uploadMatch && method === 'POST') {
            const folder = uploadMatch[1];
            if (folder !== 'blogfiles' && folder !== 'blogimgs') {
                return jsonResponse(res, { error: '无效的文件夹' }, 400);
            }
            if (!isAdminAuthorized(req)) {
                return jsonResponse(res, { error: '需要管理员登录' }, 401);
            }
            
            const folderPath = path.join(__dirname, '..', folder);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
            
            const contentType = req.headers['content-type'] || '';
            let data = [];
            let totalSize = 0;
            const MAX_SIZE = getMaxUploadSize(folder);
            const maxHint = formatMaxUploadHint(folder);
            let sizeLimitExceeded = false;
            
            req.on('data', chunk => {
                if (sizeLimitExceeded) return;
                totalSize += chunk.length;
                if (totalSize > MAX_SIZE) {
                    sizeLimitExceeded = true;
                    req.destroy();
                    if (!res.headersSent) {
                        return jsonResponse(res, { error: `文件大小超过限制 (最大 ${maxHint})` }, 413);
                    }
                    return;
                }
                data.push(chunk);
            });
            
            req.on('end', () => {
                if (sizeLimitExceeded || res.headersSent) {
                    return;
                }
                try {
                    const buffer = Buffer.concat(data);
                    const contentTypeHeader = contentType;
                    
                    if (contentTypeHeader.includes('multipart/form-data')) {
                        // 健壮的 boundary 提取，处理带有双引号包裹以及带有分号等其他参数的 Content-Type
                        const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/);
                        if (!boundaryMatch) {
                            return jsonResponse(res, { error: '无效的 multipart boundary' }, 400);
                        }
                        
                        const boundary = (boundaryMatch[1] || boundaryMatch[2] || '').trim();
                        if (!boundary) {
                            return jsonResponse(res, { error: '无效的 multipart boundary' }, 400);
                        }
                        
                        const multipartData = buffer;
                        
                        // 1. 查找 boundary 起始位置以定位当前分段
                        const boundaryBuffer = Buffer.from('--' + boundary);
                        const startIdx = multipartData.indexOf(boundaryBuffer);
                        if (startIdx === -1) {
                            return jsonResponse(res, { error: '未找到 multipart 分割边界' }, 400);
                        }
                        
                        // 2. 在分段内查找 Content-Disposition 头部与内容的双换行符分割线
                        const headerEnd = multipartData.indexOf(Buffer.from('\r\n\r\n'), startIdx + boundaryBuffer.length);
                        if (headerEnd === -1) {
                            return jsonResponse(res, { error: '无效的 multipart 结构' }, 400);
                        }
                        
                        const headerSection = multipartData.slice(startIdx + boundaryBuffer.length, headerEnd).toString('utf8');
                        const filenameMatch = headerSection.match(/filename="([^"]+)"/);
                        
                        if (!filenameMatch) {
                            return jsonResponse(res, { error: '未找到文件名' }, 400);
                        }
                        
                        const filename = path.basename(filenameMatch[1]);
                        // 清理文件名，只排除系统保留和危险字符，完全支持中文文件名
                        const cleanFilename = filename.replace(/[\/\x00-\x1F\x7F#$:?*\"<>|]/g, '_');
                        if (!cleanFilename || cleanFilename.length > 255) {
                            return jsonResponse(res, { error: '文件名无效' }, 400);
                        }
                        
                        // 3. 定位文件数据的起点
                        const fileStart = headerEnd + 4;
                        
                        // 4. 定位文件数据的终点（下一个分割边界前）
                        const boundaryEndBuffer = Buffer.from('\r\n--' + boundary);
                        let fileEnd = multipartData.indexOf(boundaryEndBuffer, fileStart);
                        
                        if (fileEnd === -1) {
                            const lastBoundaryBuffer = Buffer.from('--' + boundary);
                            fileEnd = multipartData.indexOf(lastBoundaryBuffer, fileStart);
                            if (fileEnd === -1) {
                                fileEnd = multipartData.length;
                            }
                        }
                        
                        let fileBuffer = multipartData.slice(fileStart, fileEnd);
                        
                        // 去除末尾的换行符
                        while (fileBuffer.length > 0 && (fileBuffer[fileBuffer.length - 1] === 10 || fileBuffer[fileBuffer.length - 1] === 13)) {
                            fileBuffer = fileBuffer.slice(0, -1);
                        }
                        
                        const filePath = path.join(folderPath, cleanFilename);
                        fs.writeFileSync(filePath, fileBuffer);
                        
                        return jsonResponse(res, { 
                            message: '文件上传成功', 
                            filename: cleanFilename,
                            size: formatFileSize(fileBuffer.length),
                            url: '/' + folder + '/' + encodeURIComponent(cleanFilename)
                        });
                    } else {
                        return jsonResponse(res, { error: '无效的内容类型' }, 400);
                    }
                } catch (e) {
                    return jsonResponse(res, { error: '上传失败: ' + e.message }, 500);
                }
            });
            
            req.on('error', (e) => {
                return jsonResponse(res, { error: '上传出错: ' + e.message }, 500);
            });
            return;
        }
        
        // 删除文件
        const deleteFileMatch = pathname.match(/^\/api\/files\/(\w+)\/(.+)$/);
        if (deleteFileMatch && method === 'DELETE') {
            const folder = deleteFileMatch[1];
            const filename = decodeURIComponent(deleteFileMatch[2]);
            
            if (!ALLOWED_FILE_FOLDERS.includes(folder)) {
                return jsonResponse(res, { error: '无效的文件夹' }, 400);
            }
            if (!isAdminAuthorized(req)) {
                return jsonResponse(res, { error: '需要管理员登录' }, 401);
            }

            const folderPath = path.join(__dirname, '..', folder);

            // 提取基础文件名，防御路径遍历
            const safeFilename = path.basename(filename);

            // 安全检查：确保解码后的文件名没有目录遍历嫌疑，且不含系统保留和危险字符
            if (safeFilename !== filename || /[\/\x00-\x1F\x7F#$:?*\"<>|]/.test(filename)) {
                return jsonResponse(res, { error: '文件名包含非法字符' }, 400);
            }

            const filePath = path.resolve(folderPath, safeFilename);
            // 再次验证路径是否越界，确保安全性
            if (!filePath.startsWith(folderPath + path.sep)) {
                return jsonResponse(res, { error: '非法路径访问' }, 400);
            }
            if (!fs.existsSync(filePath)) {
                return jsonResponse(res, { error: '文件不存在' }, 404);
            }

            fs.unlinkSync(filePath);
            return jsonResponse(res, { message: '文件已删除' });
        }

        // ============ Git 远程仓库同步 API ============
        // 1. 获取 Git 配置
        if (pathname === '/api/git/config' && method === 'GET') {
            let config = loadGitConfig();
            if (config.repositoryUrl && config.repositoryUrl.includes('git@')) {
                try {
                    config = ensureSshKeyPair(config);
                } catch (e) {
                    console.error('ensureSshKeyPair Error:', e);
                }
            }
            const safeConfig = {
                githubUser: config.githubUser || '',
                repositoryUrl: config.repositoryUrl || '',
                isPrivate: config.isPrivate || false,
                sshPublicKey: config.sshPublicKey || '',
                branch: config.branch || 'markdown'
            };
            return jsonResponse(res, safeConfig);
        }

        // 2. 保存 Git 配置
        if (pathname === '/api/git/config' && method === 'POST') {
            try {
                const body = await readJsonBody(req);
                const { githubUser, repositoryUrl, isPrivate, branch } = body;
                
                if (!repositoryUrl) {
                    return jsonResponse(res, { error: '仓库 URL 不能为空' }, 400);
                }

                let config = loadGitConfig();
                config.githubUser = githubUser || '';
                config.repositoryUrl = repositoryUrl.trim();
                config.isPrivate = !!isPrivate;
                config.branch = (branch || 'markdown').trim();

                if (config.repositoryUrl.includes('git@')) {
                    config = ensureSshKeyPair(config);
                }

                saveGitConfig(config);
                return jsonResponse(res, {
                    message: '配置保存成功',
                    config: {
                        githubUser: config.githubUser,
                        repositoryUrl: config.repositoryUrl,
                        isPrivate: config.isPrivate,
                        sshPublicKey: config.sshPublicKey,
                        branch: config.branch
                    }
                });
            } catch (err) {
                return jsonResponse(res, { error: err.message }, 400);
            }
        }

        // 3. 测试 Git 仓库连通性
        if (pathname === '/api/git/test' && method === 'POST') {
            let repositoryUrl = '';
            try {
                const body = await readJsonBody(req);
                repositoryUrl = (body.repositoryUrl || '').trim();

                if (!repositoryUrl) {
                    return jsonResponse(res, { error: '仓库 URL 不能为空' }, 400);
                }

                // 基本的安全过滤，防范注入攻击
                if (!/^[a-zA-Z0-9._\-/:@+%]+$/.test(repositoryUrl)) {
                    return jsonResponse(res, { error: '仓库 URL 包含非法字符，拒绝执行' }, 400);
                }

                let config = loadGitConfig();
                if (repositoryUrl.includes('git@') && !config.sshPrivateKeyPath) {
                    config.repositoryUrl = repositoryUrl;
                    config = ensureSshKeyPair(config);
                }

                // 异步测试指令以防止网络挂死
                execSync(`git ls-remote "${repositoryUrl}"`, {
                    env: getGitEnv(),
                    stdio: 'pipe',
                    timeout: 15000
                });
                return jsonResponse(res, { success: true, message: '连接成功，读写校验通过！' });
            } catch (e) {
                let stderr = '';
                if (e.stderr) {
                    stderr = e.stderr.toString('utf8').trim();
                }
                let errorMsg = stderr || e.message || '连接超时或配置错误';
                
                // 特化拦截 HTTPS 交互失败的报错
                if (repositoryUrl.includes('https://') && 
                    (errorMsg.includes('Username') || errorMsg.includes('Terminal') || errorMsg.includes('Device not configured') || errorMsg.includes('could not read') || errorMsg.includes('Credential') || errorMsg.includes('Authentication'))) {
                    errorMsg = '❌ [HTTPS AUTH ERROR] 检测到您使用了 HTTPS 链接，且 Git 试图要求输入用户名/密码。在自动化同步的无交互环境下这会被强行阻断。\n\n建议方案：\n1. 强烈推荐在上方改用更安全、适合自动化的 SSH 格式链接 (git@github.com:user/repo.git)，并使用下方生成的公钥添加到 GitHub 中。\n2. 如果必须使用 HTTPS，请确保在服务器全局配置了 Git 凭据助手(credential helper)或在 URL 中写入 Personal Access Token。';
                }
                
                return jsonResponse(res, { success: false, error: errorMsg }, 400);
            }
        }

        // 4. 远程仓库同步动作执行
        if (pathname === '/api/git/sync' && method === 'POST') {
            const logs = [];
            try {
                const body = await readJsonBody(req);
                const action = body.action; // 'push' | 'pull' | 'remoteToLocalLocalFirst' | 'remoteToLocalRemoteFirst'

                if (!['push', 'pull', 'remoteToLocalLocalFirst', 'remoteToLocalRemoteFirst'].includes(action)) {
                    return jsonResponse(res, { error: '无效的同步动作' }, 400);
                }

                const config = loadGitConfig();
                if (!config.repositoryUrl) {
                    return jsonResponse(res, { error: '请先配置远程仓库 URL' }, 400);
                }

                const targetBranch = config.branch || 'markdown';

                // 定义一个本地同步错误辅助函数，特化拦截 HTTPS 账号密码卡死报错并进行友好提示汉化
                const handleSyncError = (defaultError, statusCode = 400) => {
                    let errorMsg = defaultError;
                    // 检查 logs 里是否包含 HTTPS 的凭证错误
                    const hasHttpsAuthError = logs.some(log => 
                        log.type === 'stderr' && 
                        (log.text.includes('Username') || log.text.includes('Terminal') || log.text.includes('Device not configured') || log.text.includes('could not read') || log.text.includes('Credential') || log.text.includes('Authentication'))
                    );
                    
                    if (hasHttpsAuthError && config.repositoryUrl && config.repositoryUrl.includes('https://')) {
                        errorMsg = '❌ [HTTPS AUTH ERROR] 检测到您使用了 HTTPS 链接且同步失败。在免交互的自动化后台环境下，Git 无法读取您的用户名/密码。\n\n建议方案：\n1. 强烈推荐在左侧将仓库配置改用 SSH 格式链接 (git@github.com:user/repo.git)，并使用下方生成的专属公钥添加到 GitHub 中。\n2. 如果必须使用 HTTPS，请确保已在服务器全局配置了 Git 凭据助手(credential helper)或在 URL 中写入 Personal Access Token。';
                        logs.push({
                            type: 'stderr',
                            text: '💡 [系统修复建议]：请将仓库配置修改为 SSH 格式，并将本博客生成的部署公钥添加到您的 GitHub 部署密钥 (Deploy Keys) 中。'
                        });
                    }
                    return jsonResponse(res, { success: false, error: errorMsg, logs }, statusCode);
                };

                // 4.1 确保 Markdown 文件夹存在
                if (!fs.existsSync(MARKDOWN_DIR)) {
                    fs.mkdirSync(MARKDOWN_DIR, { recursive: true });
                }

                // 4.2 初始化 Git 仓库 (如果尚未初始化)
                if (!fs.existsSync(path.join(MARKDOWN_DIR, '.git'))) {
                    logs.push({ type: 'stdout', text: '检测到 Markdown 目录未初始化 Git，正在初始化本地仓库...' });
                    runCommandAndLog('git init', MARKDOWN_DIR, logs);
                    runCommandAndLog(`git checkout -b "${targetBranch}"`, MARKDOWN_DIR, logs);
                    runCommandAndLog('git config user.name "TerminalBlog"', MARKDOWN_DIR, logs);
                    runCommandAndLog('git config user.email "blog@terminal.local"', MARKDOWN_DIR, logs);
                    runCommandAndLog('git add .', MARKDOWN_DIR, logs);
                    try {
                        execSync('git commit -m "Initial commit of Markdown posts by TerminalBlog"', {
                            cwd: MARKDOWN_DIR,
                            stdio: 'ignore'
                        });
                        logs.push({ type: 'stdout', text: `✅ 已成功创建本地文章初始版本，并已自动绑定到 "${targetBranch}" 分支。` });
                    } catch (e) {}
                } else {
                    // 如果已经初始化，但当前分支与配置的不一致，则切换或新建目标分支
                    let currentBranch = '';
                    try {
                        currentBranch = execSync('git branch --show-current', { cwd: MARKDOWN_DIR }).toString('utf8').trim();
                    } catch (e) {
                        try {
                            currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: MARKDOWN_DIR }).toString('utf8').trim();
                        } catch (err) {}
                    }

                    if (currentBranch && currentBranch !== targetBranch) {
                        logs.push({ type: 'stdout', text: `检测到本地当前分支为 "${currentBranch}"，正在切换到配置的目标同步分支 "${targetBranch}"...` });
                        let checkoutSuccess = runCommandAndLog(`git checkout "${targetBranch}"`, MARKDOWN_DIR, logs);
                        if (!checkoutSuccess) {
                            logs.push({ type: 'stdout', text: `本地不存在分支 "${targetBranch}"，正在创建并切换...` });
                            runCommandAndLog(`git checkout -b "${targetBranch}"`, MARKDOWN_DIR, logs);
                        }
                    }
                }

                // 4.3 校验与校准 remote origin
                let currentRemote = '';
                try {
                    currentRemote = execSync('git remote get-url origin', {
                        cwd: MARKDOWN_DIR,
                        stdio: 'pipe'
                    }).toString('utf8').trim();
                } catch (e) {}

                if (!currentRemote) {
                    runCommandAndLog(`git remote add origin "${config.repositoryUrl}"`, MARKDOWN_DIR, logs);
                } else if (currentRemote !== config.repositoryUrl) {
                    runCommandAndLog(`git remote set-url origin "${config.repositoryUrl}"`, MARKDOWN_DIR, logs);
                }

                // 4.4 执行具体的同步逻辑
                if (action === 'push') {
                    // 本地覆盖远程 (Force Push)
                    runCommandAndLog('git add .', MARKDOWN_DIR, logs);
                    try {
                        execSync('git commit -m "Sync: Local override Remote at ' + new Date().toLocaleString('zh-CN') + '"', {
                            cwd: MARKDOWN_DIR,
                            env: getGitEnv(),
                            stdio: 'ignore'
                        });
                        logs.push({ type: 'stdout', text: '本地暂存文件快照建立成功。' });
                    } catch (e) {}

                    const pushSuccess = runCommandAndLog(`git push -f origin "${targetBranch}"`, MARKDOWN_DIR, logs);
                    if (pushSuccess) {
                        return jsonResponse(res, { success: true, message: `本地文章内容已强力覆盖远程仓库 ${targetBranch} 分支！`, logs });
                    } else {
                        return handleSyncError('强制推送失败，请检查配置、网络或 SSH 权限。');
                    }
                }

                if (action === 'pull') {
                    // 远程覆盖本地 (Force Reset)
                    const fetchSuccess = runCommandAndLog('git fetch origin', MARKDOWN_DIR, logs);
                    if (!fetchSuccess) {
                        return handleSyncError('从远程获取更新失败，请检查网络或 SSH 权限。');
                    }

                    // 校验远程分支是否存在
                    let hasRemoteBranch = false;
                    try {
                        execSync(`git rev-parse "origin/${targetBranch}"`, { cwd: MARKDOWN_DIR, stdio: 'ignore' });
                        hasRemoteBranch = true;
                    } catch (e) {}

                    if (!hasRemoteBranch) {
                        logs.push({ type: 'stderr', text: `❌ [ERROR] 远程仓库上不存在分支 "${targetBranch}"，无法执行远程覆盖本地。` });
                        return jsonResponse(res, { success: false, error: `远程分支 "${targetBranch}" 不存在。您必须先使用“本地覆盖远程”初始化创建该远程分支。`, logs }, 400);
                    }

                    let resetSuccess = runCommandAndLog(`git reset --hard "origin/${targetBranch}"`, MARKDOWN_DIR, logs);
                    if (resetSuccess) {
                        runCommandAndLog('git clean -fd', MARKDOWN_DIR, logs);
                        return jsonResponse(res, { success: true, message: `远程仓库分支 "${targetBranch}" 内容已成功强制覆盖本地！`, logs });
                    } else {
                        return handleSyncError('强力重置本地失败，请确认分支状态。');
                    }
                }

                if (action === 'remoteToLocalLocalFirst' || action === 'remoteToLocalRemoteFirst') {
                    const preferRemote = action === 'remoteToLocalRemoteFirst';
                    const strategyName = preferRemote ? '远程增量至本地（远程）' : '远程增加至本地（本地）';
                    logs.push({ type: 'stdout', text: `准备执行：${strategyName}` });

                    runCommandAndLog('git add .', MARKDOWN_DIR, logs);
                    try {
                        execSync('git commit -m "Sync: Local snapshot before Remote Import at ' + new Date().toLocaleString('zh-CN') + '"', {
                            cwd: MARKDOWN_DIR,
                            env: getGitEnv(),
                            stdio: 'ignore'
                        });
                        logs.push({ type: 'stdout', text: '本地快照创建完毕。' });
                    } catch (e) {}

                    const fetchSuccess = runCommandAndLog('git fetch origin', MARKDOWN_DIR, logs);
                    if (!fetchSuccess) {
                        return handleSyncError('拉取远程文件列表失败，请检查网络或 SSH 权限。');
                    }

                    // 校验远程分支是否存在
                    let hasRemoteBranch = false;
                    try {
                        execSync(`git rev-parse "origin/${targetBranch}"`, { cwd: MARKDOWN_DIR, stdio: 'ignore' });
                        hasRemoteBranch = true;
                    } catch (e) {}

                    if (!hasRemoteBranch) {
                        logs.push({ type: 'stderr', text: `❌ [ERROR] 远程仓库上不存在分支 "${targetBranch}"，已停止执行，未修改远程仓库。` });
                        return jsonResponse(res, { success: false, error: `远程分支 "${targetBranch}" 不存在。请先确认配置，或使用“本地覆盖远程”初始化远程分支。`, logs }, 400);
                    }

                    try {
                        const result = importRemoteFilesToLocal(`origin/${targetBranch}`, preferRemote, logs);
                        const message = preferRemote
                            ? `远程增量至本地完成：新增 ${result.added} 个，远程覆盖 ${result.overwritten} 个，保留本地独有文件。`
                            : `远程增加至本地完成：新增 ${result.added} 个，跳过本地已存在文件 ${result.skipped} 个。`;
                        logs.push({ type: 'stdout', text: '本次操作只修改本地 Markdown 目录，没有向远程仓库推送任何内容。' });
                        return jsonResponse(res, { success: true, message, logs });
                    } catch (err) {
                        let stderrStr = '';
                        if (err.stderr) stderrStr = err.stderr.toString('utf8').trim();
                        logs.push({ type: 'stderr', text: stderrStr || err.message });
                        return handleSyncError('远程文件增量到本地失败，请检查仓库内容或本地文件权限。');
                    }
                }
            } catch (err) {
                logs.push({ type: 'stderr', text: '执行同步动作崩溃: ' + err.message });
                return handleSyncError('执行同步动作崩溃: ' + err.message, 500);
            }
        }

        // 5. 本地与远程文件对比检查（只读，不修改工作区与远程仓库）
        if (pathname === '/api/git/compare' && method === 'POST') {
            const logs = [];
            try {
                const config = loadGitConfig();
                if (!config.repositoryUrl) {
                    return jsonResponse(res, { error: '请先配置远程仓库 URL' }, 400);
                }

                const targetBranch = config.branch || 'markdown';
                logs.push({ type: 'stdout', text: '开始对比检查（只读模式，不会推送、拉取或写入任何文章文件）...' });

                if (!fs.existsSync(MARKDOWN_DIR)) {
                    fs.mkdirSync(MARKDOWN_DIR, { recursive: true });
                }

                const localFiles = getLocalFileList();
                logs.push({ type: 'stdout', text: `已扫描本地 Markdown 目录，共 ${localFiles.length} 个文件。` });

                if (!fs.existsSync(path.join(MARKDOWN_DIR, '.git'))) {
                    logs.push({
                        type: 'stderr',
                        text: '本地尚未初始化 Git 仓库，无法获取远程分支文件树。请先保存配置并执行一次连接测试或同步初始化。'
                    });
                    return jsonResponse(
                        res,
                        {
                            success: false,
                            error: '本地 Git 未初始化，无法对比远程文件列表',
                            report: {
                                localCount: localFiles.length,
                                remoteCount: 0,
                                bothCount: 0,
                                localOnlyCount: localFiles.length,
                                remoteOnlyCount: 0,
                                localOnly: localFiles
                            },
                            logs
                        },
                        400
                    );
                }

                let currentRemote = '';
                try {
                    currentRemote = execSync('git remote get-url origin', {
                        cwd: MARKDOWN_DIR,
                        stdio: 'pipe'
                    })
                        .toString('utf8')
                        .trim();
                } catch (e) {}

                if (!currentRemote) {
                    runCommandAndLog(`git remote add origin "${config.repositoryUrl}"`, MARKDOWN_DIR, logs);
                } else if (currentRemote !== config.repositoryUrl) {
                    runCommandAndLog(`git remote set-url origin "${config.repositoryUrl}"`, MARKDOWN_DIR, logs);
                }

                const fetchSuccess = runCommandAndLog('git fetch origin', MARKDOWN_DIR, logs);
                if (!fetchSuccess) {
                    return jsonResponse(
                        res,
                        { success: false, error: '获取远程文件列表失败，请检查网络或 SSH 权限', logs },
                        400
                    );
                }

                let hasRemoteBranch = false;
                try {
                    execSync(`git rev-parse "origin/${targetBranch}"`, {
                        cwd: MARKDOWN_DIR,
                        stdio: 'ignore'
                    });
                    hasRemoteBranch = true;
                } catch (e) {}

                if (!hasRemoteBranch) {
                    logs.push({
                        type: 'stderr',
                        text: `远程仓库上不存在分支 "${targetBranch}"，无法完成对比。`
                    });
                    return jsonResponse(
                        res,
                        {
                            success: false,
                            error: `远程分支 "${targetBranch}" 不存在`,
                            report: {
                                branch: targetBranch,
                                localCount: localFiles.length,
                                remoteCount: 0,
                                bothCount: 0,
                                localOnlyCount: localFiles.length,
                                remoteOnlyCount: 0,
                                localOnly: localFiles
                            },
                            logs
                        },
                        400
                    );
                }

                const remoteRef = `origin/${targetBranch}`;
                const remoteFiles = getRemoteFileList(remoteRef, logs);
                const report = buildFileCompareReport(localFiles, remoteFiles, remoteRef, logs);

                return jsonResponse(res, {
                    success: true,
                    message: '对比检查完成（未对本地文章或远程仓库做任何修改）',
                    report,
                    logs
                });
            } catch (err) {
                logs.push({ type: 'stderr', text: '对比检查失败: ' + err.message });
                return jsonResponse(res, { success: false, error: '对比检查失败: ' + err.message, logs }, 500);
            }
        }

        // ==================== AI 聊天 API（只读文章 + 外部 LLM，无写入/执行权限）====================
        if (pathname === '/api/ai/chat' && method === 'POST') {
            try {
                const data = await parseBody(req);
                const message = data.message;

                if (!message) {
                    return jsonResponse(res, { error: '消息不能为空' }, 400);
                }

                const aiConfig = loadAIConfig();

                if (!aiConfig.enabled) {
                    return jsonResponse(res, { error: 'AI 功能已禁用' }, 400);
                }

                if (!aiConfig.apiKey) {
                    return jsonResponse(res, { error: 'AI API 未配置，请在 config.js 中设置 apiKey' }, 400);
                }

                const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
                const posts = getAllPosts().filter((p) => !p.hidden);
                const messageLower = message.toLowerCase();

                const ownerKeywords = ['站长', '管理员', '主人', '陛下', '博主', '作者', '老板', '老大'];
                const isOwnerQuestion = ownerKeywords.some((k) => messageLower.includes(k));

                const techKeywords = [
                    '系统', '网络', '编程', '代码', '软件', '服务器', 'linux', 'windows', 'mac',
                    'git', 'docker', 'npm', 'node', 'python', 'java', '前端', '后端', '数据库',
                    '算法', '架构', '部署', '配置', '安装', '命令', '终端', 'vim', 'ssh', 'api',
                    'json', 'html', 'css', 'javascript', 'typescript'
                ];
                const isTechQuestion = techKeywords.some((k) => messageLower.includes(k));

                const { userPayload, topPosts, hasHits, currentPost } = assembleAIContext(posts, message, siteUrl, aiConfig, {
                    currentPostId: data.currentPostId,
                    currentPage: data.currentPage
                });

                let mode = 'general';
                if (isOwnerQuestion) {
                    mode = 'owner';
                } else if (hasHits || currentPost) {
                    mode = 'blog';
                } else if (isTechQuestion) {
                    mode = 'tech';
                }

                const systemPrompt = buildXiaomeiSystemPrompt(mode, {
                    siteUrl,
                    postCount: posts.length,
                    hasHits
                });

                // 使用带重试的 AI 调用
                const response = await invokeAIModelWithRetry(
                    aiConfig,
                    systemPrompt,
                    userPayload,
                    data.messages,
                    3 // 最多重试 3 次
                );

                if (!response.ok) {
                    const status = response.status;
                    let errDetail = String(status);
                    try {
                        const errData = await response.json();
                        errDetail = extractAIError(errData, aiConfig) || errDetail;
                    } catch (_) { /* 忽略非 JSON 错误体 */ }
                    const errorInfo = handleAIError(status, errDetail);
                    return jsonResponse(res, { 
                        error: 'AI 服务请求失败: ' + errDetail,
                        code: errorInfo.code,
                        suggestion: errorInfo.message
                    }, status >= 500 ? 500 : 400);
                }

                const aiData = await response.json();
                const reply = parseAIReply(aiConfig, aiData) || '抱歉，AI 暂时无法回答。';

                const sources = topPosts.map((item) => ({
                    id: item.post.id,
                    title: item.post.title,
                    date: item.post.date,
                    url: `${siteUrl}/${item.post.id}`
                }));

                const result = { reply, sources };
                if (mode === 'owner') result.type = 'owner';
                else if (mode === 'tech' && !hasHits) result.type = 'tech';

                return jsonResponse(res, result);
            } catch (err) {
                console.error('AI Chat Error:', err);
                return jsonResponse(res, { error: 'AI 服务出错: ' + err.message }, 500);
            }
        }

        // Search posts
        if (pathname === '/api/search' && method === 'GET') {
            const query = url.searchParams.get('q') || '';
            const admin = url.searchParams.get('admin') === 'true';
            
            if (!query) {
                return jsonResponse(res, { results: [] });
            }
            
            let posts = getAllPosts();
            if (!admin) {
                posts = posts.filter(p => !p.hidden);
            }
            
            const queryLower = query.toLowerCase();
            const results = posts
                .filter((p) => {
                    const bodyLower = (p.body || '').toLowerCase();
                    return (
                        p.title.toLowerCase().includes(queryLower) ||
                        bodyLower.includes(queryLower) ||
                        (p.tags && p.tags.some((t) => t.toLowerCase().includes(queryLower)))
                    );
                })
                .map((p) => ({
                    id: p.id,
                    title: p.title,
                    date: p.date,
                    tags: p.tags || [],
                    locked: !!p.locked,
                    excerpt: p.locked && !admin ? '' : (p.body || '').substring(0, 200)
                }))
                .slice(0, 20);
            
            return jsonResponse(res, { results });
        }

        // SPA fallback - 所有未匹配的路径返回 index.html
        sendIndex(res);
    } catch (e) {
        console.error('Error:', e);
        // 检查响应是否已经发送
        if (!res.headersSent) {
            jsonResponse(res, { error: '服务器错误: ' + e.message }, 500);
        }
    }
}

// 文件大小格式化
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// ==================== 启动服务器 ====================
const server = http.createServer(handleRequest);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Terminal Blog running on http://0.0.0.0:${PORT}`);
    console.log(`Markdown directory: ${MARKDOWN_DIR}`);
    console.log(`Admin user: ${ADMIN_USER}`);
});

module.exports = server;
