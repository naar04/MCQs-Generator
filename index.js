import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ✅ STEP 5 goes HERE
app.post("/upload-pdf", upload.single("file"), async (req, res) => {
    try {
        const fs = await import("fs");

        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(dataBuffer);

        res.json({ text: pdfData.text });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ STEP 6 goes HERE
app.post("/generate-mcqs", async (req, res) => {
    try {
        const { text, classLevel, subject, board, difficulty, count } = req.body;

        const prompt = `
You are an expert MCQ generator.

Curriculum: ${board}
Class: ${classLevel}
Subject: ${subject}
Difficulty: ${difficulty}

Generate ${count} MCQs.

Rules:
- 4 options each
- 1 correct answer
- Pakistan board style
- Based ONLY on given text

CONTENT:
${text}
        `;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }]
            }
        );

        const mcqs = response.data.candidates[0].content.parts[0].text;

        res.json({ mcqs });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});