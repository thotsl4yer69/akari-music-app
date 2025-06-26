import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/genai';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import util from 'util';
import path from 'path';

// --- Configuration ---
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// --- Vercel Deployment Fix for Google Cloud Credentials ---
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    const credentialsPath = path.join(os.tmpdir(), 'gcloud-credentials.json');
    fs.writeFileSync(credentialsPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    console.log('Successfully created temporary credentials file for Vercel.');
  } catch (error) {
    console.error('Failed to write temporary credentials file:', error);
  }
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Vercel Path Correction for Static Files ---
// Instead of __dirname, we use process.cwd() which correctly points
// to the project root in Vercel's environment.
const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));


// --- Create and serve static audio files from a temporary directory ---
const audioDir = path.join(os.tmpdir(), 'akari_audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}
app.use('/audio', express.static(audioDir));


// --- Google AI Clients ---
let genAI;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
  console.error("GEMINI_API_KEY not found. Text generation will fail.");
}
const ttsClient = new TextToSpeechClient();


// --- API Endpoints ---
app.post('/api/generate-prompt', async (req, res) => {
    if (!genAI) return res.status(500).json({ error: 'Gemini AI client not initialized.' });
    try {
        const { mood, style } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const instruction = `Create a short, calming, descriptive paragraph for a yoga class. The mood is '${mood}' and the theme is '${style}'. The text will be read by an AI voice. Keep it to 2-3 sentences.`;
        const result = await model.generateContent(instruction);
        const detailedPrompt = result.response.text();
        console.log("Generated Descriptive Text:", detailedPrompt);
        res.json({ prompt: detailedPrompt });
    } catch (error) {
        console.error("Error in /api/generate-prompt:", error);
        res.status(500).json({ error: 'Failed to generate prompt.' });
    }
});

app.post('/api/generate-audio', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt text is required.' });
        
        console.log("Generating speech for prompt:", prompt);
        const [response] = await ttsClient.synthesizeSpeech({
            input: { text: prompt },
            voice: { languageCode: 'en-US', name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' },
            audioConfig: { audioEncoding: 'MP3' },
        });
        
        const filename = `akari_audio_${Date.now()}.mp3`;
        const filePath = path.join(audioDir, filename);
        await util.promisify(fs.writeFile)(filePath, response.audioContent, 'binary');
        
        console.log(`Audio content written to file: ${filename}`);
        res.json({ audioUrl: `/audio/${filename}` });
    } catch (error) {
        console.error("Error in /api/generate-audio:", error);
        res.status(500).json({ error: 'Failed to generate audio.' });
    }
});

// Serve the main index.html file for any other request
app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Akari Yoga backend server listening on port ${port}`);
});
