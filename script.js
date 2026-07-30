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
    const COLOR_OPTIONS = [
        '白色',
        '黄色',
        '橙色',
        '红色',
        '绿色',
        '蓝色',
        '紫色',
        '黑色',
        '粉色',
        '其他（请在备注中说明）',
        '白色（固定）',
        '随机搭配（以现货为准）',
    ];

    const form = document.getElementById('bookingForm');
    const racketCount = document.getElementById('racketCount');
    const racketDetailsContainer = document.getElementById('racketDetailsContainer');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const successMsg = document.getElementById('successMessage');
    const successOrderNumber = document.getElementById('successOrderNumber');
    const errorMsg = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    const stringModal = document.getElementById('stringModal');
    const stringModalError = document.getElementById('stringModalError');
    const confirmStringChoice = document.getElementById('confirmStringChoice');
    const cancelStringChoice = document.getElementById('cancelStringChoice');

    const orderReviewModal = document.getElementById('orderReviewModal');
    const orderReviewContent = document.getElementById('orderReviewContent');
    const editOrderBtn = document.getElementById('editOrderBtn');
    const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');

    let activeRacketIndex = null;
    let pendingOrder = null;

    const validators = {
        name: {
            validate: (value) => value.trim().length >= 2,
            message: '请输入至少 2 个字的姓名',
        },
        contact: {
            validate: (value) => value.trim().length > 0,
            message: '联系方式为必填项，请输入手机号/微信号/QQ号',
        },
        racketCount: {
            validate: (value) => Number.isInteger(Number(value)) && Number(value) >= 1,
            message: '请选择穿线拍数',
        },
        dropoffDate: {
            validate: (value) => value !== '',
            message: '请选择送拍日期',
        },
        pickupDate: {
            validate: (value) => value !== '',
            message: '请选择取拍日期',
        },
    };

    Object.keys(validators).forEach((fieldName) => {
        const element = document.getElementById(fieldName);
        element.addEventListener('blur', () => validateField(fieldName));
        element.addEventListener('change', () => validateField(fieldName));
        element.addEventListener('input', () => {
            const errorElement = document.querySelector(`.error-msg[data-for="${fieldName}"]`);
            if (errorElement && errorElement.textContent) validateField(fieldName);
        });
    });

    racketCount.addEventListener('change', () => {
        validateField('racketCount');
        renderRacketCards(Number(racketCount.value));
    });

    racketDetailsContainer.addEventListener('change', (event) => {
        const sourceRadio = event.target.closest('input[data-role="string-source"]');
        if (!sourceRadio) {
            if (event.target.matches('input[data-field="grommet"]')) {
                clearCardError(event.target.closest('.racket-card'), 'grommet');
            }
            return;
        }

        const card = sourceRadio.closest('.racket-card');
        clearCardError(card, 'stringSource');

        if (sourceRadio.value === 'provided') {
            openStringModal(Number(card.dataset.index));
        } else {
            resetCardForOwnString(card);
        }
    });

    racketDetailsContainer.addEventListener('input', (event) => {
        const field = event.target.dataset.field;
        if (!field) return;
        const card = event.target.closest('.racket-card');
        clearCardError(card, field);
        event.target.classList.remove('error');
    });

    confirmStringChoice.addEventListener('click', () => {
        const selected = document.querySelector('input[name="providedString"]:checked');
        if (!selected) {
            stringModalError.textContent = '请选择一种球线。';
            return;
        }

        const card = getRacketCard(activeRacketIndex);
        if (!card) return;

        const option = STRING_OPTIONS[selected.value];
        card.dataset.providedString = selected.value;
        const modelInput = card.querySelector('[data-field="stringModel"]');
        const colorSelect = card.querySelector('[data-field="stringColor"]');
        const modelHint = card.querySelector('[data-role="string-model-hint"]');
        const colorHint = card.querySelector('[data-role="string-color-hint"]');

        modelInput.value = option.name;
        modelInput.readOnly = true;
        colorSelect.value = option.color;
        colorSelect.disabled = true;
        modelHint.textContent = `已选择 ${option.name}，¥${option.price} / 条。`;
        colorHint.textContent =
            selected.value === 'vbs66n'
                ? '胜利 VBS66N 仅提供白色。'
                : '颜色将根据球拍样式和现货随机协调搭配。';

        clearCardError(card, 'stringModel');
        clearCardError(card, 'stringColor');
        stringModalError.textContent = '';
        closeModal(stringModal);
        activeRacketIndex = null;
    });

    cancelStringChoice.addEventListener('click', () => {
        const card = getRacketCard(activeRacketIndex);
        if (card && !card.dataset.providedString) {
            const providedRadio = card.querySelector(
                'input[data-role="string-source"][value="provided"]'
            );
            providedRadio.checked = false;
        }
        stringModalError.textContent = '';
        closeModal(stringModal);
        activeRacketIndex = null;
    });

    editOrderBtn.addEventListener('click', () => {
        closeModal(orderReviewModal);
        pendingOrder = null;
    });

    confirmSubmitBtn.addEventListener('click', submitConfirmedOrder);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        clearAllErrors();

        let isValid = true;
        Object.keys(validators).forEach((fieldName) => {
            if (!validateField(fieldName)) isValid = false;
        });

        if (!validateRacketCards()) isValid = false;

        const dropoffDate = document.getElementById('dropoffDate').value;
        const pickupDate = document.getElementById('pickupDate').value;
        if (dropoffDate && pickupDate && pickupDate < dropoffDate) {
            isValid = false;
            const errorElement = document.querySelector('.error-msg[data-for="pickupDate"]');
            errorElement.textContent = '取拍日期不能早于送拍日期';
            document.getElementById('pickupDate').classList.add('error');
        }

        if (!isValid) {
            const firstError = form.querySelector('.error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.focus();
            }
            return;
        }

        pendingOrder = buildOrderData();
        renderOrderReview(pendingOrder);
        openModal(orderReviewModal);
    });

    function renderRacketCards(count) {
        if (!count) {
            racketDetailsContainer.innerHTML =
                '<div class="racket-placeholder">请先选择穿线拍数</div>';
            return;
        }

        racketDetailsContainer.innerHTML = Array.from({ length: count }, (_, index) =>
            racketCardTemplate(index)
        ).join('');
    }

    function racketCardTemplate(index) {
        const number = index + 1;
        const colorOptions = COLOR_OPTIONS.map(
            (color) => `<option value="${escapeHtml(color)}">${escapeHtml(color)}</option>`
        ).join('');

        return `
            <section class="racket-card" data-index="${index}">
                <h3>🏸 第 ${number} 支球拍</h3>

                <div class="form-group">
                    <label>球拍品牌/型号 <span class="required">*</span></label>
                    <input type="text" data-field="racketModel"
                           placeholder="如：YONEX 天斧100ZZ、李宁 风刃900">
                    <span class="racket-error" data-error-for="racketModel"></span>
                </div>

                <div class="form-group">
                    <label>球线来源 <span class="required">*</span></label>
                    <div class="radio-group">
                        <label class="radio-label">
                            <input type="radio" name="stringSource_${index}" value="self"
                                   data-role="string-source">
                            自带球线
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="stringSource_${index}" value="provided"
                                   data-role="string-source">
                            需要提供球线
                        </label>
                    </div>
                    <span class="racket-error" data-error-for="stringSource"></span>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>球线品牌/型号 <span class="required">*</span></label>
                        <input type="text" data-field="stringModel" placeholder="请先选择球线来源">
                        <span class="racket-error" data-error-for="stringModel"></span>
                        <small class="hint" data-role="string-model-hint">自带线请填写型号；需要提供请在弹窗选择。</small>
                    </div>
                    <div class="form-group">
                        <label>球线颜色 <span class="required">*</span></label>
                        <select data-field="stringColor">
                            <option value="">请选择颜色</option>
                            ${colorOptions}
                        </select>
                        <span class="racket-error" data-error-for="stringColor"></span>
                        <small class="hint" data-role="string-color-hint">自带球线必须选择颜色。</small>
                    </div>
                </div>

                <div class="form-group">
                    <label>是否需要更换护线管 <span class="required">*</span></label>
                    <div class="radio-group grommet-options">
                        <label class="radio-label">
                            <input type="radio" name="grommet_${index}" value="none"
                                   data-field="grommet">不需要
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="grommet_${index}" value="partial"
                                   data-field="grommet">局部 +¥3
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="grommet_${index}" value="half"
                                   data-field="grommet">一半 +¥7
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="grommet_${index}" value="full"
                                   data-field="grommet">全套 +¥12
                        </label>
                    </div>
                    <span class="racket-error" data-error-for="grommet"></span>
                </div>

                <div class="form-group">
                    <label>穿线磅数 (lbs) <span class="required">*</span></label>
                    <div class="tension-dual-row">
                        <div class="tension-item">
                            <span class="tension-label">横线</span>
                            <input type="number" data-field="tensionHorizontal"
                                   placeholder="如：25" min="16" max="35" step="0.5">
                            <span class="tension-suffix">lbs</span>
                        </div>
                        <span class="tension-sep">×</span>
                        <div class="tension-item">
                            <span class="tension-label">竖线</span>
                            <input type="number" data-field="tensionVertical"
                                   placeholder="如：24" min="16" max="35" step="0.5">
                            <span class="tension-suffix">lbs</span>
                        </div>
                    </div>
                    <span class="racket-error" data-error-for="tension"></span>
                    <small class="hint">建议范围 20-30 磅，横线通常比竖线高 1-2 磅。</small>
                </div>
            </section>
        `;
    }

    function resetCardForOwnString(card) {
        delete card.dataset.providedString;
        const modelInput = card.querySelector('[data-field="stringModel"]');
        const colorSelect = card.querySelector('[data-field="stringColor"]');

        modelInput.readOnly = false;
        modelInput.value = '';
        modelInput.placeholder = '如：YONEX BG80、胜利 VBS63';
        colorSelect.disabled = false;
        colorSelect.value = '';
        card.querySelector('[data-role="string-model-hint"]').textContent =
            '自带球线必须填写品牌与型号。';
        card.querySelector('[data-role="string-color-hint"]').textContent =
            '自带球线必须选择颜色。';
    }

    function openStringModal(index) {
        activeRacketIndex = index;
        const card = getRacketCard(index);
        const savedValue = card.dataset.providedString || '';

        document.querySelectorAll('input[name="providedString"]').forEach((radio) => {
            radio.checked = radio.value === savedValue;
        });
        stringModalError.textContent = '';
        openModal(stringModal);
    }

    function validateRacketCards() {
        const cards = [...racketDetailsContainer.querySelectorAll('.racket-card')];
        if (!cards.length) return false;

        let allValid = true;
        cards.forEach((card) => {
            const requiredTextFields = ['racketModel', 'stringModel', 'stringColor'];
            requiredTextFields.forEach((field) => {
                const input = card.querySelector(`[data-field="${field}"]`);
                const valid = input.value.trim() !== '';
                if (!valid) {
                    allValid = false;
                    setCardError(
                        card,
                        field,
                        field === 'racketModel'
                            ? '请填写这支球拍的品牌与型号'
                            : field === 'stringModel'
                              ? '请填写或选择球线型号'
                              : '请选择或确认球线颜色'
                    );
                    input.classList.add('error');
                }
            });

            const source = card.querySelector('input[data-role="string-source"]:checked');
            if (!source) {
                allValid = false;
                setCardError(card, 'stringSource', '请选择这支球拍的球线来源');
                card.querySelectorAll('input[data-role="string-source"]').forEach((radio) => {
                    radio.classList.add('error');
                });
            } else if (source.value === 'provided' && !card.dataset.providedString) {
                allValid = false;
                setCardError(card, 'stringSource', '请在弹窗中选择需要提供的球线');
            }

            const grommet = card.querySelector('input[data-field="grommet"]:checked');
            if (!grommet) {
                allValid = false;
                setCardError(card, 'grommet', '请选择这支球拍是否更换护线管');
                card.querySelectorAll('input[data-field="grommet"]').forEach((radio) => {
                    radio.classList.add('error');
                });
            }

            const horizontal = card.querySelector('[data-field="tensionHorizontal"]');
            const vertical = card.querySelector('[data-field="tensionVertical"]');
            const horizontalValue = Number(horizontal.value);
            const verticalValue = Number(vertical.value);
            if (
                !horizontal.value ||
                !vertical.value ||
                horizontalValue < 16 ||
                horizontalValue > 35 ||
                verticalValue < 16 ||
                verticalValue > 35
            ) {
                allValid = false;
                setCardError(card, 'tension', '横线和竖线磅数均须填写 16-35 之间的数值');
                if (!horizontal.value || horizontalValue < 16 || horizontalValue > 35) {
                    horizontal.classList.add('error');
                }
                if (!vertical.value || verticalValue < 16 || verticalValue > 35) {
                    vertical.classList.add('error');
                }
            }
        });

        return allValid;
    }

    function buildOrderData() {
        const rackets = [...racketDetailsContainer.querySelectorAll('.racket-card')].map(
            (card, index) => {
                const source = card.querySelector('input[data-role="string-source"]:checked');
                const grommetValue = card.querySelector(
                    'input[data-field="grommet"]:checked'
                ).value;
                const grommet = GROMMET_OPTIONS[grommetValue];
                const suppliedString =
                    source.value === 'provided'
                        ? STRING_OPTIONS[card.dataset.providedString]
                        : null;
                const stringPrice = suppliedString ? suppliedString.price : 0;

                return {
                    number: index + 1,
                    racketModel: card.querySelector('[data-field="racketModel"]').value.trim(),
                    stringSource: source.value === 'self' ? '自带球线' : '需要提供球线',
                    stringModel: card.querySelector('[data-field="stringModel"]').value.trim(),
                    stringColor: card.querySelector('[data-field="stringColor"]').value,
                    stringPrice,
                    grommetReplace: grommet.name,
                    grommetPrice: grommet.price,
                    tensionHorizontal: `${card.querySelector('[data-field="tensionHorizontal"]').value} lbs`,
                    tensionVertical: `${card.querySelector('[data-field="tensionVertical"]').value} lbs`,
                    laborPrice: LABOR_PRICE,
                    subtotal: LABOR_PRICE + grommet.price + stringPrice,
                };
            }
        );

        const laborTotal = LABOR_PRICE * rackets.length;
        const grommetTotal = rackets.reduce((sum, racket) => sum + racket.grommetPrice, 0);
        const stringTotal = rackets.reduce((sum, racket) => sum + racket.stringPrice, 0);

        return {
            orderNumber: generateOrderNumber(),
            name: document.getElementById('name').value.trim(),
            contact: document.getElementById('contact').value.trim(),
            racketCount: rackets.length,
            rackets,
            dropoffDate: document.getElementById('dropoffDate').value,
            dropoffTime: document.getElementById('dropoffTime').value || '未指定',
            pickupDate: document.getElementById('pickupDate').value,
            pickupTime: document.getElementById('pickupTime').value || '未指定',
            notes: document.getElementById('notes').value.trim() || '无',
            laborTotal,
            grommetTotal,
            stringTotal,
            totalAmount: laborTotal + grommetTotal + stringTotal,
            paymentMethod: '取拍时当面结清',
            orderTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        };
    }

    function renderOrderReview(order) {
        const racketSections = order.rackets
            .map(
                (racket) => `
                    <div class="review-racket">
                        <h4>第 ${racket.number} 支球拍 · 小计 ¥${racket.subtotal}</h4>
                        ${reviewRows([
                            ['球拍型号', racket.racketModel],
                            ['球线来源', racket.stringSource],
                            ['球线型号', racket.stringModel],
                            ['球线颜色', racket.stringColor],
                            [
                                '穿线磅数',
                                `横线 ${racket.tensionHorizontal} / 竖线 ${racket.tensionVertical}`,
                            ],
                            ['护线管', racket.grommetReplace],
                            [
                                '本拍费用',
                                `手工 ¥${racket.laborPrice} + 护线管 ¥${racket.grommetPrice} + 球线 ¥${racket.stringPrice}`,
                            ],
                        ])}
                    </div>
                `
            )
            .join('');

        orderReviewContent.innerHTML = `
            <div class="order-number">订单号：${escapeHtml(order.orderNumber)}</div>
            <div class="review-section">
                ${reviewRows([
                    ['客户姓名', order.name],
                    ['联系方式', order.contact],
                    ['球拍数量', `${order.racketCount} 支`],
                    ['送拍时间', `${order.dropoffDate} ${order.dropoffTime}`],
                    ['取拍时间', `${order.pickupDate} ${order.pickupTime}`],
                    ['备注', order.notes],
                ])}
            </div>
            ${racketSections}
            <h4>费用汇总</h4>
            <div class="review-section fee-section">
                ${reviewRows([
                    ['穿线手工费', `¥${order.laborTotal}`],
                    ['护线管费用', `¥${order.grommetTotal}`],
                    ['球线费用', `¥${order.stringTotal}`],
                ])}
                <div class="review-row total-row"><span>总金额</span><strong>¥${order.totalAmount}</strong></div>
            </div>
        `;
    }

    function reviewRows(rows) {
        return rows
            .map(
                ([label, value]) =>
                    `<div class="review-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(
                        String(value)
                    )}</strong></div>`
            )
            .join('');
    }

    async function submitConfirmedOrder() {
        if (!pendingOrder) return;

        confirmSubmitBtn.disabled = true;
        confirmSubmitBtn.textContent = '提交中...';
        setLoading(true);

        const order = pendingOrder;
        const racketText = order.rackets
            .map(
                (racket) => [
                    `【第 ${racket.number} 支球拍】`,
                    `球拍型号：${racket.racketModel}`,
                    `球线来源：${racket.stringSource}`,
                    `球线型号：${racket.stringModel}`,
                    `球线颜色：${racket.stringColor}`,
                    `穿线磅数：横线 ${racket.tensionHorizontal} / 竖线 ${racket.tensionVertical}`,
                    `护线管：${racket.grommetReplace}`,
                    `本拍费用：手工 ¥${racket.laborPrice} + 护线管 ¥${racket.grommetPrice} + 球线 ¥${racket.stringPrice} = ¥${racket.subtotal}`,
                ].join('\n')
            )
            .join('\n\n');

        const message = [
            '🏸 羽毛球穿线预约订单',
            `订单号码：${order.orderNumber}`,
            '',
            `下单时间：${order.orderTime}`,
            `客户姓名：${order.name}`,
            `联系方式：${order.contact}`,
            `球拍数量：${order.racketCount} 支`,
            '',
            racketText,
            '',
            `送拍时间：${order.dropoffDate} ${order.dropoffTime}`,
            `取拍时间：${order.pickupDate} ${order.pickupTime}`,
            `备注：${order.notes}`,
            '',
            '【费用汇总】',
            `穿线手工费：¥${order.laborTotal}`,
            `护线管费用：¥${order.grommetTotal}`,
            `球线费用：¥${order.stringTotal}`,
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
                }),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || '发送失败，请稍后再试。');

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

    function validateField(fieldName) {
        const element = document.getElementById(fieldName);
        const errorElement = document.querySelector(`.error-msg[data-for="${fieldName}"]`);
        const rule = validators[fieldName];
        const valid = rule.validate(element.value);

        element.classList.toggle('error', !valid);
        errorElement.textContent = valid ? '' : rule.message;
        return valid;
    }

    function setCardError(card, field, message) {
        const errorElement = card.querySelector(`[data-error-for="${field}"]`);
        if (errorElement) errorElement.textContent = message;
    }

    function clearCardError(card, field) {
        setCardError(card, field, '');
        if (field === 'grommet') {
            card.querySelectorAll('input[data-field="grommet"]').forEach((radio) => {
                radio.classList.remove('error');
            });
        }
    }

    function clearAllErrors() {
        form.querySelectorAll('.error').forEach((element) => element.classList.remove('error'));
        form.querySelectorAll('.error-msg, .racket-error').forEach((element) => {
            element.textContent = '';
        });
    }

    function getRacketCard(index) {
        if (index === null || index === undefined) return null;
        return racketDetailsContainer.querySelector(`.racket-card[data-index="${index}"]`);
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
        return String(value)
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
