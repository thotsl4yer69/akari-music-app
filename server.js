import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/genai';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import dotenv from 'dotenv';
import fs from 'fs';
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

// Middleware
app.use(cors());
app.use(express.json());

// Serve the frontend (index.html)
app.use(express.static(path.join(__dirname, 'public')));


// --- Create and serve static audio files ---
const audioDir = path.join(__dirname, 'music_cache');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir);
}
app.use('/audio', express.static(audioDir));


// --- Google AI Clients ---
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not found in .env file");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const ttsClient = new TextToSpeechClient();


// --- API Endpoints ---

// Endpoint to generate a detailed text prompt
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


// Endpoint to take text and generate audio
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

        // Return the URL path to access the file
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