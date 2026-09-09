// French News Listening Practice App - Frontend JavaScript

// Global state
let currentSessionId = null;
let currentLevel = 'B2';
let currentCategory = 'World';
let audioDuration = 0;

// DOM Elements
const steps = {
    selection: document.getElementById('step-selection'),
    loading: document.getElementById('step-loading'),
    listening: document.getElementById('step-listening'),
    mcq1: document.getElementById('step-mcq1'),
    transcript: document.getElementById('step-transcript'),
    mcq2: document.getElementById('step-mcq2'),
    practice: document.getElementById('step-practice'),
    dictation: document.getElementById('step-dictation'),
    complete: document.getElementById('step-complete')
};

// Show a specific step, hide others
function showStep(stepName) {
    Object.keys(steps).forEach(key => {
        if (key === stepName) {
            steps[key].classList.remove('d-none');
        } else {
            steps[key].classList.add('d-none');
        }
    });
}

// Get selected level
function getSelectedLevel() {
    const selected = document.querySelector('input[name="level"]:checked');
    return selected ? selected.value : 'B2';
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners
    document.getElementById('btn-get-news').addEventListener('click', handleGetNews);
    document.getElementById('btn-play-audio').addEventListener('click', handlePlayAudio);
    document.getElementById('btn-mcq1-next').addEventListener('click', () => goToStep('transcript'));
    document.getElementById('btn-transcript-next').addEventListener('click', loadMCQ2);
    document.getElementById('btn-mcq2-next').addEventListener('click', loadPractice);
    document.getElementById('btn-practice-next').addEventListener('click', loadDictation);
    document.getElementById('btn-dictation-finish').addEventListener('click', showCompletion);
    document.getElementById('btn-restart').addEventListener('click', restartApp);

    // Audio event listeners
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.addEventListener('ended', handleAudioEnded);
    
    const transcriptAudio = document.getElementById('transcript-audio');
    transcriptAudio.addEventListener('timeupdate', handleTranscriptTimeUpdate);
    transcriptAudio.addEventListener('ended', () => {
        document.getElementById('btn-transcript-next').classList.remove('d-none');
    });
});

