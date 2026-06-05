// ============ Terminal Dot Buttons Functions ============

// 绿色按钮：刷新页面 + 触发 AI 光晕效果（保持当前页面状态）
function refreshWithEffect() {
    // 清除 AI 光晕标记，这样刷新后会重新触发
    sessionStorage.removeItem('ai_corona_shown');
    
    // 保存当前页面状态，用于刷新后恢复
    var refreshState = {
        view: currentView,
        slug: currentSlug,
        tag: currentTag,
        page: currentPage,
        url: window.location.pathname + window.location.search
    };
    sessionStorage.setItem('refresh_state', JSON.stringify(refreshState));
    
    // 刷新页面
    location.reload();
}

// 黄色按钮：最小化 Terminal
var isMinimized = false;
var terminalOriginalState = null;

function minimizeTerminal() {
    var terminal = document.querySelector('.terminal');
    var termFooter = document.querySelector('.term-footer');
    
    if (termFooter) termFooter.style.visibility = 'hidden';
    
    if (!isMinimized) {
        // 保存原始状态
        terminalOriginalState = {
            opacity: terminal.style.opacity || '1',
            transform: terminal.style.transform || 'none',
            margin: terminal.style.margin || '',
            position: terminal.style.position || '',
            left: terminal.style.left || '',
            top: terminal.style.top || '',
            width: terminal.style.width || ''
        };
        
        // 获取 terminal 位置和尺寸
        var rect = terminal.getBoundingClientRect();
        var startX = rect.left + rect.width / 2;
        var startY = rect.top + rect.height / 2;
        
        // 创建收缩圆圈 canvas
        var canvas = document.createElement('canvas');
        canvas.id = 'minimizeSwallowCanvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
        document.body.appendChild(canvas);
        
        var ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // 收缩动画参数 - 黑洞三层圈效果，更流畅
        var absorbDuration = 1200; // 增加动画时长，更流畅
        var startTime = performance.now();
        var maxRadius = Math.max(rect.width, rect.height) * 1.2; // 从更大的半径开始
        // 目标位置：屏幕正上方中心
        var targetX = window.innerWidth / 2;
        var targetY = window.innerHeight * 0.12;
        
        function easeInOutQuart(t) {
            return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
        }
        
        function animateShrink(ts) {
            var elapsed = ts - startTime;
            var progress = Math.min(elapsed / absorbDuration, 1);
            var ease = easeInOutQuart(progress);
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 计算当前位置（从原位置向目标位置移动）
            var currentX = startX + (targetX - startX) * ease;
            var currentY = startY + (targetY - startY) * ease;
            
            // 圆圈半径逐渐缩小（从大到小）
            var radius = maxRadius * (1 - Math.pow(ease, 0.8));
            
            // 圆圈透明度：渐入渐出
            var alpha = 1;
            if (progress < 0.15) {
                alpha = progress / 0.15;
            } else if (progress > 0.85) {
                alpha = (1 - progress) / 0.15;
            }
            
            // 黑洞三层圈效果（类似小球样式）
            if (alpha > 0.01 && radius > 5) {
                // 外圈 - 粉紫色虚线
                ctx.beginPath();
                ctx.arc(currentX, currentY, radius * 1.15, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 0, 128, ' + (alpha * 0.5) + ')';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 中圈 - 紫色
                ctx.beginPath();
                ctx.arc(currentX, currentY, radius * 1.07, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(138, 43, 226, ' + (alpha * 0.6) + ')';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // 内圈 - 深紫色实线
                ctx.beginPath();
                ctx.arc(currentX, currentY, radius, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(75, 0, 130, ' + (alpha * 0.7) + ')';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                
                // 中心黑洞核心
                if (radius > 15) {
                    var coreGrad = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, radius * 0.5);
                    coreGrad.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.8) + ')');
                    coreGrad.addColorStop(0.7, 'rgba(0, 0, 0, ' + (alpha * 0.3) + ')');
                    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.beginPath();
                    ctx.arc(currentX, currentY, radius * 0.5, 0, Math.PI * 2);
                    ctx.fillStyle = coreGrad;
                    ctx.fill();
                }
            }
            
            // Terminal 跟随收缩并向上移动，逐渐透明消失
            var terminalScale = 1 - ease * 0.95;
            var terminalOpacity = 1 - ease; // 逐渐消失
            var terminalX = startX + (targetX - startX) * ease;
            var terminalY = startY + (targetY - startY) * ease;
            
            terminal.style.position = 'fixed';
            terminal.style.left = terminalX + 'px';
            terminal.style.top = terminalY + 'px';
            terminal.style.transform = 'translate(-50%, -50%) scale(' + terminalScale + ')';
            terminal.style.opacity = terminalOpacity;
            terminal.style.width = rect.width + 'px';
            terminal.style.transformOrigin = 'center center';
            termFooter.style.opacity = terminalOpacity;
            
            if (progress < 1) {
                requestAnimationFrame(animateShrink);
            } else {
                // 动画完成
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvas.remove();
                
                terminal.style.display = 'none';
                terminal.style.transform = '';
                terminal.style.opacity = '';
                terminal.style.position = '';
                terminal.style.left = '';
                terminal.style.top = '';
                terminal.style.width = '';
                termFooter.style.display = 'none';
                termFooter.style.opacity = '';
                
                isMinimized = true;
                createMinimizeBall(targetY); // 小球从最终位置掉落
            }
        }
        
        requestAnimationFrame(animateShrink);
    }
}

