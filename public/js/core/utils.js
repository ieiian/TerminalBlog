    // ============ Global Safe Copy Function (Supports HTTP/HTTPS Context) ============
    function copyTextToClipboard(text) {
        return new Promise(function(resolve, reject) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(resolve).catch(reject);
                return;
            }
            try {
                var textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.top = "0";
                textArea.style.left = "0";
                textArea.style.position = "fixed";
                textArea.style.opacity = "0";
                textArea.style.width = "2em";
                textArea.style.height = "2em";
                textArea.style.padding = "0";
                textArea.style.border = "none";
                textArea.style.outline = "none";
                textArea.style.boxShadow = "none";
                textArea.style.background = "transparent";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                var successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    resolve();
                } else {
                    reject(new Error('Copy failed'));
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    // ============ Toast Notification ============
    function showToast(message, type, actions) {
        var container = document.getElementById('toastContainer');
        var toast = document.createElement('div');
        toast.className = 'toast-bar';

        var typeClass = type === 'success' ? 'toast-success' :
                        type === 'error' ? 'toast-error' :
                        type === 'info' ? 'toast-info' : '';

        var html = '<div class="' + typeClass + '">' + message + '</div>';

        if (actions && actions.length > 0) {
            html += '<div class="toast-actions">';
            actions.forEach(function(act, i) {
                var cls = act.confirm ? 'confirm-btn' : '';
                html += '<button class="' + cls + '" data-idx="' + i + '">' + act.label + '</button>';
            });
            html += '</div>';
        }

        toast.innerHTML = html;
        container.appendChild(toast);

        if (actions && actions.length > 0) {
            var btns = toast.querySelectorAll('.toast-actions button');
            btns.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var idx = parseInt(this.getAttribute('data-idx'));
                    removeToast(toast);
                    if (actions[idx] && actions[idx].action) actions[idx].action();
                });
            });
        } else {
            setTimeout(function() {
                removeToast(toast);
            }, 3000);
        }
    }

    function removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.add('fade-out');
        setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 1000);
    }

    // ============ Markdown Parser (using marked.js) ============
    // Wait for marked to load, then configure it
    function initMarked() {
        if (typeof marked === 'undefined') {
            setTimeout(initMarked, 100);
            return;
        }

        // Configure marked options
        marked.setOptions({
            breaks: true,
            gfm: true
        });

        // Create custom renderer for code blocks with copy button
        const renderer = new marked.Renderer();

        // Override code block rendering
        renderer.code = function(code, language) {
            var lang = language || '';
            var encoded = btoa(unescape(encodeURIComponent(code)));
            return '<div class="code-block"><button class="copy-btn" data-lang="' + lang + '" data-code="' + encoded + '">复制</button><pre><code class="language-' + lang + '">' + escapeHtml(code) + '</code></pre></div>';
        };

        // Override link rendering (open in new tab)
        renderer.link = function(href, title, text) {
            var titleAttr = title ? ' title="' + title + '"' : '';
            return '<a href="' + href + '" target="_blank"' + titleAttr + '>' + text + '</a>';
        };

        // Override image rendering
        renderer.image = function(href, title, text) {
            var titleAttr = title ? ' title="' + title + '"' : '';
            return '<img src="' + href + '" alt="' + (text || '') + '"' + titleAttr + '>';
        };

        // Override table rendering
        renderer.table = function(header, body) {
            return '<div style="overflow-x:auto;"><table class="md-table"><thead>' + header + '</thead><tbody>' + body + '</tbody></table></div>';
        };

        marked.use({ renderer: renderer });
    }

    // Start initialization
    initMarked();

    function parseMarkdown(md) {
        if (!md) return '';
        
        if (typeof marked === 'undefined') {
            return '<pre>' + escapeHtml(md) + '</pre>';
        }
        
        try {
            return marked.parse(md);
        } catch (e) {
            console.error('Markdown parse error:', e);
            return '<pre>' + escapeHtml(md) + '</pre>';
        }
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, '&#039;');
    }

    // ============ 初始化页脚信息 ============
    function initFooter() {
        const footer = document.getElementById('siteFooter');
        if (!footer) return;

        const siteUrl = SITE_CONFIG && SITE_CONFIG.siteUrl ? SITE_CONFIG.siteUrl : '';
        const icpNumber = SITE_CONFIG && SITE_CONFIG.icpNumber ? SITE_CONFIG.icpNumber : '';

        let footerHtml = '';
        if (siteUrl) {
            footerHtml += '<strong>HOST:</strong> <a href="' + siteUrl + '" target="_blank" style="color: inherit; text-decoration: underline; text-underline-offset: 3px;">' + siteUrl.replace(/^https?:\/\//, '') + '</a>';
        }
        footerHtml += ' | <strong>STATUS:</strong> <span style="color: #00ff00;">RUNNING</span>';
        if (icpNumber) {
            footerHtml += ' | <strong>ICP:</strong> <a href="https://beian.miit.gov.cn/" target="_blank" style="color: inherit; text-decoration: underline; text-underline-offset: 3px;">' + icpNumber + '</a>';
        }

        footer.innerHTML = footerHtml;
    }

