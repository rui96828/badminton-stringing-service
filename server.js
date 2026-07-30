/**
 * 羽毛球穿线服务预约系统
 * 网页由 Express 提供，预约表单在浏览器中通过 Web3Forms HTTPS API 发送。
 */

const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🏸 羽毛球穿线服务预约系统已启动');
    console.log(`🌐 访问地址：http://localhost:${PORT}`);
    console.log('📧 订单将通过 Web3Forms 发送至：3114354665@qq.com');
    console.log('');
});
