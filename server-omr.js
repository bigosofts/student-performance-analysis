const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

module.exports = function (app, uploadsDir) {
  const dbPath = path.join(uploadsDir, "omr-data.json");

  function readDB() {
    if (!fs.existsSync(dbPath)) {
      const initial = { exams: [], results: [], answerKeys: [] };
      fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    try {
      return JSON.parse(fs.readFileSync(dbPath, "utf8"));
    } catch {
      const initial = { exams: [], results: [], answerKeys: [] };
      fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
  }

  function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
  }

  // Health
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "OMR Reader API is running",
    });
  });

  // Exams
  app.get("/api/exams", (req, res) => {
    res.json(readDB().exams || []);
  });

  app.get("/api/exams/:id", (req, res) => {
    const exam = (readDB().exams || []).find((e) => e.id === req.params.id);
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    res.json(exam);
  });

  app.post("/api/exams", (req, res) => {
    const { name, totalQuestions, marksPerQ, negative, sets } = req.body;
    if (!name || !totalQuestions) {
      return res.status(400).json({ error: "name and totalQuestions required" });
    }
    const db = readDB();
    const exam = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : "exam_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      name,
      totalQuestions: Math.min(50, Math.max(1, parseInt(totalQuestions))),
      marksPerQ: marksPerQ || 1,
      negative: negative || 0,
      sets: sets || 1,
      createdAt: new Date().toISOString(),
    };
    db.exams.push(exam);
    writeDB(db);
    res.status(201).json(exam);
  });

  // Answer Keys
  app.get("/api/exams/:id/keys", (req, res) => {
    const keys = (readDB().answerKeys || []).filter(
      (k) => k.examId === req.params.id
    );
    res.json(keys);
  });

  app.post("/api/exams/:id/keys", (req, res) => {
    const { set, answers } = req.body;
    if (!set || !answers) {
      return res.status(400).json({ error: "set and answers required" });
    }
    const db = readDB();
    const idx = db.answerKeys.findIndex(
      (k) => k.examId === req.params.id && k.set === set
    );
    const key = {
      examId: req.params.id,
      set,
      answers,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) {
      db.answerKeys[idx] = key;
    } else {
      db.answerKeys.push(key);
    }
    writeDB(db);
    res.status(201).json(key);
  });

  // Results
  app.get("/api/exams/:id/results", (req, res) => {
    const results = (readDB().results || []).filter(
      (r) => r.examId === req.params.id
    );
    res.json(results);
  });

  app.post("/api/exams/:id/results", (req, res) => {
    const db = readDB();
    const result = {
      ...req.body,
      examId: req.params.id,
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : "res_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      scannedAt: new Date().toISOString(),
    };
    db.results.push(result);
    writeDB(db);
    res.status(201).json(result);
  });

  // Templates
  const templatePath = path.join(
    __dirname,
    "omr",
    "dist",
    "templates",
    "ssc-50.json"
  );
  app.get("/templates/ssc-50.json", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (fs.existsSync(templatePath)) {
      res.sendFile(templatePath);
    } else {
      res.status(404).json({ error: "Template file not found" });
    }
  });

  app.post("/api/templates/ssc-50", (req, res) => {
    const template = req.body?.template;
    if (!template || template.name !== "RCPSC-MCQ-50") {
      return res
        .status(400)
        .json({ error: "An RCPSC-MCQ-50 template is required." });
    }
    try {
      fs.mkdirSync(path.dirname(templatePath), { recursive: true });
      fs.writeFileSync(
        templatePath,
        JSON.stringify(template, null, 2) + "\n",
        "utf8"
      );
      res.json({ saved: true, name: template.name, version: template.version });
    } catch (error) {
      res
        .status(500)
        .json({ error: `Could not write ssc-50.json: ${error.message}` });
    }
  });

  // Serve static OMR build
  const omrDist = path.join(__dirname, "omr", "dist");
  app.use("/omr", express.static(omrDist));
  app.use("/assets", express.static(path.join(omrDist, "assets")));

  app.get("/omr/*", (req, res) => {
    if (fs.existsSync(path.join(omrDist, "index.html"))) {
      res.sendFile(path.join(omrDist, "index.html"));
    } else {
      res.status(404).send("OMR Web App not installed");
    }
  });
};
