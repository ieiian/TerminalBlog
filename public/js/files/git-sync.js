// ============ 远程 Git 仓库同步管理器 ============
let isSyncing = false; // 是否正在执行 Git 动作
let gitHasSavedPatToken = false;
let gitLoadedRepositoryUrl = '';
let gitLastSshRepositoryUrl = '';
let gitLastHttpsRepositoryUrl = '';

async function openGitSyncModal() {
    var modal = document.createElement('div');
    modal.className = 'git-sync-modal';
    modal.id = 'gitSyncModal';
    modal.innerHTML = 
        '<div class="git-sync-container">' +
            '<div class="git-sync-header">' +
                '<span>⚡ 远程 Git 仓库同步控制台</span>' +
                '<button onclick="closeGitSyncModal()">✕ 关闭</button>' +
            '</div>' +
            '<div class="git-sync-body">' +
                '<div class="git-grid">' +
                    '<!-- 设置面板 -->'+
                    '<div class="git-panel">' +
                        '<div class="git-panel-title">⚙️ 仓库配置</div>' +
                        '<div class="git-form-group">' +
                            '<label>GitHub 用户名 (Username, 非注册邮箱)</label>' +
                            '<input type="text" id="gitUser" placeholder="例如: your-github-username (请勿输入注册邮箱)" />' +
                        '</div>' +
                        '<div class="git-form-group">' +
                            '<label>仓库远程 URL (公共 HTTPS / SSH / 私有 HTTPS+PAT)</label>' +
                            '<input type="text" id="gitRepoUrl" placeholder="https://github.com/user/repo.git 或 git@github.com:user/repo.git" oninput="detectRepoType(this.value)" />' +
                            '<div class="git-btn-row" id="gitRepoUrlSwitchRow" style="display:none; margin-top: 8px;">' +
                                '<button class="git-btn full" id="gitUseLastHttpsBtn" onclick="useSavedRepoUrl(\'https\')" style="display:none;">使用上次 HTTPS</button>' +
                                '<button class="git-btn full" id="gitUseLastSshBtn" onclick="useSavedRepoUrl(\'ssh\')" style="display:none;">使用上次 SSH</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="git-form-group" id="gitPatGroup">' +
                            '<label>Personal Access Token (仅私有 HTTPS 仓库需要)</label>' +
                            '<input type="password" id="gitPatToken" autocomplete="off" placeholder="公共仓库留空；已保存的 Token 不会回显" />' +
                            '<div style="color: var(--gray-dim); font-size: 0.7em; margin-top: 6px; line-height: 1.4;">' +
                                'GitHub HTTPS 已不支持账号密码登录。公共仓库无需凭据；私有 HTTPS 仓库请填写具备仓库读写权限的 PAT；SSH 仓库请使用下方部署公钥。若 GitHub 仓库需要走代理，请使用 HTTPS 地址，SSH 不走此 HTTP 代理。' +
                            '</div>' +
                        '</div>' +
                        '<div class="git-form-group">' +
                            '<label>同步分支名称 (Branch)</label>' +
                            '<input type="text" id="gitBranch" placeholder="例如: markdown (默认)" />' +
                        '</div>' +
                        '<!-- 专属 SSH 公钥折叠触发条 -->' +
                        '<div id="gitSshTrigger" class="git-ssh-trigger" style="display:none;" onclick="toggleSshCollapse()">' +
                            '<span>🛡️ 查看本博客专属 SSH 部署公钥</span>' +
                            '<span class="icon">▶</span>' +
                        '</div>' +
                        '<!-- 专属 SSH 公钥折叠详细区域 -->' +
                        '<div id="gitSshArea" style="display:none; margin-top: 10px; border-top: 1px dashed rgba(0, 255, 255, 0.1); padding-top: 10px;">' +
                            '<label style="color: var(--cyan); font-size: 0.75em;">🛡️ 本博客专属 SSH 部署公钥 (已隔离防护):</label>' +
                            '<div class="git-ssh-key-box" id="gitSshKey">正在生成专属密钥对...</div>' +
                            '<div class="git-btn-row" style="margin-top: 8px;">' +
                                '<button class="git-btn primary full" onclick="copySshPublicKey()">📋 复制专属公钥</button>' +
                                '<button class="git-btn warning full" onclick="confirmRefreshSshKey()">刷新 SSH Key</button>' +
                            '</div>' +
                            '<div style="color: var(--gray-dim); font-size: 0.7em; margin-top: 6px; line-height: 1.4;">' +
                                '提示：对于私有仓库，请将此专属公钥添加至：<br/>' +
                                '1. <strong>仓库级（安全推荐）</strong>：该仓库的 <strong>Settings ➔ Deploy Keys</strong> 中（须勾选 <strong>Allow write access</strong> 启用写入权限）。<br/>' +
                                '2. <strong>账户级（全仓库通用）</strong>：您个人 GitHub 的 <strong>Settings ➔ SSH keys</strong> 中。<br/>' +
                                '刷新 SSH Key 会生成新的公钥；旧公钥将无法继续用于本系统，需要重新添加到 GitHub。' +
                            '</div>' +
                        '</div>' +
                        '<div style="margin-top: 16px; display: flex; gap: 8px;">' +
                            '<button class="git-btn primary" id="gitSaveBtn" onclick="saveGitSyncConfig()">保存配置</button>' +
                            '<button class="git-btn" id="gitTestBtn" onclick="testGitConnection()">⚡ 测试连接</button>' +
                        '</div>' +
                    '</div>' +
                    
                    '<!-- 同步操作面板 -->'+
                    '<div class="git-panel">' +
                        '<div class="git-panel-title-row">' +
                            '<div class="git-panel-title">🔄 同步策略控制</div>' +
                            '<button class="git-btn" id="btnGitCompare" onclick="runGitCompareCheck()">对比检查</button>' +
                        '</div>' +
                        
                        '<!-- 远程增量至本地 -->' +
                        '<div class="git-strategy-card">' +
                            '<div class="git-strategy-header">' +
                                '<span class="git-strategy-name">⬇️ 远程增量至本地（选择同名文件优先级）</span>' +
                                '<span class="git-strategy-badge safe">本地操作</span>' +
                            '</div>' +
                            '<div class="git-strategy-desc">' +
                                '只从远程读取文件补充到本地，不会推送或修改远程仓库。左侧保留本地同名文件，右侧用远程同名文件覆盖本地。' +
                            '</div>' +
                            '<div class="git-btn-row">' +
                                '<button class="git-btn primary full" id="btnGitRemoteLocalFirst" onclick="confirmGitSync(\'remoteToLocalLocalFirst\')">远程增加至本地（本地）</button>' +
                                '<button class="git-btn warning full" id="btnGitRemoteRemoteFirst" onclick="confirmGitSync(\'remoteToLocalRemoteFirst\')">远程增量至本地（远程）</button>' +
                            '</div>' +
                        '</div>' +

                        '<!-- 本地覆盖远程 -->' +
                        '<div class="git-strategy-card">' +
                            '<div class="git-strategy-header">' +
                                '<span class="git-strategy-name">⚠️ 本地覆盖远程 (Push)</span>' +
                                '<span class="git-strategy-badge warn">高危覆盖</span>' +
                            '</div>' +
                            '<div class="git-strategy-desc">' +
                                '完全以本地 Markdown 文件夹为准，强力强制覆盖远程分支。远程所有未同步的文件将被无情抹去。' +
                            '</div>' +
                            '<button class="git-btn warning full" id="btnGitPush" onclick="confirmGitSync(\'push\')">强制推送覆盖远程</button>' +
                        '</div>' +

                        '<!-- 远程覆盖本地 -->' +
                        '<div class="git-strategy-card">' +
                            '<div class="git-strategy-header">' +
                                '<span class="git-strategy-name">💥 远程覆盖本地 (Pull)</span>' +
                                '<span class="git-strategy-badge danger">最高危重置</span>' +
                            '</div>' +
                            '<div class="git-strategy-desc">' +
                                '完全以远程仓库为准，强制擦除本地所有文章并与远程对齐。本地未保存的文章将彻底丢失！' +
                            '</div>' +
                            '<button class="git-btn danger full" id="btnGitPull" onclick="confirmGitSync(\'pull\')">强制拉取覆盖本地</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                
                '<!-- 拟真终端输出 -->'+
                '<div class="git-terminal-wrapper">' +
                    '<div class="git-terminal-header">' +
                        '<span>CONSOLE TERMINAL (SCANLINES MODE)</span>' +
                        '<span id="gitTerminalStatus" style="color: var(--green);">READY</span>' +
                    '</div>' +
                    '<div class="git-terminal-body" id="gitTerminal">' +
                        '<div class="git-log-line info">Terminal Blog Git Sync Console v1.0.0</div>' +
                        '<div class="git-log-line info">请输入您的仓库配置并进行连接测试...</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
        
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // 拉取当前配置
    await loadGitSyncConfig();
}

