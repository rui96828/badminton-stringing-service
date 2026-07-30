/**
 * 羽毛球穿线服务预约 - 前端脚本
 */

(function () {
    'use strict';

    const WEB3FORMS_ACCESS_KEY = '1b796361-dea0-4063-8009-8dafc14ed7f6';
    const LABOR_PRICE = 20;
    const STRING_OPTIONS = {
        vbs66n: { name: '胜利 VBS66N', price: 28, color: '白色（固定）' },
        bg65: { name: 'YONEX BG65', price: 30, color: '随机搭配（以现货为准）' },
        kt61: { name: '卡琳 KT61', price: 20, color: '随机搭配（以现货为准）' },
        kt65: { name: '卡琳 KT65', price: 21, color: '随机搭配（以现货为准）' },
    };
    const GROMMET_OPTIONS = {
        none: { name: '不需要更换', price: 0 },
        partial: { name: '局部更换（≤8个）', price: 3 },
        half: { name: '更换一半', price: 7 },
        full: { name: '更换全套', price: 12 },
    };

    const form = document.getElementById('bookingForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const successMsg = document.getElementById('successMessage');
    const successOrderNumber = document.getElementById('successOrderNumber');
    const errorMsg = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const stringModel = document.getElementById('stringModel');
    const stringColor = document.getElementById('stringColor');
    const stringModelHint = document.getElementById('stringModelHint');
    const stringColorHint = document.getElementById('stringColorHint');

    const stringModal = document.getElementById('stringModal');
    const stringModalError = document.getElementById('stringModalError');
    const confirmStringChoice = document.getElementById('confirmStringChoice');
    const cancelStringChoice = document.getElementById('cancelStringChoice');

    const orderReviewModal = document.getElementById('orderReviewModal');
    const orderReviewContent = document.getElementById('orderReviewContent');
    const editOrderBtn = document.getElementById('editOrderBtn');
    const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');

    let selectedProvidedString = null;
    let pendingOrder = null;

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
            validate: (v) => Number.isInteger(Number(v)) && Number(v) >= 1,
            message: '请选择穿线拍数',
        },
        stringModel: {
            validate: (v) => v.trim().length > 0,
            message: '请填写或选择球线品牌与型号',
        },
        stringColor: {
            validate: (v) => v !== '',
            message: '请填写或确认球线颜色',
        },
        tensionHorizontal: {
            validate: (v) => {
                const num = parseFloat(v);
                return !Number.isNaN(num) && num >= 16 && num <= 35;
            },
            message: '请输入有效的横线磅数（16-35 磅之间）',
        },
        tensionVertical: {
            validate: (v) => {
                const num = parseFloat(v);
                return !Number.isNaN(num) && num >= 16 && num <= 35;
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

    Object.keys(validators).forEach((fieldName) => {
        const el = document.getElementById(fieldName);
        if (!el) return;

        el.addEventListener('blur', () => validateField(fieldName));
        el.addEventListener('change', () => validateField(fieldName));
        el.addEventListener('input', () => {
            const errEl = document.querySelector(`.error-msg[data-for="${fieldName}"]`);
            if (errEl && errEl.textContent) validateField(fieldName);
        });
    });

    document.querySelectorAll('input[name="stringSource"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            clearRadioError('stringSource');
            if (radio.value === 'provided') {
                openModal(stringModal);
            } else {
                selectedProvidedString = null;
                document.querySelectorAll('input[name="providedString"]').forEach((item) => {
                    item.checked = false;
                });
                stringModel.readOnly = false;
                stringModel.value = '';
                stringModel.placeholder = '如：YONEX BG80、胜利 VBS63 等';
                stringColor.disabled = false;
                stringColor.value = '';
                stringModelHint.textContent = '自带球线必须填写品牌与型号。';
                stringColorHint.textContent = '自带球线必须选择颜色。';
            }
        });
    });

    document.querySelectorAll('input[name="grommetReplace"]').forEach((radio) => {
        radio.addEventListener('change', () => clearRadioError('grommetReplace'));
    });

    confirmStringChoice.addEventListener('click', () => {
        const selected = document.querySelector('input[name="providedString"]:checked');
        if (!selected) {
            stringModalError.textContent = '请选择一种球线。';
            return;
        }

        selectedProvidedString = selected.value;
        const option = STRING_OPTIONS[selectedProvidedString];
        stringModel.value = option.name;
        stringModel.readOnly = true;
        stringColor.value = option.color;
        stringColor.disabled = true;
        stringModelHint.textContent = `已选择 ${option.name}，¥${option.price} / 条。`;
        stringColorHint.textContent =
            selectedProvidedString === 'vbs66n'
                ? '胜利 VBS66N 仅提供白色。'
                : '颜色将根据球拍样式和现货随机协调搭配。';
        stringModalError.textContent = '';
        validateField('stringModel');
        validateField('stringColor');
        closeModal(stringModal);
    });

    cancelStringChoice.addEventListener('click', () => {
        if (!selectedProvidedString) {
            const providedRadio = document.querySelector('input[name="stringSource"][value="provided"]');
            providedRadio.checked = false;
            stringModel.value = '';
            stringColor.value = '';
        }
        stringModalError.textContent = '';
        closeModal(stringModal);
    });

    editOrderBtn.addEventListener('click', () => {
        closeModal(orderReviewModal);
        pendingOrder = null;
    });

    confirmSubmitBtn.addEventListener('click', submitConfirmedOrder);

    function validateField(fieldName) {
        const el = document.getElementById(fieldName);
        const errEl = document.querySelector(`.error-msg[data-for="${fieldName}"]`);
        if (!el || !errEl) return true;

        const rule = validators[fieldName];
        if (!rule) return true;

        const valid = rule.validate(el.value);
        el.classList.toggle('error', !valid);
        errEl.textContent = valid ? '' : rule.message;
        return valid;
    }

    function clearRadioError(name) {
        const errEl = document.querySelector(`.error-msg[data-for="${name}"]`);
        if (errEl) errEl.textContent = '';
        document.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
            radio.classList.remove('error');
        });
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        clearAllErrors();

        let isValid = true;
        Object.keys(validators).forEach((fieldName) => {
            if (!validateField(fieldName)) isValid = false;
        });

        const stringSource = document.querySelector('input[name="stringSource"]:checked');
        if (!stringSource) {
            isValid = false;
            showRadioError('stringSource', '请选择球线来源（自带或需要提供）');
        } else if (stringSource.value === 'provided' && !selectedProvidedString) {
            isValid = false;
            showRadioError('stringSource', '请选择需要提供的球线型号');
            openModal(stringModal);
        }

        const grommetReplace = document.querySelector('input[name="grommetReplace"]:checked');
        if (!grommetReplace) {
            isValid = false;
            showRadioError('grommetReplace', '请选择是否需要更换护线管');
        }

        const dropoffDate = document.getElementById('dropoffDate').value;
        const pickupDate = document.getElementById('pickupDate').value;
        if (dropoffDate && pickupDate && pickupDate < dropoffDate) {
            isValid = false;
            const errEl = document.querySelector('.error-msg[data-for="pickupDate"]');
            errEl.textContent = '取拍日期不能早于送拍日期';
            document.getElementById('pickupDate').classList.add('error');
        }

        if (!isValid) {
            if (stringModal.style.display === 'none') {
                const firstError = form.querySelector('.error');
                if (firstError) {
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstError.focus();
                }
            }
            return;
        }

        pendingOrder = buildOrderData(stringSource, grommetReplace);
        renderOrderReview(pendingOrder);
        openModal(orderReviewModal);
    });

    function buildOrderData(stringSource, grommetReplace) {
        const count = Number(document.getElementById('racketCount').value);
        const grommet = GROMMET_OPTIONS[grommetReplace.value];
        const suppliedString =
            stringSource.value === 'provided' ? STRING_OPTIONS[selectedProvidedString] : null;

        const laborSubtotal = LABOR_PRICE * count;
        const grommetSubtotal = grommet.price * count;
        const stringSubtotal = suppliedString ? suppliedString.price * count : 0;
        const totalAmount = laborSubtotal + grommetSubtotal + stringSubtotal;

        return {
            orderNumber: generateOrderNumber(),
            name: document.getElementById('name').value.trim(),
            racketModel: document.getElementById('racketModel').value.trim() || '未指定',
            contact: document.getElementById('contact').value.trim(),
            racketCount: `${count} 支`,
            racketCountValue: count,
            stringSource: stringSource.value === 'self' ? '自带球线' : '需要提供球线',
            stringModel: stringModel.value.trim(),
            stringColor: stringColor.value,
            stringUnitPrice: suppliedString ? suppliedString.price : 0,
            grommetReplace: grommet.name,
            grommetUnitPrice: grommet.price,
            tensionHorizontal: `${document.getElementById('tensionHorizontal').value} lbs`,
            tensionVertical: `${document.getElementById('tensionVertical').value} lbs`,
            dropoffDate: document.getElementById('dropoffDate').value,
            dropoffTime: document.getElementById('dropoffTime').value || '未指定',
            pickupDate: document.getElementById('pickupDate').value,
            pickupTime: document.getElementById('pickupTime').value || '未指定',
            notes: document.getElementById('notes').value.trim() || '无',
            laborSubtotal,
            grommetSubtotal,
            stringSubtotal,
            totalAmount,
            paymentMethod: '取拍时当面结清',
            orderTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        };
    }

    function generateOrderNumber() {
        const parts = new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date());
        const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        const random = Math.floor(1000 + Math.random() * 9000);
        return `${values.year}${values.month}${values.day}${random}`;
    }

    function renderOrderReview(order) {
        const rows = [
            ['订单号码', order.orderNumber],
            ['客户姓名', order.name],
            ['联系方式', order.contact],
            ['球拍型号', order.racketModel],
            ['穿线拍数', order.racketCount],
            ['球线来源', order.stringSource],
            ['球线型号', order.stringModel],
            ['球线颜色', order.stringColor],
            ['穿线磅数', `横线 ${order.tensionHorizontal} / 竖线 ${order.tensionVertical}`],
            ['护线管', order.grommetReplace],
            ['送拍时间', `${order.dropoffDate} ${order.dropoffTime}`],
            ['取拍时间', `${order.pickupDate} ${order.pickupTime}`],
            ['备注', order.notes],
        ];

        const detailRows = [
            [`穿线手工费 ¥${LABOR_PRICE} × ${order.racketCountValue}`, order.laborSubtotal],
            [
                order.grommetUnitPrice
                    ? `护线管费用 ¥${order.grommetUnitPrice} × ${order.racketCountValue}`
                    : '护线管费用',
                order.grommetSubtotal,
            ],
            [
                order.stringUnitPrice
                    ? `球线费用 ¥${order.stringUnitPrice} × ${order.racketCountValue}`
                    : '球线费用（自带球线）',
                order.stringSubtotal,
            ],
        ];

        orderReviewContent.innerHTML = `
            <div class="order-number">订单号：${escapeHtml(order.orderNumber)}</div>
            <div class="review-section">
                ${rows
                    .map(
                        ([label, value]) =>
                            `<div class="review-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(
                                String(value)
                            )}</strong></div>`
                    )
                    .join('')}
            </div>
            <h4>费用明细</h4>
            <div class="review-section fee-section">
                ${detailRows
                    .map(
                        ([label, amount]) =>
                            `<div class="review-row"><span>${escapeHtml(label)}</span><strong>¥${amount}</strong></div>`
                    )
                    .join('')}
                <div class="review-row total-row"><span>总金额</span><strong>¥${order.totalAmount}</strong></div>
            </div>
        `;
    }

    async function submitConfirmedOrder() {
        if (!pendingOrder) return;

        confirmSubmitBtn.disabled = true;
        confirmSubmitBtn.textContent = '提交中...';
        setLoading(true);

        const order = pendingOrder;
        const message = [
            '🏸 羽毛球穿线预约订单',
            `订单号码：${order.orderNumber}`,
            '',
            `下单时间：${order.orderTime}`,
            `客户姓名：${order.name}`,
            `联系方式：${order.contact}`,
            `球拍型号：${order.racketModel}`,
            `穿线拍数：${order.racketCount}`,
            '',
            `球线来源：${order.stringSource}`,
            `球线型号：${order.stringModel}`,
            `球线颜色：${order.stringColor}`,
            `横线磅数：${order.tensionHorizontal}`,
            `竖线磅数：${order.tensionVertical}`,
            `护线管更换：${order.grommetReplace}`,
            '',
            `送拍时间：${order.dropoffDate} ${order.dropoffTime}`,
            `取拍时间：${order.pickupDate} ${order.pickupTime}`,
            `备注：${order.notes}`,
            '',
            '费用明细：',
            `穿线手工费：¥${order.laborSubtotal}`,
            `护线管费用：¥${order.grommetSubtotal}`,
            `球线费用：¥${order.stringSubtotal}`,
            `总金额：¥${order.totalAmount}`,
            `付款方式：${order.paymentMethod}`,
        ].join('\n');

        try {
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_key: WEB3FORMS_ACCESS_KEY,
                    subject: `🏸 穿线预约 ${order.orderNumber} - ${order.name}`,
                    from_name: '羽毛球穿线预约系统',
                    botcheck: '',
                    message,
                    ...order,
                }),
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || '发送失败，请稍后再试。');
            }

            closeModal(orderReviewModal);
            showSuccess(order.orderNumber);
            pendingOrder = null;
        } catch (error) {
            closeModal(orderReviewModal);
            showError(error.message || '网络连接失败，请检查网络后重试。');
        } finally {
            confirmSubmitBtn.disabled = false;
            confirmSubmitBtn.textContent = '确认提交预约';
            setLoading(false);
        }
    }

    function showRadioError(name, message) {
        const errEl = document.querySelector(`.error-msg[data-for="${name}"]`);
        if (errEl) errEl.textContent = message;
        document.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
            radio.classList.add('error');
        });
    }

    function setLoading(loading) {
        submitBtn.disabled = loading;
        btnText.style.display = loading ? 'none' : 'inline';
        btnLoading.style.display = loading ? 'inline' : 'none';
    }

    function showSuccess(orderNumber) {
        form.style.display = 'none';
        successOrderNumber.textContent = `订单号：${orderNumber}`;
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
        form.querySelectorAll('.error').forEach((element) => element.classList.remove('error'));
        form.querySelectorAll('.error-msg').forEach((element) => {
            element.textContent = '';
        });
    }

    function openModal(modal) {
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
    }

    function closeModal(modal) {
        modal.style.display = 'none';
        if (stringModal.style.display === 'none' && orderReviewModal.style.display === 'none') {
            document.body.classList.remove('modal-open');
        }
    }

    function escapeHtml(value) {
        return value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    window.hideError = function () {
        form.style.display = 'block';
        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';
        setLoading(false);
    };

    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
    document.getElementById('dropoffDate').setAttribute('min', today);
    document.getElementById('pickupDate').setAttribute('min', today);
})();
