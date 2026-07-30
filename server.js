/**
 * 羽毛球穿线服务 - 后端服务器
 * 接收预约订单并通过 QQ 邮箱发送
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// 中间件
app.use(express.json());
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

// QQ 邮箱 SMTP 配置
// 请设置环境变量 QQ_EMAIL 和 QQ_SMTP_AUTH_CODE
// QQ邮箱 SMTP 授权码获取方式：QQ邮箱 → 设置 → 账户 → POP3/SMTP服务 → 生成授权码
const smtpPort = Number(process.env.QQ_SMTP_PORT || 465);

const smtpHost = process.env.QQ_SMTP_HOST || 'smtp.qq.com';

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort !== 465,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    auth: {
        user: process.env.QQ_EMAIL,           // 你的 QQ 邮箱地址
        pass: process.env.QQ_SMTP_AUTH_CODE,  // QQ 邮箱 SMTP 授权码（非密码）
    },
    tls: {
        servername: 'smtp.qq.com',
    },
});

// 目标邮箱
const TARGET_EMAIL = '3114354665@qq.com';

/**
 * 格式化订单信息为纯文本
 */
function formatOrderText(order) {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    const thinDivider = '──────────────────────────────';

    return `
${divider}
  🏸  羽毛球穿线预约订单
${divider}

  📋 订单基本信息
${thinDivider}
  下单时间    ：${order.orderTime}
  客户姓名    ：${order.name}
  联系方式    ：${order.contact}
  球拍型号    ：${order.racketModel}

  🏸 穿线需求
${thinDivider}
  穿线拍数    ：${order.racketCount}
  球线来源    ：${order.stringSource}
  球线型号    ：${order.stringModel}
  横线磅数    ：${order.tensionHorizontal}
  竖线磅数    ：${order.tensionVertical}
  球线颜色    ：${order.stringColor}

  🔧 护线管更换
${thinDivider}
  更换方案    ：${order.grommetReplace}

  📅 时间安排
${thinDivider}
  送拍时间    ：${order.dropoffDate}  ${order.dropoffTime}
  取拍时间    ：${order.pickupDate}  ${order.pickupTime}

  📝 备注
${thinDivider}
  ${order.notes}

${divider}
  此订单由穿线服务预约系统自动发送
  请尽快与客户联系确认订单详情
${divider}
`.trim();
}

/**
 * 发送订单邮件
 */
async function sendOrderEmail(order) {
    const text = formatOrderText(order);
    const subject = `🏸 穿线预约 - ${order.name} - ${order.dropoffDate}`;

    const mailOptions = {
        from: {
            name: '羽毛球穿线预约系统',
            address: process.env.QQ_EMAIL,
        },
        to: TARGET_EMAIL,
        subject: subject,
        text: text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ 邮件已发送: ${info.messageId}`);
    return info;
}

// API: 发送订单
app.post('/api/send-order', orderLimiter, async (req, res) => {
    try {
        const order = req.body;

        // 基本验证
        if (!order.name || !order.contact) {
            return res.status(400).json({
                success: false,
                message: '姓名和联系方式为必填项',
            });
        }

        if (!order.tensionHorizontal || !order.tensionVertical || !order.dropoffDate || !order.pickupDate) {
            return res.status(400).json({
                success: false,
                message: '请填写完整的穿线需求信息',
            });
        }

        if (!order.grommetReplace) {
            return res.status(400).json({
                success: false,
                message: '请选择是否需要更换护线管',
            });
        }

        // 发送邮件
        await sendOrderEmail(order);

        console.log(`📬 新订单: ${order.name} | ${order.contact} | ${order.tension}`);

        res.json({ success: true, message: '订单已成功发送！' });
    } catch (error) {
        console.error('发送邮件失败:', error);
        res.status(500).json({
            success: false,
            message: '邮件发送失败：' + (error.message || '未知错误'),
        });
    }
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🏸  羽毛球穿线服务预约系统已启动');
    console.log(`🌐  访问地址: http://localhost:${PORT}`);
    console.log(`📧  订单将发送至: ${TARGET_EMAIL}`);
    console.log('');

    if (!process.env.QQ_EMAIL || !process.env.QQ_SMTP_AUTH_CODE) {
        console.warn('⚠️  警告：未配置 QQ 邮箱 SMTP 信息！');
        console.warn('   请复制 .env.example 为 .env 并填入你的 QQ 邮箱和 SMTP 授权码');
        console.warn('   QQ邮箱 SMTP 授权码获取方式：QQ邮箱 → 设置 → 账户 → POP3/SMTP服务 → 生成授权码');
        console.log('');
    }
});