// Handle "Get News" button click
async function handleGetNews() {
    currentLevel = getSelectedLevel();
    currentCategory = document.getElementById('category-select').value;

    showStep('loading');

    try {
        const response = await fetch(`/api/news?level=${currentLevel}&category=${encodeURIComponent(currentCategory)}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch news');
        }

        const data = await response.json();
        currentSessionId = data.session_id;
        audioDuration = data.estimated_duration || 60;

        // Set up listening screen
        document.getElementById('listening-title').textContent = data.title || 'News Article';
        document.getElementById('audio-player').querySelector('source').src = data.audio_url;
        document.getElementById('audio-player').load();

        showStep('listening');
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load news. Please check your API keys and try again.');
        showStep('selection');
    }
}

// Handle play audio button
function handlePlayAudio() {
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.play();
    document.getElementById('btn-play-audio').classList.add('d-none');
}

// Handle audio ended
function handleAudioEnded() {
    document.getElementById('listening-complete-msg').classList.remove('d-none');
    setTimeout(() => {
        loadMCQ1();
    }, 1500);
}

// Load first MCQ
async function loadMCQ1() {
    showStep('mcq1');

    try {
        const response = await fetch(`/api/question/${currentSessionId}/0`);
        const data = await response.json();

        document.getElementById('mcq1-question').textContent = data.question;
        
        const optionsContainer = document.getElementById('mcq1-options');
        optionsContainer.innerHTML = '';

        data.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'list-group-item list-group-item-action';
            button.textContent = option;
            button.dataset.index = index;
            button.addEventListener('click', () => handleMCQSelection(1, index, data.correct));
            optionsContainer.appendChild(button);
        });
    } catch (error) {
        console.error('Error loading MCQ1:', error);
    }
}

// Handle MCQ selection
async function handleMCQSelection(mcqNumber, selectedIndex, correctIndex) {
    const feedbackEl = document.getElementById(`mcq${mcqNumber}-feedback`);
    const nextBtn = document.getElementById(`btn-mcq${mcqNumber}-next`);
    const optionsContainer = document.getElementById(`mcq${mcqNumber}-options`);
    
    // Disable all options
    const options = optionsContainer.querySelectorAll('.list-group-item');
    options.forEach(opt => opt.style.pointerEvents = 'none');

    // Check answer
    const response = await fetch('/api/check_mcq', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            session_id: currentSessionId,
            q_index: mcqNumber - 1,
            selected_option: selectedIndex
        })
    });

    const result = await response.json();
    const isCorrect = result.correct;

    // Highlight selected option
    options[selectedIndex].classList.add(isCorrect ? 'correct' : 'incorrect');
    
    // Show correct answer if wrong
    if (!isCorrect) {
        options[correctIndex].classList.add('correct');
    }

    // Show feedback
    feedbackEl.classList.remove('d-none', 'alert-success', 'alert-danger');
    feedbackEl.classList.add(isCorrect ? 'alert-success' : 'alert-danger');
    feedbackEl.textContent = isCorrect ? '✅ Correct!' : `❌ Incorrect. The correct answer was: ${options[correctIndex].textContent}`;

    // Enable next button
    nextBtn.classList.remove('d-none');
    nextBtn.disabled = false;
}

// Load second MCQ
async function loadMCQ2() {
    showStep('mcq2');

    try {
        const response = await fetch(`/api/question/${currentSessionId}/1`);
        const data = await response.json();

        document.getElementById('mcq2-question').textContent = data.question;
        
        const optionsContainer = document.getElementById('mcq2-options');
        optionsContainer.innerHTML = '';

        data.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'list-group-item list-group-item-action';
            button.textContent = option;
            button.dataset.index = index;
            button.addEventListener('click', () => handleMCQSelection(2, index, data.correct));
            optionsContainer.appendChild(button);
        });
    } catch (error) {
        console.error('Error loading MCQ2:', error);
    }
}

// Load transcript with word highlighting
async function loadTranscript() {
    try {
        const response = await fetch(`/api/transcript/${currentSessionId}`);
        const data = await response.json();

        const transcriptContainer = document.getElementById('transcript-text');
        transcriptContainer.innerHTML = '';

        // Create word spans for highlighting
        data.word_timings.forEach((wordData, index) => {
            const span = document.createElement('span');
            span.className = 'transcript-word';
            span.textContent = wordData.word + ' ';
            span.dataset.startTime = wordData.start;
            span.dataset.index = index;
            span.addEventListener('click', () => {
                const transcriptAudio = document.getElementById('transcript-audio');
                transcriptAudio.currentTime = wordData.start;
                transcriptAudio.play();
            });
            transcriptContainer.appendChild(span);
        });

        // Set up audio
        const transcriptAudio = document.getElementById('transcript-audio');
        transcriptAudio.querySelector('source').src = `/static/audio/${currentSessionId}_full.mp3`;
        transcriptAudio.load();

        // Reset word states
        const words = transcriptContainer.querySelectorAll('.transcript-word');
        words.forEach(w => {
            w.classList.remove('active', 'played');
        });

        showStep('transcript');
    } catch (error) {
        console.error('Error loading transcript:', error);
    }
}

// Handle transcript time update for word highlighting
function handleTranscriptTimeUpdate() {
    const transcriptAudio = document.getElementById('transcript-audio');
    const currentTime = transcriptAudio.currentTime;
    const words = document.querySelectorAll('#transcript-text .transcript-word');

    let currentWordIndex = 0;
    words.forEach((word, index) => {
        const startTime = parseFloat(word.dataset.startTime);
        if (currentTime >= startTime) {
            currentWordIndex = index;
        }
    });

    // Update word classes
    words.forEach((word, index) => {
        word.classList.remove('active');
        if (index < currentWordIndex) {
            word.classList.add('played');
        } else if (index === currentWordIndex) {
            word.classList.add('active');
            word.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

// Go to transcript step (called from MCQ1 next button)
function goToStep(stepName) {
    if (stepName === 'transcript') {
        loadTranscript();
    }
}

// Load practice section
async function loadPractice() {
    showStep('practice');

    try {
        const response = await fetch(`/api/practice/${currentSessionId}`);
        const data = await response.json();

        const container = document.getElementById('practice-items');
        container.innerHTML = '';

        data.vocab.forEach((word, index) => {
            const item = document.createElement('div');
            item.className = 'practice-item';
            item.innerHTML = `
                <div class="practice-word">${word}</div>
                <textarea class="form-control" rows="2" placeholder="Write your sentence here using '${word}'..."></textarea>
                <button class="btn btn-sm btn-outline-secondary mt-2" onclick="showSampleAnswer(this, '${word.replace(/'/g, "\\'")}')">
                    Show Sample Answer
                </button>
                <div class="sample-answer mt-2 d-none text-muted fst-italic"></div>
            `;
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading practice:', error);
    }
}

// Show sample answer for practice item
window.showSampleAnswer = function(button, word) {
    const sampleDiv = button.nextElementSibling;
    if (sampleDiv.classList.contains('d-none')) {
        sampleDiv.textContent = `Exemple: J'ai utilisé le mot "${word}" dans une phrase pour pratiquer mon français.`;
        sampleDiv.classList.remove('d-none');
        button.textContent = 'Hide Sample Answer';
    } else {
        sampleDiv.classList.add('d-none');
        button.textContent = 'Show Sample Answer';
    }
};

