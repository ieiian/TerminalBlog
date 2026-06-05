// ============ Auth Functions ============
function isLoggedIn() {
    return !!authToken;
}

function clearAuth() {
    authToken = null;
    authUser = null;
    localStorage.removeItem('blog_token');
    localStorage.removeItem('blog_user');
}

async function doLogin() {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    if (!username || !password) {
        showToast('[ERROR] 请输入用户名和密码', 'error');
        return;
    }
    try {
        const result = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        }).then(r => {
            if (!r.ok) return r.json().then(e => { throw new Error(e.error || '登录失败'); });
            return r.json();
        });
        authToken = result.token;
        authUser = result.username;
        localStorage.setItem('blog_token', authToken);
        localStorage.setItem('blog_user', authUser);
        showToast('✅ 登录成功', 'success');
        render();
    } catch (err) {
        showToast('[ERROR] ' + escapeHtml(err.message), 'error');
    }
}

async function doLogout() {
    try {
        if (authToken) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
        }
    } catch (e) {}
    clearAuth();
    navigate('admin');
}

async function checkAuth() {
    if (!authToken) return false;
    try {
        const res = await fetch('/api/auth/verify', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.valid) {
            authUser = data.username;
            return true;
        }
        clearAuth();
        return false;
    } catch (e) {
        return false;
    }
}