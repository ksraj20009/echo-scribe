/**
 * EchoScribe — On-Device Speech-to-Text PWA
 * Alternative to WhisperFlow
 *
 * Engines:
 *   1. Web Speech API  — real-time, uses browser's built-in speech recognition
 *   2. Whisper WASM    — loads OpenAI Whisper model in-browser via transformers.js
 *                        (fully offline after model download, processes audio chunks)
 */

const App = {
    // State
    recognition: null,
    isRecording: false,
    engine: 'webspeech',
    selectedModel: 'base',
    whisperPipeline: null,
    mediaRecorder: null,
    audioChunks: [],
    recordedBlob: null,
    startTime: null,
    durationTimer: null,
    finalTranscript: '',
    interimText: '',
    deferredPrompt: null,

    // DOM
    el: {},

    init() {
        this.cacheElements();
        this.bindEvents();
        this.checkSupport();
        this.registerServiceWorker();
        this.setupInstallPrompt();
    },

    cacheElements() {
        this.el = {
            micButton: document.getElementById('micButton'),
            micHint: document.getElementById('micHint'),
            statusBadge: document.getElementById('statusBadge'),
            statusText: document.querySelector('.status-text'),
            langSelect: document.getElementById('langSelect'),
            transcriptArea: document.getElementById('transcriptArea'),
            wordCount: document.getElementById('wordCount'),
            charCount: document.getElementById('charCount'),
            durationDisplay: document.getElementById('durationDisplay'),
            engineLabel: document.getElementById('engineLabel'),
            continuousMode: document.getElementById('continuousMode'),
            interimResults: document.getElementById('interimResults'),
            autoPunctuate: document.getElementById('autoPunctuate'),
            copyBtn: document.getElementById('copyBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
            clearBtn: document.getElementById('clearBtn'),
            engineWebSpeech: document.getElementById('engineWebSpeech'),
            engineWhisper: document.getElementById('engineWhisper'),
            whisperModal: document.getElementById('whisperModal'),
            whisperCancel: document.getElementById('whisperCancel'),
            whisperStart: document.getElementById('whisperStart'),
            whisperProgress: document.getElementById('whisperProgress'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            toast: document.getElementById('toast'),
            installBanner: document.getElementById('installBanner'),
            installBtn: document.getElementById('installBtn'),
            installDismiss: document.getElementById('installDismiss'),
        };
    },

    bindEvents() {
        this.el.micButton.addEventListener('click', () => this.toggleRecording());
        this.el.engineWebSpeech.addEventListener('click', () => this.setEngine('webspeech'));
        this.el.engineWhisper.addEventListener('click', () => this.setEngine('whisper'));
        this.el.whisperCancel.addEventListener('click', () => this.closeWhisperModal());
        this.el.whisperStart.addEventListener('click', () => this.startWhisperRecording());

        document.querySelectorAll('.model-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedModel = btn.dataset.model;
                this.el.whisperStart.disabled = false;
            });
        });

        this.el.copyBtn.addEventListener('click', () => this.copyTranscript());
        this.el.downloadBtn.addEventListener('click', () => this.downloadTranscript());
        this.el.clearBtn.addEventListener('click', () => this.clearTranscript());

        this.el.transcriptArea.addEventListener('input', () => this.updateStats());
        this.el.transcriptArea.addEventListener('focus', () => {
            const ph = this.el.transcriptArea.querySelector('.placeholder');
            if (ph) ph.remove();
        });

        this.el.installBtn.addEventListener('click', () => this.triggerInstall());
        this.el.installDismiss.addEventListener('click', () => {
            this.el.installBanner.style.display = 'none';
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                this.toggleRecording();
            }
        });
    },

    checkSupport() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.showToast('Web Speech API not supported. Use Chrome/Edge, or switch to Whisper engine.');
            this.el.engineWhisper.click();
        }
    },

    setEngine(engine) {
        this.engine = engine;
        document.querySelectorAll('.engine-btn').forEach(b => b.classList.remove('active'));
        if (engine === 'webspeech') {
            this.el.engineWebSpeech.classList.add('active');
            this.el.engineLabel.textContent = 'Web Speech';
        } else {
            this.el.engineWhisper.classList.add('active');
            this.el.engineLabel.textContent = 'Whisper WASM';
        }
    },

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    },

    startRecording() {
        if (this.engine === 'whisper') {
            this.openWhisperModal();
            return;
        }
        this.startWebSpeech();
    },

    // --- Web Speech API Engine ---
    startWebSpeech() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.showToast('Speech recognition not supported. Try Chrome or Edge, or use Whisper engine.');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = this.el.langSelect.value;
        this.recognition.continuous = this.el.continuousMode.checked;
        this.recognition.interimResults = this.el.interimResults.checked;

        const ph = this.el.transcriptArea.querySelector('.placeholder');
        if (ph) ph.remove();

        let currentFinal = this.finalTranscript;

        this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateUI();
            this.startDurationTimer();
        };

        this.recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    let text = transcript;
                    if (this.el.autoPunctuate.checked) {
                        text = this.autoPunctuateText(text);
                    }
                    currentFinal += text + ' ';
                    this.finalTranscript = currentFinal;
                } else {
                    interim += transcript;
                }
            }
            this.interimText = interim;
            this.renderTranscript(currentFinal, interim);
        };

        this.recognition.onerror = (event) => {
            console.error('Recognition error:', event.error);
            if (event.error === 'no-speech') return;
            if (event.error === 'aborted') return;
            if (event.error === 'not-allowed') {
                this.showToast('Microphone access denied. Please allow mic permissions.');
            } else {
                this.showToast('Error: ' + event.error);
            }
        };

        this.recognition.onend = () => {
            if (this.isRecording && this.el.continuousMode.checked) {
                try {
                    this.recognition.start();
                } catch (e) {
                    // already started
                }
            } else {
                this.isRecording = false;
                this.updateUI();
                this.stopDurationTimer();
                this.renderTranscript(this.finalTranscript, '');
            }
        };

        try {
            this.recognition.start();
        } catch (e) {
            console.error(e);
            this.showToast('Could not start recognition. Try again.');
        }
    },

    stopRecording() {
        if (this.engine === 'whisper' && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            return;
        }
        if (this.recognition) {
            this.isRecording = false;
            this.recognition.stop();
            this.updateUI();
            this.stopDurationTimer();
        }
    },

    // --- Whisper WASM Engine ---
    openWhisperModal() {
        this.el.whisperModal.style.display = 'flex';
        const baseBtn = document.querySelector('.model-btn[data-model="base"]');
        if (baseBtn) {
            baseBtn.classList.add('selected');
            this.selectedModel = 'base';
            this.el.whisperStart.disabled = false;
        }
    },

    closeWhisperModal() {
        this.el.whisperModal.style.display = 'none';
        this.el.whisperProgress.style.display = 'none';
    },

    async startWhisperRecording() {
        this.el.whisperProgress.style.display = 'block';
        this.el.progressText.textContent = 'Loading transformers.js library...';
        this.el.progressFill.style.width = '5%';

        try {
            if (!window.transformers) {
                await this.loadTransformersJS();
            }
            const { pipeline } = window.transformers;

            this.el.progressText.textContent = 'Loading Whisper ' + this.selectedModel + ' model (first time downloads ~' + this.getModelSize(this.selectedModel) + ')...';
            this.el.progressFill.style.width = '15%';

            const modelId = 'Xenova/whisper-' + this.selectedModel;
            if (!this.whisperPipeline || this.whisperPipeline.modelId !== modelId) {
                this.whisperPipeline = await pipeline('automatic-speech-recognition', modelId, {
                    progress_callback: (data) => {
                        if (data.status === 'progress') {
                            const pct = Math.round(data.progress || 0);
                            this.el.progressFill.style.width = (15 + pct * 0.7) + '%';
                            this.el.progressText.textContent = 'Downloading model: ' + pct + '%';
                        }
                        if (data.status === 'ready') {
                            this.el.progressFill.style.width = '85%';
                            this.el.progressText.textContent = 'Model loaded! Starting recorder...';
                        }
                    }
                });
                this.whisperPipeline.modelId = modelId;
            }

            this.el.progressFill.style.width = '90%';
            this.el.progressText.textContent = 'Recording... Tap stop when done.';
            this.el.whisperModal.style.display = 'none';
            this.recordAudioForWhisper();

        } catch (err) {
            console.error('Whisper setup error:', err);
            this.el.progressText.textContent = 'Error: ' + err.message;
            this.showToast('Failed to load Whisper engine. Check your connection for first-time download.');
        }
    },

    async loadTransformersJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load transformers.js'));
            document.head.appendChild(script);
        });
    },

    getModelSize(model) {
        const sizes = { tiny: '40MB', base: '80MB', small: '250MB' };
        return sizes[model] || '80MB';
    },

    recordAudioForWhisper() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                this.audioChunks = [];
                this.mediaRecorder = new MediaRecorder(stream);
                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) this.audioChunks.push(e.data);
                };
                this.mediaRecorder.onstop = () => {
                    stream.getTracks().forEach(t => t.stop());
                    this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    this.processWithWhisper();
                };
                this.mediaRecorder.start();
                this.isRecording = true;
                this.updateUI();
                this.startDurationTimer();
                this.showToast('Recording... Tap mic to stop & transcribe.');
            })
            .catch(err => {
                this.showToast('Microphone access denied.');
                console.error(err);
            });
    },

    async processWithWhisper() {
        this.el.statusBadge.classList.remove('listening');
        this.el.statusBadge.classList.add('ready');
        this.el.statusText.textContent = 'Transcribing...';
        this.showToast('Transcribing with Whisper...');

        try {
            const arrayBuffer = await this.recordedBlob.arrayBuffer();
            const audioCtx = new AudioContext({ sampleRate: 16000 });
            const decoded = await audioCtx.decodeAudioData(arrayBuffer);

            let audio;
            if (decoded.numberOfChannels === 2) {
                const left = decoded.getChannelData(0);
                const right = decoded.getChannelData(1);
                audio = new Float32Array(left.length);
                for (let i = 0; i < left.length; i++) {
                    audio[i] = (left[i] + right[i]) / 2;
                }
            } else {
                audio = decoded.getChannelData(0);
            }

            const lang = this.el.langSelect.value.split('-')[0];
            const result = await this.whisperPipeline(audio, {
                language: lang,
                task: 'transcribe',
                chunk_length_s: 30,
                stride_length_s: 5,
            });

            const text = result.text || '';
            const ph = this.el.transcriptArea.querySelector('.placeholder');
            if (ph) ph.remove();

            this.finalTranscript += text + ' ';
            this.renderTranscript(this.finalTranscript, '');
            this.el.statusText.textContent = 'Ready';
            this.showToast('Transcription complete!');
            this.isRecording = false;
            this.updateUI();
            this.stopDurationTimer();

        } catch (err) {
            console.error('Whisper transcription error:', err);
            this.showToast('Transcription failed: ' + err.message);
            this.el.statusText.textContent = 'Ready';
            this.isRecording = false;
            this.updateUI();
            this.stopDurationTimer();
        }
    },

    // --- Rendering & Utilities ---
    renderTranscript(finalText, interim) {
        const ph = this.el.transcriptArea.querySelector('.placeholder');
        if (ph) ph.remove();

        let html = '';
        if (finalText) {
            html += '<span class="final">' + this.escapeHtml(finalText) + '</span>';
        }
        if (interim) {
            html += '<span class="interim">' + this.escapeHtml(interim) + '</span>';
        }
        if (!html) {
            html = '<p class="placeholder">Your transcript will appear here. Tap the microphone and start speaking.</p>';
        }
        this.el.transcriptArea.innerHTML = html;
        this.updateStats();
        this.el.transcriptArea.scrollTop = this.el.transcriptArea.scrollHeight;
    },

    updateUI() {
        if (this.isRecording) {
            this.el.micButton.classList.add('recording');
            this.el.micButton.querySelector('.mic-icon').style.display = 'none';
            this.el.micButton.querySelector('.stop-icon').style.display = 'block';
            this.el.micHint.textContent = 'Tap to stop';
            this.el.statusBadge.classList.remove('ready');
            this.el.statusBadge.classList.add('listening');
            this.el.statusText.textContent = 'Listening...';
        } else {
            this.el.micButton.classList.remove('recording');
            this.el.micButton.querySelector('.mic-icon').style.display = 'block';
            this.el.micButton.querySelector('.stop-icon').style.display = 'none';
            this.el.micHint.textContent = 'Tap to start dictation';
            this.el.statusBadge.classList.remove('listening');
            this.el.statusBadge.classList.add('ready');
            this.el.statusText.textContent = 'Ready';
        }
    },

    updateStats() {
        const text = this.finalTranscript || this.el.transcriptArea.innerText || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        this.el.wordCount.textContent = words + ' word' + (words !== 1 ? 's' : '');
        this.el.charCount.textContent = chars;
    },

    startDurationTimer() {
        this.startTime = Date.now();
        this.durationTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const secs = String(elapsed % 60).padStart(2, '0');
            this.el.durationDisplay.textContent = mins + ':' + secs;
        }, 1000);
    },

    stopDurationTimer() {
        if (this.durationTimer) {
            clearInterval(this.durationTimer);
            this.durationTimer = null;
        }
    },

    copyTranscript() {
        const text = this.finalTranscript || this.el.transcriptArea.innerText;
        if (!text || text.includes('Your transcript will appear')) {
            this.showToast('Nothing to copy yet.');
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Copied to clipboard!');
        }).catch(() => {
            this.showToast('Could not copy.');
        });
    },

    downloadTranscript() {
        const text = this.finalTranscript || this.el.transcriptArea.innerText;
        if (!text || text.includes('Your transcript will appear')) {
            this.showToast('Nothing to download yet.');
            return;
        }
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.download = 'echoscribe-' + ts + '.txt';
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Downloaded!');
    },

    clearTranscript() {
        this.finalTranscript = '';
        this.interimText = '';
        this.renderTranscript('', '');
        this.el.durationDisplay.textContent = '00:00';
        this.showToast('Transcript cleared.');
    },

    autoPunctuateText(text) {
        let result = text.trim();
        if (!result) return result;
        result = result.charAt(0).toUpperCase() + result.slice(1);
        if (!/[.!?]$/.test(result)) {
            result += '.';
        }
        return result;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    showToast(message) {
        this.el.toast.textContent = message;
        this.el.toast.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            this.el.toast.classList.remove('show');
        }, 3000);
    },

    // --- PWA / Service Worker ---
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('Service Worker registered'))
                .catch(err => console.warn('SW registration failed:', err));
        }
    },

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.el.installBanner.style.display = 'flex';
        });

        window.addEventListener('appinstalled', () => {
            this.el.installBanner.style.display = 'none';
            this.deferredPrompt = null;
            this.showToast('EchoScribe installed! Find it on your home screen.');
        });
    },

    triggerInstall() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then(() => {
                this.el.installBanner.style.display = 'none';
                this.deferredPrompt = null;
            });
        }
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());