function closeGitSyncModal() {
    if (isSyncing) {
        showToast('正在执行同步指令，请耐心等待其完成，切勿中断。', 'warning');
        return;
    }
    var modal = document.getElementById('gitSyncModal');
    if (modal) modal.remove();
    document.body.style.overflow = '';
    
    // 自动刷新文章列表，以保证本地文件发生变化时首页同步呈现
    if (typeof loadPosts === 'function') {
        loadPosts();
    }
}

function detectRepoType(url) {
    var sshTrigger = document.getElementById('gitSshTrigger');
    var sshArea = document.getElementById('gitSshArea');
    var patGroup = document.getElementById('gitPatGroup');
    if (!sshTrigger) return;
    if (url && (url.includes('git@') || url.includes('ssh://'))) {
        sshTrigger.style.display = 'flex';
        if (patGroup) patGroup.style.display = 'none';
    } else {
        sshTrigger.style.display = 'none';
        if (patGroup) patGroup.style.display = 'block';
        if (sshArea) {
            sshArea.style.display = 'none';
            sshTrigger.classList.remove('active');
            var iconSpan = sshTrigger.querySelector('.icon');
            if (iconSpan) iconSpan.innerText = '▶';
        }
    }
    updateRepoUrlSwitchButtons();
}

function updateRepoUrlSwitchButtons() {
    var row = document.getElementById('gitRepoUrlSwitchRow');
    var httpsBtn = document.getElementById('gitUseLastHttpsBtn');
    var sshBtn = document.getElementById('gitUseLastSshBtn');
    var currentUrl = document.getElementById('gitRepoUrl') ? document.getElementById('gitRepoUrl').value.trim() : '';
    if (!row || !httpsBtn || !sshBtn) return;

    var showHttps = gitLastHttpsRepositoryUrl && gitLastHttpsRepositoryUrl !== currentUrl;
    var showSsh = gitLastSshRepositoryUrl && gitLastSshRepositoryUrl !== currentUrl;
    httpsBtn.style.display = showHttps ? 'block' : 'none';
    sshBtn.style.display = showSsh ? 'block' : 'none';
    row.style.display = (showHttps || showSsh) ? 'grid' : 'none';
}

