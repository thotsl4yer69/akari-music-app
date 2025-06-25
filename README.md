# Akari Yoga AI Companion

This project is a web application that generates unique, guided audio meditations for yoga classes using Google's generative AI models.

## Features

- **Dynamic Prompt Generation:** Uses the Gemini model to create unique meditation scripts based on user-selected moods and themes.
- **AI-Powered Audio:** Utilizes Google's Text-to-Speech AI to generate a high-quality audio narration of the meditation script.
- **Modern Interface:** A clean, calming, and responsive user interface suitable for a studio environment.

## How to Run Locally

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- A Google AI (Gemini) API Key

### Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd akari-yoga-ai-companion
    ```

2.  **Install dependencies:**
    This command installs all the necessary packages for the server.
    ```bash
    npm install
    ```

3.  **Create Environment File:**
    Create a file named `.env` in the root of the project folder and add your API key:
    ```
    GEMINI_API_KEY="YOUR_API_KEY_HERE"
    ```

4.  **Start the server:**
    This command will start the backend server.
    ```bash
    npm start
    ```

5.  **Open the App:**
    Open your web browser and navigate to `http://localhost:3000`.

## Deployment

This application is designed to be easily deployed to services like Vercel or Render.

1.  Push your code to a GitHub repository.
2.  Connect your repository to your hosting service (e.g., Vercel).
3.  Set the `GEMINI_API_KEY` as an environment variable in the Vercel project settings.
4.  Deploy! Vercel will automatically install dependencies and run the `npm start` command.