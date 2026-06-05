// ============ 文件管理器 ============
function openFileManager() {
    var modal = document.createElement('div');
    modal.className = 'file-manager-modal';
    modal.id = 'fileManagerModal';
    modal.innerHTML = 
        '<div class="file-manager-container">' +
            '<div class="file-manager-header">' +
                '<span>📁 文件管理</span>' +
                '<button onclick="closeFileManager()">✕ 关闭</button>' +
            '</div>' +
            '<div class="file-manager-body">' +
                '<div class="file-section">' +
                    '<div class="file-section-header">' +
                        '<span class="file-section-title">👥 游客上传文件 (guestuploads/)</span>' +
                        '<span style="font-style: italic; color: #888; font-size: 0.9em;">仅当最后点击"复制"时保存于粘贴板中的上传码有效</span>' +
                    '</div>' +
                    '<div class="upload-code-bar">' +
                        '<span class="upload-code-label">上传码</span>' +
                        '<span class="upload-code-value" id="adminUploadCodeDisplay">--------</span>' +
                        '<button type="button" class="upload-code-copy-btn" onclick="copyAndRefreshUploadCode()">复制</button>' +
                    '</div>' +
                    '<div class="file-list" id="guestuploadsFileList">' +
                        '<span class="loading"></span>' +
                    '</div>' +
                '</div>' +
                '<div class="file-section">' +
                    '<div class="file-section-header">' +
                        '<span class="file-section-title">📥 博客文件 (blogfiles/)</span>' +
                    '</div>' +
                    '<div class="file-upload-area" id="blogfilesUploadArea" ' +
                         'onclick="if(event.target===this||this.contains(event.target)&&event.target.tagName!==\'INPUT\')document.getElementById(\'blogfilesUpload\').click()" ' +
                         'ondragover="event.preventDefault(); this.classList.add(\'dragover\');" ' +
                         'ondragleave="this.classList.remove(\'dragover\');" ' +
                         'ondrop="handleFileDrop(event, \'blogfiles\')">' +
                        '<input type="file" id="blogfilesUpload" multiple onchange="handleFileUpload(event, \'blogfiles\')" style="display:none;" />' +
                        '<label style="cursor:pointer;">点击或拖拽文件到此处上传</label>' +
                        '<div class="hint" id="blogfilesUploadHint">支持任意格式文件，单文件最大 ' + getUploadMaxHint('blogfiles') + '</div>' +
                    '</div>' +
                    '<div class="file-upload-progress" id="blogfilesUploadProgress">' +
                        '<div class="file-upload-progress-info">' +
                            '<span class="file-upload-progress-name">等待上传</span>' +
                            '<span class="file-upload-progress-percent">0%</span>' +
                        '</div>' +
                        '<div class="file-upload-progress-track"><div class="file-upload-progress-bar"></div></div>' +
                    '</div>' +
                    '<div class="file-list" id="blogfilesFileList">' +
                        '<span class="loading"></span>' +
                    '</div>' +
                '</div>' +
                '<div class="file-section">' +
                    '<div class="file-section-header">' +
                        '<span class="file-section-title">🖼️ 博客图片 (blogimgs/)</span>' +
                    '</div>' +
                    '<div class="file-upload-area" id="blogimgsUploadArea" ' +
                         'onclick="if(event.target===this||this.contains(event.target)&&event.target.tagName!==\'INPUT\')document.getElementById(\'blogimgsUpload\').click()" ' +
                         'ondragover="event.preventDefault(); this.classList.add(\'dragover\');" ' +
                         'ondragleave="this.classList.remove(\'dragover\');" ' +
                         'ondrop="handleFileDrop(event, \'blogimgs\')">' +
                        '<input type="file" id="blogimgsUpload" multiple accept="image/*" onchange="handleFileUpload(event, \'blogimgs\')" style="display:none;" />' +
                        '<label style="cursor:pointer;">点击或拖拽图片到此处上传</label>' +
                        '<div class="hint" id="blogimgsUploadHint">支持 jpg, png, gif, webp 等格式，单文件最大 ' + getUploadMaxHint('blogimgs') + '</div>' +
                    '</div>' +
                    '<div class="file-upload-progress" id="blogimgsUploadProgress">' +
                        '<div class="file-upload-progress-info">' +
                            '<span class="file-upload-progress-name">等待上传</span>' +
                            '<span class="file-upload-progress-percent">0%</span>' +
                        '</div>' +
                        '<div class="file-upload-progress-track"><div class="file-upload-progress-bar"></div></div>' +
                    '</div>' +
                    '<div class="file-list" id="blogimgsFileList">' +
                        '<span class="loading"></span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    
    document.body.appendChild(modal);
    refreshAdminUploadCodeDisplay();
    loadFileLists();
    
    // 阻止背景滚动
    document.body.style.overflow = 'hidden';
}

