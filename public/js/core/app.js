    // ============ State & Routing ============
    let currentView = 'home';
    let currentSlug = null;
    let currentTag = null;
    let currentPage = 1;
    let adminPage = 1;
    const POSTS_PER_PAGE = 10;
    
    // ============ 返回状态管理 ============
    // 用于记录进入文章详情页之前的页面状态，实现"返回上一页"功能
    let previousView = 'home';  // 之前的视图 (home, tag, admin)
    let previousTag = null;     // 之前的标签
    let previousPage = 1;       // 之前的页码
    let previousAdminPage = 1;  // 之前的管理页页码

    // ============ URL 管理 ============
    function updateUrl() {
        var newUrl = '/';
        if (currentView === 'post' && currentSlug) {
            // Will be updated after post loads when we have the ID
        } else if (currentView === 'tag' && currentTag) {
            newUrl = '/?view=tag&tag=' + encodeURIComponent(currentTag);
        } else if (currentView === 'tags') {
            newUrl = '/?view=tags';
        } else if (currentView === 'admin') {
            newUrl = '/?view=admin';
        }
        history.pushState(null, '', newUrl);
    }

    function updatePostUrl(postId) {
        if (postId) {
            history.replaceState(null, '', '/' + postId + '/');
        }
    }

    // ============ 弹窗检测函数 ============
    function hasActiveModal() {
        return !!(
            aiModal ||
            document.getElementById('gitSyncModal') ||
            document.getElementById('fileManagerModal') ||
            document.getElementById('guestUploadModal') ||
            document.getElementById('previewOverlay') ||
            document.getElementById('lockOverlay') ||
            document.getElementById('lockDialogOverlay') ||
            document.getElementById('fullscreenOverlay') ||
            document.getElementById('uploadCodePromptOverlay')
        );
    }
    
    // 获取当前页面应该显示的 URL
    function getExpectedUrl() {
        if (currentView === 'post' && currentSlug) {
            return '/' + currentSlug + '/';
        } else if (currentView === 'tag' && currentTag) {
            return '/?view=tag&tag=' + encodeURIComponent(currentTag);
        } else if (currentView === 'tags') {
            return '/?view=tags';
        } else if (currentView === 'admin') {
            return '/?view=admin';
        }
        return '/';
    }
    
    // ============ 关闭所有弹窗函数 ============
    function closeAllModals() {
        // 关闭 AI 弹窗
        if (aiModal) {
            closeAIModal();
        }
        // 关闭 Git Sync 弹窗
        var gitModal = document.getElementById('gitSyncModal');
        if (gitModal) {
            closeGitSyncModal();
        }
        // 关闭文件管理器
        var fileModal = document.getElementById('fileManagerModal');
        if (fileModal) {
            closeFileManager();
        }
        // 关闭游客上传弹窗
        var guestModal = document.getElementById('guestUploadModal');
        if (guestModal) {
            closeGuestUploadModal();
        }
        // 关闭预览
        var preview = document.getElementById('previewOverlay');
        if (preview && preview.parentNode) {
            preview.parentNode.removeChild(preview);
        }
        // 关闭锁定提示
        var lockOverlay = document.getElementById('lockOverlay');
        if (lockOverlay) {
            closeLockPrompt();
        }
        // 关闭锁定对话框
        var lockDialog = document.getElementById('lockDialogOverlay');
        if (lockDialog) {
            closeLockDialog();
        }
        // 关闭全屏编辑
        var fullscreen = document.getElementById('fullscreenOverlay');
        if (fullscreen) {
            toggleFullscreen();
        }
        // 关闭上传码提示
        var uploadPrompt = document.getElementById('uploadCodePromptOverlay');
        if (uploadPrompt) {
            closeUploadCodePrompt();
        }
        // 恢复背景滚动
        document.body.style.overflow = '';
    }

    // ============ Check for duplicate post IDs ============
    let duplicateCheckDone = false;
    async function checkDuplicateIds() {
        if (duplicateCheckDone) return;
        duplicateCheckDone = true;
        
        try {
            const res = await fetch('/api/check-duplicates');
            const data = await res.json();
            
            if (data.hasDuplicates) {
                const dupList = data.duplicates.map(d => {
                    const shortTitles = d.posts.map(p => p.title.charAt(0) + '...');
                    return 'ID ' + d.id + ': ' + shortTitles.join(', ');
                }).join('\n');
                showToast('⚠️ 发现重复文章 ID，请联系管理员处理！\n' + dupList, 'error');
            }
        } catch (err) {
            console.error('Failed to check duplicates:', err);
        }
    }

    // ============ 浏览器后退/前进按钮支持 ============
    window.addEventListener('popstate', function(e) {
        // 如果有弹窗打开，优先关闭弹窗并恢复 URL，不执行页面返回
        if (hasActiveModal()) {
            closeAllModals();
            // 恢复 URL 到当前页面应有的状态
            var expectedUrl = getExpectedUrl();
            history.replaceState(null, '', expectedUrl);
            return;
        }
        
        var path = window.location.pathname;
        var search = window.location.search;
        
        // 解析 URL 并恢复对应视图
        var postMatch = path.match(/^\/(\d+)\/?$/);
        var params = new URLSearchParams(search);
        var view = params.get('view');
        var tag = params.get('tag');
        
        if (postMatch) {
            // 文章详情页
            var postId = postMatch[1];
            currentView = 'post';
            currentSlug = postId;
            render();
        } else if (view === 'tags') {
            // 标签列表页
            currentView = 'tags';
            currentTag = null;
            render();
        } else if (view === 'tag' && tag) {
            // 标签筛选页
            currentView = 'tag';
            currentTag = decodeURIComponent(tag);
            render();
        } else if (view === 'admin') {
            // 管理后台
            currentView = 'admin';
            currentTag = null;
            render();
        } else {
            // 首页
            currentView = 'home';
            currentTag = null;
            currentSlug = null;
            render();
        }
        
        window.scrollTo(0, 0);
    });

    // ============ Auth State ============
    let authToken = localStorage.getItem('blog_token') || null;
    let authUser = localStorage.getItem('blog_user') || null;

    // Store unlocked post IDs in session storage
    let unlockedPosts = JSON.parse(sessionStorage.getItem('unlocked_posts') || '{}');

    function navigate(view, param) {
        // 进入文章详情页之前，保存当前页面状态
        if (view === 'post') {
            previousView = currentView;
            previousTag = currentTag;
            previousPage = currentPage;
            // 保存管理页的页码
            if (currentView === 'admin') {
                previousAdminPage = adminPage;
            }
        }
        
        if (view === 'home') {
            currentView = 'home';
            currentSlug = null;
            currentTag = null;
            currentPage = 1;
        } else if (view === 'post') {
            currentView = 'post';
            currentSlug = param;
        } else if (view === 'tag') {
            currentView = 'tag';
            currentTag = param;
            currentPage = 1;
        } else if (view === 'tags') {
            currentView = 'tags';
        } else if (view === 'admin') {
            currentView = 'admin';
        }
        updateUrl();
        window.scrollTo(0, 0);
        render();
    }
    
    // ============ 返回上一页功能 ============
    function goBack() {
        if (previousView === 'tag' && previousTag) {
            // 返回到标签筛选页
            currentView = 'tag';
            currentTag = previousTag;
            currentPage = previousPage;
        } else if (previousView === 'admin') {
            // 返回到管理页，保持之前的页码
            currentView = 'admin';
            currentTag = null;
            currentSlug = null;
            adminPage = previousAdminPage;
        } else {
            // 默认返回首页
            currentView = 'home';
            currentTag = null;
            currentSlug = null;
            currentPage = previousPage > 1 ? previousPage : 1;
        }
        updateUrl();
        window.scrollTo(0, 0);
        render();
    }