function useSavedRepoUrl(type) {
    var repoInput = document.getElementById('gitRepoUrl');
    if (!repoInput) return;
    var nextUrl = type === 'ssh' ? gitLastSshRepositoryUrl : gitLastHttpsRepositoryUrl;
    if (!nextUrl) return;
    repoInput.value = nextUrl;
    detectRepoType(nextUrl);
    updateRepoUrlSwitchButtons();
}

function toggleSshCollapse() {
    var sshArea = document.getElementById('gitSshArea');
    var sshTrigger = document.getElementById('gitSshTrigger');
    if (!sshArea || !sshTrigger) return;
    
    var iconSpan = sshTrigger.querySelector('.icon');
    if (sshArea.style.display === 'none') {
        sshArea.style.display = 'block';
        sshTrigger.classList.add('active');
        if (iconSpan) iconSpan.innerText = '▼';
    } else {
        sshArea.style.display = 'none';
        sshTrigger.classList.remove('active');
        if (iconSpan) iconSpan.innerText = '▶';
    }
}

async function loadGitSyncConfig() {
    try {
        var config = await apiGet('/git/config');
        if (config) {
            document.getElementById('gitUser').value = config.githubUser || '';
            document.getElementById('gitRepoUrl').value = config.repositoryUrl || '';
            gitLoadedRepositoryUrl = config.repositoryUrl || '';
            gitLastSshRepositoryUrl = config.lastSshRepositoryUrl || '';
            gitLastHttpsRepositoryUrl = config.lastHttpsRepositoryUrl || '';
            document.getElementById('gitBranch').value = config.branch || 'markdown';
            var patInput = document.getElementById('gitPatToken');
            gitHasSavedPatToken = !!config.hasPatToken;
            if (patInput && config.hasPatToken) {
                patInput.placeholder = '已保存 Token；留空保存时继续沿用';
            }
            detectRepoType(config.repositoryUrl);
            updateRepoUrlSwitchButtons();
            
            if (config.sshPublicKey) {
                document.getElementById('gitSshKey').innerText = config.sshPublicKey;
            }
        }
    } catch (err) {
        writeTerminalLog('stderr', '[ERROR] 获取 Git 配置失败: ' + err.message);
    }
}

