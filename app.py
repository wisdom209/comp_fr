import os
import uuid
import json
import asyncio
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import requests
import google.generativeai as genai
import edge_tts
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
NEWS_API_KEY = os.getenv('NEWS_API_KEY')

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("Warning: GEMINI_API_KEY not set. Content generation will fail.")

# In-memory session storage (for demo purposes)
sessions = {}

# Ensure static/audio directory exists
os.makedirs('static/audio', exist_ok=True)

# Hardcoded fallback article in case news API fails
FALLBACK_ARTICLE = {
    "title": "La Technologie et l'Environnement",
    "content": """Les nouvelles technologies jouent un rôle important dans la protection de l'environnement. 
    De nombreuses entreprises développent des solutions innovantes pour réduire la pollution et économiser l'énergie. 
    Par exemple, des panneaux solaires plus efficaces sont maintenant disponibles pour les maisons. 
    Les voitures électriques deviennent aussi plus populaires dans les villes françaises. 
    Ces changements aident à diminuer les émissions de carbone et à améliorer la qualité de l'air. 
    Les scientifiques travaillent également sur des méthodes pour recycler les déchets plastiques. 
    L'intelligence artificielle est utilisée pour optimiser la consommation d'énergie dans les bâtiments. 
    Toutes ces innovations montrent que la technologie peut être utile pour notre planète."""
}

# Categories mapping for NewsAPI (optional)
CATEGORY_MAP = {
    "World": "general",
    "Technology": "technology",
    "Sports": "sports",
    "Health": "health",
    "Business": "business",
    "Science": "science"
}


def fetch_news_article(category):
    """Fetch a news article from NewsAPI or RSS feed."""
    if NEWS_API_KEY:
        try:
            api_category = CATEGORY_MAP.get(category, "general")
            url = "https://newsapi.org/v2/top-headlines"
            params = {
                "country": "fr",
                "category": api_category,
                "apiKey": NEWS_API_KEY,
                "pageSize": 1
            }
            response = requests.get(url, params=params, timeout=10)
            data = response.json()
            
            if data.get("status") == "ok" and data.get("articles"):
                article = data["articles"][0]
                return {
                    "title": article.get("title", "Titre inconnu"),
                    "content": article.get("description", "") + " " + article.get("content", "")
                }
        except Exception as e:
            print(f"NewsAPI error: {e}")
    
    # Fallback to hardcoded article
    return FALLBACK_ARTICLE.copy()


async def generate_audio(text, filepath, voice="fr-FR-DeniseNeural"):
    """Generate audio using edge-tts."""
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(filepath)


def generate_content_with_gemini(raw_article, level):
    """Use Gemini to generate adapted text, questions, vocab, and dictation sentences."""
    prompt = f"""You are a French language teacher. Given the following raw news article (title and content), produce a JSON object with these keys:
- "adapted_text": the article rewritten for a {level} learner (approx. 250-400 words). Use simpler vocabulary and shorter sentences for lower levels, but keep the core meaning.
- "questions": an array of two objects, each with "question" (string), "options" (array of 4 strings), and "correct" (integer 0-3 indicating the correct option index).
- "vocab": an array of 5-7 important words or phrases from the adapted text that are useful for learners.
- "dictation": an array of 3-4 short sentences from the adapted text suitable for dictation practice.

Raw article: 
Title: {raw_article['title']}
Content: {raw_article['content']}

Return ONLY valid JSON. No extra text, no markdown formatting."""

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        
        # Extract JSON from response
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        result = json.loads(response_text)
        return result
    except Exception as e:
        print(f"Gemini API error: {e}")
        # Return minimal fallback structure
        return {
            "adapted_text": "Voici un texte adapté pour le niveau " + level + ". La technologie aide notre environnement. Les panneaux solaires produisent de l'électricité propre. Les voitures électriques réduisent la pollution. Nous devons protéger notre planète pour les générations futures.",
            "questions": [
                {"question": "Que font les panneaux solaires?", "options": ["Produisent de l'électricité", "Font du bruit", "Créent de la pollution", "Consomment de l'eau"], "correct": 0},
                {"question": "Pourquoi utiliser des voitures électriques?", "options": ["Pour faire du sport", "Pour réduire la pollution", "Pour dépenser plus d'argent", "Pour aller moins vite"], "correct": 1}
            ],
            "vocab": ["panneaux solaires", "électricité", "voitures électriques", "pollution", "planète", "générations futures", "environnement"],
            "dictation": [
                "La technologie aide notre environnement.",
                "Les panneaux solaires produisent de l'électricité propre.",
                "Nous devons protéger notre planète."
            ]
        }


