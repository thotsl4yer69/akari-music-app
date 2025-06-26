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

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Vercel Deployment Fix for Google Cloud Credentials ---
// This block checks if the JSON key is provided as an environment variable,
// writes it to a temporary file, and sets the official environment variable
// to point to that file's path. This is necessary for the Text-to-Speech client.
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const credentialsPath = path.join(os.tmpdir(), 'gcloud-credentials.json');
  fs.writeFileSync(credentialsPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
}


// --- Middleware ---
app.use(cors());
app.use(express.json());

// Serve the frontend (index.html is inside the 'public' folder)
app.use(express.static(path.join(__dirname, 'public')));


// --- Create and serve static audio files ---
const audioDir = path.join(os.tmpdir(), 'akari_audio'); // Use temp directory for serverless environment
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}
app.use('/audio', express.static(audioDir));


// --- Google AI Clients ---
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not found in .env file or environment variables");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const ttsClient = new TextToSpeechClient();


// --- API Endpoints ---

app.post('/api/generate-prompt', async (req, res) => {
    try {
        const { mood, style } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const instruction = `Create a short, calming, descriptive paragraph for a yoga class. The mood should be '${mood}' and the style should incorporate elements of '${style}'. The generated text will be read aloud by an AI voice. Keep the paragraph to about 2-3 sentences.`;

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
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt text is required.' });
        }
        
        console.log("Generating speech for prompt:", prompt);

        const ttsRequest = {
            input: { text: prompt },
            voice: { languageCode: 'en-US', name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await ttsClient.synthesizeSpeech(ttsRequest);
        const writeFile = util.promisify(fs.writeFile);
        
        const filename = `akari_audio_${Date.now()}.mp3`;
        const filePath = path.join(audioDir, filename);

        await writeFile(filePath, response.audioContent, 'binary');
        console.log(`Audio content written to file: ${filename}`);

        res.json({ audioUrl: `/audio/${filename}` });

    } catch (error) {
        console.error("Error in /api/generate-audio:", error);
        res.status(500).json({ error: 'Failed to generate audio.' });
    }
});

// Serve the main index.html file for any other request
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Akari Yoga backend server listening on port ${port}`);
});
