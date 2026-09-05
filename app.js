/**
 * EchoScribe — On-Device Speech-to-Text & Speech-to-Speech PWA
 * Alternative to WhisperFlow
 *
 * Features:
 *   - Speech to Text (STT) mode
 *   - Speech to Speech (S2S) mode with translation + TTS playback
 *   - Three STT engines:
 *     1. Built-in (Web Speech API) — real-time, on-device on supported browsers
 *     2. Whisper WASM — OpenAI Whisper in-browser via transformers.js, fully offline
 *     3. Custom API — user-provided endpoint (OpenAI-compatible, Azure, or custom)
 *   - Audio recording with MediaRecorder, replay support
 *   - Translation via LibreTranslate / Google (free) or custom API
 *   - Text-to-Speech via built-in Web Speech or custom TTS API
 *   - PWA: installable, offline-capable
 *   - All settings stored in localStorage (API keys never sent anywhere except the user's API)
 */

const App = {
    recognition: null,
    isRecording: false,
    mode: 'stt',
    engine: 'webspeech',
    selectedModel: 'base',
    whisperPipeline: null,
    mediaRecorder: null,
    audioChunks: [],
    recordedBlob: null,
    recordedAudioUrl: null,
    audioPlayer: null,
    startTime: null,
    durationTimer: null,
    finalTranscript: '',
    interimText: '',
    translatedText: '',
    deferredPrompt: null,
    voices: [],
    currentUtterance: null,
    el: {},

    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadSettings();
        this.checkSupport();
        this.loadVoices();
        this.registerServiceWorker();
        this.setupInstallPrompt();
    },

    cacheElements() {
        const ids = ['micButton','micHint','statusBadge','statusText','langSelect','engineSelect','targetLangSelect','targetLangGroup','voiceBar','voiceSelect','rateRange','rateVal','pitchRange','pitchVal','transcriptArea','translationArea','translationSection','transcriptTitle','translationTitle','wordCount','charCount','durationDisplay','engineLabel','privacyLabel','continuousMode','interimResults','autoPunctuate','copyBtn','downloadBtn','clearBtn','replayBtn','speakBtn','stopSpeakBtn','speakTransBtn','copyTransBtn','modeSTT','modeS2S','settingsBtn','settingsModal','settingsClose','apiUrl','apiKey','apiFormat','apiModel','testApiBtn','transApiUrl','transApiKey','transProvider','ttsEngine','customTtsConfig','ttsApiUrl','ttsApiKey','defaultWhisperModel','toast','installBanner','installBtn','installDismiss'];
        ids.forEach(id => this.el[id] = document.getElementById(id));
        this.el.statusText = document.querySelector('.status-text');
    },

    bindEvents() {
        this.el.micButton.addEventListener('click', () => this.toggleRecording());
        this.el.modeSTT.addEventListener('click', () => this.setMode('stt'));
        this.el.modeS2S.addEventListener('click', () => this.setMode('s2s'));
        this.el.engineSelect.addEventListener('change', (e) => { this.engine = e.target.value; this.updateEngineLabel(); });
        this.el.settingsBtn.addEventListener('click', () => this.el.settingsModal.style.display = 'flex');
        this.el.settingsClose.addEventListener('click', () => this.el.settingsModal.style.display = 'none');
        this.el.settingsModal.addEventListener('click', (e) => { if (e.target === this.el.settingsModal) this.el.settingsModal.style.display = 'none'; });
        this.el.ttsEngine.addEventListener('change', (e) => { this.el.customTtsConfig.style.display = e.target.value === 'custom' ? 'block' : 'none'; });
        this.el.testApiBtn.addEventListener('click', () => this.testCustomApi());
        this.el.rateRange.addEventListener('input', (e) => this.el.rateVal.textContent = parseFloat(e.target.value).toFixed(1) + 'x');
        this.el.pitchRange.addEventListener('input', (e) => this.el.pitchVal.textContent = parseFloat(e.target.value).toFixed(1));
        this.el.copyBtn.addEventListener('click', () => this.copyText(this.el.transcriptArea, 'transcript'));
        this.el.downloadBtn.addEventListener('click', () => this.downloadTranscript());
        this.el.clearBtn.addEventListener('click', () => this.clearAll());
        this.el.replayBtn.addEventListener('click', () => this.replayAudio());
        this.el.speakBtn.addEventListener('click', () => this.speakText(this.el.transcriptArea.innerText));
        this.el.stopSpeakBtn.addEventListener('click', () => this.stopSpeaking());
        this.el.speakTransBtn.addEventListener('click', () => this.speakText(this.el.translationArea.innerText));
        this.el.copyTransBtn.addEventListener('click', () => this.copyText(this.el.translationArea, 'translation'));
        this.el.transcriptArea.addEventListener('input', () => this.updateStats());
        this.el.transcriptArea.addEventListener('focus', () => { const ph = this.el.transcriptArea.querySelector('.placeholder'); if (ph) ph.remove(); });
        this.el.installBtn.addEventListener('click', () => this.triggerInstall());
        this.el.installDismiss.addEventListener('click', () => this.el.installBanner.style.display = 'none');
        document.addEventListener('keydown', (e) => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); this.toggleRecording(); } });
        if ('speechSynthesis' in window) { speechSynthesis.onvoiceschanged = () => this.loadVoices(); }
    },

    setMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        if (mode === 'stt') { this.el.modeSTT.classList.add('active'); this.el.transcriptTitle.textContent = 'Transcript'; }
        else { this.el.modeS2S.classList.add('active'); this.el.transcriptTitle.textContent = 'Original (Transcribed)'; }
        document.querySelectorAll('.s2s-only').forEach(el => { el.style.display = mode === 's2s' ? '' : 'none'; });
        this.el.transcriptArea.querySelector('.placeholder')?.remove();
        if (mode === 's2s') { if (!this.el.transcriptArea.innerText.trim()) this.el.transcriptArea.innerHTML = '<p class="placeholder">Speak — your words appear here, then get translated and spoken back.</p>'; }
        else { if (!this.el.transcriptArea.innerText.trim() || this.el.transcriptArea.innerText.includes('get translated')) this.el.transcriptArea.innerHTML = '<p class="placeholder">Your transcript will appear here. Tap the microphone and start speaking.</p>'; }
    },

    updateEngineLabel() {
        const labels = { webspeech: 'Web Speech', whisper: 'Whisper WASM', custom: 'Custom API' };
        const privacy = { webspeech: 'On-Device', whisper: '100% Local', custom: 'via API' };
        this.el.engineLabel.textContent = labels[this.engine] || 'Web Speech';
        this.el.privacyLabel.textContent = privacy[this.engine] || 'On-Device';
    },

    toggleRecording() { if (this.isRecording) this.stopRecording(); else this.startRecording(); },

    startRecording() {
        const engine = this.el.engineSelect.value;
        if (engine === 'whisper' || engine === 'custom') this.recordAudio(engine);
        else this.startWebSpeech();
    },

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') { this.mediaRecorder.stop(); return; }
        if (this.recognition) { this.isRecording = false; this.recognition.stop(); this.updateUI(); this.stopDurationTimer(); }
    },

    startWebSpeech() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { this.showToast('Web Speech not supported. Switch to Whisper or Custom API.'); return; }
        this.recognition = new SR();
        this.recognition.lang = this.el.langSelect.value;
        this.recognition.continuous = this.el.continuousMode.checked;
        this.recognition.interimResults = this.el.interimResults.checked;
        const ph = this.el.transcriptArea.querySelector('.placeholder'); if (ph) ph.remove();
        let currentFinal = this.finalTranscript;
        this.recognition.onstart = () => { this.isRecording = true; this.updateUI(); this.startDurationTimer(); };
        this.recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) { let text = t; if (this.el.autoPunctuate.checked) text = this.autoPunctuateText(text); currentFinal += text + ' '; this.finalTranscript = currentFinal; }
                else interim += t;
            }
            this.interimText = interim; this.renderTranscript(currentFinal, interim);
        };
        this.recognition.onerror = (event) => {
            if (event.error === 'no-speech' || event.error === 'aborted') return;
            if (event.error === 'not-allowed') this.showToast('Microphone access denied. Allow mic permissions.');
            else this.showToast('Error: ' + event.error);
        };
        this.recognition.onend = () => {
            if (this.isRecording && this.el.continuousMode.checked) { try { this.recognition.start(); } catch (e) {} }
            else { this.isRecording = false; this.updateUI(); this.stopDurationTimer(); this.renderTranscript(this.finalTranscript, ''); if (this.mode === 's2s' && this.finalTranscript) this.doS2S(this.finalTranscript); }
        };
        try { this.recognition.start(); } catch (e) { this.showToast('Could not start. Try again.'); }
    },

    recordAudio(engine) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.audioChunks.push(e.data); };
            this.mediaRecorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                if (this.recordedAudioUrl) URL.revokeObjectURL(this.recordedAudioUrl);
                this.recordedAudioUrl = URL.createObjectURL(this.recordedBlob);
                this.el.replayBtn.style.display = '';
                this.isRecording = false; this.updateUI(); this.stopDurationTimer();
                if (engine === 'whisper') this.processWithWhisper(); else this.processWithCustomApi();
            };
            this.mediaRecorder.start(); this.isRecording = true; this.updateUI(); this.startDurationTimer();
            this.el.micHint.textContent = 'Recording... Tap to stop & transcribe';
        }).catch(err => { this.showToast('Microphone access denied.'); console.error(err); });
    },

    async processWithWhisper() {
        this.setStatus('transcribing', 'Transcribing with Whisper...');
        try {
            if (!window.transformers) await this.loadTransformersJS();
            const { pipeline } = window.transformers;
            const modelId = 'Xenova/whisper-' + this.el.defaultWhisperModel.value;
            if (!this.whisperPipeline || this.whisperPipeline.modelId !== modelId) {
                this.showToast('Loading Whisper model (first time downloads ~' + this.getModelSize(this.el.defaultWhisperModel.value) + ')...');
                this.whisperPipeline = await pipeline('automatic-speech-recognition', modelId);
                this.whisperPipeline.modelId = modelId;
            }
            const arrayBuffer = await this.recordedBlob.arrayBuffer();
            const audioCtx = new AudioContext({ sampleRate: 16000 });
            const decoded = await audioCtx.decodeAudioData(arrayBuffer);
            let audio;
            if (decoded.numberOfChannels === 2) { const l = decoded.getChannelData(0), r = decoded.getChannelData(1); audio = new Float32Array(l.length); for (let i = 0; i < l.length; i++) audio[i] = (l[i] + r[i]) / 2; }
            else audio = decoded.getChannelData(0);
            const lang = this.el.langSelect.value.split('-')[0];
            const result = await this.whisperPipeline(audio, { language: lang, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
            const text = result.text || '';
            const ph = this.el.transcriptArea.querySelector('.placeholder'); if (ph) ph.remove();
            this.finalTranscript += text + ' '; this.renderTranscript(this.finalTranscript, '');
            this.setStatus('ready', 'Ready'); this.showToast('Transcription complete!');
            if (this.mode === 's2s' && this.finalTranscript) this.doS2S(this.finalTranscript);
        } catch (err) { console.error('Whisper error:', err); this.showToast('Whisper error: ' + err.message); this.setStatus('ready', 'Ready'); }
    },

    async loadTransformersJS() { return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load transformers.js')); document.head.appendChild(s); }); },
    getModelSize(m) { return { tiny: '40MB', base: '80MB', small: '250MB' }[m] || '80MB'; },

    async processWithCustomApi() {
        const apiUrl = (this.el.apiUrl.value || '').trim();
        const apiKey = (this.el.apiKey.value || '').trim();
        if (!apiUrl) { this.showToast('No API URL configured. Open Settings to add your API endpoint.'); this.setStatus('ready', 'Ready'); return; }
        this.setStatus('transcribing', 'Sending to your API...');
        try {
            const format = this.el.apiFormat.value;
            const lang = this.el.langSelect.value.split('-')[0];
            let response;
            if (format === 'openai') {
                const fd = new FormData();
                fd.append('file', this.recordedBlob, 'audio.webm');
                fd.append('model', this.el.apiModel.value || 'whisper-1');
                fd.append('language', lang);
                const headers = {}; if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
                response = await fetch(apiUrl, { method: 'POST', headers: headers, body: fd });
            } else if (format === 'azure') {
                const headers = { 'Content-Type': 'audio/webm; codec=audio/webm', 'Accept': 'application/json' };
                if (apiKey) headers['Ocp-Apim-Subscription-Key'] = apiKey;
                response = await fetch(apiUrl + '?language=' + lang + '&format=detailed', { method: 'POST', headers: headers, body: this.recordedBlob });
            } else {
                const headers = { 'Content-Type': 'audio/webm' }; if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
                response = await fetch(apiUrl, { method: 'POST', headers: headers, body: this.recordedBlob });
            }
            if (!response.ok) { const e = await response.text(); throw new Error('API returned ' + response.status + ': ' + e.substring(0, 200)); }
            const data = await response.json();
            let text = data.text || data.Transcript || data.transcript || (data.results && data.results[0] && data.results[0].text) || data.DisplayText || JSON.stringify(data);
            const ph = this.el.transcriptArea.querySelector('.placeholder'); if (ph) ph.remove();
            this.finalTranscript += text + ' '; this.renderTranscript(this.finalTranscript, '');
            this.setStatus('ready', 'Ready'); this.showToast('Transcription complete!');
            if (this.mode === 's2s' && this.finalTranscript) this.doS2S(this.finalTranscript);
        } catch (err) { console.error('Custom API error:', err); this.showToast('API error: ' + err.message); this.setStatus('ready', 'Ready'); }
    },

    async testCustomApi() {
        const apiUrl = (this.el.apiUrl.value || '').trim();
        if (!apiUrl) { this.showToast('Enter an API URL first.'); return; }
        this.showToast('API URL saved. Test with actual recording.'); this.saveSettings();
    },

    async doS2S(text) {
        const targetLang = this.el.targetLangSelect.value;
        const sourceLang = this.el.langSelect.value.split('-')[0];
        if (sourceLang === targetLang) { this.el.translationArea.innerHTML = '<span class="final">' + this.escapeHtml(text) + '</span>'; this.translatedText = text; this.speakText(text, targetLang); return; }
        this.setStatus('transcribing', 'Translating...');
        this.el.translationArea.innerHTML = '<p class="placeholder">Translating...</p>';
        try {
            const translated = await this.translateText(text, sourceLang, targetLang);
            const ph = this.el.translationArea.querySelector('.placeholder'); if (ph) ph.remove();
            this.translatedText = translated;
            this.el.translationArea.innerHTML = '<span class="final">' + this.escapeHtml(translated) + '</span>';
            this.setStatus('ready', 'Ready'); this.showToast('Translated! Speaking...');
            this.speakText(translated, targetLang);
        } catch (err) { console.error('Translation error:', err); this.showToast('Translation failed: ' + err.message); this.el.translationArea.innerHTML = '<p class="placeholder">Translation failed. ' + this.escapeHtml(err.message) + '</p>'; this.setStatus('ready', 'Ready'); }
    },

    async translateText(text, source, target) {
        const provider = this.el.transProvider.value;
        const customUrl = (this.el.transApiUrl.value || '').trim();
        const customKey = (this.el.transApiKey.value || '').trim();
        if (provider === 'custom' && customUrl) return await this.translateViaCustom(text, source, target, customUrl, customKey);
        if (provider === 'auto' || provider === 'libre') { try { return await this.translateViaLibre(text, source, target); } catch (e) { if (provider === 'libre') throw e; } }
        if (provider === 'auto' || provider === 'google') { try { return await this.translateViaGoogle(text, source, target); } catch (e) { if (provider === 'google') throw e; } }
        try { return await this.translateViaLibre(text, source, target); } catch (e) { throw new Error('All translation providers failed. Configure a custom API in Settings.'); }
    },

    async translateViaLibre(text, source, target) {
        const resp = await fetch('https://libretranslate.com/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: text, source: source, target: target, format: 'text' }) });
        if (!resp.ok) throw new Error('LibreTranslate returned ' + resp.status);
        const data = await resp.json(); return data.translatedText;
    },

    async translateViaGoogle(text, source, target) {
        const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + source + '&tl=' + target + '&dt=t&q=' + encodeURIComponent(text);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Google Translate returned ' + resp.status);
        const data = await resp.json(); let result = '';
        if (data && data[0]) { for (let i = 0; i < data[0].length; i++) { if (data[0][i] && data[0][i][0]) result += data[0][i][0]; } }
        return result || text;
    },

    async translateViaCustom(text, source, target, url, key) {
        const headers = { 'Content-Type': 'application/json' }; if (key) headers['Authorization'] = 'Bearer ' + key;
        const resp = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify({ q: text, source: source, target: target, format: 'text' }) });
        if (!resp.ok) throw new Error('Custom translation API returned ' + resp.status);
        const data = await resp.json(); return data.translatedText || data.text || data.translation || JSON.stringify(data);
    },

    loadVoices() {
        if (!('speechSynthesis' in window)) return;
        this.voices = speechSynthesis.getVoices();
        const vs = this.el.voiceSelect; if (!vs) return;
        vs.innerHTML = '<option value="">Auto (by language)</option>';
        this.voices.forEach(v => { const o = document.createElement('option'); o.value = v.name; o.textContent = v.name + ' (' + v.lang + ')'; vs.appendChild(o); });
    },

    speakText(text, lang) {
        if (!text || text.includes('Your transcript') || text.includes('Translation will')) return;
        this.stopSpeaking();
        const ttsEngine = this.el.ttsEngine.value;
        if (ttsEngine === 'custom') { this.speakViaCustomApi(text, lang); return; }
        if (!('speechSynthesis' in window)) { this.showToast('Text-to-speech not supported in this browser.'); return; }
        const utter = new SpeechSynthesisUtterance(text);
        const targetLang = lang || this.el.targetLangSelect.value || this.el.langSelect.value;
        const sv = this.el.voiceSelect.value;
        if (sv) { const v = this.voices.find(v => v.name === sv); if (v) utter.voice = v; }
        else { const m = this.voices.find(v => v.lang.startsWith(targetLang)); if (m) utter.voice = m; }
        utter.rate = parseFloat(this.el.rateRange.value) || 1;
        utter.pitch = parseFloat(this.el.pitchRange.value) || 1;
        utter.lang = targetLang;
        utter.onstart = () => { this.setStatus('speaking', 'Speaking...'); this.el.stopSpeakBtn.style.display = ''; };
        utter.onend = () => { this.setStatus('ready', 'Ready'); this.el.stopSpeakBtn.style.display = 'none'; };
        utter.onerror = () => { this.setStatus('ready', 'Ready'); this.el.stopSpeakBtn.style.display = 'none'; };
        this.currentUtterance = utter; speechSynthesis.speak(utter);
    },

    stopSpeaking() { if ('speechSynthesis' in window) speechSynthesis.cancel(); this.setStatus('ready', 'Ready'); this.el.stopSpeakBtn.style.display = 'none'; },

    async speakViaCustomApi(text, lang) {
        const url = (this.el.ttsApiUrl.value || '').trim();
        const key = (this.el.ttsApiKey.value || '').trim();
        if (!url) { this.showToast('No TTS API URL configured. Using built-in.'); this.el.ttsEngine.value = 'builtin'; this.el.customTtsConfig.style.display = 'none'; this.speakText(text, lang); return; }
        try {
            this.setStatus('speaking', 'Generating speech...');
            const headers = { 'Content-Type': 'application/json' }; if (key) headers['Authorization'] = 'Bearer ' + key;
            const resp = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify({ text: text, language: lang, format: 'mp3' }) });
            if (!resp.ok) throw new Error('TTS API returned ' + resp.status);
            const blob = await resp.blob(); const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audio.onended = () => { this.setStatus('ready', 'Ready'); URL.revokeObjectURL(audioUrl); };
            this.setStatus('speaking', 'Speaking...'); audio.play();
        } catch (err) { console.error('TTS API error:', err); this.showToast('TTS API failed: ' + err.message + '. Using built-in.'); this.el.ttsEngine.value = 'builtin'; this.el.customTtsConfig.style.display = 'none'; this.speakText(text, lang); }
    },

    replayAudio() {
        if (!this.recordedAudioUrl) { this.showToast('No recording to replay.'); return; }
        if (this.audioPlayer) this.audioPlayer.pause();
        this.audioPlayer = new Audio(this.recordedAudioUrl); this.audioPlayer.play();
        this.showToast('Replaying recording...');
    },

    renderTranscript(finalText, interim) {
        const ph = this.el.transcriptArea.querySelector('.placeholder'); if (ph) ph.remove();
        let html = '';
        if (finalText) html += '<span class="final">' + this.escapeHtml(finalText) + '</span>';
        if (interim) html += '<span class="interim">' + this.escapeHtml(interim) + '</span>';
        if (!html) html = '<p class="placeholder">Your transcript will appear here. Tap the microphone and start speaking.</p>';
        this.el.transcriptArea.innerHTML = html; this.updateStats();
        this.el.transcriptArea.scrollTop = this.el.transcriptArea.scrollHeight;
        if (finalText) this.el.speakBtn.style.display = '';
    },

    updateUI() {
        if (this.isRecording) {
            this.el.micButton.classList.add('recording'); this.el.micButton.classList.remove('transcribing');
            this.el.micButton.querySelector('.mic-icon').style.display = 'none';
            this.el.micButton.querySelector('.stop-icon').style.display = 'block';
            this.el.micHint.textContent = 'Tap to stop'; this.setStatus('listening', 'Listening...');
        } else {
            this.el.micButton.classList.remove('recording', 'transcribing');
            this.el.micButton.querySelector('.mic-icon').style.display = 'block';
            this.el.micButton.querySelector('.stop-icon').style.display = 'none';
            this.el.micHint.textContent = 'Tap to start dictation';
            if (this.el.statusBadge.classList.contains('transcribing')) return;
            this.setStatus('ready', 'Ready');
        }
    },

    setStatus(cls, text) { this.el.statusBadge.classList.remove('listening', 'ready', 'transcribing', 'speaking'); this.el.statusBadge.classList.add(cls); this.el.statusText.textContent = text; },

    updateStats() {
        const text = this.finalTranscript || this.el.transcriptArea.innerText || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        this.el.wordCount.textContent = words + ' word' + (words !== 1 ? 's' : '');
        this.el.charCount.textContent = text.length;
    },

    copyText(area, label) {
        const text = area.innerText;
        if (!text || text.includes('Your transcript') || text.includes('Translation will')) { this.showToast('Nothing to copy yet.'); return; }
        navigator.clipboard.writeText(text).then(() => this.showToast('Copied ' + label + '!')).catch(() => this.showToast('Could not copy.'));
    },

    downloadTranscript() {
        let text = this.finalTranscript || this.el.transcriptArea.innerText;
        if (!text || text.includes('Your transcript')) { this.showToast('Nothing to download.'); return; }
        if (this.mode === 's2s' && this.translatedText) text = '=== Original ===\n' + this.finalTranscript + '\n\n=== Translation ===\n' + this.translatedText;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = 'echoscribe-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.txt';
        a.click(); URL.revokeObjectURL(url); this.showToast('Downloaded!');
    },

    clearAll() {
        this.finalTranscript = ''; this.interimText = ''; this.translatedText = '';
        this.renderTranscript('', '');
        if (this.el.translationArea) this.el.translationArea.innerHTML = '<p class="placeholder">Translation will appear here after speaking.</p>';
        this.el.durationDisplay.textContent = '00:00';
        this.el.replayBtn.style.display = 'none'; this.el.speakBtn.style.display = 'none';
        if (this.recordedAudioUrl) { URL.revokeObjectURL(this.recordedAudioUrl); this.recordedAudioUrl = null; }
        this.showToast('Cleared.');
    },

    autoPunctuateText(text) { let r = text.trim(); if (!r) return r; r = r.charAt(0).toUpperCase() + r.slice(1); if (!/[.!?]$/.test(r)) r += '.'; return r; },
    escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; },
    showToast(msg) { this.el.toast.textContent = msg; this.el.toast.classList.add('show'); clearTimeout(this._toastTimer); this._toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), 3000); },

    saveSettings() {
        const s = { apiUrl: this.el.apiUrl.value, apiKey: this.el.apiKey.value, apiFormat: this.el.apiFormat.value, apiModel: this.el.apiModel.value, transApiUrl: this.el.transApiUrl.value, transApiKey: this.el.transApiKey.value, transProvider: this.el.transProvider.value, ttsEngine: this.el.ttsEngine.value, ttsApiUrl: this.el.ttsApiUrl.value, ttsApiKey: this.el.ttsApiKey.value, defaultWhisperModel: this.el.defaultWhisperModel.value, engine: this.el.engineSelect.value, lang: this.el.langSelect.value, targetLang: this.el.targetLangSelect.value };
        localStorage.setItem('echoscribe_settings', JSON.stringify(s));
    },

    loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem('echoscribe_settings') || '{}');
            if (s.apiUrl) this.el.apiUrl.value = s.apiUrl; if (s.apiKey) this.el.apiKey.value = s.apiKey;
            if (s.apiFormat) this.el.apiFormat.value = s.apiFormat; if (s.apiModel) this.el.apiModel.value = s.apiModel;
            if (s.transApiUrl) this.el.transApiUrl.value = s.transApiUrl; if (s.transApiKey) this.el.transApiKey.value = s.transApiKey;
            if (s.transProvider) this.el.transProvider.value = s.transProvider;
            if (s.ttsEngine) this.el.ttsEngine.value = s.ttsEngine; if (s.ttsApiUrl) this.el.ttsApiUrl.value = s.ttsApiUrl; if (s.ttsApiKey) this.el.ttsApiKey.value = s.ttsApiKey;
            if (s.defaultWhisperModel) this.el.defaultWhisperModel.value = s.defaultWhisperModel;
            if (s.engine) { this.el.engineSelect.value = s.engine; this.engine = s.engine; }
            if (s.lang) this.el.langSelect.value = s.lang; if (s.targetLang) this.el.targetLangSelect.value = s.targetLang;
            if (s.ttsEngine === 'custom') this.el.customTtsConfig.style.display = 'block';
        } catch (e) { console.warn('Could not load settings:', e); }
        ['apiUrl','apiKey','apiFormat','apiModel','transApiUrl','transApiKey','transProvider','ttsEngine','ttsApiUrl','ttsApiKey','defaultWhisperModel','engineSelect','langSelect','targetLangSelect'].forEach(id => { const el = this.el[id]; if (el) el.addEventListener('change', () => this.saveSettings()); });
        this.updateEngineLabel();
    },

    checkSupport() { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { this.el.engineSelect.value = 'whisper'; this.engine = 'whisper'; this.updateEngineLabel(); } },
    registerServiceWorker() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(() => console.log('SW registered')).catch(err => console.warn('SW failed:', err)); },
    setupInstallPrompt() { window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.deferredPrompt = e; this.el.installBanner.style.display = 'flex'; }); window.addEventListener('appinstalled', () => { this.el.installBanner.style.display = 'none'; this.deferredPrompt = null; this.showToast('EchoScribe installed!'); }); },
    triggerInstall() { if (this.deferredPrompt) { this.deferredPrompt.prompt(); this.deferredPrompt.userChoice.then(() => { this.el.installBanner.style.display = 'none'; this.deferredPrompt = null; }); } },
};

document.addEventListener('DOMContentLoaded', () => App.init());