async function saveGitSyncConfig() {
    var user = document.getElementById('gitUser').value.trim();
    var repoUrl = document.getElementById('gitRepoUrl').value.trim();
    var branchName = document.getElementById('gitBranch').value.trim();
    var patToken = document.getElementById('gitPatToken').value.trim();
    var usesSsh = repoUrl.includes('git@') || repoUrl.includes('ssh://');
    var usesSavedPat = gitHasSavedPatToken && repoUrl === gitLoadedRepositoryUrl;
    var usesPat = !usesSsh && (patToken || usesSavedPat);
    
    if (!repoUrl) {
        showToast('远程仓库 URL 不能为空', 'error');
        return;
    }
    
    try {
        showToast('正在保存配置...', 'info');
        var result = await apiPost('/git/config', {
            githubUser: user,
            repositoryUrl: repoUrl,
            isPrivate: usesSsh || !!usesPat,
            authType: usesSsh ? 'ssh' : (usesPat ? 'https_pat' : 'https_public'),
            patToken: patToken,
            branch: branchName || 'markdown'
        });
        showToast('✅ 配置保存成功', 'success');
        
        if (result.config) {
            if (result.config.sshPublicKey) {
                document.getElementById('gitSshKey').innerText = result.config.sshPublicKey;
                detectRepoType(repoUrl);
            }
            if (result.config.branch) {
                document.getElementById('gitBranch').value = result.config.branch;
            }
            if (result.config.hasPatToken) {
                gitHasSavedPatToken = true;
                gitLoadedRepositoryUrl = result.config.repositoryUrl || repoUrl;
                gitLastSshRepositoryUrl = result.config.lastSshRepositoryUrl || gitLastSshRepositoryUrl;
                gitLastHttpsRepositoryUrl = result.config.lastHttpsRepositoryUrl || gitLastHttpsRepositoryUrl;
                document.getElementById('gitPatToken').value = '';
                document.getElementById('gitPatToken').placeholder = '已保存 Token；留空保存时继续沿用';
            } else {
                gitHasSavedPatToken = false;
                gitLoadedRepositoryUrl = result.config.repositoryUrl || repoUrl;
                gitLastSshRepositoryUrl = result.config.lastSshRepositoryUrl || gitLastSshRepositoryUrl;
                gitLastHttpsRepositoryUrl = result.config.lastHttpsRepositoryUrl || gitLastHttpsRepositoryUrl;
                document.getElementById('gitPatToken').placeholder = '公共仓库留空；已保存的 Token 不会回显';
            }
            updateRepoUrlSwitchButtons();
        }
    } catch (err) {
        showToast('保存配置失败: ' + err.message, 'error');
    }
}

async function copySshPublicKey() {
    var keyText = document.getElementById('gitSshKey').innerText;
    if (!keyText || keyText.includes('正在生成')) {
        showToast('密钥尚在生成中，请稍后再试。', 'warning');
        return;
    }
    copyTextToClipboard(keyText).then(function() {
        showToast('✅ 专属公钥已复制到剪贴板', 'success');
    }).catch(function() {
        showToast('[ERROR] 复制失败', 'error');
    });
}

