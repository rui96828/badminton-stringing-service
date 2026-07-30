/**
 * 羽毛球穿线服务预约 - 前端脚本
 */

(function () {
    'use strict';

    const form = document.getElementById('bookingForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const successMsg = document.getElementById('successMessage');
    const errorMsg = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    // ========== 表单验证规则 ==========
    const validators = {
        name: {
            validate: (v) => v.trim().length >= 2,
            message: '请输入至少 2 个字的姓名',
        },
        contact: {
            validate: (v) => v.trim().length > 0,
            message: '联系方式为必填项，请输入手机号/微信号/QQ号',
        },
        racketCount: {
            validate: (v) => v !== '',
            message: '请选择穿线拍数',
        },
        tensionHorizontal: {
            validate: (v) => {
                const num = parseFloat(v);
                return !isNaN(num) && num >= 16 && num <= 35;
            },
            message: '请输入有效的横线磅数（16-35 磅之间）',
        },
        tensionVertical: {
            validate: (v) => {
                const num = parseFloat(v);
                return !isNaN(num) && num >= 16 && num <= 35;
            },
            message: '请输入有效的竖线磅数（16-35 磅之间）',
        },
        dropoffDate: {
            validate: (v) => v !== '',
            message: '请选择送拍日期',
        },
        pickupDate: {
            validate: (v) => v !== '',
            message: '请选择取拍日期',
        },
    };

    // ========== 实时校验 ==========
    Object.keys(validators).forEach((fieldName) => {
        const el = document.getElementById(fieldName);
        if (!el) return;

        el.addEventListener('blur', () => validateField(fieldName));
        el.addEventListener('change', () => validateField(fieldName));
        el.addEventListener('input', () => {
            // 当用户开始输入时清除错误状态
            const errEl = document.querySelector(`.error-msg[data-for="${fieldName}"]`);
            if (errEl && errEl.textContent) {
                validateField(fieldName);
            }
        });
    });

    // 单选框校验（球线来源 + 护线管）
    ['stringSource', 'grommetReplace'].forEach((radioName) => {
        document.querySelectorAll(`input[name="${radioName}"]`).forEach((radio) => {
            radio.addEventListener('change', () => {
                const errEl = document.querySelector(`.error-msg[data-for="${radioName}"]`);
                if (errEl) errEl.textContent = '';
                document.querySelectorAll(`input[name="${radioName}"]`).forEach((r) => {
                    r.classList.remove('error');
                });
            });
        });
    });

    function validateField(fieldName) {
        const el = document.getElementById(fieldName);
        const errEl = document.querySelector(`.error-msg[data-for="${fieldName}"]`);
        if (!el || !errEl) return true;

        const rule = validators[fieldName];
        if (!rule) return true;

        const valid = rule.validate(el.value);
        if (!valid) {
            el.classList.add('error');
            errEl.textContent = rule.message;
        } else {
            el.classList.remove('error');
            errEl.textContent = '';
        }
        return valid;
    }

    // ========== 表单提交 ==========
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // 清除之前的错误
        clearAllErrors();

        // 整体校验
        let isValid = true;

        // 字段校验
        Object.keys(validators).forEach((fieldName) => {
            if (!validateField(fieldName)) isValid = false;
        });

        // 球线来源校验
        const stringSource = document.querySelector('input[name="stringSource"]:checked');
        if (!stringSource) {
            isValid = false;
            const errEl = document.querySelector('.error-msg[data-for="stringSource"]');
            if (errEl) errEl.textContent = '请选择球线来源（自带 or 需要提供）';
            document.querySelectorAll('input[name="stringSource"]').forEach((r) => {
                r.classList.add('error');
            });
        }

        // 护线管更换校验（必选）
        const grommetReplace = document.querySelector('input[name="grommetReplace"]:checked');
        if (!grommetReplace) {
            isValid = false;
            const errEl = document.querySelector('.error-msg[data-for="grommetReplace"]');
            if (errEl) errEl.textContent = '请选择是否需要更换护线管';
            document.querySelectorAll('input[name="grommetReplace"]').forEach((r) => {
                r.classList.add('error');
            });
        }

        // 联系方式 - 二次确认（最终兜底）
        const contact = document.getElementById('contact').value.trim();
        if (!contact) {
            isValid = false;
            const el = document.getElementById('contact');
            el.classList.add('error');
            const errEl = document.querySelector('.error-msg[data-for="contact"]');
            if (errEl) errEl.textContent = '必须提供联系方式才能下单！';
        }

        // 日期逻辑校验
        const dropoffDate = document.getElementById('dropoffDate').value;
        const pickupDate = document.getElementById('pickupDate').value;
        if (dropoffDate && pickupDate) {
            if (pickupDate < dropoffDate) {
                isValid = false;
                const errEl = document.querySelector('.error-msg[data-for="pickupDate"]');
                if (errEl) errEl.textContent = '取拍日期不能早于送拍日期';
                document.getElementById('pickupDate').classList.add('error');
            }
        }

        if (!isValid) {
            // 滚动到第一个错误
            const firstError = form.querySelector('.error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.focus();
            }
            return;
        }

        // 护线管选项映射
        const grommetMap = {
            none: '不需要更换',
            partial: '局部更换（≤8个）+¥3',
            half: '更换一半 +¥7',
            full: '更换全套 +¥12',
        };

        // 收集表单数据
        const orderData = {
            name: document.getElementById('name').value.trim(),
            racketModel: document.getElementById('racketModel').value.trim() || '未指定',
            contact: contact,
            racketCount: document.getElementById('racketCount').value,
            stringSource: stringSource.value === 'self' ? '自带球线' : '需要提供球线',
            stringModel: document.getElementById('stringModel').value.trim() || '未指定',
            grommetReplace: grommetMap[grommetReplace.value] || '未指定',
            tensionHorizontal: document.getElementById('tensionHorizontal').value + ' lbs',
            tensionVertical: document.getElementById('tensionVertical').value + ' lbs',
            stringColor: document.getElementById('stringColor').value || '未指定',
            dropoffDate: document.getElementById('dropoffDate').value,
            dropoffTime: document.getElementById('dropoffTime').value || '未指定',
            pickupDate: document.getElementById('pickupDate').value,
            pickupTime: document.getElementById('pickupTime').value || '未指定',
            notes: document.getElementById('notes').value.trim() || '无',
            orderTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        };

        // 显示加载状态
        setLoading(true);

        try {
            const response = await fetch('/api/send-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
            });

            const result = await response.json();

            if (result.success) {
                showSuccess();
            } else {
                showError(result.message || '发送失败，请稍后再试。');
            }
        } catch (err) {
            console.error('提交失败:', err);
            showError('网络连接失败，请检查网络后重试。如持续失败，请直接发送订单信息到邮箱：3114354665@qq.com');
        } finally {
            setLoading(false);
        }
    });

    // ========== UI 辅助函数 ==========
    function setLoading(loading) {
        submitBtn.disabled = loading;
        btnText.style.display = loading ? 'none' : 'inline';
        btnLoading.style.display = loading ? 'inline' : 'none';
    }

    function showSuccess() {
        form.style.display = 'none';
        successMsg.style.display = 'block';
        errorMsg.style.display = 'none';
        successMsg.scrollIntoView({ behavior: 'smooth' });
    }

    function showError(message) {
        form.style.display = 'none';
        errorText.textContent = message;
        errorMsg.style.display = 'block';
        successMsg.style.display = 'none';
        errorMsg.scrollIntoView({ behavior: 'smooth' });
    }

    function clearAllErrors() {
        form.querySelectorAll('.error').forEach((el) => el.classList.remove('error'));
        form.querySelectorAll('.error-msg').forEach((el) => (el.textContent = ''));
    }

    // 暴露到全局
    window.hideError = function () {
        form.style.display = 'block';
        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';
        setLoading(false);
    };

    // ========== 日期默认值 ==========
    // 送拍日期默认今天
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dropoffDate').setAttribute('min', today);
    document.getElementById('pickupDate').setAttribute('min', today);
})();
