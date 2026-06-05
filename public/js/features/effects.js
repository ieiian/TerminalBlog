// ============ AI 按钮首次加载 — 高科技线性光晕/星芒效果 ============
(function initTechLensEffect() {
    // 检查配置开关：是否启用首次访问光晕特效
    if (AI_CONFIG && AI_CONFIG.showFirstVisitGlow === false) return;

    // 每次浏览器会话（标签页）只触发一次
    var STORAGE_KEY = 'ai_corona_shown';
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    sessionStorage.setItem(STORAGE_KEY, '1');

    // 延迟执行，等待 DOM 布局完成
    setTimeout(function() {
        var aiBtn = document.getElementById('aiBtn');
        var canvas = document.getElementById('ai-ripple-canvas');
        if (!aiBtn || !canvas) return;

        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;

        // 高分辨率屏幕适配
        canvas.width  = window.innerWidth  * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width  = window.innerWidth  + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.scale(dpr, dpr);

        var W = window.innerWidth;
        var H = window.innerHeight;

        // 以 AI 按钮中心为光晕原点（动态更新以跟随滚动）
        function updateButtonPosition() {
            var btnRect = aiBtn.getBoundingClientRect();
            var newCx = btnRect.left + btnRect.width  / 2;
            var newCy = btnRect.top  + btnRect.height / 2;
            
            // 动态更新最大扩散半径
            maxDist = Math.sqrt(
                Math.pow(Math.max(newCx, W - newCx), 2) +
                Math.pow(Math.max(newCy, H - newCy), 2)
            ) * 1.15;
            
            return { cx: newCx, cy: newCy };
        }
        
        var maxDist = 0;
        var btnPos = updateButtonPosition();
        var cx = btnPos.cx;
        var cy = btnPos.cy;

        // 参数配置
        var TOTAL_DURATION = 4800;  // 总动画时长 ms
        var FADE_OUT_AT    = 3600;  // 从此刻开始全局淡出

        // 六边形顶点计算（几何幽灵影）
        function getHexagonPoints(cx, cy, radius, rotation) {
            var points = [];
            for (var i = 0; i < 6; i++) {
                var angle = (Math.PI / 3) * i + rotation - Math.PI / 2;
                points.push({
                    x: cx + radius * Math.cos(angle),
                    y: cy + radius * Math.sin(angle)
                });
            }
            return points;
        }

        function drawHexagon(cx, cy, radius, rotation) {
            var points = getHexagonPoints(cx, cy, radius, rotation);
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (var i = 1; i < 6; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.closePath();
        }

        // 绘制星芒光线
        function drawStarBurst(cx, cy, count, innerRadius, outerRadius, alpha, rotation, colorRGB) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotation);

            for (var i = 0; i < count; i++) {
                var angle = (Math.PI * 2 / count) * i;
                var pulseOffset = Math.sin(i * 0.7 + Date.now() * 0.003) * 0.15;

                // 光线渐变
                var rayLen = outerRadius * (0.8 + pulseOffset);
                var rayGrad = ctx.createLinearGradient(
                    Math.cos(angle) * innerRadius,
                    Math.sin(angle) * innerRadius,
                    Math.cos(angle) * rayLen,
                    Math.sin(angle) * rayLen
                );
                rayGrad.addColorStop(0, 'rgba(' + colorRGB[0] + ',' + colorRGB[1] + ',' + colorRGB[2] + ',' + (alpha * 0.9) + ')');
                rayGrad.addColorStop(0.3, 'rgba(' + colorRGB[0] + ',' + colorRGB[1] + ',' + colorRGB[2] + ',' + (alpha * 0.6) + ')');
                rayGrad.addColorStop(0.7, 'rgba(' + colorRGB[0] + ',' + colorRGB[1] + ',' + colorRGB[2] + ',' + (alpha * 0.2) + ')');
                rayGrad.addColorStop(1, 'rgba(' + colorRGB[0] + ',' + colorRGB[1] + ',' + colorRGB[2] + ',0)');

                // 主光线
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
                ctx.lineTo(Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
                ctx.strokeStyle = rayGrad;
                ctx.lineWidth = 2.5 * (1 - i / count * 0.3);
                ctx.lineCap = 'round';
                ctx.stroke();

                // 光线外缘发光
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
                ctx.lineTo(Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
                ctx.strokeStyle = 'rgba(' + colorRGB[0] + ',' + colorRGB[1] + ',' + colorRGB[2] + ',' + (alpha * 0.15) + ')';
                ctx.lineWidth = 8;
                ctx.stroke();
            }

            ctx.restore();
        }

        var startTime = null;

        function draw(ts) {
            if (!startTime) startTime = ts;
            var elapsed = ts - startTime;

            // 动画结束 — 清理画布并隐藏
            if (elapsed >= TOTAL_DURATION) {
                ctx.clearRect(0, 0, W, H);
                canvas.style.display = 'none';
                return;
            }

            // 动态更新 AI 按钮位置（跟随滚动）
            var btnPos = updateButtonPosition();
            cx = btnPos.cx;
            cy = btnPos.cy;

            ctx.clearRect(0, 0, W, H);

            // 全局淡出系数
            var gFade = elapsed > FADE_OUT_AT
                ? 1 - (elapsed - FADE_OUT_AT) / (TOTAL_DURATION - FADE_OUT_AT)
                : 1;

            // 轻微呼吸效果
            var breathe = Math.sin(elapsed * 0.003) * 0.5 + 0.5;
            var hexRotation = elapsed * 0.0003;  // 六边形缓慢旋转
            var burstRotation = elapsed * 0.0008;  // 星芒旋转

            // ======== 内层六边形（实线）=======
            {
                var innerAlpha = Math.min(1, elapsed / 400) * 0.4 * gFade;
                // 从 3000ms 开始渐隐（不再突然消失）
                if (elapsed > 3000) {
                    innerAlpha = innerAlpha * Math.max(0, 1 - (elapsed - 3000) / 1200);
                }
                if (innerAlpha > 0.005) {
                    var innerRadius = 40 + Math.min(elapsed, 3000) * 0.015;
                    drawHexagon(cx, cy, innerRadius, hexRotation * 1.5);
                    ctx.strokeStyle = 'rgba(210, 168, 255,' + innerAlpha + ')';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // 内层六边形填充
                    var innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerRadius);
                    innerGrad.addColorStop(0, 'rgba(210, 168, 255,' + (innerAlpha * 0.3) + ')');
                    innerGrad.addColorStop(1, 'rgba(210, 168, 255,0)');
                    ctx.fillStyle = innerGrad;
                    ctx.fill();
                }
            }

            // ======== 强星光芒（12方向） ========
            if (elapsed > 200) {
                var burstAlpha = Math.min(1, (elapsed - 200) / 600) * 0.35 * gFade;
                var burstRadius = maxDist * (0.25 + elapsed * 0.0008);
                // 青色星芒
                drawStarBurst(cx, cy, 12, 20, burstRadius * 1.2, burstAlpha * 0.7, burstRotation, [0, 229, 255]);
            }

            // ======== 二次星芒（6方向，长光线） ========
            if (elapsed > 400) {
                var burst2Alpha = Math.min(1, (elapsed - 400) / 500) * 0.25 * gFade;
                var burst2Radius = maxDist * (0.4 + elapsed * 0.001);
                // 绿色星芒
                drawStarBurst(cx, cy, 6, 30, burst2Radius, burst2Alpha, -burstRotation * 0.6, [0, 255, 65]);
            }

            // ======== 太阳核心 — 明亮但不刺眼 ========
            if (elapsed < 3500) {
                // 核心亮度曲线：快速亮起 → 轻微呼吸 → 平滑消散
                var coreT;
                if (elapsed < 300) {
                    coreT = elapsed / 300;  // 快速亮起
                } else if (elapsed < 2200) {
                    coreT = 0.9 + Math.sin((elapsed - 300) * 0.004) * 0.1;  // 轻微呼吸
                } else {
                    coreT = Math.max(0, 0.85 - (elapsed - 2200) / 1300);  // 缓慢消散
                }

                var coreA = coreT * 0.9 * gFade;
                var coreR = 18 + coreT * 12;

                // 最内核 — 纯白光（高科技镜头质感）
                var innerCore = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
                innerCore.addColorStop(0,   'rgba(255, 255, 255, ' + (coreA * 0.95) + ')');
                innerCore.addColorStop(0.2, 'rgba(240, 250, 255, ' + (coreA * 0.8) + ')');
                innerCore.addColorStop(0.5, 'rgba(200, 230, 255, ' + (coreA * 0.5) + ')');
                innerCore.addColorStop(1,   'rgba(150, 200, 255, 0)');
                ctx.fillStyle = innerCore;
                ctx.beginPath();
                ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
                ctx.fill();

                // 第二层 — 青色光晕（高科技蓝色调）
                var techHalo = ctx.createRadialGradient(cx, cy, coreR * 0.4, cx, cy, coreR * 2.5);
                techHalo.addColorStop(0,   'rgba(0, 229, 255, ' + (coreA * 0.4) + ')');
                techHalo.addColorStop(0.4, 'rgba(0, 200, 255, ' + (coreA * 0.2) + ')');
                techHalo.addColorStop(1,   'rgba(0, 150, 200, 0)');
                ctx.fillStyle = techHalo;
                ctx.beginPath();
                ctx.arc(cx, cy, coreR * 2.5, 0, Math.PI * 2);
                ctx.fill();

                // 十字星芒（中心高光）
                var crossAlpha = coreA * 0.5;
                var crossLen = coreR * 3;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(burstRotation * 0.5);

                // 横线
                var crossGradH = ctx.createLinearGradient(-crossLen, 0, crossLen, 0);
                crossGradH.addColorStop(0, 'rgba(255,255,255,0)');
                crossGradH.addColorStop(0.4, 'rgba(255,255,255,' + (crossAlpha * 0.3) + ')');
                crossGradH.addColorStop(0.5, 'rgba(255,255,255,' + crossAlpha + ')');
                crossGradH.addColorStop(0.6, 'rgba(255,255,255,' + (crossAlpha * 0.3) + ')');
                crossGradH.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.beginPath();
                ctx.moveTo(-crossLen, 0);
                ctx.lineTo(crossLen, 0);
                ctx.strokeStyle = crossGradH;
                ctx.lineWidth = 3;
                ctx.stroke();

                // 竖线
                var crossGradV = ctx.createLinearGradient(0, -crossLen, 0, crossLen);
                crossGradV.addColorStop(0, 'rgba(255,255,255,0)');
                crossGradV.addColorStop(0.4, 'rgba(255,255,255,' + (crossAlpha * 0.3) + ')');
                crossGradV.addColorStop(0.5, 'rgba(255,255,255,' + crossAlpha + ')');
                crossGradV.addColorStop(0.6, 'rgba(255,255,255,' + (crossAlpha * 0.3) + ')');
                crossGradV.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.beginPath();
                ctx.moveTo(0, -crossLen);
                ctx.lineTo(0, crossLen);
                ctx.strokeStyle = crossGradV;
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.restore();
            }

            // ======== 线性光晕边缘（高科技扫描线效果） ========
            if (elapsed > 100 && elapsed < 4000) {
                var lineAlpha = Math.min(1, (elapsed - 100) / 300) * 0.15 * gFade;
                var lineCount = 24;
                ctx.save();
                ctx.globalCompositeOperation = 'screen';

                for (var i = 0; i < lineCount; i++) {
                    var lineAngle = (Math.PI * 2 / lineCount) * i + hexRotation;
                    var lineLen = maxDist * (0.6 + Math.sin(i * 0.8 + elapsed * 0.002) * 0.2);
                    var lineAlphaMod = lineAlpha * (0.5 + Math.sin(i * 1.2 + elapsed * 0.003) * 0.5);

                    var lineGrad = ctx.createLinearGradient(
                        cx, cy,
                        cx + Math.cos(lineAngle) * lineLen,
                        cy + Math.sin(lineAngle) * lineLen
                    );
                    lineGrad.addColorStop(0, 'rgba(0, 229, 255,' + (lineAlphaMod * 0.8) + ')');
                    lineGrad.addColorStop(0.5, 'rgba(0, 255, 65,' + (lineAlphaMod * 0.4) + ')');
                    lineGrad.addColorStop(1, 'rgba(0, 229, 255,0)');

                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(
                        cx + Math.cos(lineAngle) * lineLen,
                        cy + Math.sin(lineAngle) * lineLen
                    );
                    ctx.strokeStyle = lineGrad;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                ctx.restore();
            }

            requestAnimationFrame(draw);
        }

        requestAnimationFrame(draw);
    }, 1200); // 延迟 1.2 秒，让页面内容先渲染
})();// ============ Matrix Rain Background ============
(function() {
    var canvas = document.getElementById('matrix-bg');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    
    var cols, drops;
    var fontSize = 11;
    var hue = 140; // 经典的黑客绿

    // 检测是否为移动端
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    // 更可靠的 Safari 检测
    // 检测需要风雪效果的浏览器（Safari、Firefox 等存在代码雨渲染问题的浏览器）
    var isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
    var isFirefox = /Firefox/i.test(navigator.userAgent);
    var isEdge = /Edg/i.test(navigator.userAgent);
    // 需要风雪效果的浏览器：Safari、Firefox
    // 其他浏览器（Chrome、Edge 等）使用代码雨效果
    var needsSnowEffect = isSafari || isFirefox;
    var clearAlpha = isMobile ? 0.03 : 0.005;

    // 映射基础字符集
    var BASE_SETS = {
        '1': 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン',
        '2': '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        '3': '01',
        '4': '一二三四五六七八九十零甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥临兵斗者皆阵列在前天地神佛'
    };

    // 获取全局配置
    var config = window.SITE_CONFIG || {};
    var isStartupRandom = config.matrixRainStartupRandom === true || config.matrixRainStartupRandom === 'true';
    var fixedMode = String(config.matrixRainFixedMode || '1');

    // 【新增参数控制】随机算法模式: 'average'(等概率) / 'decay'(指数递减概率)
    var randomAlgorithm = config.matrixRainRandomAlgorithm || 'average';

    // 默认兜底数组（为了体现梯度递减，默认池子可以配置更长，供算法筛选）
    var rainRandomPool = ['1', '2', '3', '4', '2+3', '1+4', '1+2+3+4']; 

    // 九字真言，作为特殊符号单独处理，增加辨识度和趣味性
    var spellChars = '临兵斗者皆阵列在前';

    // 佛字单独成一档，触发特殊效果
    var buddhaChar = '佛';
    var enableBuddhaEffect = config.matrixRainEnableBuddhaEffect === true || config.matrixRainEnableBuddhaEffect === 'true'; 

    if (config.matrixRainRandomPool) {
        if (Array.isArray(config.matrixRainRandomPool)) {
            rainRandomPool = config.matrixRainRandomPool;
        } else if (typeof config.matrixRainRandomPool === 'string') {
            rainRandomPool = config.matrixRainRandomPool.split(',');
        }
    }
    var activeMode = '1'; 

    if (!isStartupRandom) {
        activeMode = fixedMode;
    } else {
        var lastMode = sessionStorage.getItem('matrix_rain_last_mode');
        
        var filteredPool = rainRandomPool.filter(function(mode) {
            var modeStr = typeof mode === 'string' ? mode.trim() : String(mode);
            var lastModeStr = lastMode ? lastMode.trim() : '';
            return modeStr !== lastModeStr;
        });
        
        if (filteredPool.length === 0) {
            filteredPool = rainRandomPool;
        }

        // 核心算法分流层
        var chosenMode = filteredPool[0]; // 默认兜底选第一个

        if (randomAlgorithm === 'decay' && filteredPool.length > 1) {
            var index = 0;
            var maxIndex = filteredPool.length - 1;
            
            while (Math.random() < 0.50 && index < maxIndex) {
                index++;
            }
            chosenMode = filteredPool[index];
        } else {
            chosenMode = filteredPool[Math.floor(Math.random() * filteredPool.length)];
        }

        activeMode = typeof chosenMode === 'string' ? chosenMode.trim() : String(chosenMode);
        sessionStorage.setItem('matrix_rain_last_mode', activeMode);
    }
    console.log('当前雨幕运行模式确定为:', activeMode, '【使用的是 ' + randomAlgorithm + ' 随机算法】');

    function getMixedChars(modeString) {
        var parts = modeString.split('+');
        var combined = '';
        for (var i = 0; i < parts.length; i++) {
            var key = parts[i].trim();
            if (BASE_SETS[key]) {
                combined += BASE_SETS[key];
            }
        }
        return combined || BASE_SETS['1'];
    }
    var cachedCharPool = getMixedChars(activeMode);

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        var newCols = Math.floor(canvas.width / fontSize);
        var oldDrops = drops || [];
        drops = [];
        for (var i = 0; i < newCols; i++) {
            if (oldDrops[i]) {
                drops[i] = oldDrops[i];
            } else {
                drops[i] = {
                    y: Math.random() * -100,
                    speed: 0.12 + Math.random() * 0.22,
                    currentChar: cachedCharPool[Math.floor(Math.random() * cachedCharPool.length)],
                    lastRow: -1,
                    brightness: 0.35
                };
            }
        }
        cols = newCols;
    }
    resize();
    window.addEventListener('resize', resize);

    // Safari 风雪效果 - 持久化雪花数组（在 draw 函数外部初始化）
    var snowChars = ['❄', '❅', '❆', '•', '·'];
    var snowflakes = [];
    var maxSnowflakes = 0;

    function initSnowflakes() {
        maxSnowflakes = Math.max(60, Math.floor(canvas.width / 8)); // 增加雪花数量
        snowflakes = [];
        for (var si = 0; si < maxSnowflakes; si++) {
            snowflakes[si] = {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: 12 + Math.random() * 10, // 稍大的雪花
                speed: 1.0 + Math.random() * 1.5, // 稍快的速度
                wind: (Math.random() - 0.5) * 0.5,
                char: snowChars[Math.floor(Math.random() * snowChars.length)],
                opacity: 0.6 + Math.random() * 0.3, // 更明显的透明度
                wobble: Math.random() * Math.PI * 2
            };
        }
    }
    initSnowflakes();

    function draw() {
        ctx.font = fontSize + 'px "JetBrains Mono", monospace';
        
        // Safari/Firefox 方案：风雪飘落 + 终端窗口凝霜效果
        if (needsSnowEffect) {
            // 每帧完全清除背景
            ctx.fillStyle = '#0d1117';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // ============ 风雪飘落效果（有序下落，不闪烁）===========
            var fadeStart = canvas.height * 0.75;
            for (var si = 0; si < snowflakes.length; si++) {
                var sf = snowflakes[si];
                
                // 更新位置
                sf.wobble += 0.02;
                sf.y += sf.speed;
                sf.x += sf.wind + Math.sin(sf.wobble) * 0.3;
                
                // 边界处理
                if (sf.y > canvas.height + 20) {
                    sf.y = -20;
                    sf.x = Math.random() * canvas.width;
                }
                if (sf.x < -20) sf.x = canvas.width + 20;
                if (sf.x > canvas.width + 20) sf.x = -20;
                
                // 根据位置调整透明度（底部渐隐）
                var adjustedOpacity = sf.opacity;
                if (sf.y > fadeStart) {
                    adjustedOpacity = sf.opacity * (1 - (sf.y - fadeStart) / (canvas.height - fadeStart + 50));
                }
                if (adjustedOpacity > 0.02) {
                    ctx.font = sf.size + 'px serif';
                    ctx.fillStyle = 'rgba(255, 255, 255, ' + adjustedOpacity + ')';
                    ctx.fillText(sf.char, sf.x, sf.y);
                }
            }
            
            // ============ 边缘凝霜效果 ============
            var frostThickness = 60; // 霜冻厚度
            var frostOpacity = 0.15; // 基础透明度
            
            // 创建霜冻渐变 - 顶部
            var topGrad = ctx.createLinearGradient(0, 0, 0, frostThickness);
            topGrad.addColorStop(0, 'rgba(200, 220, 255, ' + frostOpacity + ')');
            topGrad.addColorStop(0.5, 'rgba(180, 200, 240, ' + (frostOpacity * 0.5) + ')');
            topGrad.addColorStop(1, 'rgba(150, 180, 220, 0)');
            ctx.fillStyle = topGrad;
            ctx.fillRect(0, 0, canvas.width, frostThickness);
            
            // 底部霜冻
            var bottomGrad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - frostThickness);
            bottomGrad.addColorStop(0, 'rgba(200, 220, 255, ' + frostOpacity + ')');
            bottomGrad.addColorStop(0.5, 'rgba(180, 200, 240, ' + (frostOpacity * 0.5) + ')');
            bottomGrad.addColorStop(1, 'rgba(150, 180, 220, 0)');
            ctx.fillStyle = bottomGrad;
            ctx.fillRect(0, canvas.height - frostThickness, canvas.width, frostThickness);
            
            // 左侧霜冻
            var leftGrad = ctx.createLinearGradient(0, 0, frostThickness, 0);
            leftGrad.addColorStop(0, 'rgba(200, 220, 255, ' + frostOpacity + ')');
            leftGrad.addColorStop(0.5, 'rgba(180, 200, 240, ' + (frostOpacity * 0.5) + ')');
            leftGrad.addColorStop(1, 'rgba(150, 180, 220, 0)');
            ctx.fillStyle = leftGrad;
            ctx.fillRect(0, 0, frostThickness, canvas.height);
            
            // 右侧霜冻
            var rightGrad = ctx.createLinearGradient(canvas.width, 0, canvas.width - frostThickness, 0);
            rightGrad.addColorStop(0, 'rgba(200, 220, 255, ' + frostOpacity + ')');
            rightGrad.addColorStop(0.5, 'rgba(180, 200, 240, ' + (frostOpacity * 0.5) + ')');
            rightGrad.addColorStop(1, 'rgba(150, 180, 220, 0)');
            ctx.fillStyle = rightGrad;
            ctx.fillRect(canvas.width - frostThickness, 0, frostThickness, canvas.height);
            
            // 角落霜冻叠加（增强角落效果）
            var cornerSize = frostThickness * 0.7;
            
            // 左上角
            var tlGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, cornerSize);
            tlGrad.addColorStop(0, 'rgba(220, 235, 255, 0.2)');
            tlGrad.addColorStop(1, 'rgba(200, 220, 255, 0)');
            ctx.fillStyle = tlGrad;
            ctx.fillRect(0, 0, cornerSize, cornerSize);
            
            // 右上角
            var trGrad = ctx.createRadialGradient(canvas.width, 0, 0, canvas.width, 0, cornerSize);
            trGrad.addColorStop(0, 'rgba(220, 235, 255, 0.2)');
            trGrad.addColorStop(1, 'rgba(200, 220, 255, 0)');
            ctx.fillStyle = trGrad;
            ctx.fillRect(canvas.width - cornerSize, 0, cornerSize, cornerSize);
            
            // 左下角
            var blGrad = ctx.createRadialGradient(0, canvas.height, 0, 0, canvas.height, cornerSize);
            blGrad.addColorStop(0, 'rgba(220, 235, 255, 0.2)');
            blGrad.addColorStop(1, 'rgba(200, 220, 255, 0)');
            ctx.fillStyle = blGrad;
            ctx.fillRect(0, canvas.height - cornerSize, cornerSize, cornerSize);
            
            // 右下角
            var brGrad = ctx.createRadialGradient(canvas.width, canvas.height, 0, canvas.width, canvas.height, cornerSize);
            brGrad.addColorStop(0, 'rgba(220, 235, 255, 0.2)');
            brGrad.addColorStop(1, 'rgba(200, 220, 255, 0)');
            ctx.fillStyle = brGrad;
            ctx.fillRect(canvas.width - cornerSize, canvas.height - cornerSize, cornerSize, cornerSize);
        } else {
            // Chrome 使用 rgba 覆盖方案（原始效果）
            ctx.fillStyle = 'rgba(13, 17, 23, ' + clearAlpha + ')';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            for (var i = 0; i < cols; i++) {
                var drop = drops[i];
                drop.y += drop.speed;
                var row = Math.floor(drop.y);
                if (row !== drop.lastRow) {
                    drop.lastRow = row;
                    drop.currentChar = cachedCharPool[Math.floor(Math.random() * cachedCharPool.length)];
                }
                if (Math.random() > 0.90) {
                    drop.brightness = 1.0; 
                } else {
                    drop.brightness += (0.35 - drop.brightness) * 0.08; 
                }

                var isSpell = spellChars.indexOf(drop.currentChar) !== -1;
                var isBuddha = enableBuddhaEffect && drop.currentChar === buddhaChar;

                if (isBuddha) {
                    ctx.save();
                    ctx.fillStyle = '#FFFFFF';
                    ctx.shadowColor = 'rgba(255, 215, 0, 1)';
                    ctx.shadowBlur = 15;
                    ctx.font = 'bold ' + (fontSize + 1) + 'px monospace';
                    ctx.fillText(drop.currentChar, i * fontSize, row * fontSize);
                    ctx.restore();
                } else if (isSpell) {
                    ctx.fillStyle = 'hsla(45, 100%, 70%, 1)';
                    ctx.fillText(drop.currentChar, i * fontSize, row * fontSize);
                } else {
                    var lightness = 45 + drop.brightness * 55;
                    var alpha = drop.brightness * 0.85;
                    ctx.fillStyle = 'hsla(' + hue + ', 100%, ' + lightness + '%, ' + alpha + ')';
                    ctx.fillText(drop.currentChar, i * fontSize, row * fontSize);
                }

                if (drop.y * fontSize > canvas.height && Math.random() > 0.975) {
                    drop.y = 0;
                    drop.lastRow = -1;
                    drop.speed = 0.12 + Math.random() * 0.22;
                    drop.brightness = 0.35;
                }
            }
        }
    }
    function tick() {
        draw();
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    
    // Safari/Firefox 浏览器：自动为终端窗口添加凝霜效果
    if (needsSnowEffect) {
        // 等待 DOM 加载完成后添加凝霜 class
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(function() {
                var terminal = document.querySelector('.terminal');
                if (terminal) {
                    terminal.classList.add('safari-frost');
                    
                    // 添加角落霜冻元素（轻微效果）
                    var corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
                    corners.forEach(function(pos) {
                        var corner = document.createElement('div');
                        corner.className = 'frost-corner ' + pos;
                        terminal.appendChild(corner);
                    });
                }
            }, 100);
        });
    }
})();