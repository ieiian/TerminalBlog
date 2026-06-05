// ============ 游客上传 ============
var pendingGuestUploadFile = null;
var pendingGuestUploadFolder = 'guestupload';
var GUEST_UPLOAD_RECORDS_KEY = 'blog_guest_upload_records';
var GUEST_UPLOAD_RECORDS_MAX = 50;

function loadGuestUploadRecords() {
    try {
        var raw = localStorage.getItem(GUEST_UPLOAD_RECORDS_KEY);
        if (!raw) return [];
        var list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
    } catch (e) {
        return [];
    }
}

function saveGuestUploadRecords(list) {
    try {
        localStorage.setItem(GUEST_UPLOAD_RECORDS_KEY, JSON.stringify(list.slice(0, GUEST_UPLOAD_RECORDS_MAX)));
    } catch (e) {
        console.error('保存上传记录失败:', e);
    }
}

function addGuestUploadRecord(entry) {
    var list = loadGuestUploadRecords();
    list.unshift({
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        fileName: entry.fileName || '未知文件',
        savedName: entry.savedName || '',
        sizeHint: entry.sizeHint || '',
        status: entry.status === 'success' ? 'success' : 'failed',
        message: entry.message || '',
        url: entry.url || '',
        uploadedAt: entry.uploadedAt || new Date().toISOString()
    });
    saveGuestUploadRecords(list);
    renderGuestUploadHistory();
}

function formatGuestUploadTime(iso) {
    try {
        return new Date(iso).toLocaleString('zh-CN', { hour12: false });
    } catch (e) {
        return iso || '';
    }
}

function renderGuestUploadHistory() {
    var container = document.getElementById('guestUploadHistoryList');
    if (!container) return;
    var records = loadGuestUploadRecords();
    if (!records.length) {
        container.innerHTML = '<div class="file-empty">暂无上传记录</div>';
        return;
    }
    container.innerHTML = records.map(function(record) {
        var isSuccess = record.status === 'success';
        var statusText = isSuccess ? '成功' : '失败';
        var metaLines = [
            '时间：' + formatGuestUploadTime(record.uploadedAt),
            record.sizeHint ? '大小：' + escapeHtml(record.sizeHint) : ''
        ];
        if (isSuccess && record.savedName && record.savedName !== record.fileName) {
            metaLines.push('保存为：' + escapeHtml(record.savedName));
        }
        if (isSuccess && record.url) {
            metaLines.push('链接：' + escapeHtml(record.url));
        }
        if (!isSuccess && record.message) {
            metaLines.push('原因：' + escapeHtml(record.message));
        }
        var actions = '';
        if (isSuccess && record.url) {
            actions = '<button class="file-item-btn" onclick="copyFileUrl(\'' + escapeHtml(record.url) + '\')" title="复制链接">📋</button>';
        }
        return '<div class="guest-upload-history-item ' + (isSuccess ? 'success' : 'failed') + '">' +
            '<div class="guest-upload-history-main">' +
                '<div class="guest-upload-history-name" title="' + escapeHtml(record.fileName) + '">' + escapeHtml(record.fileName) + '</div>' +
                '<div class="guest-upload-history-meta">' + metaLines.filter(Boolean).join('<br/>') + '</div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">' +
                '<span class="guest-upload-history-status ' + (isSuccess ? 'success' : 'failed') + '">' + statusText + '</span>' +
                actions +
            '</div>' +
        '</div>';
    }).join('');
}

function clearGuestUploadRecords() {
    showToast('确定清空本浏览器的全部上传记录？', 'info', [
        {
            label: '确认清空',
            confirm: true,
            action: function() {
                localStorage.removeItem(GUEST_UPLOAD_RECORDS_KEY);
                renderGuestUploadHistory();
                showToast('上传记录已清空', 'success');
            }
        },
        { label: '取消', action: function() {} }
    ]);
}

