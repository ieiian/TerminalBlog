/**
 * TerminalBlog 标签特效模块
 * 统一管理标签的解析、去重和 DOM 生成
 * 使用 :: 作为特效分隔符，例如: SSL::red::bold
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

    // 特效分隔符
    var EFFECT_SEPARATOR = '::';

    // ==================== 核心函数 ====================

    /**
     * 解析原始标签字符串
     * @param {string} fullTag - 原始标签字符串，如 "SSL::red::bold"
     * @returns {object} - { tagName: 'SSL', effects: ['red', 'bold'], classNames: ['tag-fx-red', 'tag-fx-bold'] }
     */
    function parseTag(fullTag) {
        if (!fullTag || typeof fullTag !== 'string') {
            return { tagName: '', effects: [], classNames: [] };
        }

        // 安全处理：移除控制字符
        var safeTag = fullTag.replace(/[\x00-\x1F\x7F]/g, '');

        // 查找分隔符 :: 的位置
        var sepIndex = safeTag.indexOf('::');

        var tagName, effects;

        if (sepIndex === -1) {
            // 没有特效
            tagName = safeTag.trim();
            effects = [];
        } else {
            // 分离标签名和特效
            tagName = safeTag.substring(0, sepIndex).trim();
            var effectsStr = safeTag.substring(sepIndex + 2);
            effects = effectsStr.split('::').map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
        }

        // 生成安全的 CSS 类名
        var classNames = effects.map(function(effect) {
            return 'tag-fx-' + effect.replace(/[^a-z0-9]/gi, '-');
        });

        return { tagName: tagName, effects: effects, classNames: classNames };
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
     * @returns {Map} - 标签名 -> { tagName, effects, classNames, count }
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
     * @param {array} effects - 特效列表
     * @returns {string} - style 属性字符串
     */
    function buildEffectsStyle(effects) {
        if (!effects || effects.length === 0) return '';

        var styles = [];

        effects.forEach(function(effect) {
            // 颜色特效
            if (COLOR_EFFECTS[effect]) {
                styles.push('color:' + COLOR_EFFECTS[effect]);
            }
            // 粗体
            if (effect === 'bold') {
                styles.push('font-weight:bold');
            }
            // 斜体
            if (effect === 'italic') {
                styles.push('font-style:italic');
            }
            // 下划线
            if (effect === 'underline') {
                styles.push('text-decoration:underline');
            }
        });

        return styles.length > 0 ? styles.join(';') + ';' : '';
    }

    /**
     * 创建标签 DOM 字符串
     * @param {string} fullTag - 原始标签字符串
     * @param {number} count - 可选，标签文章数量
     * @param {boolean} showBracket - 是否显示方括号，默认 true
     * @returns {string} - HTML 字符串
     */
    function createTagDOM(fullTag, count, showBracket) {
        showBracket = showBracket === true; // 默认不显示方括号，与主页/标签页原始行为一致

        var parsed = parseTag(fullTag);
        if (!parsed.tagName) return '';

        var tagName = parsed.tagName;
        var effects = parsed.effects;
        var classNames = parsed.classNames;
        var effectsStyle = buildEffectsStyle(effects);

        // 组合类名
        var allClasses = ['tag-item'].concat(classNames).join(' ');
        var styleAttr = effectsStyle ? ' style="' + effectsStyle + '"' : '';

        // 显示内容（带方括号）
        var displayName = showBracket ? '[' + tagName + ']' : tagName;
        var countHtml = (typeof count === 'number' && count > 0) ? '<span class="count">(' + count + ')</span>' : '';

        // 生成 data 属性用于特效动画检测
        var dataAttrs = '';
        if (effects.indexOf('marquee') !== -1) dataAttrs += ' data-marquee="true"';
        if (effects.indexOf('flash') !== -1) dataAttrs += ' data-flash="true"';

        return '<a class="' + allClasses + '"' + styleAttr + dataAttrs +
               ' onclick="navigate(\'tag\', \'' + escapeHtml(tagName) + '\')">' +
               displayName + countHtml + '</a>';
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
        var effectsStyle = buildEffectsStyle(effects);

        // 文章详情页的标签使用 .tag 类名，带方括号，可点击
        var allClasses = ['tag'].concat(classNames).join(' ');
        var styleAttr = effectsStyle ? ' style="' + effectsStyle + '"' : '';

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
        var effectsStyle = buildEffectsStyle(effects);

        // 预览页的标签使用 .tag 类名，带方括号，无点击
        var allClasses = ['tag-preview'].concat(classNames).join(' ');
        var styleAttr = effectsStyle ? ' style="' + effectsStyle + '"' : '';

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
        COLOR_EFFECTS: COLOR_EFFECTS
    };

})();