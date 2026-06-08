import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// 1. Import createRequire to safely mix CommonJS subfiles into our modern ES Module
import { createRequire } from 'module';

dotenv.config();

// 2. Bypass pdf-parse's broken index.js file and pull directly from its internal library file
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Ensure upload cache folder structure exists on startup
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.post('/api/analyze', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const jobDescription = req.body.jobDescription || '';
        const dataBuffer = fs.readFileSync(req.file.path);
        
        let pdfData;
        try {
            pdfData = await pdfParse(dataBuffer);
        } catch (pdfError) {
            console.error('PDF text extraction crashed:', pdfError);
            return res.status(422).json({ error: 'Failed to extract text from the PDF file.' });
        }

        const resumeText = pdfData.text;

        // Cleanup temp file instantly after successful buffer processing
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error removing temporary file:', err);
        });

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Server configuration error: Gemini API Key is missing.' });
        }

        const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
        You are an expert ATS (Applicant Tracking System) and HR manager. Analyze the following resume against the provided job description.
        
        Job Description:
        ${jobDescription}
        
        Resume Text:
        ${resumeText}
        
        Provide the analysis strictly as a valid JSON object matching this schema:
        {
          "matchPercentage": number,
          "keywordAnalysis": {
            "matchedKeywords": ["string"],
            "missingKeywords": ["string"]
          },
          "strengths": ["string"],
          "weaknesses": ["string"],
          "recommendations": ["string"]
        }
        Return ONLY the raw JSON structure, absolutely no wrapping markdown or markdown blocks like \`\`\`json.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        // Standard sanitization buffer in case markdown indicators still creep into the raw stream
        const cleanedJsonString = responseText.replace(/^```json\s*/i, '').replace(/\s*
```$/, '').trim();

        try {
            const jsonOutput = JSON.parse(cleanedJsonString);
            return res.json(jsonOutput);
        } catch (parseError) {
            console.error('AI output did not contain valid JSON:', responseText);
            return res.status(500).json({ error: 'Failed to process AI assessment into standard format.' });
        }

    } catch (error) {
        console.error('Server error encountered:', error);
        return res.status(500).json({ error: 'Internal server processing failure.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Node backend pipeline fully operational on port ${PORT}`);
});
