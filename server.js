const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and Cross-Origin Configuration
app.use(cors({
    origin: ['https://naar04.github.io', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure storage binary parameters for incoming files
const upload = multer({ storage: multer.memoryStorage() });

// Ensure internal history tracking directories exist natively on start
const DATA_FILE = path.join(__dirname, 'data', 'history.json');
if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Authenticate Google AI Connection Strings
const aiKey = process.env.GEMINI_API_KEY;
if (!aiKey) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY environment variable is missing inside Render settings dashboard!");
}
const ai = new GoogleGenerativeAI(aiKey || "placeholder_key");

// --- API ENDPOINTS ---

// 1. Core PDF Content Extraction Pipeline
app.post('/api/upload-pdf', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const data = await pdfParse(req.file.buffer);
        res.json({ text: data.text });
    } catch (error) {
        console.error("PDF Parsing Error Logged:", error);
        res.status(500).json({ error: 'Failed to extract text matrix from provided PDF structure' });
    }
});

// 2. Direct Gemini AI MCQ Compilation Engine
app.post('/api/generate-mcqs', async (req, res) => {
    try {
        const { sourceText, topic, className, subject, board, difficulty, count } = req.body;
        
        let targetContent = sourceText || topic;
        if (!targetContent) {
            return res.status(400).json({ error: 'Missing context prompt baseline configurations' });
        }

        const prompt = `
You are an expert examiner. Generate exactly ${count} multiple-choice questions (MCQs) based on the following context parameters.

CONTEXT / TOPIC:
"${targetContent}"

PARAMETERS:
- Target Academic Level: ${className}
- Subject Domain: ${subject}
- Examination Board: ${board}
- Academic Difficulty Level: ${difficulty}

CRITICAL RULES:
1. Base questions strictly on the context if source text is provided.
2. Provide exactly 4 options per question.
3. Mark exactly one correct option string value ("A", "B", "C", or "D").
4. Respond ONLY with a valid, clean JSON object matching the exact structure below. No markdown wrappers, no \`\`\`json syntax block.

EXPECTED JSON SCHEMA FORMAT:
{
  "title": "A concise metadata heading summarizing this set",
  "questions": [
    {
      "question": "Clear and definitive question string?",
      "options": ["Option A statement", "Option B statement", "Option C statement", "Option D statement"],
      "answer": "A"
    }
  ]
}
`;

        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        // Secondary clean mechanism in case markdown wrapper notations filter through
        const cleanedJsonString = responseText.replace(/^```json\s*/i, '').replace(/\s*
```$/, '');
        
        const mcqData = JSON.parse(cleanedJsonString);
        res.json(mcqData);
    } catch (error) {
        console.error("Gemini AI Core Frame Exception Failure:", error);
        res.status(500).json({ error: 'Processing failure during structured LLM assessment generation cycle.' });
    }
});

// 3. Append Performance Entry History 
app.post('/api/save-history', (req, res) => {
    try {
        const newRecord = req.body;
        const fileData = fs.readFileSync(DATA_FILE, 'utf8');
        const history = JSON.parse(fileData);
        
        history.unshift(newRecord);
        fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2));
        
        res.json({ success: true, history });
    } catch (error) {
        console.error("History Registry Append Failure:", error);
        res.status(500).json({ error: 'Failed to synchronize record elements within local runtime storage paths' });
    }
});

// 4. Fetch History Records Log
app.get('/api/history', (req, res) => {
    try {
        const fileData = fs.readFileSync(DATA_FILE, 'utf8');
        res.json(JSON.parse(fileData));
    } catch (error) {
        console.error("History Directory Read Trace Exception:", error);
        res.status(500).json({ error: 'Failed to access local structural array files logs data' });
    }
});

app.listen(PORT, () => {
    console.log(`Node CommonJS Engine production pipeline successfully operational on port context ${PORT}`);
});
