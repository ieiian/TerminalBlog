/**
 * TerminalBlog 标签特效模块
 * 统一管理标签的解析、去重和 DOM 生成
 * 使用 :: 作为特效分隔符，例如: SSL::red::bold
 *
 * 特效分类：
 * 1. 文字静态颜色：red, blue, green, yellow, purple, orange, pink, cyan, gray, white
 * 2. 文字特殊效果：rainbow（彩虹渐变）, flow（流光字）, bounce（跳动）, pulse（呼吸）
 * 3. 边框静态颜色：border-red, border-blue, border-green 等
 * 4. 边框特殊效果：glow（发光）, border-rainbow, border-flow, border-pulse
 * 5. 整体特效（透明，可配合文字/边框）：glass（玻璃流光）
 * 6. 整体特效（覆盖型，独占显示）：neon（霓虹灯）
 */

(function() {
    // 防止重复加载
    if (window.TagEffects) return;

    // ==================== 特效配置 ====================

    // 颜色特效映射
    var COLOR_EFFECTS = {
        'red': '#ff3333',
        'blue': '#3399ff',
        'green': '#33ff66',
        'yellow': '#ffcc00',
        'purple': '#cc66ff',
        'orange': '#ff9933',
        'pink': '#ff66b2',
        'cyan': '#00cccc',
        'gray': '#888888',
        'white': '#ffffff'
    };

    // 边框颜色映射
    var BORDER_COLOR_EFFECTS = {
        'border-red': '#ff3333',
        'border-blue': '#3399ff',
        'border-green': '#33ff66',
        'border-yellow': '#ffcc00',
        'border-purple': '#cc66ff',
        'border-orange': '#ff9933',
        'border-pink': '#ff66b2',
        'border-cyan': '#00cccc',
        'border-gray': '#888888',
        'border-white': '#ffffff'
    };

    // 特效分隔符
    var EFFECT_SEPARATOR = '::';

    // 整体特效（覆盖型，使用后禁用文字和边框特效）
    var GLOBAL_EFFECTS = ['neon'];

    // ==================== 核心函数 ====================

    /**
     * 解析原始标签字符串
     * @param {string} fullTag - 原始标签字符串，如 "SSL::red::bold"
     * @returns {object} - { tagName: 'SSL', effects: ['red', 'bold'], classNames: ['tag-fx-red', 'tag-fx-bold'], hasGlobalEffect: false }
     */
    function parseTag(fullTag) {
        if (!fullTag || typeof fullTag !== 'string') {
            return { tagName: '', effects: [], classNames: [], hasGlobalEffect: false };
        }

        // 安全处理：移除控制字符
        var safeTag = fullTag.replace(/[\x00-\x1F\x7F]/g, '');

        // 查找分隔符 :: 的位置
        var sepIndex = safeTag.indexOf(EFFECT_SEPARATOR);

        var tagName, effects;

        if (sepIndex === -1) {
            // 没有特效
            tagName = safeTag.trim();
            effects = [];
        } else {
            // 分离标签名和特效
            tagName = safeTag.substring(0, sepIndex).trim();
            var effectsStr = safeTag.substring(sepIndex + 2);
            effects = effectsStr.split(EFFECT_SEPARATOR).map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
        }

        // 检查是否有整体覆盖型特效
        var hasGlobalEffect = effects.some(function(e) { return GLOBAL_EFFECTS.indexOf(e) !== -1; });

        // 生成安全的 CSS 类名
        var classNames = effects.map(function(effect) {
            return 'tag-fx-' + effect.replace(/[^a-z0-9-]/gi, '-');
        });

        return { tagName: tagName, effects: effects, classNames: classNames, hasGlobalEffect: hasGlobalEffect };
    }

    /**
     * 从原始标签提取纯净的标签名（不含特效）
     * @param {string} fullTag - 原始标签字符串
     * @returns {string} - 纯净的标签名
     */
    function getCleanTagName(fullTag) {
        return parseTag(fullTag).tagName;
    }

    /**
     * 清洗并去重标签列表（最大 ID 覆盖规则）
     * @param {array} posts - 文章列表
     * @returns {Map} - 标签名 -> { tagName, effects, classNames, fullTag, count, postId }
     */
    function cleanAndDeduplicateTags(posts) {
        var tagMap = new Map();

        posts.forEach(function(post) {
            if (!post || post.hidden) return;

            (post.tags || []).forEach(function(fullTag) {
                var parsed = parseTag(fullTag);
                if (!parsed.tagName) return;

                var cleanName = parsed.tagName;

                // 最大 ID 覆盖规则：以 ID 最大的为准
                var existing = tagMap.get(cleanName);
                if (!existing || (post.id && (!existing.postId || post.id > existing.postId))) {
                    tagMap.set(cleanName, {
                        tagName: cleanName,
                        effects: parsed.effects,
                        classNames: parsed.classNames,
                        fullTag: fullTag,
                        count: 1,
                        postId: post.id || 0
                    });
                } else {
                    existing.count++;
                }
            });
        });

        return tagMap;
    }

    /**
     * 构建标签特效的 style 属性字符串
     * 仅处理颜色相关的内联样式，复杂特效通过 CSS 类实现
     * @param {array} effects - 特效列表
     * @param {boolean} hasGlobalEffect - 是否有整体覆盖特效
     * @returns {string} - style 属性字符串
     */
    function buildEffectsStyle(effects, hasGlobalEffect) {
        if (!effects || effects.length === 0) return '';

        var styles = [];

        effects.forEach(function(effect) {
            // 颜色特效（如果无整体覆盖特效才应用）
            if (!hasGlobalEffect && COLOR_EFFECTS[effect]) {
                styles.push('color:' + COLOR_EFFECTS[effect]);
            }
            // 边框颜色特效（如果无整体覆盖特效才应用）
            if (!hasGlobalEffect && BORDER_COLOR_EFFECTS[effect]) {
                styles.push('--tag-border-color:' + BORDER_COLOR_EFFECTS[effect]);
            }
            // 粗体
            if (effect === 'bold') {
                styles.push('font-weight:bold');
            }
            // 斜体
            if (effect === 'italic') {
                styles.push('font-style:italic');
            }
        });

        // 如果有整体覆盖特效，设置标记变量
        if (hasGlobalEffect) {
            styles.push('--tag-global-effect:1');
        }

        return styles.length > 0 ? styles.join(';') + ';' : '';
    }

    /**
     * 创建标签 DOM 字符串（主页/标签页使用）
     * @param {string} fullTag - 原始标签字符串
     * @param {number} count - 可选，标签文章数量
     * @param {boolean} showBracket - 是否显示方括号，默认 false
     * @returns {string} - HTML 字符串
     */
    function createTagDOM(fullTag, count, showBracket) {
        showBracket = showBracket === true; // 默认不显示方括号

        var parsed = parseTag(fullTag);
        if (!parsed.tagName) return '';

        var tagName = parsed.tagName;
        var effects = parsed.effects;
        var classNames = parsed.classNames;
        var hasGlobalEffect = parsed.hasGlobalEffect;
        var effectsStyle = buildEffectsStyle(effects, hasGlobalEffect);

        // 组合类名（整体特效独占时禁用文字和边框特效类）
        var activeClassNames;
        if (hasGlobalEffect) {
            // 整体特效独占，只保留整体特效类
            activeClassNames = ['tag-item'].concat(classNames.filter(function(c) {
                return GLOBAL_EFFECTS.some(function(g) { return c.indexOf('tag-fx-' + g) !== -1; });
            }));
        } else {
            activeClassNames = ['tag-item'].concat(classNames);
        }

        var styleAttr = effectsStyle ? ' style="' + effectsStyle + '"' : '';
        var allClasses = activeClassNames.join(' ');

        // 显示内容（带方括号时需要特殊处理下划线效果）
        var displayName;
        if (showBracket) {
            displayName = '[' + tagName + ']';
        } else {
            // 不带括号时，为了正确处理下划线效果，需要将文字包裹
            displayName = tagName;
        }
        var countHtml = (typeof count === 'number' && count > 0) ? '<span class="count">(' + count + ')</span>' : '';

        // 生成标签内容（根据是否带括号选择不同的结构）
        var content;
        if (showBracket) {
            // 带括号时，整体作为可点击元素
            content = displayName + countHtml;
        } else {
            // 不带括号时，文字部分可点击，括号作为普通文本
            content = '<span class="tag-text">' + tagName + '</span>' + countHtml;
        }

        return '<a class="' + allClasses + '"' + styleAttr + ' onclick="navigate(\'tag\', \'' + escapeHtml(tagName) + '\')">' +
               content + '</a>';
    }

    /**
     * 创建文章详情的标签显示（带方括号，可点击）
     * @param {string} fullTag - 原始标签字符串
     * @returns {string} - HTML 字符串
     */
    function createPostTagDOM(fullTag) {
        var parsed = parseTag(fullTag);
        if (!parsed.tagName) return '';

        var tagName = parsed.tagName;
        var effects = parsed.effects;
        var classNames = parsed.classNames;
        var hasGlobalEffect = parsed.hasGlobalEffect;
        var effectsStyle = buildEffectsStyle(effects, hasGlobalEffect);

        // 组合类名
        var activeClassNames;
        if (hasGlobalEffect) {
            activeClassNames = ['tag'].concat(classNames.filter(function(c) {
                return GLOBAL_EFFECTS.some(function(g) { return c.indexOf('tag-fx-' + g) !== -1; });
            }));
        } else {
            activeClassNames = ['tag'].concat(classNames);
        }

        var styleAttr = effectsStyle ? ' style="' + effectsStyle + '"' : '';
        var allClasses = activeClassNames.join(' ');

        return '<a class="' + allClasses + '"' + styleAttr +
               ' href="javascript:void(0)" onclick="navigate(\'tag\', \'' + escapeHtml(tagName) + '\'); return false;">[' + tagName + ']</a>';
    }

    /**
     * 创建预览页的标签显示（带方括号，不可点击，仅特效）
     * @param {string} fullTag - 原始标签字符串
     * @returns {string} - HTML 字符串
     */
    function createPostTagDOMPreview(fullTag) {
        var parsed = parseTag(fullTag);
        if (!parsed.tagName) return '';

        var tagName = parsed.tagName;
        var effects = parsed.effects;
        var classNames = parsed.classNames;
        var hasGlobalEffect = parsed.hasGlobalEffect;
        var effectsStyle = buildEffectsStyle(effects, hasGlobalEffect);

        // 组合类名
        var activeClassNames;
        if (hasGlobalEffect) {
            activeClassNames = ['tag-preview'].concat(classNames.filter(function(c) {
                return GLOBAL_EFFECTS.some(function(g) { return c.indexOf('tag-fx-' + g) !== -1; });
            }));
        } else {
            activeClassNames = ['tag-preview'].concat(classNames);
        }

        var styleAttr = effectsStyle ? ' style="' + effectsStyle + '"' : '';
        var allClasses = activeClassNames.join(' ');

        return '<span class="' + allClasses + '"' + styleAttr + '>[' + tagName + ']</span>';
    }

    /**
     * 创建用于 API 返回的标签数据（仅包含纯净标签名）
     * @param {array} fullTags - 原始标签数组
     * @returns {array} - 纯净标签数组
     */
    function getCleanTags(fullTags) {
        if (!Array.isArray(fullTags)) return [];
        return fullTags.map(getCleanTagName).filter(Boolean);
    }

    /**
     * 检查标签是否匹配（支持带特效的标签匹配纯净标签名）
     * @param {string} fullTag - 原始标签（可能含特效）
     * @param {string} targetTag - 目标标签（纯净名称）
     * @returns {boolean}
     */
    function tagMatches(fullTag, targetTag) {
        return getCleanTagName(fullTag) === targetTag;
    }

    /**
     * HTML 转义（防止 XSS）
     */
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== 导出到全局 ====================

    window.TagEffects = {
        parseTag: parseTag,
        getCleanTagName: getCleanTagName,
        cleanAndDeduplicateTags: cleanAndDeduplicateTags,
        createTagDOM: createTagDOM,
        createPostTagDOM: createPostTagDOM,
        createPostTagDOMPreview: createPostTagDOMPreview,
        getCleanTags: getCleanTags,
        tagMatches: tagMatches,
        EFFECT_SEPARATOR: EFFECT_SEPARATOR,
        COLOR_EFFECTS: COLOR_EFFECTS,
        BORDER_COLOR_EFFECTS: BORDER_COLOR_EFFECTS,
        GLOBAL_EFFECTS: GLOBAL_EFFECTS
    };

})();