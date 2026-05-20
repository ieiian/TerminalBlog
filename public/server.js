/**
 * Terminal Blog - Node.js API Server
 * 基于文件系统存储的博客 API 服务器
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');

// ==================== 配置 ====================
const PORT = process.env.PORT || 8788;
const PUBLIC_DIR = __dirname;
const MARKDOWN_DIR = process.env.MARKDOWN_DIR || path.join(__dirname, '..', 'Markdown');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

// ==================== 工具函数 ====================
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#039;');
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

    // 静态文件服务
    if (pathname.startsWith('/public/') || pathname.endsWith('.js') || pathname.endsWith('.css') || pathname.endsWith('.html')) {
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
                return jsonResponse(res, post);
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

        // 文件下载 /download/* → 本地静态文件
        const downloadMatch = pathname.match(/^\/download\/(.+)$/);
        if (downloadMatch && method === 'GET') {
            const fileName = downloadMatch[1].split('?')[0].split('#')[0];
            if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
                return jsonResponse(res, { error: '文件名包含非法字符' }, 400);
            }
            const filePath = path.join(__dirname, '..', 'download', fileName);
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

        // 图片访问 /images/* → 本地静态文件
        const imagesMatch = pathname.match(/^\/images\/(.+)$/);
        if (imagesMatch && method === 'GET') {
            const fileName = imagesMatch[1].split('?')[0].split('#')[0];
            if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
                return jsonResponse(res, { error: '文件名包含非法字符' }, 400);
            }
            const filePath = path.join(__dirname, '..', 'images', fileName);
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

        // ============ 导出 Markdown 文件为 ZIP ============
        if (pathname === '/api/export' && method === 'GET') {
            const posts = getAllPosts();
            
            if (posts.length === 0) {
                return jsonResponse(res, { error: '没有文章可导出' }, 400);
            }
            
            // 创建 ZIP 文件
            const archive = archiver('zip', { zlib: { level: 9 } });
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

// ==================== 启动服务器 ====================
const server = http.createServer(handleRequest);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Terminal Blog running on http://0.0.0.0:${PORT}`);
    console.log(`Markdown directory: ${MARKDOWN_DIR}`);
    console.log(`Admin user: ${ADMIN_USER}`);
});

module.exports = server;