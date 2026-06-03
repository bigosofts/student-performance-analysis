const fs = require('fs');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

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
        const { paper, chapter, boardOnly, importantOnly, amount } = req.query;
        
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        
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
        const { paper, chapter, boardOnly, importantOnly, amount } = req.query;
        
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        
        data.sort(() => 0.5 - Math.random());
        
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) {
                data = data.slice(0, limit);
            }
        }

        generatePDF(res, data, 'Creative Questions', false);
    });

    app.get('/api/mcq/export-txt', (req, res) => {
        let data = readExcel(mcqFile);
        const { paper, chapter, boardOnly, importantOnly, amount } = req.query;
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        
        data.sort(() => 0.5 - Math.random());
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) data = data.slice(0, limit);
        }
        generateTXT(res, data, 'MCQ Questions', true);
    });

    app.get('/api/creative/export-txt', (req, res) => {
        let data = readExcel(creativeFile);
        const { paper, chapter, boardOnly, importantOnly, amount } = req.query;
        if (paper && paper !== 'All') data = data.filter(d => d.paper === paper);
        if (chapter && chapter !== 'All') data = data.filter(d => String(d.chapter) === chapter);
        if (boardOnly === 'true') data = data.filter(d => String(d.board_question).toUpperCase() === 'TRUE');
        if (importantOnly === 'true') data = data.filter(d => String(d.marked_important).toUpperCase() === 'TRUE');
        
        data.sort(() => 0.5 - Math.random());
        if (amount && amount !== 'All') {
            const limit = parseInt(amount);
            if (!isNaN(limit)) data = data.slice(0, limit);
        }
        generateTXT(res, data, 'Creative Questions', false);
    });

    function generatePDF(res, data, title, isMcq) {
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
                            
                            doc.image(img, x, doc.y, { width: targetWidth });
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
                    if (q.passage) {
                        const hint = type === 4 ? `${bnIndex1} ও ${toBengaliNumber(qNum + 1)}` : `${bnIndex1}`;
                        doc.text(`নিচের উদ্দীপকটি পড়ো এবং ${hint} নং প্রশ্নের উত্তর দাও:`);
                        doc.text(`${q.passage}`);
                        doc.moveDown(0.5);
                        addImageToPdf(q.passage_image);
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
                if (q.knowledge) doc.text(`ক) ${q.knowledge}`);
                if (q.understanding) doc.text(`খ) ${q.understanding}`);
                if (q.application) doc.text(`গ) ${q.application}`);
                if (q.higher_thinking) doc.text(`ঘ) ${q.higher_thinking}`);
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

    function generateTXT(res, data, title, isMcq) {
        res.setHeader('Content-disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.txt"`);
        res.setHeader('Content-type', 'text/plain; charset=utf-8');
        
        let output = `${title}\n`;
        output += `===============================\n\n`;
        
        let qNum = 1;
        data.forEach((q) => {
            if (isMcq) {
                const type = parseInt(q.type) || 1;
                const bnIndex1 = toBengaliNumber(qNum);
                
                if (type === 3 || type === 4) {
                    if (q.passage) {
                        const hint = type === 4 ? `${bnIndex1} ও ${toBengaliNumber(qNum + 1)}` : `${bnIndex1}`;
                        output += `নিচের উদ্দীপকটি পড়ো এবং ${hint} নং প্রশ্নের উত্তর দাও:\n`;
                        output += `${q.passage}\n\n`;
                    }
                }
                
                output += `${bnIndex1}। ${q.question || ''}\n`;
                
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
                if (q.knowledge) output += `ক) ${q.knowledge}\n`;
                if (q.understanding) output += `খ) ${q.understanding}\n`;
                if (q.application) output += `গ) ${q.application}\n`;
                if (q.higher_thinking) output += `ঘ) ${q.higher_thinking}\n`;
                output += '\n';
                qNum++;
            }
        });
        
        res.send('\uFEFF' + output); // Add BOM for excel/notepad unicode rendering
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

    app.delete('/api/students/:roll', (req, res) => {
        let data = readExcel(studentFile);
        data = data.filter(r => String(r.roll) !== req.params.roll);
        writeExcel(studentFile, data);
        res.json({ status: 'ok' });
    });

    app.post('/api/students/bulk-upload', excelUpload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const newRows = readExcel(req.file.path);
        const data = readExcel(studentFile);
        
        newRows.forEach(newRow => {
            const exists = data.findIndex(d => String(d.roll) === String(newRow.roll) && String(d.id) === String(newRow.id));
            if (exists >= 0) {
                data[exists] = { ...data[exists], ...newRow };
            } else {
                data.push(newRow);
            }
        });
        
        writeExcel(studentFile, data);
        fs.unlinkSync(req.file.path);
        res.json({ status: 'ok', count: newRows.length });
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
        res.json({ status: 'ok' });
    });

    app.post('/api/performance/attendance', (req, res) => {
        const { date, records } = req.body; // records: [{roll, isPresent}]
        const perfData = readJson(perfFile);
        
        records.forEach(r => {
            const student = perfData.find(p => String(p.roll) === String(r.roll));
            if (student) {
                if (!student.attendance) student.attendance = [];
                const existingDate = student.attendance.find(a => a.date === date);
                if (existingDate) {
                    existingDate.isPresent = r.isPresent;
                } else {
                    student.attendance.push({ date, isPresent: r.isPresent });
                }
            }
        });
        
        writeJson(perfFile, perfData);
        res.json({ status: 'ok' });
    });

    app.post('/api/performance/marks', (req, res) => {
        const { records } = req.body; // records: [{roll, CT1, CT2, ...}]
        const perfData = readJson(perfFile);
        
        records.forEach(r => {
            const student = perfData.find(p => String(p.roll) === String(r.roll));
            if (student) {
                if (!student.mark) student.mark = {};
                Object.keys(r).forEach(k => {
                    if (k !== 'roll') {
                        student.mark[k] = parseFloat(r[k]) || 0;
                    }
                });
            }
        });
        
        writeJson(perfFile, perfData);
        res.json({ status: 'ok' });
    });
    
    app.post('/api/performance/attendance/bulk', excelUpload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const newRows = readExcel(req.file.path);
        const perfData = readJson(perfFile);
        const today = new Date().toISOString().split('T')[0];
        
        newRows.forEach(r => {
            const student = perfData.find(p => String(p.roll) === String(r.Roll || r.roll));
            if (student) {
                if (!student.attendance) student.attendance = [];
                const isPresent = String(r.Present || r.present).toUpperCase() === 'TRUE' || r.Present === 1 || r.Present === true;
                const existingDate = student.attendance.find(a => a.date === today);
                if (existingDate) {
                    existingDate.isPresent = isPresent;
                } else {
                    student.attendance.push({ date: today, isPresent });
                }
            }
        });
        
        writeJson(perfFile, perfData);
        fs.unlinkSync(req.file.path);
        res.json({ status: 'ok', count: newRows.length });
    });

    app.post('/api/performance/marks/bulk', excelUpload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const newRows = readExcel(req.file.path);
        const perfData = readJson(perfFile);
        
        newRows.forEach(r => {
            const student = perfData.find(p => String(p.roll) === String(r.Roll || r.roll));
            if (student) {
                if (!student.mark) student.mark = {};
                ['CT1','CT2','CT3','CT4','CT5','HY','Y','PT','T','MT1','MT2','MCQ1','MCQ2','MCQ3'].forEach(k => {
                    if (r[k] !== undefined) {
                        student.mark[k] = parseFloat(r[k]) || 0;
                    }
                });
            }
        });
        
        writeJson(perfFile, perfData);
        fs.unlinkSync(req.file.path);
        res.json({ status: 'ok', count: newRows.length });
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
        socket.on('leaderboard-show', (data) => {
            socket.broadcast.emit('leaderboard-show', data);
        });
        socket.on('leaderboard-update', (data) => {
            socket.broadcast.emit('leaderboard-update', data);
        });
    });
};
