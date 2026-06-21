// Question Bank Shared Utilities – v3

window.QuestionBank = {
    OPTION_LABELS: ['ক', 'খ', 'গ', 'ঘ'],
    POINT_LABELS: ['i', 'ii', 'iii'],

    /* ── Bengali number conversion ── */
    toBengaliNumber: function(num) {
        const map = { '0':'০','1':'১','2':'২','3':'৩','4':'৪','5':'৫','6':'৬','7':'৭','8':'৮','9':'৯' };
        return String(num).replace(/[0-9]/g, x => map[x]);
    },

    /* ── Timer utility ── */
    createTimer: function(seconds, onTick, onComplete) {
        let remaining = seconds;
        let isPaused  = false;
        onTick(remaining);
        const interval = setInterval(() => {
            if (isPaused) return;
            remaining--;
            if (remaining >= 0) onTick(remaining);
            if (remaining <= 0) { clearInterval(interval); if (onComplete) onComplete(); }
        }, 1000);
        return {
            stop:     () => clearInterval(interval),
            pause:    () => { isPaused = true; },
            resume:   () => { isPaused = false; },
            isPaused: () => isPaused
        };
    },

    /* ─────────────────────────────────────────
       Options builder helpers
    ───────────────────────────────────────── */
    _simpleOptions: function(q, keys, dataFn) {
        let html = `<div class="mcq-options-grid">`;
        keys.forEach((key, i) => {
            if (q[key]) {
                html += `<div class="mcq-option" data-opt="${dataFn(i)}">
                    <span class="opt-label">${this.OPTION_LABELS[i]}</span>${q[key]}
                </div>`;
            }
        });
        html += `</div>`;
        return html;
    },

    _pointBlock: function(optionKeys, values, comboKeys, comboValues) {
        let html = `<div class="mcq-points">`;
        optionKeys.forEach((key, i) => {
            if (values[key]) html += `<div class="mcq-point">${this.POINT_LABELS[i]}) ${values[key]}</div>`;
        });
        html += `</div><div class="mcq-subtext">নিচের কোনটি সঠিক?</div>`;
        html += `<div class="mcq-options-grid">`;
        comboKeys.forEach((key, i) => {
            if (values[key]) {
                html += `<div class="mcq-option" data-opt="${i+1}">
                    <span class="opt-label">${this.OPTION_LABELS[i]}</span>${values[key]}
                </div>`;
            }
        });
        html += `</div>`;
        return html;
    },

    /* ─────────────────────────────────────────
       TYPE 1 – Simple MCQ (vertically centred)
    ───────────────────────────────────────── */
    formatMcqType1: function(q, index) {
        const bnIndex = this.toBengaliNumber(index);
        let inner = `<div class="mcq-q-text">${bnIndex}। ${q.question}</div>`;
        if (q.question_image) inner += `<div class="mcq-q-img"><img src="/uploads/qbank-images/${q.question_image}" alt=""/></div>`;
        inner += this._simpleOptions(q,
            ['option_a','option_b','option_c','option_d'],
            i => String.fromCharCode(65+i)
        );
        return `<div class="mcq-simple-wrapper">${inner}</div>`;
    },

    /* ─────────────────────────────────────────
       TYPE 2 – Point/Combo MCQ (vertically centred)
    ───────────────────────────────────────── */
    formatMcqType2: function(q, index) {
        const bnIndex = this.toBengaliNumber(index);
        let inner = `<div class="mcq-q-text">${bnIndex}। ${q.question}</div>`;
        if (q.question_image) inner += `<div class="mcq-q-img"><img src="/uploads/qbank-images/${q.question_image}" alt=""/></div>`;
        inner += this._pointBlock(
            ['option_a','option_b','option_c'], q,
            ['combo_option_1','combo_option_2','combo_option_3','combo_option_4'], q
        );
        return `<div class="mcq-simple-wrapper">${inner}</div>`;
    },

    /* ─────────────────────────────────────────
       TYPE 3 – Passage (left) | Question (right)
    ───────────────────────────────────────── */
    formatMcqType3: function(q, index) {
        const bnIndex = this.toBengaliNumber(index);

        const passage = `<div class="mcq-passage-container">
            <div class="mcq-passage-hint">নিচের উদ্দীপকটি পড়ো এবং ${bnIndex} নং প্রশ্নের উত্তর দাও</div>
            ${q.passage ? `<div class="mcq-passage">${q.passage}</div>` : ''}
            ${q.passage_image ? `<div class="mcq-passage-img"><img src="/uploads/qbank-images/${q.passage_image}" alt=""/></div>` : ''}
        </div>`;

        let questionPanel = `<div class="mcq-question-panel">
            <div class="mcq-q-text">${bnIndex}। ${q.question}</div>
            ${q.question_image ? `<div class="mcq-q-img"><img src="/uploads/qbank-images/${q.question_image}" alt=""/></div>` : ''}
            ${this._simpleOptions(q, ['option_a','option_b','option_c','option_d'], i => String.fromCharCode(65+i))}
        </div>`;

        return `<div class="mcq-type3-layout">${passage}${questionPanel}</div>`;
    },

    /* ─────────────────────────────────────────
       TYPE 4 – Passage (left) | Q1 + Q2 (right, stacked)
       Q1 is always point/combo; Q2 may be simple or point
       Combo options appear BELOW i/ii/iii points
    ───────────────────────────────────────── */
    formatMcqType4: function(q, index) {
        const bnIndex1 = this.toBengaliNumber(index);
        const bnIndex2 = this.toBengaliNumber(index + 1);

        let hintText = '';
        if (q.question && q.question2) {
            hintText = `${bnIndex1} ও ${bnIndex2}`;
        } else if (q.question) {
            hintText = `${bnIndex1}`;
        } else if (q.question2) {
            hintText = `${bnIndex2}`;
        }

        /* Passage */
        const passage = `<div class="mcq-passage-container">
            <div class="mcq-passage-hint">নিচের উদ্দীপকটি পড়ো এবং ${hintText} নং প্রশ্নের উত্তর দাও</div>
            ${q.passage ? `<div class="mcq-passage">${q.passage}</div>` : ''}
            ${q.passage_image ? `<div class="mcq-passage-img"><img src="/uploads/qbank-images/${q.passage_image}" alt=""/></div>` : ''}
        </div>`;

        /* Q1 – always point/combo type */
        let q1 = '';
        if (q.question) {
            q1 = `<div class="mcq-sub-question" data-sub="1">
                <div class="mcq-q-text">${bnIndex1}। ${q.question}</div>
                ${q.question_image ? `<div class="mcq-q-img"><img src="/uploads/qbank-images/${q.question_image}" alt=""/></div>` : ''}
                ${this._pointBlock(
                    ['option_a','option_b','option_c'], q,
                    ['combo_option_1','combo_option_2','combo_option_3','combo_option_4'], q
                )}
            </div>`;
        }

        /* Q2 – may be simple or point */
        let q2 = '';
        if (q.question2) {
            let q2Inner = `<div class="mcq-q-text">${bnIndex2}। ${q.question2}</div>
                ${q.question2_image ? `<div class="mcq-q-img"><img src="/uploads/qbank-images/${q.question2_image}" alt=""/></div>` : ''}`;

            if (q.q2_type === 'point') {
                q2Inner += this._pointBlock(
                    ['q2_option_a','q2_option_b','q2_option_c'], q,
                    ['q2_combo_option_1','q2_combo_option_2','q2_combo_option_3','q2_combo_option_4'], q
                );
            } else {
                q2Inner += this._simpleOptions(q,
                    ['q2_option_a','q2_option_b','q2_option_c','q2_option_d'],
                    i => String.fromCharCode(65+i)
                );
            }

            q2 = `<div class="mcq-sub-question" data-sub="2">${q2Inner}</div>`;
        }

        return `<div class="mcq-type4-layout">${passage}<div class="mcq-type4-questions">${q1}${q2}</div></div>`;
    },

    /* ─────────────────────────────────────────
       Auto-detect type and format
    ───────────────────────────────────────── */
    formatMcq: function(q, index) {
        if (!q || !q.type) return '<div>Invalid Question</div>';
        const type = parseInt(q.type);
        if (type === 1) return this.formatMcqType1(q, index);
        if (type === 2) return this.formatMcqType2(q, index);
        if (type === 3) return this.formatMcqType3(q, index);
        if (type === 4) return this.formatMcqType4(q, index);
        return '<div>Unknown Question Type</div>';
    },

    /* ─────────────────────────────────────────
       Format Creative Question
    ───────────────────────────────────────── */
    formatCreative: function(q, index, showAnswer = false) {
        const bnIndex = this.toBengaliNumber(index);
        let html = `<div class="cq-container">
            <div class="cq-number-badge">${bnIndex}</div>
            <div class="cq-passage">${q.passage}</div>
            ${q.passage_image ? `<div class="cq-passage-img"><img src="/uploads/qbank-images/${q.passage_image}" alt=""/></div>` : ''}
            <div class="cq-questions">`;
        if (q.knowledge) {
            html += `<div class="cq-item"><span class="cq-label">ক)</span>${q.knowledge}</div>`;
            if (showAnswer && q.answer_k) html += `<div class="cq-answer"><span class="cq-ans-label">উত্তর:</span><br>${String(q.answer_k).replace(/\n/g, '<br>')}</div>`;
        }
        if (q.understanding) {
            html += `<div class="cq-item"><span class="cq-label">খ)</span>${q.understanding}</div>`;
            if (showAnswer && q.answer_u) html += `<div class="cq-answer"><span class="cq-ans-label">উত্তর:</span><br>${String(q.answer_u).replace(/\n/g, '<br>')}</div>`;
        }
        if (q.application) {
            html += `<div class="cq-item"><span class="cq-label">গ)</span>${q.application}</div>`;
            if (showAnswer && q.answer_a) html += `<div class="cq-answer"><span class="cq-ans-label">উত্তর:</span><br>${String(q.answer_a).replace(/\n/g, '<br>')}</div>`;
        }
        if (q.higher_thinking) {
            html += `<div class="cq-item"><span class="cq-label">ঘ)</span>${q.higher_thinking}</div>`;
            if (showAnswer && q.answer_h) html += `<div class="cq-answer"><span class="cq-ans-label">উত্তর:</span><br>${String(q.answer_h).replace(/\n/g, '<br>')}</div>`;
        }
        html += `</div></div>`;
        return html;
    }
};