async function refreshAdminUploadCodeDisplay() {
    var el = document.getElementById('adminUploadCodeDisplay');
    if (!el) return;
    if (!authToken) {
        el.textContent = '请先登录';
        return;
    }
    el.textContent = '刷新中...';
    try {
        var res = await fetch('/api/guest-upload/code', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || '获取上传码失败');
        el.textContent = data.code || '--------';
    } catch (err) {
        el.textContent = '获取失败';
        showToast('[ERROR] ' + escapeHtml(err.message), 'error');
    }
}

async function copyAndRefreshUploadCode() {
    if (!authToken) {
        showToast('[ERROR] 请先登录管理后台', 'error');
        return;
    }
    try {
        var res = await fetch('/api/guest-upload/code', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || '刷新上传码失败');
        var el = document.getElementById('adminUploadCodeDisplay');
        if (el) el.textContent = data.code || '--------';
        await copyTextToClipboard(data.code);
        showToast('✅ 上传码已复制（已刷新为新码）', 'success');
    } catch (err) {
        showToast('[ERROR] ' + escapeHtml(err.message), 'error');
    }
}

function closeFileManager() {
    var modal = document.getElementById('fileManagerModal');
    if (modal) {
        modal.remove();
    }
    document.body.style.overflow = '';
}

async function loadFileLists() {
    try {
        var guestuploadsList = document.getElementById('guestuploadsFileList');
        if (guestuploadsList) {
            var guestuploadsData = await apiGet('/files/guestuploads', {
                headers: authToken ? { 'Authorization': 'Bearer ' + authToken } : {}
            });
            guestuploadsList.innerHTML = renderFileList(guestuploadsData.files, 'guestuploads', false);
        }

        // 加载 blogfiles 列表
        var blogfilesList = document.getElementById('blogfilesFileList');
        if (blogfilesList) {
            var blogfilesData = await apiGet('/files/blogfiles');
            blogfilesList.innerHTML = renderFileList(blogfilesData.files, 'blogfiles');
        }
        
        // 加载 blogimgs 列表
        var blogimgsList = document.getElementById('blogimgsFileList');
        if (blogimgsList) {
            var blogimgsData = await apiGet('/files/blogimgs');
            blogimgsList.innerHTML = renderFileList(blogimgsData.files, 'blogimgs');
        }
    } catch (err) {
        showToast('[ERROR] 加载文件列表失败', 'error');
    }
}

function renderFileList(files, folder, browseOnly) {
    if (!files || files.length === 0) {
        return '<div class="file-empty">暂无文件</div>';
    }
    
    return files.map(function(file) {
        var fileUrl = window.location.origin + '/' + folder + '/' + encodeURIComponent(file.name);
        var safeName = escapeHtml(file.name).replace(/'/g, "\\'");
        var actions = '<button class="file-item-btn" onclick="copyFileUrl(\'' + escapeHtml(fileUrl) + '\')" title="复制URL">📋 复制</button>';
        if (!browseOnly) {
            actions += '<button class="file-item-btn delete" onclick="deleteFile(\'' + folder + '\', \'' + safeName + '\')" title="删除">🗑️</button>';
        }
        return '<div class="file-item">' +
            '<div class="file-item-info">' +
                '<div class="file-item-name" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</div>' +
                '<div class="file-item-size">' + file.size + '</div>' +
            '</div>' +
            '<div class="file-item-actions">' + actions + '</div>' +
        '</div>';
    }).join('');
}

function copyFileUrl(url) {
    copyTextToClipboard(url).then(function() {
        showToast('✅ URL 已复制到剪贴板', 'success');
    }).catch(function() {
        showToast('[ERROR] 复制失败', 'error');
    });
}

async function handleFileDrop(event, folder) {
    event.preventDefault();
    event.stopPropagation();
    
    var area = event.currentTarget;
    if (area) {
        area.classList.remove('dragover');
    }
    
    var files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    await uploadMultipleFiles(files, folder);
}

async function uploadMultipleFiles(files, folder) {
    var maxBytes = getUploadMaxBytes(folder);
    var maxHint = getUploadMaxHint(folder);
    for (var j = 0; j < files.length; j++) {
        if ((files[j].size || 0) > maxBytes) {
            showToast('[ERROR] ' + files[j].name + ' 超过大小限制（最大 ' + maxHint + '）', 'error');
            return;
        }
    }

    var totalBytes = 0;
    for (var i = 0; i < files.length; i++) {
        totalBytes += files[i].size || 0;
    }
    var completedBytes = 0;
    var totalCount = files.length;
    var failedCount = 0;
    updateUploadProgress(folder, {
        active: true,
        percent: 0,
        name: '准备上传 ' + totalCount + ' 个文件'
    });

    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        try {
            await uploadFile(file, folder, function(loaded) {
                var currentLoaded = Math.min(loaded || 0, file.size || 0);
                var percent = totalBytes > 0 ? Math.round(((completedBytes + currentLoaded) / totalBytes) * 100) : 0;
                updateUploadProgress(folder, {
                    active: true,
                    percent: percent,
                    name: '上传中 ' + (i + 1) + '/' + totalCount + ': ' + file.name
                });
            });
            completedBytes += file.size || 0;
            var donePercent = totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 100;
            updateUploadProgress(folder, {
                active: true,
                percent: donePercent,
                name: '已完成 ' + (i + 1) + '/' + totalCount + ': ' + file.name
            });
        } catch (err) {
            console.error('上传文件失败:', file.name, err);
            failedCount++;
            updateUploadProgress(folder, {
                active: true,
                error: true,
                percent: totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 0,
                name: '上传失败: ' + file.name
            });
        }
    }
    if (failedCount > 0) {
        updateUploadProgress(folder, {
            active: true,
            error: true,
            percent: totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 0,
            name: '上传完成，成功 ' + (totalCount - failedCount) + ' 个，失败 ' + failedCount + ' 个'
        });
    } else {
        updateUploadProgress(folder, {
            active: true,
            done: true,
            percent: 100,
            name: '上传完成'
        });
        setTimeout(function() {
            updateUploadProgress(folder, { active: false });
        }, 1800);
    }
    loadFileLists();
}

