/**
 * 羽毛球穿线服务预约 - 前端脚本 (华丽版)
 * 包含：预约表单逻辑 + 羽毛球粒子系统 + 点击特效 + 鼠标跟踪
 */

(function () {
    'use strict';

    // ============================================
    // 预约表单逻辑
    // ============================================
    const WEB3FORMS_ACCESS_KEY = '1b796361-dea0-4063-8009-8dafc14ed7f6';
    const LABOR_PRICE = 20;
    const STRING_OPTIONS = {
        vbs66n: { name: '胜利 VBS66N（白色）', price: 28, color: '白色（固定）' },
        bg65: { name: 'YONEX BG65（黄色）', price: 30, color: '黄色（固定）' },
        kt61: { name: '卡琳 KT61', price: 20, color: '随机搭配（以现货为准）' },
        kt65: { name: '卡琳 KT65', price: 21, color: '随机搭配（以现货为准）' },
    };
    const GROMMET_OPTIONS = {
        none: { name: '不需要更换', price: 0 },
        partial: { name: '局部更换（≤8个）', price: 3 },
        half: { name: '更换一半', price: 7 },
        full: { name: '更换全套', price: 12 },
    };
    const GRIP_OPTIONS = {
        purui7c: { name: '浦锐 7C', price: 3.5 },
        huameiAce102: { name: '华美 ACE102', price: 2.5 },
        yonex102c: { name: 'YONEX 102C', price: 10 },
        victorGr1: { name: '胜利 GR1', price: 4 },
        victorGr223: { name: '胜利 GR223', price: 8 },
    };
    const COLOR_OPTIONS = [
        '白色', '黄色', '橙色', '红色', '绿色', '蓝色', '紫色', '黑色', '粉色',
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

    const gripModal = document.getElementById('gripModal');
    const gripModalError = document.getElementById('gripModalError');
    const confirmGripChoice = document.getElementById('confirmGripChoice');
    const cancelGripChoice = document.getElementById('cancelGripChoice');

    const orderReviewModal = document.getElementById('orderReviewModal');
    const orderReviewContent = document.getElementById('orderReviewContent');
    const editOrderBtn = document.getElementById('editOrderBtn');
    const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');

    let activeRacketIndex = null;
    let activeGripRacketIndex = null;
    let pendingOrder = null;

    const validators = {
        name: { validate: (v) => v.trim().length >= 2, message: '请输入至少 2 个字的姓名' },
        contact: {
            validate: (v) => /^1[3-9]\d{9}$/.test(v.trim()),
            message: '请输入正确的11位手机号码',
        },
        confirmContact: {
            validate: (v) =>
                /^1[3-9]\d{9}$/.test(v.trim()) &&
                v.trim() === document.getElementById('contact').value.trim(),
            message: '两次输入的手机号码不一致，请重新确认',
        },
        racketCount: { validate: (v) => Number.isInteger(Number(v)) && Number(v) >= 1, message: '请选择穿线拍数' },
        dropoffDate: { validate: (v) => v !== '', message: '请选择送拍日期' },
        dropoffTime: { validate: (v) => v !== '', message: '请选择送拍时间' },
        pickupDate: { validate: (v) => v !== '', message: '请选择取拍日期' },
        pickupTime: { validate: (v) => v !== '', message: '请选择取拍时间' },
    };

    ['contact', 'confirmContact'].forEach((fieldName) => {
        document.getElementById(fieldName).addEventListener('input', (event) => {
            event.target.value = event.target.value.replace(/\D/g, '').slice(0, 11);
        });
    });

    Object.keys(validators).forEach((fieldName) => {
        const el = document.getElementById(fieldName);
        el.addEventListener('blur', () => validateField(fieldName));
        el.addEventListener('change', () => validateField(fieldName));
        el.addEventListener('input', () => {
            const errEl = document.querySelector(`.error-msg[data-for="${fieldName}"]`);
            if (errEl && errEl.textContent) validateField(fieldName);
        });
    });

    document.getElementById('contact').addEventListener('input', () => {
        const confirmContact = document.getElementById('confirmContact');
        if (confirmContact.value) validateField('confirmContact');
    });

    ['dropoffDate', 'dropoffTime', 'pickupDate', 'pickupTime'].forEach((fn) => {
        document.getElementById(fn).addEventListener('change', () => {
            if (fn === 'dropoffDate') updateDropoffTimeOptions();
            if (fn !== 'pickupTime') updatePickupTimeOptions();
            const allSel = ['dropoffDate', 'dropoffTime', 'pickupDate', 'pickupTime']
                .every((n) => document.getElementById(n).value);
            if (!allSel) return;
            const pt = document.getElementById('pickupTime');
            document.querySelector('.error-msg[data-for="pickupTime"]').textContent = '';
            pt.classList.remove('error');
            validatePickupInterval();
        });
    });

    racketCount.addEventListener('change', () => {
        validateField('racketCount');
        renderRacketCards(Number(racketCount.value));
    });

    racketDetailsContainer.addEventListener('change', (event) => {
        const sourceRadio = event.target.closest('input[data-role="string-source"]');
        const gripRadio = event.target.closest('input[data-role="grip-needed"]');

        if (gripRadio) {
            const card = gripRadio.closest('.racket-card');
            clearCardError(card, 'gripNeeded');
            card.querySelectorAll('input[data-role="grip-needed"]').forEach(r => r.classList.remove('error'));
            if (gripRadio.value === 'yes') {
                openGripModal(Number(card.dataset.index));
            } else {
                delete card.dataset.providedGrip;
                card.querySelector('[data-role="grip-summary"]').textContent = '已选择：不需要手胶。';
            }
            return;
        }

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
        if (!selected) { stringModalError.textContent = '请选择一种球线。'; return; }
        const card = getRacketCard(activeRacketIndex);
        if (!card) return;
        const option = STRING_OPTIONS[selected.value];
        card.dataset.providedString = selected.value;
        const modelInput = card.querySelector('[data-field="stringModel"]');
        const colorSelect = card.querySelector('[data-field="stringColor"]');
        modelInput.value = option.name;
        modelInput.readOnly = true;
        colorSelect.querySelectorAll('[data-provider-only]').forEach(item => item.remove());
        const providerColorOption = document.createElement('option');
        providerColorOption.value = option.color;
        providerColorOption.textContent = option.color;
        providerColorOption.dataset.providerOnly = 'true';
        colorSelect.appendChild(providerColorOption);
        colorSelect.value = option.color;
        colorSelect.disabled = true;
        card.querySelector('[data-role="string-model-hint"]').textContent =
            `已选择 ${option.name}，¥${option.price} / 条。`;
        card.querySelector('[data-role="string-color-hint"]').textContent =
            selected.value === 'vbs66n'
                ? '胜利 VBS66N 仅提供白色，推荐拉 26 磅及以上，体验更佳哦！'
                : selected.value === 'bg65'
                    ? 'YONEX BG65 仅提供黄色。'
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
            card.querySelector('input[data-role="string-source"][value="provided"]').checked = false;
        }
        stringModalError.textContent = '';
        closeModal(stringModal);
        activeRacketIndex = null;
    });

    confirmGripChoice.addEventListener('click', () => {
        const selected = document.querySelector('input[name="providedGrip"]:checked');
        if (!selected) {
            gripModalError.textContent = '请选择一种手胶。';
            return;
        }
        const card = getRacketCard(activeGripRacketIndex);
        if (!card) return;
        const option = GRIP_OPTIONS[selected.value];
        card.dataset.providedGrip = selected.value;
        card.querySelector('[data-role="grip-summary"]').textContent =
            `已选择：${option.name}，¥${formatMoney(option.price)} / 条。`;
        clearCardError(card, 'gripNeeded');
        gripModalError.textContent = '';
        closeModal(gripModal);
        activeGripRacketIndex = null;
    });

    cancelGripChoice.addEventListener('click', () => {
        const card = getRacketCard(activeGripRacketIndex);
        if (card && !card.dataset.providedGrip) {
            const yesRadio = card.querySelector('input[data-role="grip-needed"][value="yes"]');
            if (yesRadio) yesRadio.checked = false;
        }
        gripModalError.textContent = '';
        closeModal(gripModal);
        activeGripRacketIndex = null;
    });

    editOrderBtn.addEventListener('click', () => { closeModal(orderReviewModal); pendingOrder = null; });
    confirmSubmitBtn.addEventListener('click', submitConfirmedOrder);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        clearAllErrors();
        let isValid = true;
        Object.keys(validators).forEach((fn) => { if (!validateField(fn)) isValid = false; });
        if (!validateRacketCards()) isValid = false;
        if (!validateDropoffFuture()) isValid = false;
        if (!validatePickupInterval()) isValid = false;
        if (!isValid) {
            const firstError = form.querySelector('.error');
            if (firstError) { firstError.scrollIntoView({ behavior: 'smooth', block: 'center' }); firstError.focus(); }
            return;
        }
        pendingOrder = buildOrderData();
        renderOrderReview(pendingOrder);
        openModal(orderReviewModal);
    });

    function renderRacketCards(count) {
        if (!count) { racketDetailsContainer.innerHTML = '<div class="racket-placeholder">请先选择穿线拍数</div>'; return; }
        racketDetailsContainer.innerHTML = Array.from({ length: count }, (_, i) => racketCardTemplate(i)).join('');
    }

    function racketCardTemplate(index) {
        const num = index + 1;
        const colorOpts = COLOR_OPTIONS.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        return `<section class="racket-card" data-index="${index}">
            <h3>🏸 第 ${num} 支球拍</h3>
            <div class="form-group"><label>球拍品牌/型号 <span class="required">*</span></label><input type="text" data-field="racketModel" placeholder="如：YONEX 天斧100ZZ、李宁 风刃900" required><span class="racket-error" data-error-for="racketModel"></span></div>
            <div class="form-group"><label>球线来源 <span class="required">*</span></label><div class="radio-group"><label class="radio-label"><input type="radio" name="stringSource_${index}" value="self" data-role="string-source" required>自带球线</label><label class="radio-label"><input type="radio" name="stringSource_${index}" value="provided" data-role="string-source" required>需要提供球线</label></div><span class="racket-error" data-error-for="stringSource"></span></div>
            <div class="form-row"><div class="form-group"><label>球线品牌/型号 <span class="required">*</span></label><input type="text" data-field="stringModel" placeholder="请先选择球线来源" required><span class="racket-error" data-error-for="stringModel"></span><small class="hint" data-role="string-model-hint">自带线请填写型号；需要提供请在弹窗选择。</small></div><div class="form-group"><label>球线颜色 <span class="required">*</span></label><select data-field="stringColor" required><option value="">请选择颜色</option>${colorOpts}</select><span class="racket-error" data-error-for="stringColor"></span><small class="hint" data-role="string-color-hint">自带球线必须选择颜色。</small></div></div>
            <div class="form-group"><label>是否需要更换护线管 <span class="required">*</span></label><div class="radio-group grommet-options"><label class="radio-label"><input type="radio" name="grommet_${index}" value="none" data-field="grommet" required>不需要</label><label class="radio-label"><input type="radio" name="grommet_${index}" value="partial" data-field="grommet" required>局部 +¥3</label><label class="radio-label"><input type="radio" name="grommet_${index}" value="half" data-field="grommet" required>一半 +¥7</label><label class="radio-label"><input type="radio" name="grommet_${index}" value="full" data-field="grommet" required>全套 +¥12</label></div><span class="racket-error" data-error-for="grommet"></span><div class="grommet-tip">💡 <strong>温馨小贴士：</strong>建议您勤换护线管（全新的单线孔护线管一般可以使用3-4次，双线孔护线管一般可以使用2-3次），勤换护线管可以有效防止您的爱拍塌陷，从而有效地防止您的拍子意外断裂。</div></div>
            <div class="form-group grip-form-group"><label>是否需要更换手胶 <span class="required">*</span></label><div class="radio-group"><label class="radio-label"><input type="radio" name="gripNeeded_${index}" value="no" data-role="grip-needed" required>不需要</label><label class="radio-label"><input type="radio" name="gripNeeded_${index}" value="yes" data-role="grip-needed" required>需要购买手胶</label></div><span class="racket-error" data-error-for="gripNeeded"></span><small class="grip-summary" data-role="grip-summary">请选择是否需要手胶。</small></div>
            <div class="form-group"><label>穿线磅数 (lbs) <span class="required">*</span></label><div class="tension-dual-row"><div class="tension-item"><span class="tension-label">横线</span><input type="number" data-field="tensionHorizontal" placeholder="如：25" min="16" max="35" step="0.5" required><span class="tension-suffix">lbs</span></div><span class="tension-sep">×</span><div class="tension-item"><span class="tension-label">竖线</span><input type="number" data-field="tensionVertical" placeholder="如：24" min="16" max="35" step="0.5" required><span class="tension-suffix">lbs</span></div></div><span class="racket-error" data-error-for="tension"></span><small class="hint">建议范围 20-30 磅，横线通常比竖线高 1-2 磅。</small></div>
        </section>`;
    }

    function resetCardForOwnString(card) {
        delete card.dataset.providedString;
        const mi = card.querySelector('[data-field="stringModel"]');
        const cs = card.querySelector('[data-field="stringColor"]');
        mi.readOnly = false; mi.value = ''; mi.placeholder = '如：YONEX BG80、胜利 VBS63';
        cs.querySelectorAll('[data-provider-only]').forEach(item => item.remove());
        cs.disabled = false; cs.value = '';
        card.querySelector('[data-role="string-model-hint"]').textContent = '自带球线必须填写品牌与型号。';
        card.querySelector('[data-role="string-color-hint"]').textContent = '自带球线必须选择颜色。';
    }

    function openStringModal(index) {
        activeRacketIndex = index;
        const card = getRacketCard(index);
        const sv = card.dataset.providedString || '';
        document.querySelectorAll('input[name="providedString"]').forEach(r => { r.checked = r.value === sv; });
        stringModalError.textContent = '';
        openModal(stringModal);
    }

    function openGripModal(index) {
        activeGripRacketIndex = index;
        const card = getRacketCard(index);
        const savedValue = card.dataset.providedGrip || '';
        document.querySelectorAll('input[name="providedGrip"]').forEach(r => {
            r.checked = r.value === savedValue;
        });
        gripModalError.textContent = '';
        openModal(gripModal);
    }

    function validateRacketCards() {
        const cards = [...racketDetailsContainer.querySelectorAll('.racket-card')];
        if (!cards.length) return false;
        let allValid = true;
        cards.forEach(card => {
            ['racketModel', 'stringModel', 'stringColor'].forEach(field => {
                const inp = card.querySelector(`[data-field="${field}"]`);
                if (inp.value.trim() === '') {
                    allValid = false;
                    const msgs = { racketModel: '请填写这支球拍的品牌与型号', stringModel: '请填写或选择球线型号', stringColor: '请选择或确认球线颜色' };
                    setCardError(card, field, msgs[field]); inp.classList.add('error');
                }
            });
            const src = card.querySelector('input[data-role="string-source"]:checked');
            if (!src) {
                allValid = false; setCardError(card, 'stringSource', '请选择这支球拍的球线来源');
                card.querySelectorAll('input[data-role="string-source"]').forEach(r => r.classList.add('error'));
            } else if (src.value === 'provided' && !card.dataset.providedString) {
                allValid = false; setCardError(card, 'stringSource', '请在弹窗中选择需要提供的球线');
            }
            const grom = card.querySelector('input[data-field="grommet"]:checked');
            if (!grom) {
                allValid = false; setCardError(card, 'grommet', '请选择这支球拍是否更换护线管');
                card.querySelectorAll('input[data-field="grommet"]').forEach(r => r.classList.add('error'));
            }
            const gripNeeded = card.querySelector('input[data-role="grip-needed"]:checked');
            if (!gripNeeded) {
                allValid = false;
                setCardError(card, 'gripNeeded', '请选择这支球拍是否需要更换手胶');
                card.querySelectorAll('input[data-role="grip-needed"]').forEach(r => r.classList.add('error'));
            } else if (gripNeeded.value === 'yes' && !card.dataset.providedGrip) {
                allValid = false;
                setCardError(card, 'gripNeeded', '请在弹窗中选择需要购买的手胶');
                card.querySelectorAll('input[data-role="grip-needed"]').forEach(r => r.classList.add('error'));
            }
            const hz = card.querySelector('[data-field="tensionHorizontal"]');
            const vt = card.querySelector('[data-field="tensionVertical"]');
            const hv = Number(hz.value), vv = Number(vt.value);
            if (!hz.value || !vt.value || hv < 16 || hv > 35 || vv < 16 || vv > 35) {
                allValid = false; setCardError(card, 'tension', '横线和竖线磅数均须填写 16-35 之间的数值');
                if (!hz.value || hv < 16 || hv > 35) hz.classList.add('error');
                if (!vt.value || vv < 16 || vv > 35) vt.classList.add('error');
            }
        });
        return allValid;
    }

    function buildOrderData() {
        const rackets = [...racketDetailsContainer.querySelectorAll('.racket-card')].map((card, i) => {
            const src = card.querySelector('input[data-role="string-source"]:checked');
            const gv = card.querySelector('input[data-field="grommet"]:checked').value;
            const grommet = GROMMET_OPTIONS[gv];
            const suppliedString = src.value === 'provided' ? STRING_OPTIONS[card.dataset.providedString] : null;
            const sp = suppliedString ? suppliedString.price : 0;
            const gripNeeded = card.querySelector('input[data-role="grip-needed"]:checked').value;
            const selectedGrip = gripNeeded === 'yes' ? GRIP_OPTIONS[card.dataset.providedGrip] : null;
            const gripPrice = selectedGrip ? selectedGrip.price : 0;
            return {
                number: i + 1,
                racketModel: card.querySelector('[data-field="racketModel"]').value.trim(),
                stringSource: src.value === 'self' ? '自带球线' : '需要提供球线',
                stringModel: card.querySelector('[data-field="stringModel"]').value.trim(),
                stringColor: card.querySelector('[data-field="stringColor"]').value,
                stringPrice: sp,
                grommetReplace: grommet.name,
                grommetPrice: grommet.price,
                gripNeeded: gripNeeded === 'yes' ? '需要' : '不需要',
                gripModel: selectedGrip ? selectedGrip.name : '无',
                gripPrice,
                tensionHorizontal: `${card.querySelector('[data-field="tensionHorizontal"]').value} lbs`,
                tensionVertical: `${card.querySelector('[data-field="tensionVertical"]').value} lbs`,
                laborPrice: LABOR_PRICE,
                subtotal: LABOR_PRICE + grommet.price + sp + gripPrice,
            };
        });
        const laborTotal = LABOR_PRICE * rackets.length;
        const grommetTotal = rackets.reduce((s, r) => s + r.grommetPrice, 0);
        const stringTotal = rackets.reduce((s, r) => s + r.stringPrice, 0);
        const gripTotal = rackets.reduce((s, r) => s + r.gripPrice, 0);
        return {
            orderNumber: generateOrderNumber(),
            name: document.getElementById('name').value.trim(),
            contact: document.getElementById('contact').value.trim(),
            racketCount: rackets.length, rackets,
            dropoffDate: document.getElementById('dropoffDate').value,
            dropoffTime: document.getElementById('dropoffTime').value || '未指定',
            pickupDate: document.getElementById('pickupDate').value,
            pickupTime: document.getElementById('pickupTime').value || '未指定',
            notes: document.getElementById('notes').value.trim() || '无',
            laborTotal, grommetTotal, stringTotal, gripTotal,
            totalAmount: laborTotal + grommetTotal + stringTotal + gripTotal,
            paymentMethod: '取拍时当面结清',
            orderTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        };
    }

    function renderOrderReview(order) {
        const racketSections = order.rackets.map(racket => `<div class="review-racket">
            <h4>第 ${racket.number} 支球拍 · 小计 ¥${formatMoney(racket.subtotal)}</h4>
            ${reviewRows([['球拍型号', racket.racketModel], ['球线来源', racket.stringSource], ['球线型号', racket.stringModel], ['球线颜色', racket.stringColor], ['穿线磅数', `横线 ${racket.tensionHorizontal} / 竖线 ${racket.tensionVertical}`], ['护线管', racket.grommetReplace], ['手胶', racket.gripNeeded === '需要' ? `${racket.gripModel}（¥${formatMoney(racket.gripPrice)}）` : '不需要'], ['本拍费用', `手工 ¥${formatMoney(racket.laborPrice)} + 护线管 ¥${formatMoney(racket.grommetPrice)} + 球线 ¥${formatMoney(racket.stringPrice)} + 手胶 ¥${formatMoney(racket.gripPrice)}`]])}
        </div>`).join('');
        orderReviewContent.innerHTML = `<div class="order-number">订单号：${escapeHtml(order.orderNumber)}</div>
            <div class="review-section">${reviewRows([['客户姓名', order.name], ['联系方式', order.contact], ['球拍数量', `${order.racketCount} 支`], ['送拍时间', `${order.dropoffDate} ${order.dropoffTime}`], ['取拍时间', `${order.pickupDate} ${order.pickupTime}`], ['备注', order.notes]])}</div>
            ${racketSections}
            <h4>费用汇总</h4>
            <div class="review-section fee-section">
                ${reviewRows([['穿线手工费', `¥${formatMoney(order.laborTotal)}`], ['护线管费用', `¥${formatMoney(order.grommetTotal)}`], ['球线费用', `¥${formatMoney(order.stringTotal)}`], ['手胶费用', `¥${formatMoney(order.gripTotal)}`]])}
                <div class="review-row total-row"><span>总金额</span><strong>¥${formatMoney(order.totalAmount)}</strong></div>
            </div>`;
    }

    function reviewRows(rows) {
        return rows.map(([l, v]) => `<div class="review-row"><span>${escapeHtml(l)}</span><strong>${escapeHtml(String(v))}</strong></div>`).join('');
    }

    async function submitConfirmedOrder() {
        if (!pendingOrder) return;
        updateDropoffTimeOptions(); updatePickupTimeOptions();
        if (!['dropoffDate','dropoffTime','pickupDate','pickupTime'].every(fn => validateField(fn)) || !validateDropoffFuture() || !validatePickupInterval()) {
            closeModal(orderReviewModal); pendingOrder = null;
            const fe = form.querySelector('.error');
            if (fe) { fe.scrollIntoView({ behavior: 'smooth', block: 'center' }); fe.focus(); }
            return;
        }
        confirmSubmitBtn.disabled = true; confirmSubmitBtn.textContent = '提交中...'; setLoading(true);
        const order = pendingOrder;
        const racketText = order.rackets.map(r => [
            `【第 ${r.number} 支球拍】`, `球拍型号：${r.racketModel}`, `球线来源：${r.stringSource}`,
            `球线型号：${r.stringModel}`, `球线颜色：${r.stringColor}`,
            `穿线磅数：横线 ${r.tensionHorizontal} / 竖线 ${r.tensionVertical}`,
            `护线管：${r.grommetReplace}`,
            `手胶：${r.gripNeeded === '需要' ? `${r.gripModel}（¥${formatMoney(r.gripPrice)}）` : '不需要'}`,
            `本拍费用：手工 ¥${formatMoney(r.laborPrice)} + 护线管 ¥${formatMoney(r.grommetPrice)} + 球线 ¥${formatMoney(r.stringPrice)} + 手胶 ¥${formatMoney(r.gripPrice)} = ¥${formatMoney(r.subtotal)}`,
        ].join('\n')).join('\n\n');
        const message = [
            '🏸 羽毛球穿线预约订单', `订单号码：${order.orderNumber}`, '',
            `下单时间：${order.orderTime}`, `客户姓名：${order.name}`, `联系方式：${order.contact}`,
            `球拍数量：${order.racketCount} 支`, '', racketText, '',
            `送拍时间：${order.dropoffDate} ${order.dropoffTime}`,
            `取拍时间：${order.pickupDate} ${order.pickupTime}`, `备注：${order.notes}`, '',
            '【费用汇总】', `穿线手工费：¥${formatMoney(order.laborTotal)}`, `护线管费用：¥${formatMoney(order.grommetTotal)}`,
            `球线费用：¥${formatMoney(order.stringTotal)}`, `手胶费用：¥${formatMoney(order.gripTotal)}`,
            `总金额：¥${formatMoney(order.totalAmount)}`,
            `付款方式：${order.paymentMethod}`,
        ].join('\n');
        try {
            const resp = await fetch('https://api.web3forms.com/submit', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_key: WEB3FORMS_ACCESS_KEY, subject: `🏸 穿线预约 ${order.orderNumber} - ${order.name}`, from_name: '羽毛球穿线预约系统', botcheck: '', message }),
            });
            const result = await resp.json();
            if (!result.success) throw new Error(result.message || '发送失败，请稍后再试。');
            closeModal(orderReviewModal); showSuccess(order.orderNumber); pendingOrder = null;
        } catch (error) {
            closeModal(orderReviewModal); showError(error.message || '网络连接失败，请检查网络后重试。');
        } finally {
            confirmSubmitBtn.disabled = false; confirmSubmitBtn.textContent = '确认提交预约'; setLoading(false);
        }
    }

    function validateField(fieldName) {
        const el = document.getElementById(fieldName);
        const errEl = document.querySelector(`.error-msg[data-for="${fieldName}"]`);
        const rule = validators[fieldName];
        const valid = rule.validate(el.value);
        el.classList.toggle('error', !valid);
        errEl.textContent = valid ? '' : rule.message;
        return valid;
    }

    function getSlotStart(date, timeRange) {
        if (!date || !timeRange) return null;
        const [y, m, d] = date.split('-').map(Number);
        const [h, min] = timeRange.split('-')[0].split(':').map(Number);
        const ts = Date.UTC(y, m - 1, d, h, min);
        return Number.isNaN(ts) ? null : ts;
    }

    function getShanghaiNow() {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
        const vals = Object.fromEntries(parts.map(p => [p.type, p.value]));
        return { date: `${vals.year}-${vals.month}-${vals.day}`, timestamp: Date.UTC(Number(vals.year), Number(vals.month) - 1, Number(vals.day), Number(vals.hour), Number(vals.minute)) };
    }

    function updateDropoffTimeOptions() {
        const dde = document.getElementById('dropoffDate');
        const dte = document.getElementById('dropoffTime');
        const ph = dte.options[0];
        const now = getShanghaiNow();
        dde.min = now.date;
        if (dde.value && dde.value < now.date) dde.value = '';
        if (!dde.value) {
            dte.value = ''; dte.disabled = true; ph.textContent = '请选择';
            Array.from(dte.options).slice(1).forEach(o => { o.disabled = true; o.hidden = true; });
            return;
        }
        let avail = 0;
        Array.from(dte.options).slice(1).forEach(o => {
            const ss = getSlotStart(dde.value, o.value);
            const av = ss !== null && ss >= now.timestamp;
            o.disabled = !av; o.hidden = !av; if (av) avail++;
        });
        const sel = dte.selectedOptions[0];
        if (sel && sel.value && sel.disabled) dte.value = '';
        dte.disabled = avail === 0;
        ph.textContent = avail ? '请选择' : '无可选时间';
    }

    function updatePickupTimeOptions() {
        const dde = document.getElementById('dropoffDate');
        const dte = document.getElementById('dropoffTime');
        const pde = document.getElementById('pickupDate');
        const pte = document.getElementById('pickupTime');
        const ph = pte.options[0];
        if (dde.value) {
            pde.min = dde.value;
            if (pde.value && pde.value < dde.value) pde.value = '';
        }
        const dss = getSlotStart(dde.value, dte.value);
        if (!dss || !pde.value) {
            pte.value = ''; pte.disabled = true; ph.textContent = '请选择';
            Array.from(pte.options).slice(1).forEach(o => { o.disabled = true; o.hidden = true; });
            return;
        }
        const minPk = dss + 2 * 60 * 60 * 1000;
        let avail = 0;
        Array.from(pte.options).slice(1).forEach(o => {
            const ps = getSlotStart(pde.value, o.value);
            const av = ps !== null && ps >= minPk;
            o.disabled = !av; o.hidden = !av; if (av) avail++;
        });
        const sel = pte.selectedOptions[0];
        if (sel && sel.value && sel.disabled) pte.value = '';
        pte.disabled = avail === 0;
        ph.textContent = avail ? '请选择' : '无可选时间';
    }

    function validatePickupInterval() {
        const dd = document.getElementById('dropoffDate'), dt = document.getElementById('dropoffTime');
        const pd = document.getElementById('pickupDate'), pt = document.getElementById('pickupTime');
        const ds = getSlotStart(dd.value, dt.value);
        const ps = getSlotStart(pd.value, pt.value);
        if (!ds || !ps) return true;
        if (ps - ds >= 2 * 60 * 60 * 1000) return true;
        const err = document.querySelector('.error-msg[data-for="pickupTime"]');
        err.textContent = '取拍时间必须比送拍时间至少晚 2 小时';
        pt.classList.add('error');
        return false;
    }

    function validateDropoffFuture() {
        const dd = document.getElementById('dropoffDate'), dt = document.getElementById('dropoffTime');
        const ds = getSlotStart(dd.value, dt.value);
        if (!ds || ds >= getShanghaiNow().timestamp) return true;
        const err = document.querySelector('.error-msg[data-for="dropoffTime"]');
        err.textContent = '该送拍时间已经开始或已过去，请重新选择';
        dt.classList.add('error');
        return false;
    }

    function setCardError(card, field, msg) {
        const err = card.querySelector(`[data-error-for="${field}"]`);
        if (err) err.textContent = msg;
    }

    function clearCardError(card, field) {
        setCardError(card, field, '');
        if (field === 'grommet') card.querySelectorAll('input[data-field="grommet"]').forEach(r => r.classList.remove('error'));
    }

    function clearAllErrors() {
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.error-msg, .racket-error').forEach(el => el.textContent = '');
    }

    function getRacketCard(index) {
        if (index === null || index === undefined) return null;
        return racketDetailsContainer.querySelector(`.racket-card[data-index="${index}"]`);
    }

    function generateOrderNumber() {
        const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        const vals = Object.fromEntries(parts.map(p => [p.type, p.value]));
        return `${vals.year}${vals.month}${vals.day}${Math.floor(1000 + Math.random() * 9000)}`;
    }

    function setLoading(loading) {
        submitBtn.disabled = loading;
        btnText.style.display = loading ? 'none' : 'inline';
        btnLoading.style.display = loading ? 'inline' : 'none';
    }

    function showSuccess(orderNumber) {
        form.style.display = 'none';
        successOrderNumber.textContent = `订单号：${orderNumber}`;
        successMsg.style.display = 'block'; errorMsg.style.display = 'none';
        successMsg.scrollIntoView({ behavior: 'smooth' });
    }

    function showError(message) {
        form.style.display = 'none';
        errorText.textContent = message;
        errorMsg.style.display = 'block'; successMsg.style.display = 'none';
        errorMsg.scrollIntoView({ behavior: 'smooth' });
    }

    function openModal(modal) {
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
    }

    function closeModal(modal) {
        modal.style.display = 'none';
        if (
            stringModal.style.display === 'none' &&
            gripModal.style.display === 'none' &&
            orderReviewModal.style.display === 'none'
        ) {
            document.body.classList.remove('modal-open');
        }
    }

    function formatMoney(value) {
        return Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    }

    function escapeHtml(value) {
        return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
    }

    window.hideError = function () {
        form.style.display = 'block';
        errorMsg.style.display = 'none'; successMsg.style.display = 'none';
        setLoading(false);
    };

    // ============================================
    // 羽毛球粒子背景系统（全平台）
    // ============================================
    (function initBgShuttlecocks() {
        const container = document.getElementById('bgShuttlecocks');
        if (!container) return;

        const icons = ['🏸', '🏸', '🏸', '🏸', '🏸', '🪶', '🪶', '🎯', '🏸', '🏸'];
        var count = ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 15 : 12;

        for (var i = 0; i < count; i++) {
            var el = document.createElement('span');
            el.className = 'bg-shuttlecock';
            el.textContent = icons[i % icons.length];
            el.style.setProperty('--size', (18 + Math.random() * 40) + 'px');
            el.style.setProperty('--duration', (12 + Math.random() * 16) + 's');
            el.style.setProperty('--delay', (Math.random() * -15) + 's');
            el.style.setProperty('--drift', ((Math.random() - 0.5) * 200) + 'px');
            el.style.setProperty('--spin', (180 + Math.random() * 540) + 'deg');
            el.style.left = (5 + Math.random() * 90) + '%';
            container.appendChild(el);
        }
    })();

    // ============================================
    // 全局点击特效系统（仅桌面端）
    // ============================================
    (function initClickEffects() {
        // 触屏设备跳过点击特效，只保留背景粒子
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

        var rippleColors = ['#1a936f', '#2563eb', '#f4a261', '#a855f7', '#f59e0b'];
        var featherIcons = ['🏸', '🪶', '🏸'];
        var starChars = ['✦', '✧', '✨', '💫', '⭐'];

        function addRipple(x, y) {
            var r = document.createElement('div');
            r.className = 'click-ripple';
            var c = rippleColors[Math.floor(Math.random() * rippleColors.length)];
            r.style.left = x + 'px';
            r.style.top = y + 'px';
            r.style.background = 'radial-gradient(circle, ' + c + '66, ' + c + '11, transparent 70%)';
            document.body.appendChild(r);
            setTimeout(function() { if (r.parentNode) r.remove(); }, 1500);
        }

        function addFeathers(x, y) {
            var count = 3;
            for (var i = 0; i < count; i++) {
                var f = document.createElement('span');
                f.className = 'click-feather';
                f.textContent = featherIcons[i % featherIcons.length];
                var angle = (Math.PI * 2 / count) * i;
                var dist = 50 + Math.random() * 70;
                f.style.left = x + 'px';
                f.style.top = y + 'px';
                f.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
                f.style.setProperty('--dy', (Math.sin(angle) * dist - 30) + 'px');
                f.style.setProperty('--rot', (Math.random() * 360) + 'deg');
                f.style.fontSize = (20 + Math.random() * 16) + 'px';
                f.style.animationDuration = (0.7 + Math.random() * 0.5) + 's';
                document.body.appendChild(f);
                f.addEventListener('animationend', function() { f.remove(); });
            }
        }

        function addStars(x, y) {
            var count = 5;
            var colors = ['#f4a261', '#ffd700', '#60a5fa', '#a78bfa', '#f472b6'];
            for (var i = 0; i < count; i++) {
                var s = document.createElement('span');
                s.className = 'click-star';
                s.textContent = starChars[i % starChars.length];
                var angle = (Math.PI * 2 / count) * i;
                var dist = 30 + Math.random() * 60;
                s.style.left = x + 'px';
                s.style.top = y + 'px';
                s.style.setProperty('--sx', (Math.cos(angle) * dist) + 'px');
                s.style.setProperty('--sy', (Math.sin(angle) * dist) + 'px');
                s.style.fontSize = (12 + Math.random() * 14) + 'px';
                s.style.color = colors[i % colors.length];
                document.body.appendChild(s);
                s.addEventListener('animationend', function() { s.remove(); });
            }
        }

        var lastFire = 0;
        document.addEventListener('click', function(e) {
            var now = Date.now();
            if (now - lastFire < 150) return;
            lastFire = now;
            addRipple(e.clientX, e.clientY);
            addFeathers(e.clientX, e.clientY);
            addStars(e.clientX, e.clientY);
        });
    })();

    // ============================================
    // 鼠标跟随羽毛（仅桌面端）
    // ============================================
    (function initMouseFeather() {
        // 触屏/无鼠标：直接跳过
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

        var feather = document.createElement('span');
        feather.className = 'mouse-feather';
        feather.textContent = '🏸';
        feather.style.opacity = '0';
        document.body.appendChild(feather);

        var mx = 0, my = 0;
        var cx = 0, cy = 0;

        document.addEventListener('mousemove', function(e) {
            mx = e.clientX;
            my = e.clientY;
            feather.style.opacity = '0.55';
        });

        document.addEventListener('mouseleave', function() {
            feather.style.opacity = '0';
        });

        function tick() {
            cx += (mx - cx) * 0.08;
            cy += (my - cy) * 0.08;
            feather.style.left = (cx - 8) + 'px';
            feather.style.top = (cy - 8) + 'px';
            requestAnimationFrame(tick);
        }
        tick();
    })();

    // ============================================
    // 按钮悬浮羽毛球特效
    // ============================================
    (function initButtonShuttleEffect() {
        function addShuttleHoverEffect(el) {
            el.addEventListener('mouseenter', (e) => {
                const rect = el.getBoundingClientRect();
                const shuttle = document.createElement('span');
                shuttle.className = 'click-feather';
                shuttle.textContent = '🏸';
                shuttle.style.cssText = `
                    position: fixed;
                    left: ${rect.right + 10}px;
                    top: ${rect.top + rect.height / 2}px;
                    pointer-events: none;
                    z-index: 9999;
                    font-size: 28px;
                    --dx: 60px;
                    --dy: -40px;
                    animation: featherFly 1.2s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
                `;
                document.body.appendChild(shuttle);
                shuttle.addEventListener('animationend', () => shuttle.remove());
            });
        }

        // 给所有按钮和链接添加效果
        document.querySelectorAll('.submit-btn, .primary-btn, .new-order-btn, .retry-btn, .choice-card, .radio-label').forEach(addShuttleHoverEffect);
    })();

    // ============================================
    // 初始化
    // ============================================
    const today = getShanghaiNow().date;
    document.getElementById('dropoffDate').setAttribute('min', today);
    document.getElementById('pickupDate').setAttribute('min', today);
    updateDropoffTimeOptions();
    updatePickupTimeOptions();
    window.setInterval(() => {
        updateDropoffTimeOptions();
        updatePickupTimeOptions();
    }, 60 * 1000);
})();
