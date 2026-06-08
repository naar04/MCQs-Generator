import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Configured to accept communication explicitly from your GitHub Pages URL
app.use(cors({
    origin: ['https://naar04.github.io', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer Config for PDF Upload
const upload = multer({ storage: multer.memoryStorage() });

// Ensure data file exists for local caching fallback
const DATA_FILE = path.join(__dirname, 'data', 'history.json');
if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Initialize Gemini API with the correct class name
const aiKey = process.env.GEMINI_API_KEY;
if (!aiKey) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY environment variable is missing inside Render Settings!");
}

const ai = new GoogleGenerativeAI(aiKey || "placeholder_key");

// --- ENDPOINTS ---

// 1. PDF Text Extraction Endpoint
app.post('/api/upload-pdf', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const data = await pdfParse(req.file.buffer);
        res.json({ text: data.text });
    } catch (error) {
        console.error("PDF Parsing Error:", error);
        res.status(500).json({ error: 'Failed to extract text from PDF' });
    }
});

// 2. MCQ Generation Endpoint (Using Gemini 1.5 Flash)
app.post('/api/generate-mcqs', async (req, res) => {
    try {
        const { sourceText, topic, className, subject, board, difficulty, count } = req.body;
        
        let targetContent = sourceText || topic;
        if (!targetContent) {
            return res.status(400).json({ error: 'Missing topic or reference text content' });
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
        
        // Clean markdown wraps if Gemini accidentally includes them
        const cleanedJsonString = responseText.replace(/^```json\s*/i, '').replace(/\s*
```$/, '');
        
        const mcqData = JSON.parse(cleanedJsonString);
        res.json(mcqData);
    } catch (error) {
        console.error("Gemini Generation Error:", error);
        res.status(500).json({ error: 'Failed to process AI generated content structure.' });
    }
});

// 3. Save History Endpoint
app.post('/api/save-history', (req, res) => {
    try {
        const newRecord = req.body;
        const fileData = fs.readFileSync(DATA_FILE, 'utf8');
        const history = JSON.parse(fileData);
        
        history.unshift(newRecord);
        fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2));
        
        res.json({ success: true, history });
    } catch (error) {
        console.error("Save History Error:", error);
        res.status(500).json({ error: 'Failed to write history data' });
    }
});

// 4. Fetch History Endpoint
app.get('/api/history', (req, res) => {
    try {
        const fileData = fs.readFileSync(DATA_FILE, 'utf8');
        res.json(JSON.parse(fileData));
    } catch (error) {
        console.error("Fetch History Error:", error);
        res.status(500).json({ error: 'Failed to read history records' });
    }
});

app.listen(PORT, () => {
    console.log(`Server executing seamlessly on port ${PORT}`);
});