function confirmRefreshSshKey() {
    showToast('确认刷新 SSH Key？旧公钥将失效，需要重新添加到 GitHub。', 'warning', [
        { label: '确认刷新', confirm: true, action: function() { refreshSshPublicKey(); } },
        { label: '取消', action: function() {} }
    ]);
}

async function refreshSshPublicKey() {
    try {
        showToast('正在刷新 SSH Key...', 'info');
        var result = await apiPost('/git/ssh-key/refresh', {});
        if (result.sshPublicKey) {
            document.getElementById('gitSshKey').innerText = result.sshPublicKey;
        }
        showToast('✅ SSH Key 已刷新，请重新添加公钥到 GitHub', 'success');
    } catch (err) {
        showToast('刷新 SSH Key 失败: ' + err.message, 'error');
    }
}

async function testGitConnection() {
    var repoUrl = document.getElementById('gitRepoUrl').value.trim();
    var patToken = document.getElementById('gitPatToken').value.trim();
    var usesSsh = repoUrl.includes('git@') || repoUrl.includes('ssh://');
    var usesSavedPat = gitHasSavedPatToken && repoUrl === gitLoadedRepositoryUrl;
    var authType = usesSsh ? 'ssh' : ((patToken || usesSavedPat) ? 'https_pat' : 'https_public');
    if (!repoUrl) {
        showToast('远程仓库 URL 不能为空', 'error');
        return;
    }
    
    setSyncingState(true);
    clearTerminal();
    writeTerminalLog('command', '> git ls-remote "' + repoUrl + '"');
    writeTerminalLog('info', '正在发起非破坏性连接测试，测试 SSH 部署密钥和网络通畅度，这可能需要数秒时间...');
    
    try {
        var res = await apiPost('/git/test', { repositoryUrl: repoUrl, patToken: patToken, authType: authType });
        if (res && res.success) {
            writeTerminalLog('stdout', '✅ [SUCCESS] 远程仓库连接完美通过！读写校验全绿！');
            showToast('✅ 连接测试成功！', 'success');
        } else {
            writeTerminalLog('stderr', '[ERROR] 连接验证失败：' + (res.error || '未知错误'));
        }
    } catch (err) {
        writeTerminalLog('stderr', '[ERROR] 远程仓库握手失败！\n原因：\n' + err.message);
        showToast('❌ 连接测试失败，请检查终端日志', 'error');
    } finally {
        setSyncingState(false);
    }
}

async function runGitCompareCheck() {
    if (isSyncing) return;

    setSyncingState(true);
    clearTerminal();
    writeTerminalLog('info', '正在执行本地与远程文件对比检查（只读，不会修改任何文件）...');

    try {
        var response = await fetch('/api/git/compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken ? 'Bearer ' + authToken : ''
            },
            body: JSON.stringify({})
        });
        var result = await response.json();

        await renderLogsGradually(result.logs || []);

        if (!response.ok || !result.success) {
            if (result.report) {
                renderGitCompareReport(result.report, true);
            }
            showToast('❌ 对比检查未完成：' + (result.error || '请查看终端输出'), 'error');
            return;
        }

        setTimeout(function() {
            writeTerminalLog('stdout', '\n📊 ' + (result.message || '对比检查完成'));
            if (result.report) {
                renderGitCompareReport(result.report, false);
            }
            showToast('📊 对比检查完成', 'success');
        }, (result.logs || []).length * 150 + 100);
    } catch (err) {
        writeTerminalLog('stderr', '[ERROR] 对比检查通信异常: ' + err.message);
        showToast('❌ 对比检查失败', 'error');
    } finally {
        setTimeout(function() {
            setSyncingState(false);
        }, 500);
    }
}