// 创建收纳小球
function createMinimizeBall(y) {
    // 移除已存在的 ball
    var existingBall = document.getElementById('minimizeBall');
    if (existingBall) existingBall.remove();
    
    var ball = document.createElement('div');
    ball.id = 'minimizeBall';
    ball.className = 'style-1';
    // 立即设置位置，避免在左上角闪烁
    ball.style.position = 'fixed';
    ball.style.left = (window.innerWidth / 2 - 27.5) + 'px';
    ball.style.top = '-60px';
    
    // 黑洞样式 HTML 结构
    ball.innerHTML = `
        <div class="blackhole-swirl"></div>
        <div class="blackhole-ring blackhole-ring-1"></div>
        <div class="blackhole-ring blackhole-ring-2"></div>
        <div class="blackhole-ring blackhole-ring-3"></div>
        <div class="blackhole-core"></div>
    `;
    // 点击恢复 terminal
    ball.addEventListener('click', restoreTerminal);
    
    // 悬停时减慢速度
    var isHovered = false;
    ball.addEventListener('mouseenter', function() { isHovered = true; });
    ball.addEventListener('mouseleave', function() { isHovered = false; });
    
    // 重要：必须将小球添加到 body
    document.body.appendChild(ball);

    // 物理弹跳动画
    var ballSize = 60;
    var startX = window.innerWidth / 2 - ballSize / 2;
    var startY = 100;
    var velocityY = 0;
    var velocityX = (Math.random() - 0.5) * 8;
    var posY = startY;
    var posX = startX;
    var gravity = 0.4;
    var bounce = 0.7;
    var friction = 0.99;
    var groundY = window.innerHeight - ballSize - 30;
    
    // 弹性属性
    var elasticity = 0.85;
    var maxBounce = groundY - 80;
    
    // 从屏幕正中间上方开始掉落
    posX = window.innerWidth / 2 - ballSize / 2;
    posY = -ballSize; // 从屏幕顶部上方开始
    
    function animateBall(ts) {
        if (!document.getElementById('minimizeBall')) return;
        
        // 悬停时大幅减慢速度，但不是完全静止
        var timeScale = isHovered ? 0.08 : 1;
        
        velocityY += gravity * timeScale;
        posY += velocityY * timeScale;
        posX += velocityX * timeScale;
        
        // 边界反弹
        if (posY > maxBounce) {
            posY = maxBounce;
            velocityY = -velocityY * bounce;
            velocityX *= friction;
        }
        
        // 左右边界
        if (posX < 10 || posX > window.innerWidth - ballSize - 10) {
            velocityX = -velocityX * 0.8;
            posX = Math.max(10, Math.min(window.innerWidth - ballSize - 10, posX));
        }
        
        ball.style.left = posX + 'px';
        ball.style.top = posY + 'px';
        
        // 悬停时旋转变慢
        var rotationScale = isHovered ? 0.15 : 1;
        var rotation = velocityX * 2 * rotationScale;
        ball.style.transform = 'rotate(' + rotation + 'deg)';
        
        // 轻微悬浮动画（悬停时也变慢）
        if (Math.abs(velocityY) < 0.5 && Math.abs(velocityX) < 0.5) {
            velocityY = Math.sin(ts * 0.003) * 0.3 * timeScale;
        }
        
        requestAnimationFrame(animateBall);
    }
    
    requestAnimationFrame(animateBall);
}

// 恢复 Terminal
function restoreTerminal() {
    var terminal = document.querySelector('.terminal');
    var termFooter = document.querySelector('.term-footer');
    var ball = document.getElementById('minimizeBall');
    
    if (!ball) return;
    
    // 球向上飞向屏幕中央上方
    var ballRect = ball.getBoundingClientRect();
    var targetY = -100;
    var targetX = window.innerWidth / 2 - 30;
    
    var startY = ballRect.top;
    var startX = ballRect.left;
    var startTime = performance.now();
    var duration = 500;
    
    function animateFly(ts) {
        var elapsed = ts - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var easeProgress = 1 - Math.pow(1 - progress, 2);
        
        var currentY = startY + (targetY - startY) * easeProgress;
        var currentX = startX + (targetX - startX) * easeProgress;
        ball.style.top = currentY + 'px';
        ball.style.left = currentX + 'px';
        ball.style.opacity = 1 - progress;
        ball.style.transform = 'scale(' + (1 - progress * 0.5) + ')';
        
        if (progress < 1) {
            requestAnimationFrame(animateFly);
        } else {
            ball.remove();
            
            // 恢复 terminal
            terminal.style.display = '';
            terminal.style.opacity = '';
            terminal.style.transform = '';
            terminal.style.position = '';
            terminal.style.left = '';
            terminal.style.top = '';
            terminal.style.width = '';
            terminal.style.margin = '';
            termFooter.style.display = '';
            termFooter.style.visibility = '';
            
            // 淡入效果
            terminal.style.opacity = '0';
            terminal.style.transition = 'opacity 0.3s ease';
            setTimeout(function() {
                terminal.style.opacity = '1';
                setTimeout(function() {
                    terminal.style.transition = '';
                }, 300);
            }, 50);
            
            isMinimized = false;
        }
    }
    
    requestAnimationFrame(animateFly);
}

// 页面加载时检查是否需要恢复最小化状态（可选）
window.addEventListener('load', function() {
    // 检查 URL 参数或其他状态
    var urlParams = new URLSearchParams(window.location.search);
    // 如果需要保持最小化状态，可以在这里恢复
});