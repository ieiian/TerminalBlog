/**
 * 重新编号 Markdown 文件
 * 按日期排序，重新分配 ID，并重命名文件
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
            frontmatter[key] = value;
        }
    });

    const body = content.slice(match[0].length);
    return { frontmatter, body };
}

function buildFrontmatter(data) {
    const lines = [];
    if (data.id) lines.push(`id: ${data.id}`);
    if (data.title) lines.push(`title: ${data.title}`);
    if (data.date) lines.push(`date: ${data.date}`);
    if (data.tags) lines.push(`tags: ${data.tags}`);
    if (data.hidden !== undefined) lines.push(`hidden: ${data.hidden}`);
    if (data.locked !== undefined) lines.push(`locked: ${data.locked}`);
    if (data.lockPassword) lines.push(`lockPassword: ${data.lockPassword}`);
    return lines.join('\n');
}

function buildMarkdownFile(data) {
    const frontmatter = buildFrontmatter(data);
    return `---\n${frontmatter}\n---\n${data.body}`;
}

// 读取所有 .md 文件
const files = fs.readdirSync(MARKDOWN_DIR).filter(f => f.endsWith('.md'));

console.log('找到文件:', files.length);
console.log('文件列表:');
files.forEach(f => console.log('  -', f));

// 解析每个文件
const posts = files.map(fileName => {
    const filePath = path.join(MARKDOWN_DIR, fileName);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);
    
    return {
        originalFileName: fileName,
        filePath: filePath,
        id: frontmatter.id ? parseInt(frontmatter.id) : null,
        title: frontmatter.title || fileName.replace('.md', ''),
        date: frontmatter.date || '1970-01-01',
        tags: frontmatter.tags || '[]',
        hidden: frontmatter.hidden === 'true',
        locked: frontmatter.locked === 'true',
        lockPassword: frontmatter.lockPassword || '',
        body: body
    };
});

// 按日期排序
posts.sort((a, b) => new Date(a.date) - new Date(b.date));

console.log('\n按日期排序后:');
posts.forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.date}] ${p.title} (原ID: ${p.id || '无'})`);
});

// 重新分配 ID (从 1001 开始)
const START_ID = 1001;
const idMap = {}; // 旧ID -> 新ID
posts.forEach((post, index) => {
    const newId = START_ID + index;
    if (post.id) {
        idMap[post.id] = newId;
    }
    post.newId = newId;
});

// 检查重复
const usedIds = new Set();
const duplicates = [];
posts.forEach(post => {
    if (usedIds.has(post.newId)) {
        duplicates.push(post);
    }
    usedIds.add(post.newId);
});

if (duplicates.length > 0) {
    console.log('\n警告: 发现重复 ID:');
    duplicates.forEach(d => console.log('  -', d.title));
}

// 重命名文件并更新内容
console.log('\n开始重命名文件...');
posts.forEach(post => {
    const newFileName = `${post.newId}.md`;
    const newFilePath = path.join(MARKDOWN_DIR, newFileName);
    
    // 如果文件名已经正确，跳过
    if (post.originalFileName === newFileName) {
        console.log(`  ✓ ${post.originalFileName} (无需更改)`);
        return;
    }
    
    // 如果目标文件已存在，先删除
    if (fs.existsSync(newFilePath)) {
        console.log(`  ⚠ 删除已存在的文件: ${newFileName}`);
        fs.unlinkSync(newFilePath);
    }
    
    // 更新 frontmatter 中的 id
    const updatedData = {
        id: post.newId,
        title: post.title,
        date: post.date,
        tags: post.tags,
        hidden: post.hidden,
        locked: post.locked,
        lockPassword: post.lockPassword,
        body: post.body
    };
    
    const newContent = buildMarkdownFile(updatedData);
    fs.writeFileSync(newFilePath, newContent, 'utf-8');
    
    // 删除原文件
    if (post.originalFileName !== newFileName) {
        fs.unlinkSync(post.filePath);
    }
    
    console.log(`  → ${post.originalFileName} → ${newFileName}`);
});

console.log('\n完成！');
console.log('ID 映射表:');
Object.entries(idMap).forEach(([oldId, newId]) => {
    console.log(`  ${oldId} → ${newId}`);
});