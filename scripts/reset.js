/**
 * 重置脚本 - 清空 Markdown 目录，恢复出厂状态
 */

const fs = require('fs');
const path = require('path');

const MARKDOWN_DIR = path.join(__dirname, '..', 'Markdown');

function main() {
    console.log('⚠️  即将清空所有文章数据，恢复出厂状态！');
    console.log(`📁 目标目录: ${MARKDOWN_DIR}\n`);

    if (!fs.existsSync(MARKDOWN_DIR)) {
        console.log('  ℹ️  Markdown 目录不存在，无需清理\n');
        console.log('🎉 重置完成！');
        return;
    }

    const files = fs.readdirSync(MARKDOWN_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    if (mdFiles.length === 0) {
        console.log('  ℹ️  没有文章文件，无需清理\n');
        console.log('🎉 重置完成！');
        return;
    }

    console.log(`🗑️  发现 ${mdFiles.length} 篇文章待删除...\n`);

    let deleted = 0;
    for (const file of mdFiles) {
        const filePath = path.join(MARKDOWN_DIR, file);
        try {
            fs.unlinkSync(filePath);
            deleted++;
        } catch (e) {
            console.log(`  ⚠️  删除失败: ${file}`);
        }
    }

    console.log(`  ✅ 已删除 ${deleted} 篇文章\n`);
    console.log('🎉 重置完成！');
    console.log('\n💡 提示: 运行 npm run seed 可重新生成种子数据\n');
}

main();