function renderGitCompareReport(report, partial) {
    if (!report) return;

    var lines = [];
    lines.push('══════ 文件对比报告 ' + (partial ? '(部分) ' : '') + '══════');
    var statParts = [];
    statParts.push('本地 ' + (report.localCount ?? 0));
    statParts.push('远程 ' + (report.remoteCount ?? 0));
    if (report.bothCount > 0) statParts.push('重复 ' + report.bothCount);
    if (report.identicalCount > 0) statParts.push('相同 ' + report.identicalCount);
    if (report.contentDiffCount > 0) statParts.push('差异 ' + report.contentDiffCount);
    if (report.localOnlyCount > 0) statParts.push('仅本地 ' + report.localOnlyCount);
    if (report.remoteOnlyCount > 0) statParts.push('仅远程 ' + report.remoteOnlyCount);
    lines.push('📊 ' + statParts.join(' │ '));
    lines.push('═════════════════════');

    // 只列出有问题的文件（内容不同/仅本地/仅远程），相同的不列
    function appendSection(title, items, icon) {
        if (!items || !items.length) return;
        lines.push('');
        lines.push(icon + ' ' + title + ' (' + items.length + '):');
        items.slice(0, 30).forEach(function(f) {
            var name = typeof f === 'string' ? f : f.path;
            lines.push('  • ' + name);
        });
        if (items.length > 30) {
            lines.push('  ... 另有 ' + (items.length - 30) + ' 个未列出');
        }
    }

    appendSection('内容不同', report.contentDiff, '📝');
    appendSection('仅本地', report.localOnly, '📤');
    appendSection('仅远程', report.remoteOnly, '📥');

    lines.push('═════════════════════');
    lines.forEach(function(line) {
        writeTerminalLog('info', line);
    });
}

function confirmGitSync(action) {
    if (isSyncing) return;
    
    if (action === 'push') {
        showToast('⚠️ 【高危操作】确定要用【本地文章】彻底强推覆盖【远程仓库】吗？远程的所有文件将被全部擦除！', 'warning', [
            { label: '🔥 确认强制推送覆盖', confirm: true, action: function() { doGitSync('push'); } },
            { label: '取消', action: function() {} }
        ]);
    } else if (action === 'pull') {
        showToast('⚠️ 【最高危操作】确定要用【远程仓库】强行覆盖【本地文章】吗？本地所有未保存的修改将被擦除且不可挽回！', 'warning', [
            { label: '💥 确认强制擦除重置', confirm: true, action: function() { doGitSync('pull'); } },
            { label: '取消', action: function() {} }
        ]);
    } else if (action === 'remoteToLocalRemoteFirst') {
        showToast('⚠️ 确定要执行【远程增量至本地（远程）】吗？本地同名文件会被远程版本覆盖，本地独有文件会保留。', 'warning', [
            { label: '确认远程增量', confirm: true, action: function() { doGitSync('remoteToLocalRemoteFirst'); } },
            { label: '取消', action: function() {} }
        ]);
    } else {
        // 远程增加至本地，本地同名文件优先保留
        doGitSync('remoteToLocalLocalFirst');
    }
}