// Load dictation section
async function loadDictation() {
    showStep('dictation');

    try {
        const response = await fetch(`/api/dictation/${currentSessionId}`);
        const data = await response.json();

        const container = document.getElementById('dictation-items');
        container.innerHTML = '';

        data.sentences.forEach((sentence, index) => {
            const item = document.createElement('div');
            item.className = 'dictation-item';
            item.innerHTML = `
                <div class="mb-2">
                    <strong>Sentence ${index + 1}:</strong>
                    <audio controls class="ms-2">
                        <source src="${sentence.audio_url}" type="audio/mpeg">
                    </audio>
                </div>
                <input type="text" class="form-control dictation-input" data-index="${index}" placeholder="Type what you hear...">
                <button class="btn btn-primary mt-2" onclick="checkDictation(${index})">Check Answer</button>
                <div class="dictation-feedback d-none" id="dictation-feedback-${index}"></div>
            `;
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading dictation:', error);
    }
}

// Check dictation answer
window.checkDictation = async function(sentenceIndex) {
    const input = document.querySelector(`.dictation-input[data-index="${sentenceIndex}"]`);
    const feedbackEl = document.getElementById(`dictation-feedback-${sentenceIndex}`);
    const userInput = input.value.trim();

    if (!userInput) {
        alert('Please type something first!');
        return;
    }

    try {
        const response = await fetch('/api/check_dictation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                sentence_index: sentenceIndex,
                user_input: userInput
            })
        });

        const result = await response.json();

        feedbackEl.classList.remove('d-none', 'correct', 'incorrect');
        
        if (result.correct) {
            feedbackEl.classList.add('correct');
            feedbackEl.textContent = '✅ Perfect!';
        } else if (result.is_close) {
            feedbackEl.classList.add('correct');
            feedbackEl.textContent = `✅ Close enough! Correct answer: "${result.correct_text}"`;
        } else {
            feedbackEl.classList.add('incorrect');
            feedbackEl.textContent = `❌ Correct answer: "${result.correct_text}"`;
        }
    } catch (error) {
        console.error('Error checking dictation:', error);
    }
};

// Show completion screen
function showCompletion() {
    showStep('complete');
}

// Restart the app
function restartApp() {
    currentSessionId = null;
    
    // Reset all UI elements
    document.getElementById('audio-player').pause();
    document.getElementById('transcript-audio').pause();
    document.getElementById('listening-complete-msg').classList.add('d-none');
    document.getElementById('btn-play-audio').classList.remove('d-none');
    document.getElementById('btn-mcq1-next').classList.add('d-none');
    document.getElementById('btn-mcq2-next').classList.add('d-none');
    document.getElementById('btn-transcript-next').classList.add('d-none');
    
    // Clear MCQ selections
    document.querySelectorAll('#mcq1-options .list-group-item, #mcq2-options .list-group-item').forEach(el => {
        el.classList.remove('selected', 'correct', 'incorrect');
    });
    document.querySelectorAll('#mcq1-feedback, #mcq2-feedback').forEach(el => {
        el.classList.add('d-none');
    });

    showStep('selection');
}
