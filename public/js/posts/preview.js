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
                    '<a onclick="closePreview()" style="color: var(--cyan);">[◀ 返回编辑]</a>' +
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