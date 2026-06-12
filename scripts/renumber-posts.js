#!/usr/bin/env node

/**
 * 文章占位脚本 - 用于在文章列表中插入新文章时自动重命名和更新文章ID
 * 
 * 用法：
 *   node renumber-posts.js insert <newId>           - 在指定位置插入，触发占位重编号
 *   node renumber-posts.js delete <id>             - 删除文章，后续文章ID自动-1
 *   node renumber-posts.js verify                  - 仅执行验证（文件名与ID一致性、时间顺序检查）
 * 
 * 示例：
 *   node renumber-posts.js insert 1111             - 在 1111 位置插入，后续文章ID自动+1
 *   node renumber-posts.js delete 1111             - 删除 1111，后续文章ID自动-1
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const MARKDOWN_DIR = path.join(__dirname, '..', 'Markdown');

// 解析命令行参数
const args = process.argv.slice(2);
const command = args[0];
const targetId = args[1];

/**
 * 交互式确认提示
 */
function confirm(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(`${colors.yellow}${message} (y/N): ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

function logInfo(msg) { log(colors.blue, 'INFO', msg); }
function logSuccess(msg) { log(colors.green, 'SUCCESS', msg); }
function logWarn(msg) { log(colors.yellow, 'WARN', msg); }
function logError(msg) { log(colors.red, 'ERROR', msg); }

/**
 * 获取目录下所有纯数字命名的 Markdown 文件（排除含非数字字符的文件）
 */
function getNumericPosts() {
  const files = fs.readdirSync(MARKDOWN_DIR);
  return files
    .filter(f => f.endsWith('.md') && /^\d+\.md$/.test(f))
    .map(f => {
      const id = parseInt(f.replace('.md', ''), 10);
      return { id, filename: f, filepath: path.join(MARKDOWN_DIR, f) };
    })
    .sort((a, b) => a.id - b.id);
}

/**
 * 读取文章的 YAML frontmatter 中的 ID
 */
function getPostIdFromContent(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (match) {
    const frontmatter = match[1];
    const idMatch = frontmatter.match(/^id:\s*(\d+)/m);
    if (idMatch) {
      return parseInt(idMatch[1], 10);
    }
  }
  return null;
}

/**
 * 更新文章的 YAML frontmatter 中的 ID
 */
function updatePostId(filepath, newId) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const updated = content.replace(/^id:\s*\d+/m, `id: ${newId}`);
  fs.writeFileSync(filepath, updated, 'utf-8');
}

/**
 * 重命名文件
 */
function renameFile(oldPath, newPath) {
  fs.renameSync(oldPath, newPath);
}

/**
 * 验证：文件名与内部ID是否一致
 */
function verifyFilenameIdConsistency() {
  const posts = getNumericPosts();
  const results = { passed: true, errors: [] };

  for (const post of posts) {
    const contentId = getPostIdFromContent(post.filepath);
    if (contentId === null) {
      results.errors.push(`${post.filename}: 无法从内容中读取 ID`);
      results.passed = false;
    } else if (contentId !== post.id) {
      results.errors.push(`${post.filename}: 文件名ID(${post.id}) 与内容ID(${contentId}) 不一致`);
      results.passed = false;
    }
  }

  return results;
}

/**
 * 验证：文章ID顺序是否与时间顺序一致
 */
function verifyIdTimeOrder() {
  const posts = getNumericPosts();
  const results = { passed: true, errors: [], warnings: [] };

  for (let i = 0; i < posts.length; i++) {
    const current = posts[i];
    const content = fs.readFileSync(current.filepath, 'utf-8');
    
    // 提取日期
    const dateMatch = content.match(/^date:\s*([\d-]+)/m);
    if (!dateMatch) {
      results.warnings.push(`${current.filename}: 缺少 date 字段`);
      continue;
    }
    current.date = dateMatch[1];

    // 检查是否与前一个文章存在时间倒流
    if (i > 0) {
      const prev = posts[i - 1];
      if (current.date < prev.date) {
        results.errors.push(
          `${current.filename}(${current.date}) 比 ${prev.filename}(${prev.date}) 时间更早，但ID更大(${current.id} > ${prev.id})`
        );
        results.passed = false;
      }
    }
  }

  return results;
}

/**
 * 执行占位操作：在指定位置插入，后续文章ID自动+1
 */
function insertPost(targetId) {
  const posts = getNumericPosts();
  
  // 检查目标位置是否已有文章
  const existing = posts.find(p => p.id === targetId);
  if (existing) {
    logWarn(`位置 ${targetId} 已有文章 ${existing.filename}，将触发占位重编号...`);
  } else {
    // 目标位置为空，创建空文件
    const newFilepath = path.join(MARKDOWN_DIR, `${targetId}.md`);
    fs.writeFileSync(newFilepath, '', 'utf-8');
    logSuccess(`已创建空文件: ${targetId}.md`);
    return;
  }

  // 找到需要重编号的起始位置
  const startIndex = posts.findIndex(p => p.id === targetId);
  const postsToUpdate = posts.slice(startIndex);

  // 从后往前重编号，避免冲突
  logInfo(`需要重编号的文章数量: ${postsToUpdate.length}`);

  for (let i = postsToUpdate.length - 1; i >= 0; i--) {
    const current = postsToUpdate[i];
    const newId = current.id + 1;
    const oldPath = current.filepath;
    const newFilename = `${newId}.md`;
    const newPath = path.join(MARKDOWN_DIR, newFilename);

    // 1. 先更新文件内容中的ID
    updatePostId(oldPath, newId);
    logInfo(`更新内容: ${current.filename} -> ID: ${newId}`);

    // 2. 再重命名文件
    renameFile(oldPath, newPath);
    logSuccess(`重命名: ${current.filename} -> ${newFilename}`);
  }

  // 3. 在目标位置创建空文件
  const newFilepath = path.join(MARKDOWN_DIR, `${targetId}.md`);
  fs.writeFileSync(newFilepath, '', 'utf-8');
  logSuccess(`已创建空文件: ${targetId}.md`);

  logSuccess('占位重编号完成！');
}

/**
 * 执行删除操作：删除文章，后续文章ID自动-1
 */
async function deletePost(targetId) {
  const posts = getNumericPosts();
  
  // 检查目标位置是否有文章
  const existing = posts.find(p => p.id === targetId);
  if (!existing) {
    logError(`文章 ${targetId}.md 不存在`);
    return;
  }

  // 确认删除
  logWarn(`即将删除文章: ${existing.filename}`);
  const confirmed = await confirm('确认删除？此操作不可逆');
  if (!confirmed) {
    logInfo('已取消删除');
    return;
  }

  // 删除目标文件
  fs.unlinkSync(existing.filepath);
  logSuccess(`已删除: ${existing.filename}`);

  // 找到需要重编号的后续文章
  const deleteIndex = posts.findIndex(p => p.id === targetId);
  const postsToUpdate = posts.slice(deleteIndex + 1);

  if (postsToUpdate.length === 0) {
    logInfo('无需重编号');
    return;
  }

  // 从前往后重编号，避免冲突
  logInfo(`需要重编号的文章数量: ${postsToUpdate.length}`);

  for (const current of postsToUpdate) {
    const newId = current.id - 1;
    const oldPath = current.filepath;
    const newFilename = `${newId}.md`;
    const newPath = path.join(MARKDOWN_DIR, newFilename);

    // 1. 先更新文件内容中的ID
    updatePostId(oldPath, newId);
    logInfo(`更新内容: ${current.filename} -> ID: ${newId}`);

    // 2. 再重命名文件
    renameFile(oldPath, newPath);
    logSuccess(`重命名: ${current.filename} -> ${newFilename}`);
  }

  logSuccess('删除并重编号完成！');
}

/**
 * 打印使用说明
 */
function printUsage() {
  console.log(`
${colors.cyan}文章占位脚本 - 用于在文章列表中插入新文章时自动重命名和更新文章ID${colors.reset}

${colors.yellow}用法:${colors.reset}
  node renumber-posts.js insert <newId>    在指定位置插入，触发占位重编号
  node renumber-posts.js -i <newId>        同上，简写形式
  node renumber-posts.js delete <id>       删除文章，后续文章ID自动-1
  node renumber-posts.js -d <id>           同上，简写形式
  node renumber-posts.js verify            仅执行验证（文件名与ID一致性、时间顺序检查）
  node renumber-posts.js -v                同上，简写形式

${colors.yellow}示例:${colors.reset}
  node renumber-posts.js insert 1111       在1111位置插入，后续文章ID自动+1
  node renumber-posts.js -i 1111           同上，简写形式
  node renumber-posts.js delete 1111       删除1111，后续文章ID自动-1
  node renumber-posts.js -d 1111           同上，简写形式
  node renumber-posts.js verify            仅验证文件名、ID一致性和时间顺序
  node renumber-posts.js -v                同上，简写形式

${colors.yellow}说明:${colors.reset}
  - 只处理纯数字命名的文章（如 1001.md, 1118.md）
  - 忽略含非数字字符的文件（如 !2001.md, draft.md）
  - 验证过程可单独执行，不影响现有文章
`);
}

// 主程序
function main() {
  if (!command) {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case '-v':
    case 'verify':
      logInfo('开始验证...');
      console.log('');

      // 验证文件名与ID一致性
      logInfo('检查文件名与内容ID一致性...');
      const idResult = verifyFilenameIdConsistency();
      if (idResult.passed) {
        logSuccess('文件名与ID一致性检查通过');
      } else {
        logError('文件名与ID一致性检查失败:');
        idResult.errors.forEach(err => log(colors.red, '  ✗', err));
      }
      console.log('');

      // 验证ID与时间顺序
      logInfo('检查文章ID顺序与时间顺序一致性...');
      const timeResult = verifyIdTimeOrder();
      if (timeResult.warnings.length > 0) {
        timeResult.warnings.forEach(w => logWarn(w));
        console.log('');
      }
      if (timeResult.passed) {
        logSuccess('ID与时间顺序一致性检查通过');
      } else {
        logError('ID与时间顺序一致性检查失败:');
        timeResult.errors.forEach(err => log(colors.red, '  ✗', err));
      }
      console.log('');

      // 总结
      if (idResult.passed && timeResult.passed) {
        logSuccess('所有验证通过！');
      } else {
        logError('存在验证问题，请检查上述错误');
        process.exit(1);
      }
      break;

    case '-i':
    case 'insert':
      if (!targetId || !/^\d+$/.test(targetId)) {
        logError('请提供有效的数字ID');
        console.log('');
        printUsage();
        process.exit(1);
      }
      insertPost(parseInt(targetId, 10));
      
      // 插入完成后自动验证
      console.log('');
      logInfo('插入完成，开始验证...');
      console.log('');

      const idCheck = verifyFilenameIdConsistency();
      if (!idCheck.passed) {
        logError('验证失败，文件名与ID不一致:');
        idCheck.errors.forEach(err => log(colors.red, '  ✗', err));
        process.exit(1);
      }

      const timeCheck = verifyIdTimeOrder();
      if (!timeCheck.passed) {
        logError('验证失败，ID与时间顺序不一致:');
        timeCheck.errors.forEach(err => log(colors.red, '  ✗', err));
        process.exit(1);
      }

      logSuccess('所有验证通过！');
      break;

    case '-d':
    case 'delete':
      if (!targetId || !/^\d+$/.test(targetId)) {
        logError('请提供有效的数字ID');
        console.log('');
        printUsage();
        process.exit(1);
      }
      deletePost(parseInt(targetId, 10)).then(() => {
        // 删除完成后自动验证
        console.log('');
        logInfo('删除完成，开始验证...');
        console.log('');

        const idCheck = verifyFilenameIdConsistency();
        if (!idCheck.passed) {
          logError('验证失败，文件名与ID不一致:');
          idCheck.errors.forEach(err => log(colors.red, '  ✗', err));
          process.exit(1);
        }

        const timeCheck = verifyIdTimeOrder();
        if (!timeCheck.passed) {
          logError('验证失败，ID与时间顺序不一致:');
          timeCheck.errors.forEach(err => log(colors.red, '  ✗', err));
          process.exit(1);
        }

        logSuccess('所有验证通过！');
      });
      break;

    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;

    default:
      logError(`未知命令: ${command}`);
      console.log('');
      printUsage();
      process.exit(1);
  }
}

main();