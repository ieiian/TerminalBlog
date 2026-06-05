// ============ API Calls ============
    async function apiGet(path, options) {
        options = options || {};
        const res = await fetch(`/api${path}`, options);
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    }

    async function apiPost(path, data) {
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
        const res = await fetch(`/api${path}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
        if (res.status === 401) {
            clearAuth();
            const err = await res.json().catch(() => ({ error: '登录已过期' }));
            throw new Error(err.error || '需要重新登录');
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || res.statusText);
        }
        return res.json();
    }

    async function apiDelete(path) {
        const headers = {};
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
        const res = await fetch(`/api${path}`, {
            method: 'DELETE',
            headers
        });
        if (res.status === 401) {
            clearAuth();
            throw new Error('需要重新登录');
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `API Error: ${res.status}`);
        }
        return res.json();
    }

    // 从 SITE_CONFIG 读取上传大小上限（字节）
    function getUploadMaxBytes(folder) {
        var cfg = typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG : {};
        var mb;
        if (folder === 'blogimgs') {
            mb = cfg.maxUploadSizeBlogimgsMB != null ? cfg.maxUploadSizeBlogimgsMB : 10;
        } else if (folder === 'guestupload' || folder === 'guestuploads') {
            mb = cfg.maxUploadSizeGuestMB != null ? cfg.maxUploadSizeGuestMB : 50;
        } else {
            mb = cfg.maxUploadSizeBlogfilesMB != null ? cfg.maxUploadSizeBlogfilesMB : 100;
        }
        mb = Number(mb);
        if (!mb || mb <= 0) {
            if (folder === 'blogimgs') mb = 10;
            else if (folder === 'guestupload' || folder === 'guestuploads') mb = 50;
            else mb = 100;
        }
        return mb * 1024 * 1024;
    }

    function getGuestUploadMaxMB() {
        return Math.round(getUploadMaxBytes('guestupload') / (1024 * 1024));
    }

    function formatBytesHint(bytes) {
        if (bytes >= 1024 * 1024 * 1024) {
            return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
        }
        if (bytes >= 1024 * 1024) {
            return Math.round(bytes / (1024 * 1024)) + ' MB';
        }
        if (bytes >= 1024) {
            return Math.round(bytes / 1024) + ' KB';
        }
        return bytes + ' B';
    }

    function getUploadMaxHint(folder) {
        return formatBytesHint(getUploadMaxBytes(folder));
    }

    async function apiPut(path, data) {
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
        const res = await fetch(`/api${path}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        });
        if (res.status === 401) {
            clearAuth();
            const err = await res.json().catch(() => ({ error: '登录已过期' }));
            throw new Error(err.error || '需要重新登录');
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || res.statusText);
        }
        return res.json();
    }