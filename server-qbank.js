const fs = require('fs');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const { imageSize: sizeOf } = require('image-size');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType, convertInchesToTwip, ImageRun } = require('docx');

module.exports = function(app, io, uploadsDir) {
    const qbankImagesDir = path.join(uploadsDir, 'qbank-images');
    if (!fs.existsSync(qbankImagesDir)) {
        fs.mkdirSync(qbankImagesDir, { recursive: true });
    }

    // Configure multer for question images
    const imageStorage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, qbankImagesDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `img_${Date.now()}_${Math.floor(Math.random()*1000)}${ext}`);
        }
    });
    const imageUpload = multer({ storage: imageStorage });

    // Configure multer for bulk excel uploads
    const excelStorage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            cb(null, `temp_${Date.now()}.xlsx`);
        }
    });
    const excelUpload = multer({ storage: excelStorage });

    // File paths
    const mcqFile = path.join(uploadsDir, 'mcq-questions.xlsx');
    const creativeFile = path.join(uploadsDir, 'creative-questions.xlsx');
    const studentFile = path.join(uploadsDir, 'student-bank.xlsx');
    const perfFile = path.join(uploadsDir, 'student-performance.json');

    // Utils
    function readExcel(filePath) {
        if (!fs.existsSync(filePath)) return [];
        try {
            const wb = XLSX.readFile(filePath);
            const ws = wb.Sheets[wb.SheetNames[0]];
            return XLSX.utils.sheet_to_json(ws);
        } catch (e) {
            console.error("Error reading excel:", e);
            return [];
        }
    }

    function writeExcel(filePath, data) {
        try {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
            XLSX.writeFile(wb, filePath);
            return true;
        } catch (e) {
            console.error("Error writing excel:", e);
            return false;
        }
    }

    function readJson(filePath) {
        if (!fs.existsSync(filePath)) return [];
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            return [];
        }
    }

    function writeJson(filePath, data) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (e) {
            return false;
        }
    }

    // Normalize any date value from xlsx (serial number, JS Date, or string) to YYYY-MM-DD
    function normalizeDate(val) {
        if (!val && val !== 0) return null;
        // Excel serial number (e.g. 46175)
        if (typeof val === 'number') {
            const d = new Date(Math.round((val - 25569) * 86400 * 1000));
            return d.toISOString().split('T')[0];
        }
        // JS Date object
        if (val instanceof Date) {
            return val.toISOString().split('T')[0];
        }
        const str = String(val).trim();
        // M/D/YYYY or MM/DD/YYYY or M/D/YY or MM/DD/YY
        const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (mdyMatch) {
            let [, m, d, y] = mdyMatch;
            if (y.length === 2) {
                y = '20' + y;
            }
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        // If it's already YYYY-MM-DD or close to it, try to ensure YYYY-MM-DD format
        const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (ymdMatch) {
            const [, y, m, d] = ymdMatch;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return str;
    }

    // Compute ranked leaderboard from performance data
    function computeLeaderboard(perfData) {
        return perfData.map(p => {
            const attCount = (p.attendance || []).filter(a => a.isPresent).length;
            const attScore = attCount * 5;
            let examScore = 0;
            if (p.mark) {
                Object.values(p.mark).forEach(v => { examScore += (parseFloat(v) || 0); });
            }
            return {
                name: p.name,
                roll: String(p.roll),
                id: p.id,
                session: p.session,
                class: p.class,
                section: p.section,
                group: p.group,
                attendanceScore: attScore,
                examScore: examScore,
                totalScore: attScore + examScore
            };
        }).sort((a, b) => b.totalScore - a.totalScore);
    }

    // Emit live leaderboard update to all connected clients
    function emitLeaderboardUpdate(perfData) {
        const leaderboard = computeLeaderboard(perfData);
        io.emit('leaderboard-live-update', { data: leaderboard });
    }

    // Initialize files if they don't exist
    if (!fs.existsSync(mcqFile)) writeExcel(mcqFile, []);
    if (!fs.existsSync(creativeFile)) writeExcel(creativeFile, []);
    if (!fs.existsSync(studentFile)) writeExcel(studentFile, []);
    if (!fs.existsSync(perfFile)) writeJson(perfFile, []);

    // Helper for Bengali numbers
    function toBengaliNumber(num) {
        const engToBn = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
        return String(num).replace(/[0-9]/g, x => engToBn[x]);
    }

    // ==== MCQ API ====
    app.get('/api/mcq', (req, res) => {
        let data = readExcel(mcqFile);
        const { paper, chapter, boardOnly, importantOnly, amount, topics } = req.query;
        
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        if (topics && topics !== 'All') data = data.filter(d => d.topics && String(d.topics).toLowerCase().includes(topics.toLowerCase()));
        
        data.sort(() => 0.5 - Math.random());
        
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) {
                data = data.slice(0, limit);
            }
        }
        res.json(data);
    });

    app.get('/api/mcq/chapters', (req, res) => {
        let data = readExcel(mcqFile);
        let chapters = new Set();
        data.forEach(d => { if (d.chapter) chapters.add(String(d.chapter)); });
        res.json(Array.from(chapters).sort());
    });

    app.get('/api/mcq/download-xlsx', (req, res) => {
        if (!fs.existsSync(mcqFile)) return res.status(404).json({ error: 'No file found' });
        res.download(mcqFile, 'mcq-questions.xlsx');
    });

    app.post('/api/mcq/upload-image', imageUpload.single('image'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No image uploaded" });
        res.json({ url: req.file.filename });
    });

    app.post('/api/mcq', (req, res) => {
        const data = readExcel(mcqFile);
        const newRecord = { ...req.body, id: `mcq_${Date.now()}` };
        data.push(newRecord);
        const success = writeExcel(mcqFile, data);
        if (success) res.json({ status: 'ok', record: newRecord });
        else res.status(500).json({ error: 'Failed to write to Excel. Ensure the file is not open in another program.' });
    });

    app.put('/api/mcq/:id', (req, res) => {
        let data = readExcel(mcqFile);
        const index = data.findIndex(r => r.id === req.params.id);
        if (index !== -1) {
            data[index] = { ...data[index], ...req.body, id: req.params.id };
            const success = writeExcel(mcqFile, data);
            if (success) res.json({ status: 'ok', record: data[index] });
            else res.status(500).json({ error: 'Failed to write to Excel. Ensure the file is not open in another program.' });
        } else {
            res.status(404).json({ error: 'Record not found' });
        }
    });

    app.get('/api/mcq/topics', (req, res) => {
        let data = readExcel(mcqFile);
        const { paper, chapter } = req.query;
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);

        let topics = new Set();
        data.forEach(d => {
            if (d.topics) {
                String(d.topics).split(',').forEach(t => {
                    const trimmed = t.trim();
                    if (trimmed) topics.add(trimmed);
                });
            }
        });
        res.json(Array.from(topics).sort());
    });

    app.delete('/api/mcq/:id', (req, res) => {
        let data = readExcel(mcqFile);
        const record = data.find(r => r.id === req.params.id);
        if (record) {
            // Delete associated images
            ['question_image', 'passage_image', 'question2_image'].forEach(field => {
                if (record[field]) {
                    const imgPath = path.join(qbankImagesDir, record[field]);
                    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
                }
            });
        }
        data = data.filter(r => r.id !== req.params.id);
        const success = writeExcel(mcqFile, data);
        if (success) res.json({ status: 'ok' });
        else res.status(500).json({ error: 'Failed to write to Excel.' });
    });

    app.post('/api/mcq/bulk-upload', excelUpload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        let newRows = readExcel(req.file.path);
        // Ensure each row has a unique id
        newRows = newRows.map(r => ({ ...r, id: r.id || `mcq_${Date.now()}_${Math.floor(Math.random()*10000)}` }));
        // REPLACE existing xlsx entirely
        const success = writeExcel(mcqFile, newRows);
        fs.unlinkSync(req.file.path);
        if (success) res.json({ status: 'ok', count: newRows.length });
        else res.status(500).json({ error: 'Failed to write to Excel.' });
    });

    app.post('/api/mcq/export-to-game', (req, res) => {
        const { paper, chapter, boardOnly, importantOnly, amount, topics, game } = req.body;
        
        if (!game || (game !== 'monopoly' && game !== 'maze')) {
            return res.status(400).json({ error: 'Valid game (monopoly or maze) is required.' });
        }

        let data = readExcel(mcqFile);
        
        // Ensure ONLY Type 1 MCQ is included
        data = data.filter(d => String(d.type) === '1');
        
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === true || boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === true || importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        if (topics && topics !== 'All') data = data.filter(d => d.topics && String(d.topics).toLowerCase().includes(String(topics).toLowerCase()));
        
        data.sort(() => 0.5 - Math.random());
        
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) {
                data = data.slice(0, limit);
            }
        }
        
        if (data.length === 0) {
            return res.status(404).json({ error: 'No Type 1 MCQs matched the filter criteria.' });
        }

        // Map to game format: ["Question", "Option A", "Option B", "Option C", "Option D", "Answer"]
        const exportData = [
            ["Question", "Option A", "Option B", "Option C", "Option D", "Answer"]
        ];
        
        data.forEach(d => {
            exportData.push([
                d.question || '',
                d.option_a || '',
                d.option_b || '',
                d.option_c || '',
                d.option_d || '',
                (d.answer || 'A').toString().toUpperCase()
            ]);
        });
        
        // Write to respective game file
        const targetFileName = game === 'monopoly' ? 'quiz-questions.xlsx' : 'maze-quiz-questions.xlsx';
        const targetFilePath = path.join(uploadsDir, targetFileName);
        
        try {
            const ws = XLSX.utils.aoa_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Quiz Questions");
            XLSX.writeFile(wb, targetFilePath);
            res.json({ status: 'ok', count: data.length });
        } catch (e) {
            console.error("Error writing game export excel:", e);
            res.status(500).json({ error: 'Failed to write exported game file.' });
        }
    });

    // ==== Creative API ====
    app.get('/api/creative', (req, res) => {
        let data = readExcel(creativeFile);
        const { paper, chapter, boardOnly, importantOnly, amount, topics } = req.query;
        
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        if (topics && topics !== 'All') data = data.filter(d => d.topics && String(d.topics).toLowerCase().includes(topics.toLowerCase()));
        
        data.sort(() => 0.5 - Math.random());
        
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) {
                data = data.slice(0, limit);
            }
        }
        res.json(data);
    });

    app.get('/api/creative/chapters', (req, res) => {
        let data = readExcel(creativeFile);
        let chapters = new Set();
        data.forEach(d => { if (d.chapter) chapters.add(String(d.chapter)); });
        res.json(Array.from(chapters).sort());
    });

    app.get('/api/creative/download-xlsx', (req, res) => {
        if (!fs.existsSync(creativeFile)) return res.status(404).json({ error: 'No file found' });
        res.download(creativeFile, 'creative-questions.xlsx');
    });

    app.post('/api/creative', (req, res) => {
        const data = readExcel(creativeFile);
        const newRecord = { ...req.body, id: `cq_${Date.now()}` };
        data.push(newRecord);
        const success = writeExcel(creativeFile, data);
        if (success) res.json({ status: 'ok', record: newRecord });
        else res.status(500).json({ error: 'Failed to write to Excel. Ensure the file is not open in another program.' });
    });

    app.put('/api/creative/:id', (req, res) => {
        let data = readExcel(creativeFile);
        const index = data.findIndex(r => r.id === req.params.id);
        if (index !== -1) {
            data[index] = { ...data[index], ...req.body, id: req.params.id };
            const success = writeExcel(creativeFile, data);
            if (success) res.json({ status: 'ok', record: data[index] });
            else res.status(500).json({ error: 'Failed to write to Excel. Ensure the file is not open in another program.' });
        } else {
            res.status(404).json({ error: 'Record not found' });
        }
    });

    app.get('/api/creative/topics', (req, res) => {
        let data = readExcel(creativeFile);
        const { paper, chapter } = req.query;
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);

        let topics = new Set();
        data.forEach(d => {
            if (d.topics) {
                String(d.topics).split(',').forEach(t => {
                    const trimmed = t.trim();
                    if (trimmed) topics.add(trimmed);
                });
            }
        });
        res.json(Array.from(topics).sort());
    });

    app.delete('/api/creative/:id', (req, res) => {
        let data = readExcel(creativeFile);
        const record = data.find(r => r.id === req.params.id);
        if (record) {
            // Delete associated images
            ['passage_image'].forEach(field => {
                if (record[field]) {
                    const imgPath = path.join(qbankImagesDir, record[field]);
                    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
                }
            });
        }
        data = data.filter(r => r.id !== req.params.id);
        const success = writeExcel(creativeFile, data);
        if (success) res.json({ status: 'ok' });
        else res.status(500).json({ error: 'Failed to write to Excel.' });
    });

    app.post('/api/creative/bulk-upload', excelUpload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        let newRows = readExcel(req.file.path);
        // Ensure each row has a unique id
        newRows = newRows.map(r => ({ ...r, id: r.id || `cq_${Date.now()}_${Math.floor(Math.random()*10000)}` }));
        // REPLACE existing xlsx entirely
        const success = writeExcel(creativeFile, newRows);
        fs.unlinkSync(req.file.path);
        if (success) res.json({ status: 'ok', count: newRows.length });
        else res.status(500).json({ error: 'Failed to write to Excel.' });
    });

    // ==== PDF Export API ====
    app.get('/api/mcq/export-pdf', (req, res) => {
        let data = readExcel(mcqFile);
        const { paper, chapter, boardOnly, importantOnly, amount, topics } = req.query;
        
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        if (topics && topics !== 'All') data = data.filter(d => d.topics && String(d.topics).toLowerCase().includes(topics.toLowerCase()));
        
        data.sort(() => 0.5 - Math.random());
        
        // Limit
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) {
                data = data.slice(0, limit);
            }
        }

        generatePDF(res, data, 'MCQ Questions', true);
    });

    app.get('/api/creative/export-pdf', (req, res) => {
        let data = readExcel(creativeFile);
        const { paper, chapter, boardOnly, importantOnly, amount, topics, showAnswer } = req.query;
        
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        if (topics && topics !== 'All') data = data.filter(d => d.topics && String(d.topics).toLowerCase().includes(topics.toLowerCase()));
        
        data.sort(() => 0.5 - Math.random());
        
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) {
                data = data.slice(0, limit);
            }
        }

        generatePDF(res, data, 'Creative Questions', false, showAnswer === 'true');
    });

    app.get('/api/mcq/export-txt', (req, res) => {
        let data = readExcel(mcqFile);
        const { paper, chapter, boardOnly, importantOnly, amount, topics } = req.query;
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        if (topics && topics !== 'All') data = data.filter(d => d.topics && String(d.topics).toLowerCase().includes(topics.toLowerCase()));
        
        data.sort(() => 0.5 - Math.random());
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) data = data.slice(0, limit);
        }
        generateTXT(req, res, data, 'MCQ Questions', true);
    });

    app.get('/api/creative/export-txt', (req, res) => {
        let data = readExcel(creativeFile);
        const { paper, chapter, boardOnly, importantOnly, amount, topics, showAnswer } = req.query;
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        if (topics && topics !== 'All') data = data.filter(d => d.topics && String(d.topics).toLowerCase().includes(topics.toLowerCase()));
        
        data.sort(() => 0.5 - Math.random());
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) data = data.slice(0, limit);
        }
        generateTXT(req, res, data, 'Creative Questions', false, showAnswer === 'true');
    });

    app.get('/api/mcq/export-docx', async (req, res) => {
        let data = readExcel(mcqFile);
        const { paper, chapter, boardOnly, importantOnly, amount, topics } = req.query;
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        if (topics && topics !== 'All') data = data.filter(d => d.topics && String(d.topics).toLowerCase().includes(topics.toLowerCase()));
        
        data.sort(() => 0.5 - Math.random());
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) data = data.slice(0, limit);
        }
        await generateDOCX(res, data, 'MCQ Questions', true);
    });

    app.get('/api/creative/export-docx', async (req, res) => {
        let data = readExcel(creativeFile);
        const { paper, chapter, boardOnly, importantOnly, amount, topics, showAnswer } = req.query;
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        if (topics && topics !== 'All') data = data.filter(d => d.topics && String(d.topics).toLowerCase().includes(topics.toLowerCase()));
        
        data.sort(() => 0.5 - Math.random());
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) data = data.slice(0, limit);
        }
        await generateDOCX(res, data, 'Creative Questions', false, showAnswer === 'true');
    });

    // ==== Question Maker ====
    app.post('/api/qmaker/generate-docx', async (req, res) => {
        const { type, ids, meta } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No question IDs provided' });
        }
        const sourceFile = type === 'cq' ? creativeFile : mcqFile;
        const allData = readExcel(sourceFile);
        const dataMap = {};
        allData.forEach(q => { if (q.id) dataMap[q.id] = q; });
        const questions = ids.map(id => dataMap[id]).filter(Boolean);
        if (questions.length === 0) return res.status(404).json({ error: 'No matching questions found' });
        await generateQuestionPaperDocx(res, questions, type || 'mcq', meta || {});
    });

    async function generateQuestionPaperDocx(res, questions, type, meta) {
        try {
            const MARGIN = convertInchesToTwip(0.5);
            const BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
            const { college = '', exam = '', subject = '', time = '', marks = '' } = meta;
            const headerChildren = [];
            const answerKey = [];
            const docSections = [];

            const P = (children, opts = {}) => new Paragraph({ children, ...opts });
            const T = (text, opts = {}) => new TextRun({ text: String(text || ''), ...opts });
            const bnNum = (n) => toBengaliNumber(n);

            function getImgPara(imgFilename, maxW = 280) {
                if (!imgFilename) return null;
                const fullPath = path.join(qbankImagesDir, imgFilename);
                if (!fs.existsSync(fullPath)) return null;
                try {
                    const buf = fs.readFileSync(fullPath);
                    const dim = sizeOf(buf);
                    let w = dim.width, h = dim.height;
                    if (w > maxW) { h = Math.round((maxW / w) * h); w = maxW; }
                    return new Paragraph({
                        children: [new ImageRun({ data: buf, transformation: { width: w, height: h } })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 60, after: 60 }
                    });
                } catch(e) { console.error('img error:', e.message); return null; }
            }

            // ── HEADER ──
            if (college) {
                headerChildren.push(P([T(college, { bold: true, size: 36 })], {
                    alignment: AlignmentType.CENTER, spacing: { after: 80 }
                }));
            }
            if (exam) {
                headerChildren.push(P([T(exam, { size: 26 })], {
                    alignment: AlignmentType.CENTER, spacing: { after: 60 }
                }));
            }
            if (subject) {
                headerChildren.push(P([T(subject, { size: 26 })], {
                    alignment: AlignmentType.CENTER, spacing: { after: 100 }
                }));
            }
            if (time || marks) {
                headerChildren.push(new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE, insideHorizontal: BORDER_NONE, insideVertical: BORDER_NONE },
                    rows: [new TableRow({ children: [
                        new TableCell({ children: [P([T(`সময়ঃ ${time}`, { size: 22 })], { alignment: AlignmentType.LEFT })],
                            borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
                            width: { size: 50, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [P([T(`পূর্ণমানঃ ${marks}`, { size: 22 })], { alignment: AlignmentType.RIGHT })],
                            borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
                            width: { size: 50, type: WidthType.PERCENTAGE } })
                    ]})]
                }));
            }
            headerChildren.push(new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '334155' } },
                spacing: { before: 80, after: 160 }
            }));

            // ── CQ: single column ──
            if (type === 'cq') {
                let qNum = 1;
                questions.forEach(q => {
                    const blockRuns = [T(`প্রশ্ন ${bnNum(qNum)}।  `, { bold: true, size: 22 })];
                    if (q.passage) blockRuns.push(T(q.passage, { size: 22 }));
                    headerChildren.push(P(blockRuns, { spacing: { before: 80, after: 100 } }));
                    
                    const imgPara = getImgPara(q.passage_image, 320);
                    if (imgPara) headerChildren.push(imgPara);

                    [{ label: 'ক', text: q.knowledge }, { label: 'খ', text: q.understanding },
                     { label: 'গ', text: q.application }, { label: 'ঘ', text: q.higher_thinking }
                    ].forEach(sub => {
                        if (sub.text) {
                            headerChildren.push(P([
                                T(`   ${sub.label}) `, { bold: true, size: 22 }),
                                T(sub.text, { size: 22 })
                            ], { spacing: { after: 80 } }));
                        }
                    });
                    headerChildren.push(P([T('')], { spacing: { after: 80 } }));
                    qNum++;
                });

                docSections.push({
                    properties: {
                        page: {
                            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
                            size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) }
                        }
                    },
                    children: headerChildren
                });

            } else {
                // ── MCQ: native 2-column sections ──
                const questionCounts = questions.map(q => {
                    const t = parseInt(q.type) || 1;
                    return (t === 4 && q.question2) ? 2 : 1;
                });

                const mcqParas = [];
                let runningCount = 0;
                questions.forEach((q, i) => {
                    const startNum = runningCount + 1;
                    mcqParas.push(...renderMcqParas({ q, startNum }));
                    runningCount += questionCounts[i];
                });

                function renderMcqParas(qObj) {
                    const { q, startNum } = qObj;
                    const qtype = parseInt(q.type) || 1;
                    const paras = [];
                    let qN = startNum;
                    const SZ = 20; // 10pt

                    // Passage block (type 3 & 4)
                    if ((qtype === 3 || qtype === 4) && (q.passage || q.passage_image)) {
                        const hint = (qtype === 4 && q.question2) ? `${bnNum(qN)} ও ${bnNum(qN + 1)}` : `${bnNum(qN)}`;
                        const pRuns = [T(`নিচের উদ্দীপকটি পড় এবং ${hint} নং প্রশ্নের উত্তর দাওঃ\n`, { bold: true, size: SZ })];
                        if (q.passage) pRuns.push(T(q.passage, { size: SZ, italics: true }));
                        paras.push(P(pRuns, { spacing: { after: 60 } }));
                        
                        const imgPara = getImgPara(q.passage_image, 200);
                        if (imgPara) paras.push(imgPara);
                    }

                    // Q1
                    if (q.question) {
                        const qRuns = [T(`${bnNum(qN)}। `, { bold: true, size: SZ }), T(q.question, { size: SZ })];
                        paras.push(P(qRuns, { spacing: { after: 50 } }));
                        
                        const imgPara = getImgPara(q.question_image, 200);
                        if (imgPara) paras.push(imgPara);

                        if (qtype === 1 || qtype === 3) {
                            const r1 = [], r2 = [];
                            if (q.option_a) r1.push(`ক) ${q.option_a}`);
                            if (q.option_b) r1.push(`খ) ${q.option_b}`);
                            if (q.option_c) r2.push(`গ) ${q.option_c}`);
                            if (q.option_d) r2.push(`ঘ) ${q.option_d}`);
                            if (r1.length) paras.push(P([T('   ' + r1.join('   '), { size: SZ })], { spacing: { after: 30 } }));
                            if (r2.length) paras.push(P([T('   ' + r2.join('   '), { size: SZ })], { spacing: { after: 80 } }));
                            const ans = String(q.answer || '').toUpperCase();
                            answerKey.push({ num: qN, label: ans });

                        } else if (qtype === 2 || qtype === 4) {
                            if (q.option_a) paras.push(P([T(`   i) ${q.option_a}`, { size: SZ })], { spacing: { after: 20 } }));
                            if (q.option_b) paras.push(P([T(`   ii) ${q.option_b}`, { size: SZ })], { spacing: { after: 20 } }));
                            if (q.option_c) paras.push(P([T(`   iii) ${q.option_c}`, { size: SZ })], { spacing: { after: 20 } }));
                            paras.push(P([T('   নিচের কোনটি সঠিক?', { size: SZ, italics: true })], { spacing: { before: 20, after: 30 } }));
                            const cb = [q.combo_option_1, q.combo_option_2, q.combo_option_3, q.combo_option_4];
                            const cr1 = [], cr2 = [];
                            if (cb[0]) cr1.push(`ক) ${cb[0]}`);
                            if (cb[1]) cr1.push(`খ) ${cb[1]}`);
                            if (cb[2]) cr2.push(`গ) ${cb[2]}`);
                            if (cb[3]) cr2.push(`ঘ) ${cb[3]}`);
                            if (cr1.length) paras.push(P([T('   ' + cr1.join('   '), { size: SZ })], { spacing: { after: 30 } }));
                            if (cr2.length) paras.push(P([T('   ' + cr2.join('   '), { size: SZ })], { spacing: { after: 60 } }));
                            const ansMap = {'1':'A','2':'B','3':'C','4':'D'};
                            answerKey.push({ num: qN, label: ansMap[String(q.answer)] || '?' });

                            // Q2 for type 4
                            if (qtype === 4 && q.question2) {
                                qN++;
                                const q2Runs = [T(`${bnNum(qN)}। `, { bold: true, size: SZ }), T(q.question2, { size: SZ })];
                                paras.push(P(q2Runs, { spacing: { before: 40, after: 50 } }));
                                
                                const imgPara = getImgPara(q.question2_image, 200);
                                if (imgPara) paras.push(imgPara);

                                if (q.q2_type === 'point') {
                                    if (q.q2_option_a) paras.push(P([T(`   i) ${q.q2_option_a}`, { size: SZ })], { spacing: { after: 20 } }));
                                    if (q.q2_option_b) paras.push(P([T(`   ii) ${q.q2_option_b}`, { size: SZ })], { spacing: { after: 20 } }));
                                    if (q.q2_option_c) paras.push(P([T(`   iii) ${q.q2_option_c}`, { size: SZ })], { spacing: { after: 20 } }));
                                    paras.push(P([T('   নিচের কোনটি সঠিক?', { size: SZ, italics: true })], { spacing: { before: 20, after: 30 } }));
                                    const q2cb = [q.q2_combo_option_1, q.q2_combo_option_2, q.q2_combo_option_3, q.q2_combo_option_4];
                                    const qr1 = [], qr2 = [];
                                    if (q2cb[0]) qr1.push(`ক) ${q2cb[0]}`);
                                    if (q2cb[1]) qr1.push(`খ) ${q2cb[1]}`);
                                    if (q2cb[2]) qr2.push(`গ) ${q2cb[2]}`);
                                    if (q2cb[3]) qr2.push(`ঘ) ${q2cb[3]}`);
                                    if (qr1.length) paras.push(P([T('   ' + qr1.join('   '), { size: SZ })], { spacing: { after: 30 } }));
                                    if (qr2.length) paras.push(P([T('   ' + qr2.join('   '), { size: SZ })], { spacing: { after: 60 } }));
                                    const ansMap2 = {'1':'A','2':'B','3':'C','4':'D'};
                                    answerKey.push({ num: qN, label: ansMap2[String(q.q2_answer)] || '?' });
                                } else {
                                    const qr1 = [], qr2 = [];
                                    if (q.q2_option_a) qr1.push(`ক) ${q.q2_option_a}`);
                                    if (q.q2_option_b) qr1.push(`খ) ${q.q2_option_b}`);
                                    if (q.q2_option_c) qr2.push(`গ) ${q.q2_option_c}`);
                                    if (q.q2_option_d) qr2.push(`ঘ) ${q.q2_option_d}`);
                                    if (qr1.length) paras.push(P([T('   ' + qr1.join('   '), { size: SZ })], { spacing: { after: 30 } }));
                                    if (qr2.length) paras.push(P([T('   ' + qr2.join('   '), { size: SZ })], { spacing: { after: 60 } }));
                                    answerKey.push({ num: qN, label: String(q.q2_answer || '').toUpperCase() || '?' });
                                }
                            }
                        }
                    }
                    return paras;
                }

                docSections.push({
                    properties: {
                        page: {
                            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
                            size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) }
                        }
                    },
                    children: headerChildren
                });

                docSections.push({
                    properties: {
                        type: 'continuous',
                        column: { count: 2, space: convertInchesToTwip(0.3) },
                        page: {
                            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
                            size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) }
                        }
                    },
                    children: mcqParas
                });

                // Sort answer key by question number
                answerKey.sort((a, b) => a.num - b.num);

                // ── ANSWER KEY (new page) ──
                if (answerKey.length > 0) {
                    const ansChildren = [];
                    ansChildren.push(P([T('উত্তরমালা', { bold: true, size: 28 })], {
                        alignment: AlignmentType.CENTER, spacing: { after: 200 }
                    }));
                    const CHUNK = 10;
                    for (let i = 0; i < answerKey.length; i += CHUNK) {
                        const row = answerKey.slice(i, i + CHUNK).map(a => `${a.num}.${a.label}`).join('   ');
                        ansChildren.push(P([T(row, { size: 22 })], { spacing: { after: 80 } }));
                    }

                    docSections.push({
                        properties: {
                            type: 'nextPage',
                            page: {
                                margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
                                size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) }
                            }
                        },
                        children: ansChildren
                    });
                }
            }

            // ── BUILD DOC ──
            const doc = new Document({
                creator: 'Question Bank',
                title: exam || 'Question Paper',
                sections: docSections
            });

            const buffer = await Packer.toBuffer(doc);
            const safeTitle = (exam || 'question-paper').replace(/[^a-zA-Z0-9\u0980-\u09FF _-]/g, '_');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.docx`);
            res.send(buffer);

        } catch (err) {
            console.error('Question paper DOCX error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    function generatePDF(res, data, title, isMcq, showAnswer = false) {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            
            res.setHeader('Content-disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.pdf"`);
            res.setHeader('Content-type', 'application/pdf');
            
            doc.on('error', (err) => {
                console.error("PDF generation stream error:", err);
            });
            
            doc.pipe(res);

            const fontPath = path.join(__dirname, 'fonts', 'kalpurush.ttf');
            if (fs.existsSync(fontPath)) {
                doc.font(fontPath);
            }

            doc.fontSize(20).text(title, { align: 'center' });
            doc.moveDown();
            doc.fontSize(12);

            const addImageToPdf = (imgName) => {
                if (imgName) {
                    const imgPath = path.join(qbankImagesDir, imgName);
                    if (fs.existsSync(imgPath)) {
                        try {
                            const img = doc.openImage(imgPath);
                            const targetWidth = 200; // smaller image
                            const scale = targetWidth / img.width;
                            const targetHeight = img.height * scale;
                            
                            // Check for page overflow
                            if (doc.y + targetHeight > doc.page.height - doc.page.margins.bottom) {
                                doc.addPage();
                            }
                            
                            // Center horizontally
                            const x = (doc.page.width - doc.page.margins.left - doc.page.margins.right - targetWidth) / 2 + doc.page.margins.left;
                            
                            doc.image(imgPath, x, doc.y, { width: targetWidth });
                            doc.y += targetHeight + 15; // manually advance cursor
                        } catch(e) {
                            console.error('Error adding image to pdf:', e);
                        }
                    }
                }
            };

        let qNum = 1;
        data.forEach((q) => {
            if (isMcq) {
                const type = parseInt(q.type) || 1;
                const bnIndex1 = toBengaliNumber(qNum);
                
                if (type === 3 || type === 4) {
                    if (q.passage || q.passage_image) {
                        const hint = type === 4 ? `${bnIndex1} ও ${toBengaliNumber(qNum + 1)}` : `${bnIndex1}`;
                        doc.text(`নিচের উদ্দীপকটি পড়ো এবং ${hint} নং প্রশ্নের উত্তর দাও:`);
                        if (q.passage) doc.text(`${q.passage}`);
                        doc.moveDown(0.5);
                        if (q.passage_image) addImageToPdf(q.passage_image);
                    }
                }
                
                doc.text(`${bnIndex1}। ${q.question || ''}`);
                addImageToPdf(q.question_image);
                
                const renderOptions = (a, b, c, d) => {
                    const row1 = (a ? `ক) ${a}` : '').padEnd(30, ' ') + (b ? `    খ) ${b}` : '');
                    const row2 = (c ? `গ) ${c}` : '').padEnd(30, ' ') + (d ? `    ঘ) ${d}` : '');
                    if (row1.trim()) doc.text(row1);
                    if (row2.trim()) doc.text(row2);
                };

                if (type === 1 || type === 3) {
                    renderOptions(q.option_a, q.option_b, q.option_c, q.option_d);
                } else if (type === 2 || type === 4) {
                    if (q.option_a) doc.text(`i) ${q.option_a}`);
                    if (q.option_b) doc.text(`ii) ${q.option_b}`);
                    if (q.option_c) doc.text(`iii) ${q.option_c}`);
                    doc.text(`নিচের কোনটি সঠিক?`);
                    renderOptions(q.combo_option_1, q.combo_option_2, q.combo_option_3, q.combo_option_4);
                }
                
                if (type === 4 && q.question2) {
                    doc.moveDown(0.5);
                    qNum++;
                    const bnIndex2 = toBengaliNumber(qNum);
                    doc.text(`${bnIndex2}। ${q.question2}`);
                    addImageToPdf(q.question2_image);
                    
                    if (q.q2_type === 'point') {
                        if (q.q2_option_a) doc.text(`i) ${q.q2_option_a}`);
                        if (q.q2_option_b) doc.text(`ii) ${q.q2_option_b}`);
                        if (q.q2_option_c) doc.text(`iii) ${q.q2_option_c}`);
                        doc.text(`নিচের কোনটি সঠিক?`);
                        renderOptions(q.q2_combo_option_1, q.q2_combo_option_2, q.q2_combo_option_3, q.q2_combo_option_4);
                    } else {
                        renderOptions(q.q2_option_a, q.q2_option_b, q.q2_option_c, q.q2_option_d);
                    }
                }
                doc.moveDown();
                qNum++;
            } else {
                const bnIndex = toBengaliNumber(qNum);
                doc.text(`প্রশ্ন ${bnIndex}। ${q.passage || ''}`);
                doc.moveDown(0.5);
                addImageToPdf(q.passage_image);
                const formatAns = (ans) => `    উত্তর:\n` + String(ans).split('\n').map(l => `        ${l}`).join('\n');
                if (q.knowledge) {
                    doc.text(`ক) ${q.knowledge}`);
                    if (showAnswer && q.answer_k) doc.text(formatAns(q.answer_k));
                }
                if (q.understanding) {
                    doc.text(`খ) ${q.understanding}`);
                    if (showAnswer && q.answer_u) doc.text(formatAns(q.answer_u));
                }
                if (q.application) {
                    doc.text(`গ) ${q.application}`);
                    if (showAnswer && q.answer_a) doc.text(formatAns(q.answer_a));
                }
                if (q.higher_thinking) {
                    doc.text(`ঘ) ${q.higher_thinking}`);
                    if (showAnswer && q.answer_h) doc.text(formatAns(q.answer_h));
                }
                doc.moveDown();
                qNum++;
            }
        });

        doc.end();
        } catch (error) {
            console.error("PDF Generation failed:", error);
            if (!res.headersSent) {
                res.status(500).send("Error generating PDF due to complex font parsing. Please try again.");
            }
        }
    }

    function generateTXT(req, res, data, title, isMcq, showAnswer = false) {
        res.setHeader('Content-disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.txt"`);
        res.setHeader('Content-type', 'text/plain; charset=utf-8');
        
        const baseUrl = `${req.protocol}://${req.get('host')}/uploads/qbank-images/`;
        
        let output = `${title}\n`;
        output += `===============================\n\n`;
        
        let qNum = 1;
        data.forEach((q) => {
            if (isMcq) {
                const type = parseInt(q.type) || 1;
                const bnIndex1 = toBengaliNumber(qNum);
                
                if (type === 3 || type === 4) {
                    if (q.passage || q.passage_image) {
                        const hint = type === 4 ? `${bnIndex1} ও ${toBengaliNumber(qNum + 1)}` : `${bnIndex1}`;
                        output += `নিচের উদ্দীপকটি পড়ো এবং ${hint} নং প্রশ্নের উত্তর দাও:\n`;
                        if (q.passage) output += `${q.passage}\n`;
                        if (q.passage_image) {
                            output += `[Image Link: ${baseUrl}${q.passage_image}]\n`;
                        }
                        output += `\n`;
                    }
                }
                
                output += `${bnIndex1}। ${q.question || ''}\n`;
                if (q.question_image) {
                    output += `[Image Link: ${baseUrl}${q.question_image}]\n`;
                }
                
                const appendOptions = (a, b, c, d) => {
                    const row1 = (a ? `ক) ${a}` : '').padEnd(30, ' ') + (b ? `    খ) ${b}` : '');
                    const row2 = (c ? `গ) ${c}` : '').padEnd(30, ' ') + (d ? `    ঘ) ${d}` : '');
                    if (row1.trim()) output += row1 + '\n';
                    if (row2.trim()) output += row2 + '\n';
                };

                if (type === 1 || type === 3) {
                    appendOptions(q.option_a, q.option_b, q.option_c, q.option_d);
                } else if (type === 2 || type === 4) {
                    if (q.option_a) output += `i) ${q.option_a}\n`;
                    if (q.option_b) output += `ii) ${q.option_b}\n`;
                    if (q.option_c) output += `iii) ${q.option_c}\n`;
                    output += `নিচের কোনটি সঠিক?\n`;
                    appendOptions(q.combo_option_1, q.combo_option_2, q.combo_option_3, q.combo_option_4);
                }
                
                if (type === 4 && q.question2) {
                    output += '\n';
                    qNum++;
                    const bnIndex2 = toBengaliNumber(qNum);
                    output += `${bnIndex2}। ${q.question2}\n`;
                    if (q.question2_image) {
                        output += `[Image Link: ${baseUrl}${q.question2_image}]\n`;
                    }
                    
                    if (q.q2_type === 'point') {
                        if (q.q2_option_a) output += `i) ${q.q2_option_a}\n`;
                        if (q.q2_option_b) output += `ii) ${q.q2_option_b}\n`;
                        if (q.q2_option_c) output += `iii) ${q.q2_option_c}\n`;
                        output += `নিচের কোনটি সঠিক?\n`;
                        appendOptions(q.q2_combo_option_1, q.q2_combo_option_2, q.q2_combo_option_3, q.q2_combo_option_4);
                    } else {
                        appendOptions(q.q2_option_a, q.q2_option_b, q.q2_option_c, q.q2_option_d);
                    }
                }
                output += '\n';
                qNum++;
            } else {
                const bnIndex = toBengaliNumber(qNum);
                output += `প্রশ্ন ${bnIndex}। ${q.passage || ''}\n`;
                if (q.passage_image) {
                    output += `[Image Link: ${baseUrl}${q.passage_image}]\n`;
                }
                const formatAnsTxt = (ans) => `    উত্তর:\n` + String(ans).split('\n').map(l => `        ${l}`).join('\n') + `\n`;
                if (q.knowledge) {
                    output += `ক) ${q.knowledge}\n`;
                    if (showAnswer && q.answer_k) output += formatAnsTxt(q.answer_k);
                }
                if (q.understanding) {
                    output += `খ) ${q.understanding}\n`;
                    if (showAnswer && q.answer_u) output += formatAnsTxt(q.answer_u);
                }
                if (q.application) {
                    output += `গ) ${q.application}\n`;
                    if (showAnswer && q.answer_a) output += formatAnsTxt(q.answer_a);
                }
                if (q.higher_thinking) {
                    output += `ঘ) ${q.higher_thinking}\n`;
                    if (showAnswer && q.answer_h) output += formatAnsTxt(q.answer_h);
                }
                output += '\n';
                qNum++;
            }
        });
        
        res.send('\uFEFF' + output); // Add BOM for excel/notepad unicode rendering
    }

    async function generateDOCX(res, data, title, isMcq, showAnswer = false) {
        try {
            const BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
            const docChildren = [];

            docChildren.push(new Paragraph({
                text: title,
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 300 },
                alignment: AlignmentType.CENTER
            }));

            function createTextRuns(text, options = {}) {
                if (!text) return [];
                const lines = String(text).split('\n');
                const runs = [];
                lines.forEach((line, i) => {
                    const runOpt = { text: line, ...options };
                    if (i > 0) runOpt.break = 1;
                    runs.push(new TextRun(runOpt));
                });
                return runs;
            }

            function addImage(imgPath, runsArray) {
                if (!imgPath) return;
                const fullPath = path.join(qbankImagesDir, imgPath);
                if (fs.existsSync(fullPath)) {
                    try {
                        const buf = fs.readFileSync(fullPath);
                        const dim = sizeOf(buf);
                        let w = dim.width;
                        let h = dim.height;
                        if (w > 300) {
                            h = Math.round((300 / w) * h);
                            w = 300;
                        }
                        runsArray.push(new TextRun({ text: "", break: 1 }));
                        runsArray.push(new ImageRun({
                            data: buf,
                            transformation: { width: w, height: h }
                        }));
                        runsArray.push(new TextRun({ text: "", break: 1 }));
                    } catch(e) {
                        console.error("Image export error:", e.message);
                    }
                }
            }

            let qNum = 1;
            data.forEach((q) => {
                const blockChildren = [];
                
                if (isMcq) {
                    const type = parseInt(q.type) || 1;
                    const bnIndex1 = toBengaliNumber(qNum);
                    
                    if (type === 3 || type === 4) {
                        if (q.passage || q.passage_image) {
                            const hint = type === 4 ? `${bnIndex1} ও ${toBengaliNumber(qNum + 1)}` : `${bnIndex1}`;
                            const passageRuns = [
                                new TextRun({ text: `নিচের উদ্দীপকটি পড়ো এবং ${hint} নং প্রশ্নের উত্তর দাও:`, bold: true, size: 24 })
                            ];
                            if (q.passage) {
                                passageRuns.push(new TextRun({ break: 1 }));
                                passageRuns.push(...createTextRuns(q.passage, { size: 24 }));
                            }
                            addImage(q.passage_image, passageRuns);
                            blockChildren.push(new Paragraph({
                                children: passageRuns,
                                spacing: { after: 120 }
                            }));
                        }
                    }
                    
                    const qRuns = [
                        new TextRun({ text: `${bnIndex1}। ${q.question || ''}`, bold: true, size: 24 })
                    ];
                    addImage(q.question_image, qRuns);
                    blockChildren.push(new Paragraph({
                        children: qRuns,
                        spacing: { before: 100, after: 120 }
                    }));

                    const appendOptionsDocx = (a, b, c, d) => {
                        const row1 = (a ? `ক) ${a}` : '').padEnd(30, ' ') + (b ? `    খ) ${b}` : '');
                        const row2 = (c ? `গ) ${c}` : '').padEnd(30, ' ') + (d ? `    ঘ) ${d}` : '');
                        if (row1.trim()) blockChildren.push(new Paragraph({ children: createTextRuns(row1, { size: 22 }), spacing: { after: 40 } }));
                        if (row2.trim()) blockChildren.push(new Paragraph({ children: createTextRuns(row2, { size: 22 }), spacing: { after: 80 } }));
                    };

                    if (type === 1 || type === 3) {
                        appendOptionsDocx(q.option_a, q.option_b, q.option_c, q.option_d);
                    } else if (type === 2 || type === 4) {
                        if (q.option_a) blockChildren.push(new Paragraph({ children: [new TextRun({ text: `i) ${q.option_a}`, size: 22 })] }));
                        if (q.option_b) blockChildren.push(new Paragraph({ children: [new TextRun({ text: `ii) ${q.option_b}`, size: 22 })] }));
                        if (q.option_c) blockChildren.push(new Paragraph({ children: [new TextRun({ text: `iii) ${q.option_c}`, size: 22 })] }));
                        blockChildren.push(new Paragraph({ children: [new TextRun({ text: `নিচের কোনটি সঠিক?`, size: 22, italics: true })], spacing: { before: 40, after: 40 } }));
                        appendOptionsDocx(q.combo_option_1, q.combo_option_2, q.combo_option_3, q.combo_option_4);
                    }
                    
                    if (type === 4 && q.question2) {
                        qNum++;
                        const bnIndex2 = toBengaliNumber(qNum);
                        const q2Runs = [
                            new TextRun({ text: `${bnIndex2}। ${q.question2 || ''}`, bold: true, size: 24, break: 1 })
                        ];
                        addImage(q.question2_image, q2Runs);
                        blockChildren.push(new Paragraph({
                            children: q2Runs,
                            spacing: { before: 100, after: 120 }
                        }));
                        
                        if (q.q2_type === 'point') {
                            if (q.q2_option_a) blockChildren.push(new Paragraph({ children: [new TextRun({ text: `i) ${q.q2_option_a}`, size: 22 })] }));
                            if (q.q2_option_b) blockChildren.push(new Paragraph({ children: [new TextRun({ text: `ii) ${q.q2_option_b}`, size: 22 })] }));
                            if (q.q2_option_c) blockChildren.push(new Paragraph({ children: [new TextRun({ text: `iii) ${q.q2_option_c}`, size: 22 })] }));
                            blockChildren.push(new Paragraph({ children: [new TextRun({ text: `নিচের কোনটি সঠিক?`, size: 22, italics: true })], spacing: { before: 40, after: 40 } }));
                            appendOptionsDocx(q.q2_combo_option_1, q.q2_combo_option_2, q.q2_combo_option_3, q.q2_combo_option_4);
                        } else {
                            appendOptionsDocx(q.q2_option_a, q.q2_option_b, q.q2_option_c, q.q2_option_d);
                        }
                    }
                    qNum++;
                } else {
                    const bnIndex = toBengaliNumber(qNum);
                    const cqRuns = [
                        new TextRun({ text: `প্রশ্ন ${bnIndex}। ${q.passage || ''}`, bold: true, size: 24 })
                    ];
                    addImage(q.passage_image, cqRuns);
                    blockChildren.push(new Paragraph({
                        children: cqRuns,
                        spacing: { before: 100, after: 120 }
                    }));
                    
                    const formatAnsDocx = (ans) => {
                        const runs = [new TextRun({ text: `    উত্তর:`, bold: true, size: 22, color: "065F46", break: 1 })];
                        runs.push(...createTextRuns(ans, { size: 22, color: "065F46" }));
                        return runs;
                    };
                    
                    if (q.knowledge) {
                        const kRuns = [new TextRun({ text: `ক) ${q.knowledge}`, size: 22 })];
                        if (showAnswer && q.answer_k) kRuns.push(...formatAnsDocx(q.answer_k));
                        blockChildren.push(new Paragraph({ children: kRuns, spacing: { after: 80 } }));
                    }
                    if (q.understanding) {
                        const uRuns = [new TextRun({ text: `খ) ${q.understanding}`, size: 22 })];
                        if (showAnswer && q.answer_u) uRuns.push(...formatAnsDocx(q.answer_u));
                        blockChildren.push(new Paragraph({ children: uRuns, spacing: { after: 80 } }));
                    }
                    if (q.application) {
                        const aRuns = [new TextRun({ text: `গ) ${q.application}`, size: 22 })];
                        if (showAnswer && q.answer_a) aRuns.push(...formatAnsDocx(q.answer_a));
                        blockChildren.push(new Paragraph({ children: aRuns, spacing: { after: 80 } }));
                    }
                    if (q.higher_thinking) {
                        const hRuns = [new TextRun({ text: `ঘ) ${q.higher_thinking}`, size: 22 })];
                        if (showAnswer && q.answer_h) hRuns.push(...formatAnsDocx(q.answer_h));
                        blockChildren.push(new Paragraph({ children: hRuns, spacing: { after: 80 } }));
                    }
                    qNum++;
                }

                // Table to prevent split
                const table = new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE, insideHorizontal: BORDER_NONE, insideVertical: BORDER_NONE },
                    rows: [
                        new TableRow({
                            cantSplit: true,
                            children: [
                                new TableCell({
                                    children: blockChildren,
                                    borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
                                    margins: { top: 0, bottom: convertInchesToTwip(0.15), left: 0, right: 0 }
                                })
                            ]
                        })
                    ]
                });
                docChildren.push(table);
                
                docChildren.push(new Paragraph({
                    children: [new TextRun({ text: '━'.repeat(50), color: 'E5E7EB', size: 16 })],
                    spacing: { after: 120 }
                }));
            });

            const doc = new Document({
                creator: 'Question Bank',
                title: title,
                sections: [{
                    properties: {
                        page: {
                            margin: {
                                top: convertInchesToTwip(1),
                                right: convertInchesToTwip(1),
                                bottom: convertInchesToTwip(1),
                                left: convertInchesToTwip(1),
                            },
                            size: {
                                width: convertInchesToTwip(8.27),
                                height: convertInchesToTwip(11.69)
                            }
                        }
                    },
                    children: docChildren
                }]
            });

            const buffer = await Packer.toBuffer(doc);
            const safeTitle = title.replace(/[^a-zA-Z0-9-_\u0980-\u09FF ]/g, '_');

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.docx`);
            res.send(buffer);
        } catch (error) {
            console.error("DOCX export error:", error);
            res.status(500).json({ error: error.message });
        }
    }

    // ==== Student Bank API ====
    app.get('/api/students', (req, res) => {
        let data = readExcel(studentFile);
        const { session, className, section, group } = req.query;
        if (session) data = data.filter(d => d.session === session);
        if (className) data = data.filter(d => d.class === className);
        if (section) data = data.filter(d => d.section === section);
        if (group) data = data.filter(d => d.group === group);
        res.json(data);
    });

    app.post('/api/students', (req, res) => {
        const data = readExcel(studentFile);
        data.push(req.body);
        writeExcel(studentFile, data);
        res.json({ status: 'ok' });
    });

    app.put('/api/students/:roll', (req, res) => {
        let data = readExcel(studentFile);
        const index = data.findIndex(r => String(r.roll) === req.params.roll);
        if (index !== -1) {
            data[index] = { ...data[index], ...req.body };
            writeExcel(studentFile, data);
            res.json({ status: 'ok', record: data[index] });
        } else {
            res.status(404).json({ error: 'Student not found' });
        }
    });

    app.delete('/api/students/:roll', (req, res) => {
        let data = readExcel(studentFile);
        data = data.filter(r => String(r.roll) !== req.params.roll);
        writeExcel(studentFile, data);
        res.json({ status: 'ok' });
    });

    app.post('/api/students/bulk-upload', excelUpload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const newRows = readExcel(req.file.path);
        
        // Replace existing xlsx entirely
        writeExcel(studentFile, newRows);
        fs.unlinkSync(req.file.path);
        res.json({ status: 'ok', count: newRows.length });
    });

    app.get('/api/students/filters', (req, res) => {
        const data = readExcel(studentFile);
        const sessions = new Set(), classes = new Set(), sections = new Set(), groups = new Set();
        data.forEach(d => {
            if (d.session) sessions.add(String(d.session));
            if (d.class) classes.add(String(d.class));
            if (d.section) sections.add(String(d.section));
            if (d.group) groups.add(String(d.group));
        });
        res.json({
            sessions: Array.from(sessions).sort(),
            classes: Array.from(classes).sort(),
            sections: Array.from(sections).sort(),
            groups: Array.from(groups).sort()
        });
    });

    // ==== Student Demo XLSX ====
    app.get('/api/students/demo-xlsx', (req, res) => {
        const demoData = [{
            id: 'STU2024001',
            roll: '101',
            name: 'Demo Student Name',
            session: '2024-25',
            class: 'Eleven',
            section: 'Teesta',
            group: 'A',
            gender: 'Male',
            mobile: '01700000000'
        }];
        const ws = XLSX.utils.json_to_sheet(demoData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Students');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="student-bank-demo.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    });

    // ==== Student Performance API ====
    app.get('/api/performance', (req, res) => {
        let data = readJson(perfFile);
        const { session, className, section, group } = req.query;
        if (session) data = data.filter(d => d.session === session);
        if (className) data = data.filter(d => d.class === className);
        if (section) data = data.filter(d => d.section === section);
        if (group) data = data.filter(d => d.group === group);
        res.json(data);
    });

    app.post('/api/performance/init', (req, res) => {
        // Initialize performance records from students
        const students = req.body.students || [];
        const perfData = readJson(perfFile);
        
        students.forEach(s => {
            const exists = perfData.find(p => String(p.roll) === String(s.roll) && String(p.id) === String(s.id));
            if (!exists) {
                perfData.push({
                    id: s.id,
                    roll: s.roll,
                    name: s.name,
                    session: s.session,
                    class: s.class,
                    section: s.section,
                    group: s.group,
                    gender: s.gender,
                    attendance: [],
                    mark: {}
                });
            }
        });
        
        writeJson(perfFile, perfData);
        
        // Trigger leaderboard update immediately with calculated scores
        const initPayload = students.map(s => {
            const pData = perfData.find(p => String(p.roll) === String(s.roll) && String(p.id) === String(s.id)) || s;
            const attCount = (pData.attendance || []).filter(a => a.isPresent).length;
            const attScore = attCount * 5;
            
            let examScore = 0;
            if (pData.mark) {
                Object.keys(pData.mark).forEach(k => {
                    examScore += (parseFloat(pData.mark[k]) || 0);
                });
            }
            
            return {
                name: pData.name,
                roll: pData.roll,
                attendanceScore: attScore,
                examScore: examScore,
                totalScore: attScore + examScore
            };
        });
        
        // Sort before emitting
        initPayload.sort((a, b) => b.totalScore - a.totalScore);
        
        io.emit('leaderboard-show', {
            data: initPayload,
            filters: { session: 'Initializing', className: '', section: '' }
        });
        
        res.json({ status: 'ok' });
    });

    app.post('/api/performance/attendance', (req, res) => {
        const { date, records } = req.body; // records: [{roll, isPresent}]
        const perfData = readJson(perfFile);
        const normTargetDate = normalizeDate(date) || date;
        console.log(`[ATTENDANCE GRID SAVE] Date: ${normTargetDate}, records count: ${records ? records.length : 0}`);
        
        records.forEach(r => {
            const student = perfData.find(p => String(p.roll) === String(r.roll) && String(p.id) === String(r.id));
            if (student) {
                if (!student.attendance) student.attendance = [];
                const existingDate = student.attendance.find(a => normalizeDate(a.date) === normTargetDate);
                if (existingDate) {
                    existingDate.isPresent = r.isPresent;
                } else {
                    student.attendance.push({ date: normTargetDate, isPresent: r.isPresent });
                }
            }
        });
        
        writeJson(perfFile, perfData);
        emitLeaderboardUpdate(perfData);
        res.json({ status: 'ok' });
    });

    app.post('/api/performance/marks', (req, res) => {
        const { records } = req.body; // records: [{roll, CT1, CT2, ...}]
        const perfData = readJson(perfFile);
        
        records.forEach(r => {
            const student = perfData.find(p => String(p.roll) === String(r.roll) && String(p.id) === String(r.id));
            if (student) {
                if (!student.mark) student.mark = {};
                Object.keys(r).forEach(k => {
                    if (k !== 'roll' && k !== 'id') {
                        student.mark[k] = parseFloat(r[k]) || 0;
                    }
                });
            }
        });
        
        writeJson(perfFile, perfData);
        emitLeaderboardUpdate(perfData);
        res.json({ status: 'ok' });
    });
    
    app.post('/api/performance/attendance/bulk', excelUpload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const newRows = readExcel(req.file.path);
        let perfData = readJson(perfFile);
        const today = new Date().toISOString().split('T')[0];
        
        newRows.forEach(r => {
            console.log(`[ATTENDANCE BULK ROW] Keys: ${Object.keys(r).join(', ')} | name: ${r.name} | isPresent: ${r.isPresent} | id: ${r.id} | roll: ${r.roll}`);
            
            const student = perfData.find(p => {
                const searchId = String(r.id || r.ID || r.Id || "");
                const searchRoll = String(r.roll || r.Roll || "");
                return String(p.id) === searchId && String(p.roll) === searchRoll;
            });
            
            if (student) {
                // Normalize date from xlsx (handles serial numbers, M/D/YYYY, YYYY-MM-DD)
                const rawDate = r.date !== undefined ? r.date : (r.Date !== undefined ? r.Date : null);
                const recordDate = normalizeDate(rawDate) || today;
                // Read isPresent (supports isPresent, Present, present columns)
                const rawPresent = r.isPresent !== undefined ? r.isPresent : (r.Present !== undefined ? r.Present : r.present);
                const isPresent = String(rawPresent).trim().toUpperCase() === 'TRUE' || 
                                  String(rawPresent).trim().toUpperCase() === 'PRESENT' || 
                                  String(rawPresent).trim().toUpperCase() === 'P' || 
                                  rawPresent === 1 || 
                                  rawPresent === true;
                console.log(`[ATTENDANCE BULK] Roll: ${student.roll}, Name: ${student.name}, rawDate: ${rawDate}, recordDate: ${recordDate}, rawPresent: ${rawPresent}, isPresent: ${isPresent}`);
                if (!student.attendance) student.attendance = [];
                const existingIdx = student.attendance.findIndex(a => normalizeDate(a.date) === recordDate);
                if (existingIdx >= 0) {
                    student.attendance[existingIdx].isPresent = isPresent;
                } else {
                    student.attendance.push({ date: recordDate, isPresent });
                }
            }
        });
        
        writeJson(perfFile, perfData);
        emitLeaderboardUpdate(perfData);
        fs.unlinkSync(req.file.path);
        res.json({ status: 'ok', count: newRows.length });
    });

    app.post('/api/performance/marks/bulk', excelUpload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const newRows = readExcel(req.file.path);
        let perfData = readJson(perfFile);
        
        newRows.forEach(r => {
            const student = perfData.find(p => {
                const searchId = String(r.id || r.ID || r.Id || "");
                const searchRoll = String(r.roll || r.Roll || "");
                return String(p.id) === searchId && String(p.roll) === searchRoll;
            });
            if (student) {
                student.mark = {}; // Completely replace marks object
                ['CT1','CT2','CT3','CT4','CT5','HY','Y','PT','T','MT1','MT2','MCQ1','MCQ2','MCQ3', 'Rewards'].forEach(k => {
                    if (r[k] !== undefined) {
                        student.mark[k] = parseFloat(r[k]) || 0;
                    }
                });
            }
        });
        
        writeJson(perfFile, perfData);
        emitLeaderboardUpdate(perfData);
        fs.unlinkSync(req.file.path);
        res.json({ status: 'ok', count: newRows.length });
    });

    // ==== Marks Demo XLSX (pre-filled with filtered students + current marks) ====
    app.get('/api/performance/marks/demo-xlsx', (req, res) => {
        const { session, className, section, group } = req.query;
        let students = readExcel(studentFile);
        if (session) students = students.filter(d => d.session === session);
        if (className) students = students.filter(d => d.class === className);
        if (section) students = students.filter(d => d.section === section);
        if (group) students = students.filter(d => d.group === group);

        const perfData = readJson(perfFile);
        const markCols = ['CT1','CT2','CT3','CT4','CT5','HY','Y','PT','T','MT1','MT2','MCQ1','MCQ2','MCQ3','Rewards'];

        let rows = students.map(s => {
            const perf = perfData.find(p => String(p.roll) === String(s.roll));
            const marks = (perf && perf.mark) ? perf.mark : {};
            const row = { roll: s.roll, name: s.name, id: s.id, session: s.session, class: s.class, section: s.section, group: s.group };
            markCols.forEach(c => { row[c] = marks[c] !== undefined ? marks[c] : 0; });
            return row;
        });

        if (rows.length === 0) {
            const demo = { roll: '101', name: 'Demo Student', id: 'STU2024001', session: '2024-25', class: 'Eleven', section: 'Teesta', group: 'A' };
            markCols.forEach(c => { demo[c] = 0; });
            rows = [demo];
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Marks');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="marks-bulk-template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    });

    // ==== Attendance Demo XLSX (pre-filled with filtered students + current date attendance) ====
    app.get('/api/performance/attendance/demo-xlsx', (req, res) => {
        const { session, className, section, group, date } = req.query;
        let students = readExcel(studentFile);
        if (session) students = students.filter(d => d.session === session);
        if (className) students = students.filter(d => d.class === className);
        if (section) students = students.filter(d => d.section === section);
        if (group) students = students.filter(d => d.group === group);

        const perfData = readJson(perfFile);
        const targetDate = date || new Date().toISOString().split('T')[0];

        let rows = students.map(s => {
            const perf = perfData.find(p => String(p.roll) === String(s.roll));
            const attEntry = (perf && perf.attendance) ? perf.attendance.find(a => a.date === targetDate) : null;
            return {
                roll: s.roll,
                name: s.name,
                id: s.id,
                session: s.session,
                class: s.class,
                section: s.section,
                group: s.group,
                date: targetDate,
                isPresent: attEntry ? (attEntry.isPresent ? 'TRUE' : 'FALSE') : 'FALSE'
            };
        });

        if (rows.length === 0) {
            rows = [{ roll: '101', name: 'Demo Student', id: 'STU2024001', session: '2024-25', class: 'Eleven', section: 'Teesta', group: 'A', date: targetDate, isPresent: 'TRUE' }];
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="attendance-bulk-template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    });

    // Leaderboard calculation
    app.get('/api/performance/leaderboard', (req, res) => {
        let data = readJson(perfFile);
        const { session, className, section, group } = req.query;
        if (session) data = data.filter(d => d.session === session);
        if (className) data = data.filter(d => d.class === className);
        if (section) data = data.filter(d => d.section === section);
        if (group) data = data.filter(d => d.group === group);
        
        const leaderboard = data.map(s => {
            const attCount = (s.attendance || []).filter(a => a.isPresent).length;
            const attScore = attCount * 5;
            
            let examScore = 0;
            if (s.mark) {
                Object.values(s.mark).forEach(m => examScore += (parseFloat(m) || 0));
            }
            
            return {
                name: s.name,
                roll: s.roll,
                attendanceScore: attScore,
                examScore: examScore,
                totalScore: attScore + examScore
            };
        });
        
        leaderboard.sort((a, b) => b.totalScore - a.totalScore);
        res.json(leaderboard);
    });

    // ==== Socket Events ====
    io.on('connection', (socket) => {
        socket.on('qbank-start-mcq-quiz', (data) => {
            socket.broadcast.emit('qbank-start-mcq-quiz', data);
        });
        socket.on('qbank-next-question', (data) => {
            socket.broadcast.emit('qbank-next-question', data);
        });
        socket.on('qbank-show-answer', (data) => {
            socket.broadcast.emit('qbank-show-answer', data);
        });
        socket.on('qbank-timer-update', (data) => {
            socket.broadcast.emit('qbank-timer-update', data);
        });
        socket.on('qbank-end-quiz', () => {
            socket.broadcast.emit('qbank-end-quiz');
        });
        socket.on('qbank-show-creative', (data) => {
            socket.broadcast.emit('qbank-show-creative', data);
        });
        socket.on('qbank-close-creative', () => {
            socket.broadcast.emit('qbank-close-creative');
        });
        socket.on('qbank-pause-timer', () => {
            socket.broadcast.emit('qbank-pause-timer');
        });
        socket.on('qbank-resume-timer', () => {
            socket.broadcast.emit('qbank-resume-timer');
        });
        socket.on('qbank-sync-question', (data) => {
            socket.broadcast.emit('qbank-sync-question', data);
        });
        socket.on('qbank-live-update-question', (data) => {
            socket.broadcast.emit('qbank-live-update-question', data);
        });
        socket.on('leaderboard-show', (data) => {
            socket.broadcast.emit('leaderboard-show', data);
        });
        socket.on('leaderboard-update', (data) => {
            socket.broadcast.emit('leaderboard-update', data);
        });
    });
};