@app.route('/')
def index():
    """Serve the main frontend page."""
    return render_template('index.html')


@app.route('/api/news', methods=['GET'])
def get_news():
    """Fetch news and generate learning materials."""
    level = request.args.get('level', 'A1')
    category = request.args.get('category', 'World')
    
    if level not in ['A1', 'A2', 'B1', 'B2']:
        level = 'A1'
    
    # Fetch raw news article
    raw_article = fetch_news_article(category)
    
    # Generate content with Gemini
    generated_content = generate_content_with_gemini(raw_article, level)
    
    # Create session ID
    session_id = str(uuid.uuid4())
    
    # Store session data
    sessions[session_id] = {
        'level': level,
        'category': category,
        'article_title': raw_article['title'],
        'adapted_text': generated_content.get('adapted_text', ''),
        'questions': generated_content.get('questions', []),
        'vocab': generated_content.get('vocab', []),
        'dictation': generated_content.get('dictation', []),
        'created_at': datetime.now()
    }
    
    # Generate audio files asynchronously
    session_data = sessions[session_id]
    adapted_text = session_data['adapted_text']
    
    # Generate full audio
    full_audio_path = f'static/audio/{session_id}_full.mp3'
    asyncio.run(generate_audio(adapted_text, full_audio_path))
    
    # Generate dictation audio files
    dictation_audio_paths = []
    for i, sentence in enumerate(session_data['dictation']):
        dictation_path = f'static/audio/{session_id}_dict_{i}.mp3'
        asyncio.run(generate_audio(sentence, dictation_path))
        dictation_audio_paths.append(dictation_path)
    
    session_data['audio_path'] = full_audio_path
    session_data['dictation_audio_paths'] = dictation_audio_paths
    
    # Calculate approximate word timings for transcript highlighting
    # Simple estimation based on character count
    words = adapted_text.split()
    total_chars = len(adapted_text.replace(' ', ''))
    
    # We'll estimate duration at ~15 chars per second for French speech
    estimated_duration = total_chars / 15.0
    
    word_timings = []
    current_time = 0
    for word in words:
        word_duration = len(word) / 15.0
        word_timings.append({
            'word': word,
            'start': current_time,
            'end': current_time + word_duration
        })
        current_time += word_duration
    
    session_data['word_timings'] = word_timings
    session_data['estimated_duration'] = estimated_duration
    
    return jsonify({
        'session_id': session_id,
        'title': raw_article['title'],
        'adapted_text_preview': adapted_text[:200] + '...' if len(adapted_text) > 200 else adapted_text,
        'audio_url': f'/static/audio/{session_id}_full.mp3',
        'estimated_duration': estimated_duration
    })


@app.route('/api/transcript/<session_id>', methods=['GET'])
def get_transcript(session_id):
    """Get the full transcript with word timings."""
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session_data = sessions[session_id]
    return jsonify({
        'text': session_data['adapted_text'],
        'word_timings': session_data.get('word_timings', [])
    })


@app.route('/api/question/<session_id>/<int:q_index>', methods=['GET'])
def get_question(session_id, q_index):
    """Get a specific comprehension question."""
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session_data = sessions[session_id]
    questions = session_data.get('questions', [])
    
    if q_index < 0 or q_index >= len(questions):
        return jsonify({'error': 'Question not found'}), 404
    
    return jsonify(questions[q_index])