async function handleFileUpload(event, folder) {
    var files = event.target.files;
    if (!files || files.length === 0) return;
    
    await uploadMultipleFiles(files, folder);
    
    // 清空 input
    event.target.value = '';
}

function updateUploadProgress(folder, state) {
    var progress = document.getElementById(folder + 'UploadProgress');
    if (!progress) return;
    
    var bar = progress.querySelector('.file-upload-progress-bar');
    var name = progress.querySelector('.file-upload-progress-name');
    var percentLabel = progress.querySelector('.file-upload-progress-percent');
    var percent = Math.max(0, Math.min(100, state.percent || 0));
    
    progress.classList.toggle('active', !!state.active);
    progress.classList.toggle('error', !!state.error);
    progress.classList.toggle('done', !!state.done);
    if (name && state.name) name.textContent = state.name;
    if (percentLabel) percentLabel.textContent = percent + '%';
    if (bar) bar.style.width = percent + '%';
}

async function uploadFile(file, folder, onProgress) {
    var maxBytes = getUploadMaxBytes(folder);
    var maxHint = getUploadMaxHint(folder);
    if ((file.size || 0) > maxBytes) {
        var sizeErr = file.name + ' 超过大小限制（最大 ' + maxHint + '）';
        showToast('[ERROR] ' + sizeErr, 'error');
        return Promise.reject(new Error(sizeErr));
    }

    return new Promise(function(resolve, reject) {
        var formData = new FormData();
        formData.append('file', file);
        
        var headers = {};
        if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
        
        showToast('正在上传: ' + file.name, 'info');

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload/' + folder, true);
        Object.keys(headers).forEach(function(key) {
            xhr.setRequestHeader(key, headers[key]);
        });
        xhr.upload.onprogress = function(event) {
            if (typeof onProgress === 'function') {
                onProgress(event.lengthComputable ? event.loaded : 0, event.total || file.size || 0);
            }
        };
        xhr.onload = function() {
            var contentType = xhr.getResponseHeader('content-type') || '';
            var result = null;
            if (contentType.includes('application/json')) {
                try {
                    result = JSON.parse(xhr.responseText);
                } catch (e) {
                    reject(new Error('服务器返回了无效 JSON 数据'));
                    return;
                }
            }
            if (xhr.status < 200 || xhr.status >= 300) {
                var errMsg = result && result.error ? result.error : '上传失败 (HTTP ' + xhr.status + ')';
                showToast('[ERROR] ' + escapeHtml(errMsg), 'error');
                reject(new Error(errMsg));
                return;
            }
            if (!result) {
                reject(new Error('服务器未返回 JSON 数据，可能上传路径不正确或服务出错'));
                return;
            }
            if (result.error) {
                showToast('[ERROR] ' + escapeHtml(result.error), 'error');
                reject(new Error(result.error));
            } else {
                showToast('✅ ' + file.name + ' 上传成功', 'success');
                resolve(result);
            }
        };
        xhr.onerror = function() {
            var err = new Error('上传请求出错');
            showToast('[ERROR] ' + escapeHtml(err.message), 'error');
            reject(err);
        };
        xhr.send(formData);
    });
}

async function deleteFile(folder, filename) {
    showToast('确认删除文件 "' + filename + '"？', 'info', [
        { label: '确认', confirm: true, action: function() { doDeleteFile(folder, filename); } },
        { label: '取消', action: function() {} }
    ]);
}

async function doDeleteFile(folder, filename) {
    try {
        await apiDelete('/files/' + folder + '/' + encodeURIComponent(filename));
        showToast('✅ 文件已删除', 'success');
        loadFileLists();
    } catch (err) {
        showToast('[ERROR] ' + escapeHtml(err.message), 'error');
    }
}