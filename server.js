import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/genai';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration ---
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// ES Module equivalent of __dirname for Vercel's environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Vercel Deployment Fix for Google Cloud Credentials ---
// This block is crucial for Vercel. It checks for the JSON key content
// in the environment variable, writes it to a temporary file, and then
// sets the official GOOGLE_APPLICATION_CREDENTIALS path variable to that file.
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
app.use(cors()); // Allows your frontend to talk to this backend
app.use(express.json()); // Allows the server to understand JSON requests

// Serve the 'public' folder which contains your index.html
app.use(express.static(path.join(__dirname, 'public')));

// --- Create and serve static audio files from a temporary directory ---
const audioDir = path.join(os.tmpdir(), 'akari_audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}
app.use('/audio', express.static(audioDir)); // This makes generated audio accessible via a URL


// --- Google AI Clients ---
let genAI;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
  console.error("GEMINI_API_KEY not found. Text generation will fail.");
}

// The TextToSpeechClient will automatically find the credentials file
// thanks to the Vercel fix block above.
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
        res.json({ audioUrl: `/audio/${filename}` }); // Return the web-accessible URL
    } catch (error) {
        console.error("Error in /api/generate-audio:", error);
        res.status(500).json({ error: 'Failed to generate audio.' });
    }
});

// Serve the main index.html file for any request not caught by the API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Akari Yoga backend server listening on port ${port}`);
});
