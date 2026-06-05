// ============ AI Chat Functions ============
let aiModal = null;
let aiMessages = [];          // 对外显示的对话记录
let isAiTyping = false;
let pendingAIRequests = 0;
let aiHistoryVersion = 0;
const pendingAutoSummaries = new Set();

function typeWriterEffect(msgDiv, text) {
    if (!msgDiv || !text) return;
    const contentEl = msgDiv.querySelector('.ai-message-content');
    if (!contentEl) return;

    let index = 0;
    const speed = 30; // 每个字符间隔 30ms

    function type() {
        if (!document.body.contains(msgDiv)) return;
        if (index < text.length) {
            if (typeof marked !== 'undefined') {
                try {
                    const partialText = text.substring(0, index + 1);
                    contentEl.innerHTML = marked.parse(partialText);
                } catch (e) {
                    contentEl.textContent = text.substring(0, index + 1);
                }
            } else {
                contentEl.textContent = text.substring(0, index + 1);
            }
            index++;
            const msgList = document.getElementById('aiMessageList');
            if (msgList) msgList.scrollTop = msgList.scrollHeight;
            setTimeout(type, speed);
        }
    }

    type();
}

const AI_STORAGE_KEY = 'terminal_blog_ai_messages';
const AI_POST_MARKER_RE = /\s*<!--\s*post:([^|>]+)(?:\|summary)?\s*-->\s*$/;

function getActivePostId() {
    if (currentView === 'post' && currentSlug) return String(currentSlug);
    return getCurrentPostIdFromUrl();
}

function getCurrentAIPageContext() {
    return {
        view: currentView || 'home',
        postId: isOnPostPage() ? getActivePostId() : null,
        tag: currentView === 'tag' ? (currentTag || '') : '',
        path: window.location.pathname,
        title: document.title || ''
    };
}

function stripAIMessageMetadata(content) {
    return String(content || '')
        .replace(/\s*<!--\s*post:[^>]+\s*-->\s*$/, '')
        .replace(/\s*<!-- \/[^/]+\/ -->\s*$/, '');
}

function buildAIMessageContent(content, options) {
    const opts = options || {};
    let savedContent = stripAIMessageMetadata(content);
    if (opts.postId) {
        savedContent += `<!-- post:${opts.postId}${opts.summary ? '|summary' : ''} -->`;
    }
    return savedContent;
}

function getAIMessagePostId(content) {
    const modern = String(content || '').match(AI_POST_MARKER_RE);
    if (modern) return modern[1];
    const legacy = String(content || '').match(/<!-- \/([^/]+)\/ -->\s*$/);
    return legacy ? legacy[1] : null;
}

function isAIMessageSummary(content) {
    const value = String(content || '');
    return /\s*<!--\s*post:[^|>]+\|summary\s*-->\s*$/.test(value) || /<!-- \/[^/]+\/ -->\s*$/.test(value);
}

function saveAIMessage(role, content, options) {
    const opts = options || {};
    const savedContent = role === 'ai'
        ? buildAIMessageContent(content, opts)
        : stripAIMessageMetadata(content);
    aiMessages.push({ role: role, content: savedContent });
    saveAIMessages();
}

function getVisibleAIMessages() {
    return aiMessages
        .filter((msg) => msg && (msg.role === 'user' || msg.role === 'ai'))
        .map((msg) => ({
            role: msg.role,
            content: stripAIMessageMetadata(msg.content)
        }))
        .filter((msg) => msg.content);
}

function saveAIMessages() {
    try {
        localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(aiMessages));
    } catch (e) {
        console.error('保存 AI 聊天记录失败:', e);
    }
}

function loadAIMessages() {
    try {
        const saved = localStorage.getItem(AI_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                aiMessages = parsed;
            }
        }
    } catch (e) {
        console.error('加载 AI 聊天记录失败:', e);
        aiMessages = [];
        clearAISavedMessages();
    }
}

function clearAISavedMessages() {
    try {
        localStorage.removeItem(AI_STORAGE_KEY);
    } catch (e) {
        console.error('清除 AI 聊天记录失败:', e);
    }
}

