/**
 * 羽毛球穿线服务预约系统
 * - 静态页面由 Express 提供
 * - 网站文案/价格等可在 /admin 后台修改，保存后立即生效
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 内容文件目录：Railway 等平台请把持久化磁盘挂载到 /data，并设置 DATA_DIR=/data
const DATA_DIR = process.env.DATA_DIR || __dirname;
const CONTENT_FILE = path.join(DATA_DIR, 'content.js');
const DEFAULT_CONTENT_FILE = path.join(__dirname, 'content.js');
const BACKUP_DIR = path.join(DATA_DIR, 'content-backups');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONTENT_FILE)) {
    fs.copyFileSync(DEFAULT_CONTENT_FILE, CONTENT_FILE);
    console.log('已初始化内容文件:', CONTENT_FILE);
}

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

/* ---------------- 后台登录（HTTP Basic） ---------------- */

function safeEqual(a, b) {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

function requireAdmin(req, res, next) {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
        return res.status(503).type('text/plain; charset=utf-8')
            .send('后台未启用：请在环境变量中设置 ADMIN_PASSWORD 后重启服务。');
    }
    const header = req.headers.authorization || '';
    if (header.startsWith('Basic ')) {
        const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
        const idx = decoded.indexOf(':');
        const user = idx >= 0 ? decoded.slice(0, idx) : '';
        const pass = idx >= 0 ? decoded.slice(idx + 1) : '';
        if (safeEqual(user, process.env.ADMIN_USER || 'admin') && safeEqual(pass, password)) {
            return next();
        }
    }
    res.set('WWW-Authenticate', 'Basic realm="Site Admin", charset="UTF-8"');
    return res.status(401).type('text/plain; charset=utf-8').send('需要登录后才能访问后台。');
}

/* ---------------- 内容读取与保存 ---------------- */

function serializeConfig(data) {
    return '/**\n * 网站内容配置（由 /admin 后台自动生成，请勿手动修改格式）\n */\n' +
        'window.SITE_CONFIG = ' + JSON.stringify(data, null, 4) + ';\n';
}

function validateConfig(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return '配置格式不正确';
    for (const key of ['site', 'notices', 'pricing', 'schedule']) {
        if (!data[key] || typeof data[key] !== 'object' || Array.isArray(data[key])) {
            return '缺少配置项：' + key;
        }
    }
    if (!Array.isArray(data.pricing.strings) || !Array.isArray(data.pricing.grips) || !Array.isArray(data.pricing.grommets)) {
        return '价格配置格式不正确';
    }
    if (!Array.isArray(data.schedule.dropoffSlots) || !Array.isArray(data.schedule.pickupSlots)) {
        return '预约时段格式不正确';
    }
    const numbers = [data.pricing.labor, ...data.pricing.strings.map(s => s.price), ...data.pricing.grips.map(s => s.price)];
    if (numbers.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100000)) {
        return '价格必须是 0 以上的数字';
    }
    const text = JSON.stringify(data);
    if (text.length > 500000) return '内容过大';
    return null;
}

app.get('/content.js', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('application/javascript; charset=utf-8');
    res.sendFile(CONTENT_FILE);
});

app.get('/api/content', (req, res) => {
    try {
        const raw = fs.readFileSync(CONTENT_FILE, 'utf8');
        const match = raw.match(/window\.SITE_CONFIG\s*=\s*([\s\S]*?);\s*$/);
        res.json(match ? JSON.parse(match[1]) : {});
    } catch (err) {
        res.status(500).json({ error: '读取配置失败' });
    }
});

app.post('/api/content', requireAdmin, (req, res) => {
    const error = validateConfig(req.body);
    if (error) return res.status(400).json({ error });

    try {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        if (fs.existsSync(CONTENT_FILE)) {
            fs.copyFileSync(CONTENT_FILE, path.join(BACKUP_DIR, `content-${stamp}.js`));
        }
        const tmp = CONTENT_FILE + '.tmp';
        fs.writeFileSync(tmp, serializeConfig(req.body), 'utf8');
        fs.renameSync(tmp, CONTENT_FILE);
        res.json({ ok: true, savedAt: new Date().toISOString() });
    } catch (err) {
        console.error('保存内容失败:', err);
        res.status(500).json({ error: '保存失败，请查看服务端日志' });
    }
});

/* ---------------- 页面 ---------------- */

app.get('/admin', requireAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.html', requireAdmin, (req, res) => res.redirect('/admin'));
app.use('/content-backups', (req, res) => res.status(404).type('text/plain').send('Not found'));

app.use(express.static(__dirname, { dotfiles: 'ignore' }));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🏸 羽毛球穿线服务预约系统已启动');
    console.log(`🌐 访问地址：http://localhost:${PORT}`);
    console.log(`🔧 管理后台：http://localhost:${PORT}/admin`);
    console.log(`💾 内容文件：${CONTENT_FILE}`);
    if (!process.env.ADMIN_PASSWORD) {
        console.log('⚠️  未设置 ADMIN_PASSWORD，后台暂不可用');
    }
    console.log('');
});
