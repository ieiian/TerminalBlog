// ============ 导出/导入 (ZIP 格式) ============
async function exportPosts() {
    try {
        showToast('正在导出文章...', 'info');
        var headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
        var res = await fetch('/api/export', { headers: headers });
        if (!res.ok) {
            var err = await res.json().catch(function() { return { error: '导出失败' }; });
            throw new Error(err.error || '导出失败');
        }
        var blob = await res.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'terminalblog-export-' + new Date().toISOString().split('T')[0] + '.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('✅ 导出成功 (ZIP 格式)', 'success');
    } catch (err) {
        showToast('[ERROR] ' + escapeHtml(err.message), 'error');
    }
}

async function importPosts(event) {
    var file = event.target.files[0];
    if (!file) return;

    var fileName = file.name.toLowerCase();
    var isZip = fileName.endsWith('.zip');
    var isMarkdown = fileName.endsWith('.md');

    try {
        if (isZip) {
            // ZIP 文件导入
            showToast('正在处理 ZIP 文件...', 'info');
            
            // 读取文件为 base64
            var reader = new FileReader();
            reader.onload = function(e) {
                var base64 = e.target.result;
                
                var headers = { 'Content-Type': 'application/json' };
                if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
                
                fetch('/api/import', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ base64: base64 })
                }).then(function(res) {
                    return res.json();
                }).then(function(result) {
                    if (result.error) {
                        showToast('[ERROR] ' + escapeHtml(result.error), 'error');
                    } else {
                        showToast('✅ 导入完成 (成功: ' + result.imported + ', 跳过: ' + result.skipped + ', 失败: ' + result.failed + ')', 'success');
                        loadAdminPosts();
                    }
                }).catch(function(err) {
                    showToast('[ERROR] ' + escapeHtml(err.message), 'error');
                });
            };
            reader.readAsDataURL(file);
        } else if (isMarkdown) {
            // 单个 Markdown 文件导入 - 直接发送文本内容
            var text = await file.text();
            var headers = { 'Content-Type': 'application/json' };
            if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
            
            showToast('正在导入 Markdown 文件...', 'info');
            
            var res = await fetch('/api/import-markdown', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ content: text, filename: file.name })
            });
            var result = await res.json();
            if (result.error) {
                showToast('[ERROR] ' + escapeHtml(result.error), 'error');
            } else {
                showToast('✅ 导入完成 (成功: ' + result.imported + ', 跳过: ' + result.skipped + ', 失败: ' + result.failed + ')', 'success');
                loadAdminPosts();
            }
        } else {
            // 尝试作为 JSON 处理（向后兼容）
            var text = await file.text();
            var data = JSON.parse(text);
            if (data.posts && Array.isArray(data.posts)) {
                showToast('确认导入？所有文章将被重新分配新的 ID。', 'info', [
                    { label: '确认', confirm: true, action: function() { doImport(data); } },
                    { label: '取消', action: function() {} }
                ]);
            } else {
                throw new Error('不支持的文件格式，请上传 .zip 或 .md 文件');
            }
        }
    } catch (err) {
        showToast('[ERROR] ' + escapeHtml(err.message), 'error');
    }
    event.target.value = '';
}

async function doImport(data) {
    try {
        var headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
        var res = await fetch('/api/import', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });
        var result = await res.json();
        if (!res.ok) {
            throw new Error(result.error || '导入失败');
        }
        showToast('✅ ' + escapeHtml(result.message) + ' (成功: ' + result.imported + ', 失败: ' + result.failed + ', 总计: ' + result.total + ')', 'success');
        loadAdminPosts();
    } catch (err) {
        showToast('[ERROR] ' + escapeHtml(err.message), 'error');
    }
}