function openGuestUploadModal() {
    closeGuestUploadModal();
    var modal = document.createElement('div');
    modal.className = 'file-manager-modal';
    modal.id = 'guestUploadModal';
    modal.innerHTML =
        '<div class="file-manager-container">' +
            '<div class="file-manager-header">' +
                '<span>📤 游客上传</span>' +
                '<button onclick="closeGuestUploadModal()">✕ 关闭</button>' +
            '</div>' +
            '<div class="file-manager-body">' +
                '<div class="file-section">' +
                    '<div class="file-upload-area" id="guestUploadArea" ' +
                         'onclick="if(event.target===this||this.contains(event.target)&&event.target.tagName!==\'INPUT\')document.getElementById(\'guestUploadInput\').click()" ' +
                         'ondragover="event.preventDefault(); this.classList.add(\'dragover\');" ' +
                         'ondragleave="this.classList.remove(\'dragover\');" ' +
                         'ondrop="handleGuestFileDrop(event)">' +
                        '<input type="file" id="guestUploadInput" onchange="handleGuestFileSelect(event)" style="display:none;" />' +
                        '<label style="cursor:pointer;">点击或拖拽文件到此处</label>' +
                        '<div class="hint" id="guestUploadHint">支持任意格式，单文件最大 ' + getUploadMaxHint('guestupload') + ' · 需联系管理员获取 <span style="text-decoration: underline; font-style: italic;">上传码</span> 才可操作</div>' +
                    '</div>' +
                    '<div class="file-upload-progress" id="guestuploadUploadProgress">' +
                        '<div class="file-upload-progress-info">' +
                            '<span class="file-upload-progress-name">等待上传</span>' +
                            '<span class="file-upload-progress-percent">0%</span>' +
                        '</div>' +
                        '<div class="file-upload-progress-track"><div class="file-upload-progress-bar"></div></div>' +
                    '</div>' +
                '</div>' +
                '<div class="file-section guest-upload-history-section">' +
                    '<div class="file-section-header">' +
                        '<span class="file-section-title">📋 上传记录</span>' +
                        '<button type="button" class="guest-upload-history-clear" onclick="clearGuestUploadRecords()">清空记录</button>' +
                    '</div>' +
                    '<div class="guest-upload-history-list" id="guestUploadHistoryList">' +
                        '<div class="file-empty">暂无上传记录</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);
    renderGuestUploadHistory();
    document.body.style.overflow = 'hidden';
}

function closeGuestUploadModal() {
    var modal = document.getElementById('guestUploadModal');
    if (modal) modal.remove();
    closeUploadCodePrompt();
    pendingGuestUploadFile = null;
    document.body.style.overflow = document.getElementById('fileManagerModal') ? 'hidden' : '';
}

function handleGuestFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    var area = event.currentTarget;
    if (area) area.classList.remove('dragover');
    var files = event.dataTransfer.files;
    if (!files || !files.length) return;
    promptGuestUploadWithCode(files[0]);
}

function handleGuestFileSelect(event) {
    var files = event.target.files;
    if (!files || !files.length) return;
    promptGuestUploadWithCode(files[0]);
    event.target.value = '';
}

function promptGuestUploadWithCode(file) {
    var maxBytes = getUploadMaxBytes('guestupload');
    var maxHint = getUploadMaxHint('guestupload');
    if ((file.size || 0) > maxBytes) {
        showToast('[ERROR] ' + file.name + ' 超过大小限制（最大 ' + maxHint + '）', 'error');
        return;
    }
    pendingGuestUploadFile = file;
    closeUploadCodePrompt();

    var overlay = document.createElement('div');
    overlay.className = 'upload-code-prompt-overlay';
    overlay.id = 'uploadCodePromptOverlay';
    overlay.innerHTML =
        '<div class="upload-code-prompt-box">' +
            '<h4>🔐 请输入上传码</h4>' +
            '<p class="upload-code-prompt-note">文件：<span style="color:var(--cyan);">' + escapeHtml(file.name) + '</span><br/>' +
            '上传文件最大不能超过 <strong style="color:var(--yellow);">' + getGuestUploadMaxMB() + 'MB</strong>。上传码由管理员在「文件管理」中提供，每个上传码仅可成功上传一次。</p>' +
            '<input type="text" id="uploadCodeInput" maxlength="8" placeholder="8位上传码" autocomplete="off" />' +
            '<div class="upload-code-prompt-actions">' +
                '<button type="button" onclick="closeUploadCodePrompt()">取消</button>' +
                '<button type="button" class="primary" onclick="confirmGuestUploadWithCode()">确认上传</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    var input = document.getElementById('uploadCodeInput');
    if (input) {
        input.focus();
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') confirmGuestUploadWithCode();
        });
    }
}