function isOnPostPage() {
    if (currentView === 'post' && currentSlug) return true;
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html' || path === '') return false;
    if (path.startsWith('/api/') || path.startsWith('/config.js')) return false;
    return /^\/[a-zA-Z0-9_-]+\/?$/.test(path);
}

function getCurrentPostIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/^\/([a-zA-Z0-9_-]+)\/?$/);
    return match ? match[1] : null;
}

// 检查聊天记录中是否已有当前文章的总结（通过文章 URL 识别）
function hasPostSummary() {
    if (!isOnPostPage()) return false;

    const postSlug = getActivePostId();
    if (!postSlug) return false;
    return aiMessages.some((msg) => (
        msg.role === 'ai' &&
        getAIMessagePostId(msg.content) === postSlug &&
        isAIMessageSummary(msg.content)
    ));
}

// 获取文章标题用于总结提示
function getPostSummaryPrompt(postTitle, postContent) {
    // 截取前2000字符作为摘要材料
    const contentPreview = postContent.length > 2000 
        ? postContent.substring(0, 2000) + '...' 
        : postContent;
    
    const prompts = [
        `当前打开的这篇文章是《${postTitle}》，以下是文章摘要：\n\n${contentPreview}\n\n请用简洁的语言为读者总结这篇文章的主要内容。`,
        `当前打开的这篇文章是《${postTitle}》，以下是文章摘要：\n\n${contentPreview}\n\n请为读者简要介绍这篇文章在讲什么。`
    ];
    
    return prompts[Math.floor(Math.random() * prompts.length)];
}

// 自动总结当前文章
async function autoSummarizePost() {
    const postId = getActivePostId();
    if (!postId || pendingAutoSummaries.has(postId) || hasPostSummary()) return;
    pendingAutoSummaries.add(postId);
    const requestVersion = aiHistoryVersion;

    try {
        const config = window.AI_CONFIG || {};
        if (!config.apiKey) {
            console.log('AI 未配置 API Key，跳过自动总结');
            return;
        }

        const post = await apiGet('/post/' + postId);
        if (!post || !post.content) {
            console.log('无法获取文章内容，跳过自动总结');
            return;
        }

        const summaryPrompt = getPostSummaryPrompt(post.title || '未命名文章', post.content || '');

        const msgList = document.getElementById('aiMessageList');
        const welcome = msgList ? msgList.querySelector('.ai-welcome') : null;
        if (welcome) welcome.remove();

        beginAIRequest();

        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [],
                message: summaryPrompt,
                currentPostId: postId,
                currentPage: getCurrentAIPageContext(),
                hiddenRequest: true
            })
        });

        const data = await response.json();
        if (!response.ok) {
            showAIError('❌ ' + (data.error || '请求失败'));
            return;
        }

        if (data.error) {
            showAIError('❌ ' + data.error);
            return;
        }

        const replyText = data.reply || '抱歉，无法生成总结。';
        if (requestVersion !== aiHistoryVersion) return;
        saveAIMessage('ai', replyText, { postId: postId, summary: true });
        renderAIMessage('ai', replyText, { animate: replyText.length >= 200 });
    } catch (err) {
        console.error('自动总结失败:', err);
    } finally {
        pendingAutoSummaries.delete(postId);
        endAIRequest();
    }
}

