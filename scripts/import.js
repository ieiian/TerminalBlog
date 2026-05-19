/**
 * Markdown 导入脚本 - 将 Markdown/ 目录下的 .md 文件导入到博客
 * 
 * 用法:
 *   npm run import
 * 
 * 特性:
 *   - 按日期排序导入（先旧后新）
 *   - 按 ID 去重，已存在的 ID 会被跳过
 *   - 自动分配新的 ID 给没有 ID 的文件
 */

const fs = require('fs');
const path = require('path');

const MARKDOWN_DIR = path.join(__dirname, '..', 'Markdown');

function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return { frontmatter: {}, body: content };

    const lines = match[1].split('\n');
    const frontmatter = {};

    lines.forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            let value = line.slice(colonIdx + 1).trim();

            if (value.startsWith('[') && value.endsWith(']')) {
                try {
                    value = JSON.parse(value.replace(/'/g, '"'));
                } catch (e) {
                    value = [];
                }
            }

            frontmatter[key] = value;
        }
    });

    const body = content.slice(match[0].length).trim();
    return { frontmatter, body };
}

function getExistingIds() {
    const ids = new Set();
    
    if (!fs.existsSync(MARKDOWN_DIR)) {
        return ids;
    }
    
    const files = fs.readdirSync(MARKDOWN_DIR);
    
    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const filePath = path.join(MARKDOWN_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const { frontmatter } = parseFrontmatter(content);
        
        if (frontmatter.id) {
            ids.add(parseInt(frontmatter.id));
        }
    }
    
    return ids;
}

function getNextId(existingIds) {
    let maxId = 10000;
    for (const id of existingIds) {
        if (id > maxId) {
            maxId = id;
        }
    }
    return maxId + 1;
}

function generateFilename(title) {
    return title
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50) + '.md';
}

function main() {
    console.log('📥 Markdown 导入脚本');
    console.log(`📁 目录: ${MARKDOWN_DIR}\n`);

    if (!fs.existsSync(MARKDOWN_DIR)) {
        console.log(`❌ Markdown 目录不存在: ${MARKDOWN_DIR}\n`);
        process.exit(1);
    }

    const existingIds = getExistingIds();
    let nextId = getNextId(existingIds);

    let files = fs.readdirSync(MARKDOWN_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => {
            const filePath = path.join(MARKDOWN_DIR, f);
            const content = fs.readFileSync(filePath, 'utf-8');
            const { frontmatter, body } = parseFrontmatter(content);

            let date = frontmatter.date || '1970-01-01';
            if (typeof date === 'string' && date.includes('T')) {
                date = date.split('T')[0];
            }

            return {
                file: f,
                id: frontmatter.id ? parseInt(frontmatter.id) : null,
                title: frontmatter.title || f.replace(/\.md$/, ''),
                tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
                date,
                content: body,
                hidden: frontmatter.hidden === true || frontmatter.hidden === 'true'
            };
        });

    // 按日期排序
    files.sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log(`📝 找到 ${files.length} 篇文章（按日期排序）\n`);
    console.log(`  已存在 ${existingIds.size} 个 ID\n`);

    let imported = 0;
    let skipped = 0;
    let updated = 0;

    for (const post of files) {
        // 如果文件没有 ID，分配一个新 ID
        if (!post.id) {
            post.id = nextId++;
        } else if (existingIds.has(post.id)) {
            console.log(`  ⏭️  跳过（ID 已存在）: ${post.title} (ID: ${post.id})`);
            skipped++;
            continue;
        }

        // 更新文件内容，添加 ID
        const tagsStr = JSON.stringify(post.tags).replace(/"/g, "'");
        const newContent = `---
id: ${post.id}
title: ${post.title}
date: ${post.date}
tags: ${tagsStr}
hidden: ${post.hidden}
---

${post.content}`;

        const filePath = path.join(MARKDOWN_DIR, post.file);
        try {
            fs.writeFileSync(filePath, newContent, 'utf-8');
            console.log(`  ✅ 导入: ${post.title} (ID: ${post.id})`);
            imported++;
            existingIds.add(post.id);
        } catch (e) {
            console.log(`  ❌ 导入失败: ${post.title} - ${e.message}`);
        }
    }

    console.log(`\n🎉 导入完成！`);
    console.log(`  ✅ 新增/更新: ${imported} 篇`);
    console.log(`  ⏭️  跳过: ${skipped} 篇（ID 已存在）\n`);
}

main();