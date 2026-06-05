    // ============ Init ============
    // Handle direct URL: /<ID> (numeric) - 支持任意位数的数字
    (function() {
        // 检查是否有刷新后需要恢复的状态
        var refreshState = sessionStorage.getItem('refresh_state');
        sessionStorage.removeItem('refresh_state'); // 清除状态，只使用一次
        
        if (refreshState) {
            try {
                var state = JSON.parse(refreshState);
                currentView = state.view || 'home';
                currentSlug = state.slug || null;
                currentTag = state.tag || null;
                currentPage = state.page || 1;
                return; // 已恢复状态，不需要再解析 URL
            } catch (e) {
                console.error('恢复刷新状态失败:', e);
            }
        }
        
        // 正常解析 URL
        var pathMatch = window.location.pathname.match(/^\/(\d+)\/?$/);
        if (pathMatch) {
            currentView = 'post';
            currentSlug = pathMatch[1];
        } else {
            // 解析查询参数
            var params = new URLSearchParams(window.location.search);
            var view = params.get('view');
            var tag = params.get('tag');
            if (view === 'tags') {
                currentView = 'tags';
            } else if (view === 'tag' && tag) {
                currentView = 'tag';
                currentTag = decodeURIComponent(tag);
            } else if (view === 'admin') {
                currentView = 'admin';
            } else {
                currentView = 'home';
            }
        }
    })();

    // 初始化时恢复已解锁的文章密码
    (function() {
        try {
            var stored = sessionStorage.getItem('unlocked_posts');
            if (stored) {
                unlockedPosts = JSON.parse(stored);
            }
        } catch (e) {}
    })();

    // 页面加载完成后调用 render
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            render();
        }, 100);
    });

    // ============ Renderers ============
    function setTitle(text) {
        document.getElementById('titleBar').textContent = text;
        document.title = text.split(' ~ ')[0] + ' - Terminal Blog';
    }

    function prompt(user, path, cmd) {
        return `<div class="prompt">
            <span class="user">${user}</span><span class="symbol">@</span><span class="path">${path}</span><span class="symbol">:~$</span> <span class="cmd">${cmd}</span>
        </div>`;
    }

    function separator(text) {
        if (text) return `<div class="sep"># ─── ${text} ${'─'.repeat(Math.max(1, 20 - text.length))}</div>`;
        return `<div class="sep"># ${'─'.repeat(28)}</div>`;
    }

    async function render() {
        const body = document.getElementById('termBody');
        body.innerHTML = '<div class="loading"></div>';

        try {
            switch (currentView) {
                case 'home': await renderHome(body); break;
                case 'post': await renderPost(body); break;
                case 'tag': await renderTagPosts(body); break;
                case 'tags': await renderTags(body); break;
                case 'admin': await renderAdmin(body); break;
            }
        } catch (err) {
            body.innerHTML = `
                ${prompt('hacker', 'blog', 'cat ./error.log')}
                <div class="output">
                    <p class="error-text">[ERROR] ${escapeHtml(err.message)}</p>
                    <p style="color: var(--gray); margin-top: 12px;">Try refreshing or <a href="#" onclick="navigate('home'); return false;" style="color: var(--cyan);">return home</a></p>
                </div>
            `;
        }

        // 页面渲染完成后初始化页脚
        initFooter();
        
        // 检查重复文章 ID
        checkDuplicateIds();
    }

    async function renderHome(body) {
        // 去除 ~ zsh 后缀
        // setTitle(SITE_CONFIG ? SITE_CONFIG.siteTitle + ' ~ zsh' : 'TerminalBlog ~ zsh');
        setTitle(SITE_CONFIG ? SITE_CONFIG.siteTitle : 'TerminalBlog');
        document.getElementById('statusMode').textContent = 'NORMAL';

        const [stats, posts] = await Promise.all([
            apiGet('/stats'),
            apiGet(`/posts?page=${currentPage}&limit=${POSTS_PER_PAGE}`)
        ]);

        body.innerHTML = `
            <div class="ascii-art glow">
 _____ _____ ____  __  __ ___ _   _    _    _
|_   _| ____|  _ \\|  \\/  |_ _| \\ | |  / \\  | |
  | | |  _| | |_) | |\\/| || ||  \\| | / _ \\ | |
  | | | |___|  _ <| |  | || || |\\  |/ ___ \\| |___
  |_| |_____|_| \\_\\_|  |_|___|_| \\_/_/   \\_\\_____|
            </div>

            <div class="sysinfo">
                <p><span class="highlight">$</span> uname -a</p>
                <p>TerminalBlog 1.0.0 RELEASE_X86_64 GNU/Linux UTF-8</p>
            </div>

            ${separator()}

            ${prompt('hacker', 'blog', 'cat ./welcome.txt')}
            <div class="output">
                <p style="color: var(--green);">${SITE_CONFIG ? SITE_CONFIG.welcomeMessage : '欢迎来到我的终端博客。这里用代码记录世界，用键盘书写思考。'}</p>
                <p style="color: var(--gray);">共 ${stats.totalPosts} 篇文章 · 上次更新: ${stats.lastUpdate || 'N/A'} · 运行天数: ${stats.uptime} 天</p>
            </div>

            <div class="nav-links">
                <a onclick="navigate('home')" class="active">[首页]</a>
                <a onclick="navigate('tags')">[标签]</a>
                <a onclick="openGuestUploadModal()">[上传]</a>
                <a onclick="navigate('admin')">[管理]</a>
            </div>

            ${separator('文章列表')}

            ${prompt('hacker', 'blog', 'ls -la ./posts/')}
            ${renderPostList(posts.posts)}

            ${posts.totalPages > 1 ? renderPagination(posts.page, posts.totalPages) : ''}

            ${separator('标签云')}

            ${prompt('hacker', 'blog', 'cat ./tags.json')}
            <div id="homeTags" class="tags-section">
                <span class="loading"></span>
            </div>

            ${separator('我的信息')}

            ${prompt('hacker', 'blog', 'whoami')}
            <div class="sysinfo">
                <p><span class="highlight">User:</span> <span id="clientUser">guest</span></p>
                <p id="clientIPRow" style="display:none;"><span class="highlight">IP:</span> <span id="clientIP">Loading...</span></p>
                <p id="clientBrowserRow" style="display:none;"><span class="highlight">Browser:</span> <span id="clientBrowser">Loading...</span></p>
                <p><span class="highlight">Time:</span> <span id="clientTime">Loading...</span></p>
            </div>

            ${separator('系统信息')}

            ${prompt('hacker', 'blog', 'neofetch')}
            <div class="sysinfo">
                <p><span class="warn">Storage:</span> FS</p>
                <p><span class="warn">Articles:</span> ${stats.totalPosts} posts</p>
            </div>

            ${separator()}

            <div class="prompt" style="margin-top: 16px;">
                <span class="user">hacker</span><span class="symbol">@</span><span class="path">blog</span><span class="symbol">:~$</span> <span class="cursor"></span>
            </div>
        `;

        // Load tags asynchronously
        try {
            const tagsData = await apiGet('/tags');
            const tagsEl = document.getElementById('homeTags');
            if (tagsEl) {
                tagsEl.innerHTML = tagsData.tags.map(t =>
                    `<a class="tag-item" onclick="navigate('tag', '${escapeHtml(t.name)}')">${escapeHtml(t.name)}<span class="count">(${t.count})</span></a>`
                ).join('');
            }
        } catch (e) {
            const tagsEl = document.getElementById('homeTags');
            if (tagsEl) tagsEl.innerHTML = '<p class="error-text">标签加载失败</p>';
        }

        // Load client info asynchronously
        try {
            const clientInfo = await apiGet('/client-info');
            const userEl = document.getElementById('clientUser');
            const ipEl = document.getElementById('clientIP');
            const ipRow = document.getElementById('clientIPRow');
            const timeEl = document.getElementById('clientTime');
            const browserEl = document.getElementById('clientBrowser');
            const browserRow = document.getElementById('clientBrowserRow');

            if (userEl) userEl.textContent = clientInfo.username || 'guest';

            // IP: only show if available
            if (ipEl && ipRow) {
                if (clientInfo.ip) {
                    ipEl.textContent = clientInfo.ip;
                    ipRow.style.display = '';
                } else {
                    ipRow.style.display = 'none';
                }
            }

            if (timeEl) timeEl.textContent = clientInfo.time || 'N/A';

            // Browser: get from client-side navigator
            if (browserEl && browserRow) {
                const ua = navigator.userAgent;
                if (ua) {
                    // Parse browser info
                    let browser = 'Unknown';
                    if (ua.includes('Firefox')) {
                        browser = 'Firefox ' + (ua.match(/Firefox\/(\d+)/) || ['', ''])[1];
                    } else if (ua.includes('Edg/')) {
                        browser = 'Edge ' + (ua.match(/Edg\/(\d+)/) || ['', ''])[1];
                    } else if (ua.includes('Chrome')) {
                        browser = 'Chrome ' + (ua.match(/Chrome\/(\d+)/) || ['', ''])[1];
                    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
                        browser = 'Safari ' + (ua.match(/Version\/(\d+)/) || ['', ''])[1];
                    } else if (ua.includes('Opera') || ua.includes('OPR')) {
                        browser = 'Opera';
                    }
                    browserEl.textContent = browser;
                    browserRow.style.display = '';
                } else {
                    browserRow.style.display = 'none';
                }
            }
        } catch (e) {
            const ipRow = document.getElementById('clientIPRow');
            const timeEl = document.getElementById('clientTime');
            const browserRow = document.getElementById('clientBrowserRow');
            if (ipRow) ipRow.style.display = 'none';
            if (timeEl) timeEl.textContent = 'N/A';
            if (browserRow) browserRow.style.display = 'none';
        }
    }

    function renderPostList(posts) {
        if (!posts || posts.length === 0) {
            return '<div class="output"><p style="color: var(--gray);">暂无文章</p></div>';
        }

        let html = `<div class="ls-output">
            <div class="ls-row header">
                <span>权限</span>
                <span>大小</span>
                <span>文件名</span>
                <span>日期</span>
            </div>`;

        posts.forEach(post => {
            const lockIcon = post.locked ? '🔒 ' : '';
            html += `<div class="ls-row">
                <span class="perm">${post.locked ? '🔒' : '-rw-r--r--'}</span>
                <span class="size">${post.size || '---'}</span>
                <span class="name"><a onclick="viewPost('${post.id}')">${lockIcon}${escapeHtml(post.title)}.md</a></span>
                <span class="date-col">${post.date || '--'}</span>
            </div>`;
        });

        html += '</div>';
        return html;
    }

    function renderPagination(page, totalPages) {
        let html = '<div class="pagination">';
        html += `<a onclick="goPage(${page - 1})" class="${page <= 1 ? 'disabled' : ''}">← 上一页</a>`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<a onclick="goPage(${i})" class="${i === page ? 'active' : ''}">${i}</a>`;
        }
        html += `<a onclick="goPage(${page + 1})" class="${page >= totalPages ? 'disabled' : ''}">下一页 →</a>`;
        html += '</div>';
        return html;
    }

    function goPage(page) {
        currentPage = page;
        render();
        window.scrollTo(0, 0);
    }

    function goAdminPage(page) {
        adminPage = page;
        loadAdminPosts();
    }

    async function loadAdminPosts() {
        const listEl = document.getElementById('adminPostList');
        if (!listEl) return;
        listEl.innerHTML = '<span class="loading"></span>';
        try {
            const posts = await apiGet(`/posts?page=${adminPage}&limit=${POSTS_PER_PAGE}&admin=true`);
            if (posts.posts.length === 0) {
                listEl.innerHTML = '<p style="color: var(--gray);">暂无文章</p>';
            } else {
                let html = posts.posts.map(p => {
                    const btnLabel = p.hidden ? '显示' : '隐藏';
                    const btnColor = p.hidden ? 'var(--red)' : 'var(--green)';
                    const lockBtnColor = p.locked ? 'var(--orange)' : 'var(--gray)';
                    const lockLabel = p.locked ? '🔓' : '🔒';
                    const hiddenTag = p.hidden ? '<span style="color: var(--yellow); font-size: 0.75em;">[隐藏]</span> ' : '';
                    return `<div style="padding: 6px 0; border-bottom: 1px solid rgba(48,54,61,0.5); display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            ${hiddenTag}
                            <span style="color: var(--purple); font-size: 0.75em;">#${p.id}</span>
                            ${p.locked ? '<span style="color: var(--orange); font-size: 0.75em;"> 🔒</span>' : ''}
                            <a style="color: var(--cyan); cursor: pointer; text-decoration: none; margin-left: 8px;" onclick="viewPost('${p.id}')">${escapeHtml(p.title)}</a>
                            <span style="color: var(--gray); font-size: 0.8em; margin-left: 8px;">${p.date || ''}</span>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button class="admin-btn" style="padding: 4px 8px; font-size: 0.75em;" onclick="editPost('${p.id}')" title="编辑">✏️</button>
                            <button class="admin-btn" style="padding: 4px 8px; font-size: 0.75em; color: ${btnColor}; border-color: ${btnColor};" onclick="toggleVisibility('${p.id}')" title="${btnLabel}">${p.hidden ? '👁' : '👁️'}</button>
                            <button class="admin-btn" style="padding: 4px 8px; font-size: 0.75em; color: ${lockBtnColor}; border-color: ${lockBtnColor};" onclick="showLockDialog('${p.id}', ${p.locked})" title="${p.locked ? '解锁' : '上锁'}">${lockLabel}</button>
                        </div>
                    </div>`;
                }).join('');
                if (posts.totalPages > 1) {
                    html += renderPagination(posts.page, posts.totalPages).replace(/goPage/g, 'goAdminPage');
                }
                listEl.innerHTML = html;
            }
        } catch (e) {
            listEl.innerHTML = `<p class="error-text">加载失败: ${escapeHtml(e.message)}</p>`;
        }
    }

    async function renderPost(body) {
        // 检查重复文章 ID
        checkDuplicateIds();
        
        // currentSlug now always contains the post ID
        var post;
        try {
            // If post was previously unlocked, pass password to get full content
            var unlockPassword = unlockedPosts[currentSlug];
            if (unlockPassword) {
                post = await apiGet('/post/' + currentSlug, {
                    headers: { 'X-Unlock-Password': unlockPassword }
                });
            } else {
                post = await apiGet('/post/' + currentSlug);
            }
        } catch (err) {
            // Post not found, redirect to home
            showToast('文章不存在或已被删除', 'error');
            navigate('home');
            return;
        }

        // 已上锁且服务端未返回正文：弹出密码框（直接访问 /文章ID 也生效）
        if (post.locked && !post.content) {
            // setTitle(`${post.title} ~ blog`);
            // 去除 ~ blog 后缀
            setTitle(post.title);
            updatePostUrl(post.id || currentSlug);
            showLockPasswordPrompt(currentSlug, post.title);
            body.innerHTML = `
                ${prompt('hacker', 'blog', `cat ./posts/${currentSlug}.md`)}
                <div class="nav-links">
                    <a onclick="navigate('home')">[← 返回首页]</a>
                </div>
                <div class="post-detail" style="padding: 32px; text-align: center;">
                    <p style="color: var(--orange); font-size: 1.1em;">🔒 此文已上锁</p>
                    <p style="color: var(--gray); margin-top: 12px;">请输入解锁密码后查看正文。</p>
                </div>
            `;
            return;
        }

        // setTitle(`${post.title} ~ blog`);
        // 去除 ~ blog 后缀
        setTitle(post.title);
        document.getElementById('statusMode').textContent = 'INSERT';

        const tags = (post.tags || []).map(t => `<span class="tag">[${escapeHtml(t)}]</span>`).join(' · ');
        const postId = post.id || '';
        const shareUrl = postId ? `${window.location.origin}/${postId}` : '';

        // Update browser URL to /<ID>/
        updatePostUrl(postId);

        body.innerHTML = `
            ${prompt('hacker', 'blog', `cat ./posts/${postId}.md`)}

            <div class="nav-links">
                <a onclick="navigate('home')">[← 返回首页]</a>
                <a onclick="navigate('tags')">[标签]</a>
                ${shareUrl ? `<a onclick="var self=this; copyTextToClipboard('${shareUrl}').then(function(){ self.textContent='[✓ 已复制链接]'; setTimeout(function(){ self.textContent='[📋 复制分享链接]' }, 1500); }).catch(function(){ showToast('复制失败', 'error'); });" style="color: var(--yellow);">[📋 复制分享链接]</a>` : ''}
            </div>

            <div class="post-detail">
                <div class="file-header">
                    <span class="filename">${postId}.md</span>
                    <span class="lang">ID: ${postId}${post.locked ? ' 🔒' : ''}</span>
                </div>
                <div class="file-body">
                    <h2 class="glow"># ${escapeHtml(post.title)}</h2>
                    <div class="meta-line">
                        ${tags}${tags ? ' · ' : ''}发表于 <span class="date-highlight">${post.date || 'N/A'}</span> · 阅读约 ${post.readTime || '?'} 分钟
                        ${shareUrl ? ` · <span style="color: var(--purple);">🔗 ${shareUrl}</span>` : ''}
                    </div>
                    <div class="post-content">
                        ${parseMarkdown(post.content || '')}
                    </div>
                </div>
            </div>

            ${separator()}

            <div class="prompt" style="margin-top: 16px;">
                <span class="user">hacker</span><span class="symbol">@</span><span class="path">blog</span><span class="symbol">:~$</span> <span class="cursor"></span>
            </div>
        `;
    }

    async function renderTagPosts(body) {
        // setTitle(`${currentTag || '全部标签'} ~ blog`);
        // 去除 ~ blog 后缀
        setTitle(currentTag || '全部标签');
        document.getElementById('statusMode').textContent = 'NORMAL';

        const posts = await apiGet(`/posts?tag=${encodeURIComponent(currentTag || '')}&page=${currentPage}&limit=${POSTS_PER_PAGE}`);

        body.innerHTML = `
            ${prompt('hacker', 'blog', `grep -r "${escapeHtml(currentTag)}" ./posts/`)}

            <div class="nav-links">
                <a onclick="navigate('home')">[首页]</a>
                <a onclick="navigate('tags')" class="active">[标签]</a>
                <a onclick="openGuestUploadModal()">[上传]</a>
                <a onclick="navigate('admin')">[管理]</a>
            </div>

            ${separator(`标签: ${currentTag}`)}

            ${renderPostList(posts.posts)}

            ${posts.totalPages > 1 ? renderPagination(posts.page, posts.totalPages) : ''}

            ${separator()}

            <div class="prompt" style="margin-top: 16px;">
                <span class="user">hacker</span><span class="symbol">@</span><span class="path">blog</span><span class="symbol">:~$</span> <span class="cursor"></span>
            </div>
        `;
    }

    async function renderTags(body) {
        // setTitle('tags ~ blog');
        // 去除 ~ blog 后缀
        setTitle('tags');
        document.getElementById('statusMode').textContent = 'NORMAL';

        const tagsData = await apiGet('/tags');

        let tagsHtml = tagsData.tags.map(t =>
            `<a class="tag-item" onclick="navigate('tag', '${escapeHtml(t.name)}')">${escapeHtml(t.name)}<span class="count">(${t.count})</span></a>`
        ).join('');

        body.innerHTML = `
            ${prompt('hacker', 'blog', 'cat ./tags.json')}

            <div class="nav-links">
                <a onclick="navigate('home')">[首页]</a>
                <a onclick="navigate('tags')" class="active">[标签]</a>
                <a onclick="openGuestUploadModal()">[上传]</a>
                <a onclick="navigate('admin')">[管理]</a>
            </div>

            ${separator('全部标签')}

            <div class="tags-section">
                ${tagsHtml || '<p style="color: var(--gray);">暂无标签</p>'}
            </div>

            ${separator()}

            <div class="prompt" style="margin-top: 16px;">
                <span class="user">hacker</span><span class="symbol">@</span><span class="path">blog</span><span class="symbol">:~$</span> <span class="cursor"></span>
            </div>
        `;
    }

    async function renderAdmin(body) {
        // setTitle('admin ~ blog');
        // 去除 ~ blog 后缀
        setTitle('admin');
        document.getElementById('statusMode').textContent = 'ADMIN';

        // Check if logged in
        const authenticated = await checkAuth();

        if (!authenticated) {
            // Show login form
            body.innerHTML = `
                ${prompt('hacker', 'blog', 'sudo ./admin-panel')}

                <div class="nav-links">
                    <a onclick="navigate('home')">[首页]</a>
                    <a onclick="navigate('tags')">[标签]</a>
                    <a onclick="navigate('admin')" class="active">[管理]</a>
                </div>

                ${separator('身份验证')}

                <div class="ascii-art" style="font-size: 0.6em; line-height: 1.3;">
 ╔╗ ╦  ╔═╗╔═╗   ╔╦╗╔═╗╔╗╔╔═╗╔═╗╔═╗
 ╠╩╗║  ║ ║║ ╦   ║║║╠═╣║║║╠═╣║ ╦║╣
 ╚═╝╩═╝╚═╝╚═╝   ╩ ╩╩ ╩╝╚╝╩ ╩╚═╝╚═╝
                </div>

                <div class="output">
                    <p style="color: var(--yellow);">⚠ 需要管理员身份验证才能访问管理面板</p>
                    <p style="color: var(--gray); font-size: 0.8em;">请输入管理员帐号和密码以继续</p>
                </div>

                <div class="admin-section" style="max-width: 400px;">
                    <label>用户名</label>
                    <input type="text" id="loginUser" placeholder="admin"
                           onkeydown="if(event.key==='Enter') document.getElementById('loginPass').focus()" />

                    <label>密码</label>
                    <input type="password" id="loginPass" placeholder="••••••••"
                           onkeydown="if(event.key==='Enter') doLogin()" />

                    <div style="margin-top: 12px;">
                        <button class="admin-btn" onclick="doLogin()">🔑 登录</button>
                    </div>
                </div>

                ${separator()}

                <div class="prompt" style="margin-top: 16px;">
                    <span class="user">hacker</span><span class="symbol">@</span><span class="path">blog</span><span class="symbol">:~$</span> <span class="cursor"></span>
                </div>
            `;
            return;
        }

        // Show admin panel (authenticated)
        body.innerHTML = `
            ${prompt('hacker', 'blog', 'sudo ./admin-panel')}

            <div class="nav-links">
                <a onclick="navigate('home')">[首页]</a>
                <a onclick="navigate('tags')">[标签]</a>
                <a onclick="openFileManager()">[文件管理]</a>
                <a onclick="openGitSyncModal()">[远程仓库]</a>
                <a onclick="doLogout()" style="color: var(--red);" class="nav-break">[退出登录]</a>
            </div>

            ${separator('博客管理面板')}

            <div class="output">
                <p style="color: var(--green);">✅ 已登录为: <span style="color: var(--cyan);">${escapeHtml(authUser || 'admin')}</span></p>
            </div>

            <div class="admin-section">
                <input type="hidden" id="adminId" />

                <label>标题</label>
                <input type="text" id="adminTitle" placeholder="文章标题" />

                <label>标签 (逗号分隔，如: 技术,教程,Linux)</label>
                <input type="text" id="adminTags" placeholder="技术, 教程" />

                <label style="position: relative;">内容 (Markdown 格式)
                    <span id="fullscreenBtn" onclick="toggleFullscreen()" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--gray); font-size: 1.2em; padding: 4px;" onmouseover="this.style.color='var(--green)'" onmouseout="this.style.color='var(--gray)'">⛶</span>
                </label>
                <textarea id="adminContent" placeholder="# 我的文章标题\n\n文章内容..." style="padding-right: 40px;"></textarea>

                <div style="margin-top: 12px; display: flex; gap: 12px;">
                    <button class="admin-btn cyan" onclick="previewPost()">👁️ 预览</button>
                    <button class="admin-btn" onclick="savePost()">💾 发布</button>
                    <button class="admin-btn danger" onclick="deletePost()">🗑️ 删除</button>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin: 16px 0;">
                <div style="color: var(--gray-dim); font-size: 0.85em;"># ${'─'.repeat(4)} 已有文章 ${'─'.repeat(15)}</div>
                <div style="display: flex; gap: 8px;">
                    <button class="admin-btn" style="padding: 4px 10px; font-size: 0.75em; color: var(--cyan); border-color: var(--cyan);" onclick="document.getElementById('importFile').click()" title="导入">↙️</button>
                    <button class="admin-btn" style="padding: 4px 10px; font-size: 0.75em;" onclick="exportPosts()" title="导出">↗️</button>
                    <input type="file" id="importFile" accept=".zip,.md,.tar,.gz" style="display:none;" onchange="importPosts(event)" />
                </div>
            </div>

            <div id="adminPostList">
                <span class="loading"></span>
            </div>

            ${separator()}

            <div class="prompt" style="margin-top: 16px;">
                <span class="user">hacker</span><span class="symbol">@</span><span class="path">blog</span><span class="symbol">:~$</span> <span class="cursor"></span>
            </div>
        `;

        // Load posts for admin (paginated)
        adminPage = 1;
        loadAdminPosts();
    }

    async function savePost() {
        const title = document.getElementById('adminTitle').value.trim();
        const tags = document.getElementById('adminTags').value.trim();
        const content = document.getElementById('adminContent').value;
        const id = document.getElementById('adminId').value.trim();

        if (!title || !content) {
            showToast('[ERROR] 标题和内容不能为空', 'error');
            return;
        }

        const postData = {
            title,
            tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            content
        };

        try {
            let result;
            if (id) {
                // Update existing post
                result = await apiPut('/post/' + id, postData);
                showToast('✅ ' + (result.message || '更新成功'), 'success');
            } else {
                // Create new post
                result = await apiPost('/post', postData);
                showToast('✅ ' + (result.message || '保存成功') + ' (ID: ' + result.id + ')', 'success');
            }
            // Refresh admin post list
            navigate('admin');
        } catch (err) {
            showToast('[ERROR] ' + escapeHtml(err.message), 'error');
        }
    }

    async function deletePost() {
        const id = document.getElementById('adminId').value.trim();

        if (!id) {
            showToast('[ERROR] 请先在列表中选择要删除的文章', 'error');
            return;
        }

        showToast('确认删除文章 ID "' + id + '"？', 'info', [
            { label: '确认', confirm: true, action: function() { doDeletePost(id); } },
            { label: '取消', action: function() {} }
        ]);
    }

    async function doDeletePost(id) {
        try {
            const result = await apiDelete('/post/' + id);
            showToast('✅ ' + (result.message || '删除成功'), 'success');
            // Clear form and refresh
            document.getElementById('adminId').value = '';
            document.getElementById('adminTitle').value = '';
            document.getElementById('adminTags').value = '';
            document.getElementById('adminContent').value = '';
            navigate('admin');
        } catch (err) {
            showToast('[ERROR] ' + escapeHtml(err.message), 'error');
        }
    }

    // View post - check if locked first, show password prompt if needed
    async function viewPost(id) {
        try {
            const post = await apiGet('/post/' + id);
            if (post.locked) {
                showLockPasswordPrompt(id, post.title);
            } else {
                navigate('post', id);
            }
        } catch (err) {
            showToast('[ERROR] ' + escapeHtml(err.message), 'error');
        }
    }

    // Lock password prompt overlay
    function showLockPasswordPrompt(id, title) {
        var overlay = document.createElement('div');
        overlay.className = 'preview-overlay';
        overlay.id = 'lockOverlay';
        overlay.innerHTML =
            '<div class="terminal" style="margin: 30px auto; max-width: 400px;">' +
                '<div class="title-bar">' +
                    '<div class="dot red"></div>' +
                    '<div class="dot yellow"></div>' +
                    '<div class="dot green"></div>' +
                    '<div class="title">🔒 文章已锁定</div>' +
                '</div>' +
                '<div class="term-body">' +
                    '<p style="color: var(--yellow); margin-bottom: 16px;">🔒 <strong>' + escapeHtml(title) + '</strong> 已锁定</p>' +
                    '<p style="color: var(--gray); margin-bottom: 16px;">请输入解锁密码</p>' +
                    '<input type="text" id="lockPasswordInput" placeholder="输入密码..." ' +
                        'style="width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: 4px; font-family: inherit; margin-bottom: 12px;" ' +
                        'onfocus="this.removeAttribute(\'readonly\'); this.value = \'\'; this.type = \'password\'" readonly ' +
                        'onkeydown="if(event.key===\'Enter\') verifyLockPassword()" />' +
                    '<div style="display: flex; gap: 8px;">' +
                        '<button onclick="verifyLockPassword()" style="background: var(--bg-header); color: var(--green); border: 1px solid var(--green); padding: 8px 16px; border-radius: 4px; font-family: inherit; cursor: pointer;">解锁</button>' +
                        '<button onclick="closeLockPrompt()" style="background: var(--bg-header); color: var(--gray); border: 1px solid var(--border); padding: 8px 16px; border-radius: 4px; font-family: inherit; cursor: pointer;">取消</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        window.lockPostId = id;
        // Focus and clear
        setTimeout(function() {
            var input = document.getElementById('lockPasswordInput');
            if (input) {
                input.removeAttribute('readonly');
                input.value = '';
                input.type = 'password';
                input.focus();
            }
        }, 100);
    }

    function closeLockPrompt() {
        var overlay = document.getElementById('lockOverlay');
        if (overlay) overlay.remove();
        window.lockPostId = null;
    }

    async function verifyLockPassword() {
        var password = document.getElementById('lockPasswordInput').value;
        var id = window.lockPostId;
        if (!id || !password) return;

        try {
            var res = await fetch('/api/post/' + id + '/verify-lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            });
            var data = await res.json();
            if (data.valid) {
                // Mark post as unlocked in session storage
                unlockedPosts[id] = password;
                sessionStorage.setItem('unlocked_posts', JSON.stringify(unlockedPosts));
                closeLockPrompt();
                navigate('post', id);
            } else {
                showToast('❌ 密码错误', 'error');
            }
        } catch (err) {
            showToast('[ERROR] ' + err.message, 'error');
        }
    }

    // Show lock dialog or directly unlock
    function showLockDialog(id, isLocked) {
        if (isLocked) {
            // Directly unlock without confirmation
            unlockPost(id);
        } else {
            // Show lock password input
            var overlay = document.createElement('div');
            overlay.className = 'preview-overlay';
            overlay.id = 'lockDialogOverlay';
            overlay.innerHTML =
                '<div class="terminal" style="margin: 30px auto; max-width: 400px;">' +
                    '<div class="title-bar">' +
                        '<div class="dot red"></div>' +
                        '<div class="dot yellow"></div>' +
                        '<div class="dot green"></div>' +
                        '<div class="title">🔒 设置文章密码</div>' +
                    '</div>' +
                    '<div class="term-body">' +
                        '<p style="color: var(--yellow); margin-bottom: 16px;">设置解锁密码</p>' +
                        '<input type="text" id="lockNewPassword" placeholder="输入密码..." ' +
                            'style="width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: 4px; font-family: inherit; margin-bottom: 12px;" ' +
                            'onfocus="this.removeAttribute(\'readonly\'); this.value = \'\'; this.type = \'password\'" readonly />' +
                        '<input type="text" id="lockNewPasswordConfirm" placeholder="确认密码..." ' +
                            'style="width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: 4px; font-family: inherit; margin-bottom: 12px;" ' +
                            'onfocus="this.removeAttribute(\'readonly\'); this.value = \'\'; this.type = \'password\'" readonly />' +
                        '<div style="display: flex; gap: 8px;">' +
                            '<button onclick="lockPost(' + id + ')" style="background: var(--bg-header); color: var(--orange); border: 1px solid var(--orange); padding: 8px 16px; border-radius: 4px; font-family: inherit; cursor: pointer;">上锁</button>' +
                            '<button onclick="closeLockDialog()" style="background: var(--bg-header); color: var(--gray); border: 1px solid var(--border); padding: 8px 16px; border-radius: 4px; font-family: inherit; cursor: pointer;">取消</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(overlay);
            // Focus first input
            setTimeout(function() {
                var input = document.getElementById('lockNewPassword');
                if (input) {
                    input.removeAttribute('readonly');
                    input.value = '';
                    input.type = 'password';
                    input.focus();
                }
            }, 100);
        }
    }

    function closeLockDialog() {
        var overlay = document.getElementById('lockDialogOverlay');
        if (overlay) overlay.remove();
    }

    async function lockPost(id) {
        var password = document.getElementById('lockNewPassword').value;
        var confirm = document.getElementById('lockNewPasswordConfirm').value;

        if (!password) {
            showToast('请输入密码', 'error');
            return;
        }
        if (password !== confirm) {
            showToast('两次密码不一致', 'error');
            return;
        }

        try {
            var res = await apiPost('/post/' + id + '/lock', { password: password });
            showToast('✅ 文章已上锁', 'success');
            closeLockDialog();
            loadAdminPosts();
        } catch (err) {
            showToast('[ERROR] ' + err.message, 'error');
        }
    }

    async function unlockPost(id) {
        try {
            var res = await apiPost('/post/' + id + '/unlock', {});
            showToast('✅ 文章已解锁', 'success');
            loadAdminPosts();
        } catch (err) {
            showToast('[ERROR] ' + err.message, 'error');
        }
    }

    async function editPost(id) {
        try {
            // For admin users, fetch full content even for locked posts
            const post = await apiGet('/post/' + id, {
                headers: authToken ? { 'Authorization': 'Bearer ' + authToken } : {}
            });
            document.getElementById('adminId').value = post.id || '';
            document.getElementById('adminTitle').value = post.title || '';
            document.getElementById('adminTags').value = (post.tags || []).join(', ');
            document.getElementById('adminContent').value = post.content || '';
            showToast('📝 已加载文章: ' + escapeHtml(post.title), 'info');
            window.scrollTo(0, 0);
        } catch (err) {
            showToast('[ERROR] ' + escapeHtml(err.message), 'error');
        }
    }

    // ============ Preview Post ============
    function previewPost() {
        var id = document.getElementById('adminId').value.trim();
        var title = document.getElementById('adminTitle').value.trim() || '未命名文章';
        var tagsStr = document.getElementById('adminTags').value.trim();
        var content = document.getElementById('adminContent').value || '';
        var tags = tagsStr ? tagsStr.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [];
        var htmlContent = parseMarkdown(content);
        var today = new Date().toISOString().split('T')[0];
        var readTime = Math.max(1, Math.ceil(content.length / 500));
        var tagsHtml = tags.map(function(t) { return '<span class="tag">[' + escapeHtml(t) + ']</span>'; }).join(' · ');
        var displayId = id || 'new';

        var overlay = document.createElement('div');
        overlay.className = 'preview-overlay';
        overlay.id = 'previewOverlay';
        overlay.innerHTML =
            '<div class="terminal" style="margin: 0 auto;">' +
                '<div class="title-bar">' +
                    '<div class="dot red"></div>' +
                    '<div class="dot yellow"></div>' +
                    '<div class="dot green"></div>' +
                    '<div class="title">预览模式 ~ ' + escapeHtml(title) + '</div>' +
                '</div>' +
                '<div class="term-body">' +
                    prompt('hacker', 'blog', 'cat ./posts/' + displayId + '.md') +
                    '<div class="nav-links">' +
                        '<a onclick="closePreview()" style="color: var(--cyan);">[← 返回编辑]</a>' +
                        '<span style="color: var(--yellow); font-size: 0.85em;">⬆ 这是预览模式，文章尚未发布</span>' +
                    '</div>' +
                    '<div class="post-detail">' +
                        '<div class="file-header">' +
                            '<span class="filename">' + displayId + '.md</span>' +
                            '<span class="lang">预览</span>' +
                        '</div>' +
                        '<div class="file-body">' +
                            '<h2 class="glow"># ' + escapeHtml(title) + '</h2>' +
                            '<div class="meta-line">' +
                                tagsHtml + (tagsHtml ? ' · ' : '') +
                                '发表于 <span class="date-highlight">' + today + '</span>' +
                                ' · 阅读约 ' + readTime + ' 分钟' +
                            '</div>' +
                            '<div class="post-content">' +
                                (htmlContent || '<p style="color: var(--gray);">暂无内容</p>') +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    separator() +
                    '<div class="prompt" style="margin-top: 16px;">' +
                        '<span class="user">hacker</span><span class="symbol">@</span><span class="path">blog</span><span class="symbol">:~$</span> <span class="cursor"></span>' +
                    '</div>' +
                '</div>' +
                '<div class="status-bar">' +
                    '<div><span class="branch">⎇ main</span> · TerminalBlog</div>' +
                    '<div><span class="mode" style="color: var(--yellow);">PREVIEW</span> · utf-8 · markdown</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        overlay.scrollTop = 0;
    }

    function closePreview() {
        var overlay = document.getElementById('previewOverlay');
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }

    // ============ Fullscreen Editor ============
    function toggleFullscreen() {
        var existingOverlay = document.getElementById('fullscreenOverlay');
        if (existingOverlay) {
            // Exit fullscreen - restore content
            var textarea = document.getElementById('adminContent');
            var fullscreenTextarea = document.getElementById('fullscreenTextarea');
            if (textarea && fullscreenTextarea) {
                textarea.value = fullscreenTextarea.value;
            }
            document.body.removeChild(existingOverlay);
            return;
        }

        // Enter fullscreen
        var textarea = document.getElementById('adminContent');
        var content = textarea ? textarea.value : '';

        var overlay = document.createElement('div');
        overlay.className = 'fullscreen-overlay';
        overlay.id = 'fullscreenOverlay';
        overlay.innerHTML =
            '<div class="fullscreen-container">' +
                '<div class="fullscreen-header">' +
                    '<span>📝 全屏编辑模式 - 按 Esc 或点击退出</span>' +
                    '<button onclick="toggleFullscreen()">✕ 退出</button>' +
                '</div>' +
                '<textarea id="fullscreenTextarea" placeholder="# 文章内容...">' + escapeHtml(content) + '</textarea>' +
            '</div>';

        document.body.appendChild(overlay);

        // Focus textarea
        setTimeout(function() {
            var ta = document.getElementById('fullscreenTextarea');
            if (ta) {
                ta.focus();
                // Move cursor to end
                ta.selectionStart = ta.selectionEnd = ta.value.length;
            }
        }, 100);

        // Handle Escape key
        document.addEventListener('keydown', exitFullscreenOnEscape);
    }

    function exitFullscreenOnEscape(e) {
        if (e.key === 'Escape') {
            toggleFullscreen();
            document.removeEventListener('keydown', exitFullscreenOnEscape);
        }
    }

    // ============ Toggle Visibility ============
    async function toggleVisibility(id) {
        try {
            const result = await apiPost('/post/' + id + '/toggle', {});
            showToast('✅ 状态已切换', 'success');
            loadAdminPosts();
        } catch (err) {
            showToast('[ERROR] ' + err.message, 'error');
        }
    }

