/**
 * 羽毛球穿线服务预约系统后端
 * 通过 Web3Forms 的 HTTPS API 转发预约邮件。
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_EMAIL = '3114354665@qq.com';
const WEB3FORMS_ACCESS_KEY =
    process.env.WEB3FORMS_ACCESS_KEY || '1b796361-dea0-4063-8009-8dafc14ed7f6';

app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
app.use(express.static(__dirname));

const orderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: '提交过于频繁，请 15 分钟后再试。',
    },
});

function clean(value, fallback = '未指定') {
    if (typeof value !== 'string') return fallback;
    const result = value.trim().slice(0, 500);
    return result || fallback;
}

function formatOrderText(order) {
    return [
        '🏸 羽毛球穿线预约订单',
        '',
        `下单时间：${clean(order.orderTime)}`,
        `客户姓名：${clean(order.name)}`,
        `联系方式：${clean(order.contact)}`,
        `球拍型号：${clean(order.racketModel)}`,
        '',
        `穿线拍数：${clean(order.racketCount)}`,
        `球线来源：${clean(order.stringSource)}`,
        `球线型号：${clean(order.stringModel)}`,
        `横线磅数：${clean(order.tensionHorizontal)}`,
        `竖线磅数：${clean(order.tensionVertical)}`,
        `球线颜色：${clean(order.stringColor)}`,
        `护线管更换：${clean(order.grommetReplace)}`,
        '',
        `送拍时间：${clean(order.dropoffDate)} ${clean(order.dropoffTime)}`,
        `取拍时间：${clean(order.pickupDate)} ${clean(order.pickupTime)}`,
        '',
        `备注：${clean(order.notes, '无')}`,
    ].join('\n');
}

async function sendOrderEmail(order) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_key: WEB3FORMS_ACCESS_KEY,
                subject: `🏸 穿线预约 - ${clean(order.name)} - ${clean(order.dropoffDate)}`,
                from_name: '羽毛球穿线预约系统',
                message: formatOrderText(order),
                客户姓名: clean(order.name),
                联系方式: clean(order.contact),
                球拍型号: clean(order.racketModel),
                穿线拍数: clean(order.racketCount),
                球线来源: clean(order.stringSource),
                球线型号: clean(order.stringModel),
                横线磅数: clean(order.tensionHorizontal),
                竖线磅数: clean(order.tensionVertical),
                球线颜色: clean(order.stringColor),
                护线管更换: clean(order.grommetReplace),
                送拍时间: `${clean(order.dropoffDate)} ${clean(order.dropoffTime)}`,
                取拍时间: `${clean(order.pickupDate)} ${clean(order.pickupTime)}`,
                备注: clean(order.notes, '无'),
                下单时间: clean(order.orderTime),
            }),
            signal: controller.signal,
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
            throw new Error(result.message || `Web3Forms 请求失败（${response.status}）`);
        }

        return result;
    } finally {
        clearTimeout(timeout);
    }
}

app.post('/api/send-order', orderLimiter, async (req, res) => {
    try {
        const order = req.body || {};

        if (!clean(order.name, '') || !clean(order.contact, '')) {
            return res.status(400).json({
                success: false,
                message: '姓名和联系方式为必填项。',
            });
        }

        if (
            !clean(order.tensionHorizontal, '') ||
            !clean(order.tensionVertical, '') ||
            !clean(order.dropoffDate, '') ||
            !clean(order.pickupDate, '')
        ) {
            return res.status(400).json({
                success: false,
                message: '请填写完整的穿线需求信息。',
            });
        }

        if (!clean(order.grommetReplace, '')) {
            return res.status(400).json({
                success: false,
                message: '请选择是否需要更换护线管。',
            });
        }

        await sendOrderEmail(order);
        console.log(`📤 新订单已转发：${clean(order.name)} | ${clean(order.contact)}`);
        return res.json({ success: true, message: '订单已成功发送！' });
    } catch (error) {
        console.error('订单发送失败：', error);
        const message =
            error.name === 'AbortError'
                ? '订单发送超时，请稍后重试。'
                : '订单发送失败，请稍后重试。';
        return res.status(502).json({ success: false, message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🏸 羽毛球穿线服务预约系统已启动');
    console.log(`🌐 访问地址：http://localhost:${PORT}`);
    console.log(`📧 订单将通过 Web3Forms 发送至：${TARGET_EMAIL}`);
    console.log('');
});