function closeUploadCodePrompt() {
    var overlay = document.getElementById('uploadCodePromptOverlay');
    if (overlay) overlay.remove();
}

async function confirmGuestUploadWithCode() {
    var input = document.getElementById('uploadCodeInput');
    var code = input ? input.value.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{8}$/.test(code)) {
        showToast('[ERROR] 请输入 8 位大写字母或数字组成的上传码', 'error');
        return;
    }
    if (!pendingGuestUploadFile) {
        showToast('[ERROR] 未选择文件', 'error');
        closeUploadCodePrompt();
        return;
    }
    closeUploadCodePrompt();
    var uploadFile = pendingGuestUploadFile;
    var sizeHint = formatBytesHint(uploadFile.size || 0);
    try {
        var result = await uploadGuestFile(uploadFile, code, function(loaded) {
            var total = uploadFile.size || 1;
            var percent = Math.round((Math.min(loaded, total) / total) * 100);
            updateUploadProgress('guestupload', {
                active: true,
                percent: percent,
                name: '上传中: ' + uploadFile.name
            });
        });
        var fileUrl = result && result.url
            ? (result.url.startsWith('http') ? result.url : window.location.origin + result.url)
            : '';
        addGuestUploadRecord({
            fileName: uploadFile.name,
            savedName: result && result.filename ? result.filename : '',
            sizeHint: sizeHint,
            status: 'success',
            message: result && result.message ? result.message : '上传成功',
            url: fileUrl
        });
        updateUploadProgress('guestupload', {
            active: true,
            done: true,
            percent: 100,
            name: '上传完成'
        });
        setTimeout(function() {
            updateUploadProgress('guestupload', { active: false });
        }, 1800);
        pendingGuestUploadFile = null;
    } catch (err) {
        addGuestUploadRecord({
            fileName: uploadFile.name,
            sizeHint: sizeHint,
            status: 'failed',
            message: err && err.message ? err.message : '上传失败'
        });
        updateUploadProgress('guestupload', {
            active: true,
            error: true,
            percent: 0,
            name: '上传失败'
        });
        pendingGuestUploadFile = null;
    }
}

function uploadGuestFile(file, uploadCode, onProgress) {
    return new Promise(function(resolve, reject) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('uploadCode', uploadCode);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/guest-upload', true);
        xhr.upload.onprogress = function(event) {
            if (typeof onProgress === 'function') {
                onProgress(event.lengthComputable ? event.loaded : 0);
            }
        };
        xhr.onload = function() {
            var result = null;
            try {
                result = JSON.parse(xhr.responseText);
            } catch (e) {}
            if (xhr.status < 200 || xhr.status >= 300) {
                var errMsg = result && result.error ? result.error : '上传失败 (HTTP ' + xhr.status + ')';
                showToast('[ERROR] ' + escapeHtml(errMsg), 'error');
                reject(new Error(errMsg));
                return;
            }
            showToast('✅ ' + file.name + ' 上传成功', 'success');
            resolve(result);
        };
        xhr.onerror = function() {
            showToast('[ERROR] 上传请求出错', 'error');
            reject(new Error('上传请求出错'));
        };
        xhr.send(formData);
    });
}