async function doGitSync(action) {
    setSyncingState(true);
    clearTerminal();
    writeTerminalLog('info', '正在准备 Git 同步动作: ' + getGitActionLabel(action) + '...');
    writeTerminalLog('info', '与远程 GitHub 握手，开始收集变更日志，这需要一些时间，请稍候...');
    
    try {
        var response = await fetch('/api/git/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken ? 'Bearer ' + authToken : ''
            },
            body: JSON.stringify({ action: action })
        });
        
        var result = await response.json();
        
        if (response.status === 409 && result.conflict) {
            // 发生合并冲突
            await renderLogsGradually(result.logs || []);
            setTimeout(function() {
                writeTerminalLog('stderr', '\n❌ [MERGE CONFLICT] 发生了合并冲突！');
                writeTerminalLog('stderr', '冲突文章列表如下，需手动核查：');
                (result.conflictFiles || []).forEach(function(file) {
                    writeTerminalLog('stderr', '  ➔ ' + file);
                });
                writeTerminalLog('info', '\n提示：合并已安全且保护性地自动撤销，您的工作区毫发无损。\n建议：您可以选择"本地覆盖远程(Push)"以本地为准，或者"远程覆盖本地(Pull)"以远程为准解决冲突。');
                showToast('⚠️ 合并冲突，已自动安全撤销并还原工作区。', 'error');
            }, (result.logs || []).length * 150 + 100);
            
        } else if (!response.ok) {
            await renderLogsGradually(result.logs || [{ type: 'stderr', text: result.error || '服务器同步发生故障' }]);
            showToast('❌ 同步动作失败，请查看终端输出', 'error');
        } else {
            // 成功
            await renderLogsGradually(result.logs || []);
            setTimeout(function() {
                writeTerminalLog('stdout', '\n🎉 ' + (result.message || '远程同步成功完成！'));
                showToast('🎉 同步成功！', 'success');
            }, (result.logs || []).length * 150 + 100);
        }
        
    } catch (err) {
        writeTerminalLog('stderr', '[ERROR] 通信过程发生重大异常: ' + err.message);
        showToast('❌ 同步发生严重通信故障', 'error');
    } finally {
        // 延迟重设按钮状态
        setTimeout(function() {
            setSyncingState(false);
        }, 1000);
    }
}

function getGitActionLabel(action) {
    var labels = {
        push: '本地覆盖远程',
        pull: '远程覆盖本地',
        remoteToLocalLocalFirst: '远程增加至本地（本地）',
        remoteToLocalRemoteFirst: '远程增量至本地（远程）'
    };
    return labels[action] || action;
}

function setSyncingState(syncing) {
    isSyncing = syncing;
    var btnRemoteLocalFirst = document.getElementById('btnGitRemoteLocalFirst');
    var btnRemoteRemoteFirst = document.getElementById('btnGitRemoteRemoteFirst');
    var btnPush = document.getElementById('btnGitPush');
    var btnPull = document.getElementById('btnGitPull');
    var btnCompare = document.getElementById('btnGitCompare');
    var testBtn = document.getElementById('gitTestBtn');
    var saveBtn = document.getElementById('gitSaveBtn');
    var statusSpan = document.getElementById('gitTerminalStatus');
    
    if (btnRemoteLocalFirst) btnRemoteLocalFirst.disabled = syncing;
    if (btnRemoteRemoteFirst) btnRemoteRemoteFirst.disabled = syncing;
    if (btnPush) btnPush.disabled = syncing;
    if (btnPull) btnPull.disabled = syncing;
    if (btnCompare) btnCompare.disabled = syncing;
    if (testBtn) testBtn.disabled = syncing;
    if (saveBtn) saveBtn.disabled = syncing;
    
    if (statusSpan) {
        if (syncing) {
            statusSpan.innerText = 'EXECUTING...';
            statusSpan.style.color = 'var(--yellow)';
            statusSpan.style.textShadow = '0 0 5px var(--yellow)';
        } else {
            statusSpan.innerText = 'READY';
            statusSpan.style.color = 'var(--green)';
            statusSpan.style.textShadow = '0 0 5px var(--green)';
        }
    }
}

function clearTerminal() {
    var term = document.getElementById('gitTerminal');
    if (term) term.innerHTML = '';
}

function writeTerminalLog(type, text) {
    var term = document.getElementById('gitTerminal');
    if (!term) return;
    
    var line = document.createElement('div');
    line.className = 'git-log-line ' + type;
    line.innerText = text;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
}

// 核心流式打字机延迟喷吐日志算法
async function renderLogsGradually(logs) {
    return new Promise(function(resolve) {
        if (!logs || logs.length === 0) {
            resolve();
            return;
        }
        
        var index = 0;
        function printNext() {
            if (index >= logs.length) {
                resolve();
                return;
            }
            var log = logs[index++];
            
            // 给命令行前缀打上特殊的渐进打字机呼吸感
            if (log.type === 'command') {
                writeTerminalLog(log.type, log.text);
                setTimeout(printNext, 180); // 命令打完稍作停顿
            } else {
                writeTerminalLog(log.type, log.text);
                setTimeout(printNext, 120); // 日志行间延迟
            }
        }
        
        printNext();
    });
}