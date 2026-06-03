// Question Bank Shared Utilities

window.QuestionBank = {
    OPTION_LABELS: ['ক', 'খ', 'গ', 'ঘ'],
    POINT_LABELS: ['i', 'ii', 'iii'],

    // Convert English numbers to Bengali numbers
    toBengaliNumber: function(num) {
        const engToBn = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
        return String(num).replace(/[0-9]/g, x => engToBn[x]);
    },

    // Timer utility
    createTimer: function(seconds, onTick, onComplete) {
        let remaining = seconds;
        onTick(remaining);
        
        const interval = setInterval(() => {
            remaining--;
            if (remaining >= 0) {
                onTick(remaining);
            }
            if (remaining <= 0) {
                clearInterval(interval);
                if (onComplete) onComplete();
            }
        }, 1000);
        
        return {
            stop: () => clearInterval(interval)
        };
    },

    // Format Type 1: Simple MCQ
    formatMcqType1: function(q, index) {
        const bnIndex = this.toBengaliNumber(index);
        let html = `<div class="mcq-q-text">${bnIndex}। ${q.question}</div>`;
        if (q.question_image) {
            html += `<div class="mcq-q-img"><img src="/uploads/qbank-images/${q.question_image}" alt="Question Image" /></div>`;
        }
        
        html += `<div class="mcq-options-grid">`;
        ['option_a', 'option_b', 'option_c', 'option_d'].forEach((optKey, i) => {
            if (q[optKey]) {
                html += `<div class="mcq-option" data-opt="${String.fromCharCode(65+i)}">
                    <span class="opt-label">${this.OPTION_LABELS[i]})</span> ${q[optKey]}
                </div>`;
            }
        });
        html += `</div>`;
        return html;
    },

    // Format Type 2: Point-based MCQ
    formatMcqType2: function(q, index) {
        const bnIndex = this.toBengaliNumber(index);
        let html = `<div class="mcq-q-text">${bnIndex}। ${q.question}</div>`;
        if (q.question_image) {
            html += `<div class="mcq-q-img"><img src="/uploads/qbank-images/${q.question_image}" alt="Question Image" /></div>`;
        }
        
        html += `<div class="mcq-points">`;
        ['option_a', 'option_b', 'option_c'].forEach((optKey, i) => {
            if (q[optKey]) {
                html += `<div class="mcq-point">${this.POINT_LABELS[i]}) ${q[optKey]}</div>`;
            }
        });
        html += `</div>`;
        
        html += `<div class="mcq-subtext">নিচের কোনটি সঠিক?</div>`;
        html += `<div class="mcq-options-grid">`;
        ['combo_option_1', 'combo_option_2', 'combo_option_3', 'combo_option_4'].forEach((optKey, i) => {
            if (q[optKey]) {
                html += `<div class="mcq-option" data-opt="${i+1}">
                    <span class="opt-label">${this.OPTION_LABELS[i]})</span> ${q[optKey]}
                </div>`;
            }
        });
        html += `</div>`;
        return html;
    },

    // Format Type 3: Passage + Simple MCQ
    formatMcqType3: function(q, index) {
        const bnIndex = this.toBengaliNumber(index);
        let html = `<div class="mcq-passage-container">`;
        html += `<div class="mcq-passage-hint">নিচের উদ্দীপকটি পড়ো এবং ${bnIndex} নং প্রশ্নের উত্তর দাও</div>`;
        html += `<div class="mcq-passage">${q.passage}</div>`;
        if (q.passage_image) {
            html += `<div class="mcq-passage-img"><img src="/uploads/qbank-images/${q.passage_image}" alt="Passage Image" /></div>`;
        }
        html += `</div>`;
        html += this.formatMcqType1(q, index);
        return html;
    },

    // Format Type 4: Passage + Compound (2 questions)
    formatMcqType4: function(q, index) {
        const bnIndex1 = this.toBengaliNumber(index);
        const bnIndex2 = this.toBengaliNumber(index + 1);
        let html = `<div class="mcq-passage-container">`;
        html += `<div class="mcq-passage-hint">নিচের উদ্দীপকটি পড়ো এবং ${bnIndex1} ও ${bnIndex2} নং প্রশ্নের উত্তর দাও</div>`;
        html += `<div class="mcq-passage">${q.passage}</div>`;
        if (q.passage_image) {
            html += `<div class="mcq-passage-img"><img src="/uploads/qbank-images/${q.passage_image}" alt="Passage Image" /></div>`;
        }
        html += `</div>`;
        
        // Render Question 1
        html += `<div class="mcq-sub-question" data-sub="1">`;
        html += this.formatMcqType1(q, index);
        html += `</div>`;
        
        // Render Question 2
        html += `<div class="mcq-sub-question" data-sub="2">`;
        
        let q2Html = `<div class="mcq-q-text">${bnIndex2}। ${q.question2}</div>`;
        if (q.question2_image) {
            q2Html += `<div class="mcq-q-img"><img src="/uploads/qbank-images/${q.question2_image}" alt="Question Image" /></div>`;
        }
        
        if (q.q2_type === 'point') {
            q2Html += `<div class="mcq-points">`;
            ['q2_option_a', 'q2_option_b', 'q2_option_c'].forEach((optKey, i) => {
                if (q[optKey]) {
                    q2Html += `<div class="mcq-point">${this.POINT_LABELS[i]}) ${q[optKey]}</div>`;
                }
            });
            q2Html += `</div>`;
            
            q2Html += `<div class="mcq-subtext">নিচের কোনটি সঠিক?</div>`;
            q2Html += `<div class="mcq-options-grid">`;
            ['q2_combo_option_1', 'q2_combo_option_2', 'q2_combo_option_3', 'q2_combo_option_4'].forEach((optKey, i) => {
                if (q[optKey]) {
                    q2Html += `<div class="mcq-option" data-opt="${i+1}">
                        <span class="opt-label">${this.OPTION_LABELS[i]})</span> ${q[optKey]}
                    </div>`;
                }
            });
            q2Html += `</div>`;
        } else {
            q2Html += `<div class="mcq-options-grid">`;
            ['q2_option_a', 'q2_option_b', 'q2_option_c', 'q2_option_d'].forEach((optKey, i) => {
                if (q[optKey]) {
                    q2Html += `<div class="mcq-option" data-opt="${String.fromCharCode(65+i)}">
                        <span class="opt-label">${this.OPTION_LABELS[i]})</span> ${q[optKey]}
                    </div>`;
                }
            });
            q2Html += `</div>`;
        }
        html += q2Html;
        html += `</div>`;
        
        return html;
    },

    // Auto-detect type and format
    formatMcq: function(q, index) {
        if (!q || !q.type) return "<div>Invalid Question</div>";
        const type = parseInt(q.type);
        if (type === 1) return this.formatMcqType1(q, index);
        if (type === 2) return this.formatMcqType2(q, index);
        if (type === 3) return this.formatMcqType3(q, index);
        if (type === 4) return this.formatMcqType4(q, index);
        return "<div>Unknown Question Type</div>";
    },

    // Format Creative Question
    formatCreative: function(q, index) {
        const bnIndex = this.toBengaliNumber(index);
        let html = `<div class="cq-container">`;
        html += `<div class="cq-passage">প্রশ্ন ${bnIndex}। ${q.passage}</div>`;
        if (q.passage_image) {
            html += `<div class="cq-passage-img"><img src="/uploads/qbank-images/${q.passage_image}" alt="Passage Image" /></div>`;
        }
        
        html += `<div class="cq-questions">`;
        if (q.knowledge) html += `<div class="cq-item"><span class="cq-label">ক)</span> ${q.knowledge}</div>`;
        if (q.understanding) html += `<div class="cq-item"><span class="cq-label">খ)</span> ${q.understanding}</div>`;
        if (q.application) html += `<div class="cq-item"><span class="cq-label">গ)</span> ${q.application}</div>`;
        if (q.higher_thinking) html += `<div class="cq-item"><span class="cq-label">ঘ)</span> ${q.higher_thinking}</div>`;
        html += `</div></div>`;
        
        return html;
    }
};