function openAIModal() {
    if (aiModal) return;

    const config = window.AI_CONFIG || {};
    if (!config.enabled) {
        showToast('AI 功能已禁用', 'info');
        return;
    }

    aiModal = document.createElement('div');
    aiModal.className = 'ai-modal';
    aiModal.id = 'aiModal';
    aiModal.onclick = function(e) {
        if (e.target === aiModal) closeAIModal();
    };

    const uiConfig = config.ui || {};
    const showWelcome = uiConfig.showWelcome !== false;
    const welcomeMsg = uiConfig.welcomeMessage || '你好！我是 TerminalBlog 的 AI 助手，可以帮你解答关于博客内容的问题，有什么想了解的吗？';

    // 加载历史聊天记录
    loadAIMessages();

    const autoSummarizeConfig = config.autoSummarize || {};
    const autoSummarizeEnabled = autoSummarizeConfig.enabled !== false;
    const shouldAutoSummarize = autoSummarizeEnabled && isOnPostPage() && !hasPostSummary();

    let welcomeHtml = '';
    if (showWelcome && aiMessages.length === 0 && !shouldAutoSummarize) {
        welcomeHtml = `
            <div class="ai-welcome">
                <div class="ai-welcome-icon">🤖</div>
                <div class="ai-welcome-title">TerminalBlog AI</div>
                <div class="ai-welcome-desc">${escapeHtml(welcomeMsg)}</div>
            </div>
        `;
    }

    aiModal.innerHTML = `
        <div class="ai-modal-window">
            <div class="ai-modal-header">
                <div class="ai-modal-title">
                    <span class="ai-icon">✨</span>
                    <span>${uiConfig.windowTitle || 'AI 助手'}</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="ai-modal-close" onclick="clearAIMessages()" style="background: transparent; border: 1px solid var(--border); color: var(--gray); width: auto; padding: 4px 10px; font-size: 0.75em; border-radius: 4px; cursor: pointer;">🗑️ 清空</button>
                    <button class="ai-modal-close" onclick="closeAIModal()">✕</button>
                </div>
            </div>
            <div class="ai-modal-body" id="aiMessageList">
                ${welcomeHtml}
            </div>
            <div class="ai-modal-footer">
                <div class="ai-input-wrapper">
                    <textarea class="ai-input" id="aiInput" placeholder="输入问题..." rows="1"></textarea>
                    <button class="ai-send-btn" id="aiSendBtn" onclick="sendAIMessage()">发送</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(aiModal);
    document.body.style.overflow = 'hidden';

    // 渲染历史消息（如果有的话）
    if (aiMessages.length > 0) {
        const msgList = document.getElementById('aiMessageList');
        if (msgList) {
            const welcome = msgList.querySelector('.ai-welcome');
            if (welcome) welcome.remove();

            aiMessages.forEach(function(msg) {
                if (msg.role === 'user' || msg.role === 'ai') {
                    renderAIMessage(msg.role, stripAIMessageMetadata(msg.content), { save: false });
                }
            });

            msgList.scrollTop = msgList.scrollHeight;
        }
    }
    if (pendingAIRequests > 0) {
        showAITyping();
    }

    const input = document.getElementById('aiInput');
    if (input) {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAIMessage();
            }
        });
        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
        setTimeout(() => input.focus(), 100);
    }

    if (shouldAutoSummarize) {
        setTimeout(() => autoSummarizePost(), 300);
    }
}

function closeAIModal() {
    if (aiModal) {
        aiModal.remove();
        aiModal = null;
    }
    document.body.style.overflow = '';
}

function clearAIMessages() {
    const config = window.AI_CONFIG || {};
    const uiConfig = config.ui || {};
    const showWelcome = uiConfig.showWelcome !== false;
    const welcomeMsg = uiConfig.welcomeMessage || '你好！我是 TerminalBlog 的 AI 助手，可以帮你解答关于博客内容的问题，有什么想了解的吗？';

    aiMessages = [];
    aiHistoryVersion++;
    clearAISavedMessages();
    pendingAutoSummaries.clear();

    const msgList = document.getElementById('aiMessageList');
    if (msgList) {
        if (showWelcome) {
            msgList.innerHTML = `
                <div class="ai-welcome">
                    <div class="ai-welcome-icon">🤖</div>
                    <div class="ai-welcome-title">TerminalBlog AI</div>
                    <div class="ai-welcome-desc">${escapeHtml(welcomeMsg)}</div>
                </div>
            `;
        } else {
            msgList.innerHTML = '';
        }
    }
}

function renderMarkdownContent(content) {
    if (typeof marked !== 'undefined') {
        try {
            return marked.parse(content);
        } catch (e) {
            return '<pre style="white-space:pre-wrap;">' + escapeHtml(content) + '</pre>';
        }
    }
    return '<pre style="white-space:pre-wrap;">' + escapeHtml(content) + '</pre>';
}

function renderAIMessage(role, content, options) {
    const opts = options || {};
    const msgList = document.getElementById('aiMessageList');
    if (!msgList) return null;

    const welcome = msgList.querySelector('.ai-welcome');
    if (welcome) welcome.remove();

    const avatar = role === 'user' ? '👤' : '🤖';
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-message ' + role;

    const renderedContent = role === 'user' ? escapeHtml(content) : (opts.animate ? '' : renderMarkdownContent(content));
    msgDiv.innerHTML = `
        <div class="ai-message-avatar">${avatar}</div>
        <div class="ai-message-content">${renderedContent}</div>
    `;
    msgList.appendChild(msgDiv);
    msgList.scrollTop = msgList.scrollHeight;

    if (opts.animate && role === 'ai') {
        typeWriterEffect(msgDiv, content);
    }
    return msgDiv;
}

function addAIMessage(role, content, options) {
    const opts = options || {};
    const postId = opts.postId || (role === 'ai' && isOnPostPage() ? getActivePostId() : null);
    renderAIMessage(role, content, opts);
    if (opts.save !== false) {
        saveAIMessage(role, content, {
            postId: postId,
            summary: !!opts.summary
        });
    }
}

function showAITyping() {
    const msgList = document.getElementById('aiMessageList');
    if (!msgList) return;
    if (document.getElementById('aiTypingIndicator')) return;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-message ai';
    typingDiv.id = 'aiTypingIndicator';
    typingDiv.innerHTML = `
        <div class="ai-message-avatar">🤖</div>
        <div class="ai-message-content">
            <div class="ai-typing">
                <div class="ai-typing-dots"><span></span><span></span><span></span></div>
                <span>思考中...</span>
            </div>
        </div>
    `;
    msgList.appendChild(typingDiv);
    msgList.scrollTop = msgList.scrollHeight;
    isAiTyping = true;
}

function hideAITyping() {
    const typing = document.getElementById('aiTypingIndicator');
    if (typing) typing.remove();
    isAiTyping = false;
}

function beginAIRequest() {
    pendingAIRequests++;
    showAITyping();
}

function endAIRequest() {
    pendingAIRequests = Math.max(0, pendingAIRequests - 1);
    if (pendingAIRequests === 0) {
        hideAITyping();
    }
}

function showAIError(message) {
    const msgList = document.getElementById('aiMessageList');
    if (!msgList) return;

    const errDiv = document.createElement('div');
    errDiv.className = 'ai-error';
    errDiv.textContent = message;
    msgList.appendChild(errDiv);
    msgList.scrollTop = msgList.scrollHeight;
}

async function sendAIMessage() {
    const input = document.getElementById('aiInput');
    const sendBtn = document.getElementById('aiSendBtn');
    if (!input || !sendBtn) return;

    const content = input.value.trim();
    if (!content || isAiTyping) return;

    const config = window.AI_CONFIG || {};
    if (!config.apiKey) {
        showAIError('⚠️ AI 未配置 API Key，请在 config.js 中设置');
        return;
    }

    input.value = '';
    input.style.height = 'auto';

    addAIMessage('user', content);

    beginAIRequest();
    sendBtn.disabled = true;

    const currentPostId = isOnPostPage() ? getActivePostId() : null;
    const historyMessages = getVisibleAIMessages();
    if (historyMessages.length && historyMessages[historyMessages.length - 1].role === 'user') {
        historyMessages.pop();
    }
    const requestVersion = aiHistoryVersion;

    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: historyMessages,
                message: content,
                currentPostId: currentPostId,
                currentPage: getCurrentAIPageContext()
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showAIError('❌ ' + (data.error || '请求失败'));
            return;
        }

        if (data.error) {
            showAIError('❌ ' + data.error);
            return;
        }

        const replyText = data.reply || '抱歉，我没有理解您的问题。';
        if (requestVersion !== aiHistoryVersion) return;
        saveAIMessage('ai', replyText, { postId: currentPostId });
        renderAIMessage('ai', replyText, { animate: replyText.length >= 200 });

    } catch (err) {
        showAIError('❌ 网络错误: ' + err.message);
    } finally {
        endAIRequest();
        if (sendBtn) sendBtn.disabled = false;
        if (input) input.focus();
    }
}