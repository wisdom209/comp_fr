# French News Listening Practice App

A web application to help users practice French listening comprehension at CEFR levels A1, A2, B1, and B2 using today's news.

## Features

- **Level Selection**: Choose from A1 (Beginner), A2 (Elementary), B1 (Intermediate), or B2 (Upper Intermediate)
- **Category Selection**: World News, Technology, Sports, Health, Business, Science
- **AI-Powered Content**: Uses Google Gemini API to adapt real news articles to your level
- **Text-to-Speech**: Generates natural French audio using edge-tts
- **Interactive Learning Flow**:
  1. Listen to the news article
  2. Answer comprehension questions (MCQ)
  3. Follow along with highlighted transcript
  4. Practice vocabulary with sentence writing
  5. Dictation exercises

## Tech Stack

- **Backend**: Python 3.10+ with Flask
- **Frontend**: HTML, CSS, JavaScript (Bootstrap 5)
- **AI**: Google Gemini API for content generation
- **TTS**: edge-tts for French speech synthesis
- **Deployment**: Ready for Render hosting

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Up Environment Variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
NEWS_API_KEY=your_newsapi_key_here  # Optional - falls back to demo content if not set
```

**Getting API Keys:**

- **Gemini API Key**: Get a free key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **NewsAPI Key** (optional): Get a free key from [NewsAPI.org](https://newsapi.org/) - without this, the app uses fallback demo content

### 3. Run Locally

```bash
python app.py
```

The app will be available at `http://localhost:5000`

### 4. Deploy to Render

1. Push your code to a GitHub repository
2. Create a new Web Service on Render
3. Connect your repository
4. Add environment variables (`GEMINI_API_KEY`, optionally `NEWS_API_KEY`)
5. Deploy!

Render will automatically use the `Procfile` to start the app with gunicorn.

## Project Structure

```
/
├── app.py                 # Flask backend application
├── requirements.txt       # Python dependencies
├── Procfile              # Render deployment config
├── README.md             # This file
├── templates/
│   └── index.html        # Frontend HTML
└── static/
    ├── css/
    │   └── style.css     # Custom styles
    ├── js/
    │   └── app.js        # Frontend JavaScript
    └── audio/            # Generated audio files (created at runtime)
```

## How It Works

1. **User selects level and category** → Frontend sends request to `/api/news`
2. **Backend fetches news** → Uses NewsAPI or fallback content
3. **Gemini generates content** → Adapts article, creates questions, vocab, dictation sentences
4. **edge-tts generates audio** → Creates MP3 files for full article and dictation sentences
5. **User goes through learning flow** → Listen → Quiz → Transcript → Practice → Dictation
6. **Session cleanup** → Old sessions are removed after 1 hour

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve frontend |
| `/api/news` | GET | Fetch news and generate learning materials |
| `/api/transcript/<session_id>` | GET | Get transcript with word timings |
| `/api/question/<session_id>/<q_index>` | GET | Get MCQ question |
| `/api/practice/<session_id>` | GET | Get vocabulary list |
| `/api/dictation/<session_id>` | GET | Get dictation sentences |
| `/api/check_mcq` | POST | Check MCQ answer |
| `/api/check_dictation` | POST | Check dictation answer |

## Notes

- Audio generation may take 30-60 seconds depending on text length
- Sessions are stored in memory and cleaned up after 1 hour
- Word timing in transcripts is approximate (based on character count)
- The app works without NewsAPI key using fallback content

## License

MIT License - feel free to modify and deploy!