@app.route('/api/practice/<session_id>', methods=['GET'])
def get_practice(session_id):
    """Get vocabulary for practice section."""
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session_data = sessions[session_id]
    return jsonify({
        'vocab': session_data.get('vocab', [])
    })


@app.route('/api/dictation/<session_id>', methods=['GET'])
def get_dictation(session_id):
    """Get dictation sentences and their audio URLs."""
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session_data = sessions[session_id]
    dictation_sentences = session_data.get('dictation', [])
    dictation_audio_paths = session_data.get('dictation_audio_paths', [])
    
    # Build list of sentences with audio URLs
    dictation_data = []
    for i, sentence in enumerate(dictation_sentences):
        audio_url = f'/static/audio/{session_id}_dict_{i}.mp3' if i < len(dictation_audio_paths) else None
        dictation_data.append({
            'sentence_index': i,
            'text': sentence,
            'audio_url': audio_url
        })
    
    return jsonify({
        'sentences': dictation_data
    })


@app.route('/api/check_mcq', methods=['POST'])
def check_mcq():
    """Check MCQ answer."""
    data = request.get_json()
    session_id = data.get('session_id')
    q_index = data.get('q_index')
    selected_option = data.get('selected_option')
    
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session_data = sessions[session_id]
    questions = session_data.get('questions', [])
    
    if q_index < 0 or q_index >= len(questions):
        return jsonify({'error': 'Question not found'}), 404
    
    question = questions[q_index]
    correct_index = question.get('correct', 0)
    is_correct = (selected_option == correct_index)
    
    return jsonify({
        'correct': is_correct,
        'correct_index': correct_index
    })


@app.route('/api/check_dictation', methods=['POST'])
def check_dictation():
    """Check dictation answer."""
    data = request.get_json()
    session_id = data.get('session_id')
    sentence_index = data.get('sentence_index')
    user_input = data.get('user_input', '')
    
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session_data = sessions[session_id]
    dictation_sentences = session_data.get('dictation', [])
    
    if sentence_index < 0 or sentence_index >= len(dictation_sentences):
        return jsonify({'error': 'Sentence not found'}), 404
    
    correct_text = dictation_sentences[sentence_index]
    
    # Normalize both texts for comparison (lowercase, remove extra spaces, punctuation)
    def normalize(text):
        text = text.lower().strip()
        # Remove common punctuation
        for char in '.,!?;:"\'':
            text = text.replace(char, '')
        # Normalize whitespace
        text = ' '.join(text.split())
        return text
    
    normalized_user = normalize(user_input)
    normalized_correct = normalize(correct_text)
    
    # Check if they match (allow some flexibility)
    is_correct = normalized_user == normalized_correct
    
    # If not exact match, check for high similarity
    if not is_correct:
        # Simple word overlap check
        user_words = set(normalized_user.split())
        correct_words = set(normalized_correct.split())
        overlap = len(user_words & correct_words) / max(len(correct_words), 1)
        is_close = overlap > 0.8
    else:
        is_close = True
    
    return jsonify({
        'correct': is_correct,
        'is_close': is_close,
        'correct_text': correct_text
    })


@app.route('/static/audio/<path:filename>')
def serve_audio(filename):
    """Serve audio files from static/audio directory."""
    return send_from_directory('static/audio', filename)


# Cleanup old sessions periodically (simple implementation)
def cleanup_old_sessions():
    """Remove sessions older than 1 hour."""
    now = datetime.now()
    to_remove = []
    for sid, data in sessions.items():
        if 'created_at' in data:
            age = now - data['created_at']
            if age.total_seconds() > 3600:  # 1 hour
                to_remove.append(sid)
    
    for sid in to_remove:
        del sessions[sid]
        # Also remove audio files
        try:
            for f in os.listdir('static/audio'):
                if f.startswith(sid):
                    os.remove(os.path.join('static/audio', f))
        except:
            pass


if __name__ == '__main__':
    app.run(debug=True, port=5000)
