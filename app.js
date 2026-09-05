/** EchoScribe — phone + laptop voice dictation (Wispr Flow alternative) */
const App = {
  recognition: null, isRecording: false, engine: "webspeech", selectedModel: "tiny",
  whisperPipeline: null, mediaRecorder: null, audioChunks: [], startTime: null,
  durationTimer: null, finalTranscript: "", interimText: "", deferredPrompt: null,
  notes: [], vocab: [], el: {},
  fillers: ["um","uh","erm","uhh","umm","hmm","ah","ahh","like","you know","i mean","sort of","kind of","basically","literally","actually"],
  commands: [
    { pattern: /\bnew paragraph\b/gi, replace: "\n\n" },
    { pattern: /\bnew line\b/gi, replace: "\n" },
    { pattern: /\bperiod\b/gi, replace: "." },
    { pattern: /\bfull stop\b/gi, replace: "." },
    { pattern: /\bcomma\b/gi, replace: "," },
    { pattern: /\bquestion mark\b/gi, replace: "?" },
    { pattern: /\bexclamation mark\b/gi, replace: "!" },
    { pattern: /\bcolon\b/gi, replace: ":" },
    { pattern: /\bsemicolon\b/gi, replace: ";" }
  ],
  init() {
    this.cacheElements(); this.loadState(); this.bindEvents(); this.checkSupport();
    this.registerServiceWorker(); this.setupInstallPrompt(); this.renderNotes(); this.renderVocab(); this.syncSettings();
  },
  cacheElements() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      micButton: $("micButton"), micHint: $("micHint"), statusBadge: $("statusBadge"),
      statusText: document.querySelector(".status-text"), langSelect: $("langSelect"),
      transcriptArea: $("transcriptArea"), wordCount: $("wordCount"), charCount: $("charCount"),
      durationDisplay: $("durationDisplay"), engineLabel: $("engineLabel"), privacyLabel: $("privacyLabel"),
      continuousMode: $("continuousMode"), autoPunctuate: $("autoPunctuate"), cleanFillers: $("cleanFillers"),
      copyBtn: $("copyBtn"), shareBtn: $("shareBtn"), saveBtn: $("saveBtn"), downloadBtn: $("downloadBtn"),
      clearBtn: $("clearBtn"), engineWebSpeech: $("engineWebSpeech"), engineWhisper: $("engineWhisper"),
      whisperModal: $("whisperModal"), whisperCancel: $("whisperCancel"), whisperStart: $("whisperStart"),
      whisperProgress: $("whisperProgress"), progressFill: $("progressFill"), progressText: $("progressText"),
      toast: $("toast"), installBanner: $("installBanner"), installBtn: $("installBtn"), installDismiss: $("installDismiss"),
      notesList: $("notesList"), vocabForm: $("vocabForm"), vocabFrom: $("vocabFrom"), vocabTo: $("vocabTo"),
      vocabList: $("vocabList"), settingsBtn: $("settingsBtn"), settingsModal: $("settingsModal"),
      settingsClose: $("settingsClose"), setClean: $("setClean"), setPunct: $("setPunct"), setCont: $("setCont"),
      exportNotesBtn: $("exportNotesBtn")
    };
  },
  bindEvents() {
    this.el.micButton.addEventListener("click", () => this.toggleRecording());
    this.el.engineWebSpeech.addEventListener("click", () => this.setEngine("webspeech"));
    this.el.engineWhisper.addEventListener("click", () => this.setEngine("whisper"));
    this.el.whisperCancel.addEventListener("click", () => this.closeWhisperModal());
    this.el.whisperStart.addEventListener("click", () => this.startWhisperRecording());
    document.querySelectorAll(".model-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".model-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected"); this.selectedModel = btn.dataset.model;
      });
    });
    this.el.copyBtn.addEventListener("click", () => this.copyTranscript());
    this.el.shareBtn.addEventListener("click", () => this.shareTranscript());
    this.el.saveBtn.addEventListener("click", () => this.saveNote());
    this.el.downloadBtn.addEventListener("click", () => this.downloadTranscript());
    this.el.clearBtn.addEventListener("click", () => this.clearTranscript());
    this.el.exportNotesBtn.addEventListener("click", () => this.exportNotes());
    this.el.transcriptArea.addEventListener("input", () => {
      const text = this.getEditableText();
      if (!text.includes("Tap the mic")) this.finalTranscript = text;
      this.updateStats();
    });
    document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => this.switchTab(tab.dataset.tab)));
    this.el.vocabForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const from = this.el.vocabFrom.value.trim();
      const to = this.el.vocabTo.value.trim();
      if (!from || !to) return;
      this.vocab.push({ from, to, id: Date.now() }); this.persist();
      this.el.vocabFrom.value = ""; this.el.vocabTo.value = ""; this.renderVocab(); this.showToast("Word added");
    });
    this.el.settingsBtn.addEventListener("click", () => this.el.settingsModal.hidden = false);
    this.el.settingsClose.addEventListener("click", () => this.el.settingsModal.hidden = true);
    this.el.setClean.addEventListener("change", () => { this.el.cleanFillers.checked = this.el.setClean.checked; this.persist(); });
    this.el.setPunct.addEventListener("change", () => { this.el.autoPunctuate.checked = this.el.setPunct.checked; this.persist(); });
    this.el.setCont.addEventListener("change", () => { this.el.continuousMode.checked = this.el.setCont.checked; this.persist(); });
    this.el.cleanFillers.addEventListener("change", () => { this.el.setClean.checked = this.el.cleanFillers.checked; this.persist(); });
    this.el.autoPunctuate.addEventListener("change", () => { this.el.setPunct.checked = this.el.autoPunctuate.checked; this.persist(); });
    this.el.continuousMode.addEventListener("change", () => { this.el.setCont.checked = this.el.continuousMode.checked; this.persist(); });
    this.el.langSelect.addEventListener("change", () => this.persist());
    this.el.installBtn.addEventListener("click", () => this.triggerInstall());
    this.el.installDismiss.addEventListener("click", () => { this.el.installBanner.hidden = true; });
    document.addEventListener("keydown", (e) => {
      const typing = ["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName) || e.target.isContentEditable;
      if (e.code === "Space" && !typing) { e.preventDefault(); this.toggleRecording(); }
    });
  },
  switchTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel" + name[0].toUpperCase() + name.slice(1)));
  },
  loadState() {
    try {
      const data = JSON.parse(localStorage.getItem("echoscribe-state") || "{}");
      this.notes = data.notes || []; this.vocab = data.vocab || [];
      if (data.lang) this.el.langSelect.value = data.lang;
      if (typeof data.clean === "boolean") this.el.cleanFillers.checked = data.clean;
      if (typeof data.punct === "boolean") this.el.autoPunctuate.checked = data.punct;
      if (typeof data.cont === "boolean") this.el.continuousMode.checked = data.cont;
    } catch (_) {}
  },
  persist() {
    localStorage.setItem("echoscribe-state", JSON.stringify({
      notes: this.notes, vocab: this.vocab, lang: this.el.langSelect.value,
      clean: this.el.cleanFillers.checked, punct: this.el.autoPunctuate.checked, cont: this.el.continuousMode.checked
    }));
  },
  syncSettings() {
    this.el.setClean.checked = this.el.cleanFillers.checked;
    this.el.setPunct.checked = this.el.autoPunctuate.checked;
    this.el.setCont.checked = this.el.continuousMode.checked;
  },
  checkSupport() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) this.showToast("Live mode needs Chrome, Edge, or Safari. Whisper works in more browsers.");
  },
  setEngine(engine) {
    this.engine = engine;
    document.querySelectorAll(".engine-btn").forEach((b) => b.classList.remove("active"));
    if (engine === "webspeech") {
      this.el.engineWebSpeech.classList.add("active"); this.el.engineLabel.textContent = "Live"; this.el.privacyLabel.textContent = "Browser";
    } else {
      this.el.engineWhisper.classList.add("active"); this.el.engineLabel.textContent = "Whisper"; this.el.privacyLabel.textContent = "On device";
    }
  },
  toggleRecording() { this.isRecording ? this.stopRecording() : this.startRecording(); },
  startRecording() { this.engine === "whisper" ? this.openWhisperModal() : this.startWebSpeech(); },
  startWebSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { this.showToast("Live dictation not supported here. Try Whisper engine."); return; }
    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.el.langSelect.value;
    this.recognition.continuous = this.el.continuousMode.checked;
    this.recognition.interimResults = true;
    this.clearPlaceholder();
    this.recognition.onstart = () => { this.isRecording = true; this.updateUI(); this.startDurationTimer(); };
    this.recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const raw = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          if (/\bscratch that\b/i.test(raw)) this.scratchLastSentence();
          else {
            this.finalTranscript += this.cleanText(raw);
            if (!this.finalTranscript.endsWith("\n")) this.finalTranscript += " ";
          }
        } else interim += raw;
      }
      this.interimText = interim; this.renderTranscript(this.finalTranscript, interim);
    };
    this.recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed") this.showToast("Allow microphone access in the browser.");
      else this.showToast("Error: " + event.error);
    };
    this.recognition.onend = () => {
      if (this.isRecording && this.el.continuousMode.checked) { try { this.recognition.start(); } catch (_) {} }
      else { this.isRecording = false; this.updateUI(); this.stopDurationTimer(); this.renderTranscript(this.finalTranscript, ""); }
    };
    try { this.recognition.start(); } catch (_) { this.showToast("Could not start. Tap again."); }
  },
  stopRecording() {
    if (this.engine === "whisper" && this.mediaRecorder && this.mediaRecorder.state !== "inactive") { this.mediaRecorder.stop(); return; }
    if (this.recognition) { this.isRecording = false; try { this.recognition.stop(); } catch (_) {} this.updateUI(); this.stopDurationTimer(); }
  },
  cleanText(input) {
    let text = " " + input.trim() + " ";
    this.commands.forEach((c) => { text = text.replace(c.pattern, c.replace); });
    this.vocab.forEach((v) => { text = text.replace(new RegExp("\\b" + this.escapeReg(v.from) + "\\b", "gi"), v.to); });
    if (this.el.cleanFillers.checked) this.fillers.forEach((w) => { text = text.replace(new RegExp("\\b" + this.escapeReg(w) + "\\b", "gi"), " "); });
    text = text.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
    if (this.el.autoPunctuate.checked) text = this.autoPunctuateText(text);
    return text || "";
  },
  autoPunctuateText(text) {
    if (!text) return text;
    let t = text.trim().replace(/\s+/g, " ");
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (!/[.!?]$/.test(t) && t.split(" ").length > 8) t += ".";
    return t;
  },
  scratchLastSentence() {
    const parts = this.finalTranscript.trim().split(/(?<=[.!?])\s+/);
    parts.pop(); this.finalTranscript = parts.join(" ") + (parts.length ? " " : "");
    this.showToast("Removed last sentence");
  },
  openWhisperModal() { this.el.whisperModal.hidden = false; },
  closeWhisperModal() { this.el.whisperModal.hidden = true; this.el.whisperProgress.hidden = true; },
  async startWhisperRecording() {
    this.el.whisperProgress.hidden = false;
    this.el.progressText.textContent = "Loading transformers.js…";
    this.el.progressFill.style.width = "8%";
    try {
      if (!window.transformers) await this.loadTransformersJS();
      const { pipeline } = window.transformers;
      const modelId = "Xenova/whisper-" + this.selectedModel;
      if (!this.whisperPipeline || this.whisperPipeline.modelId !== modelId) {
        this.whisperPipeline = await pipeline("automatic-speech-recognition", modelId, {
          progress_callback: (data) => {
            if (data.status === "progress") {
              const pct = Math.round(data.progress || 0);
              this.el.progressFill.style.width = 10 + pct * 0.7 + "%";
              this.el.progressText.textContent = "Downloading model " + pct + "%";
            }
          }
        });
        this.whisperPipeline.modelId = modelId;
      }
      this.closeWhisperModal(); this.recordAudioForWhisper();
    } catch (err) {
      this.el.progressText.textContent = "Error: " + err.message;
      this.showToast("Could not load Whisper. Need internet the first time.");
    }
  },
  loadTransformersJS() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
      script.onload = resolve; script.onerror = () => reject(new Error("Failed to load transformers.js"));
      document.head.appendChild(script);
    });
  },
  recordAudioForWhisper() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => { if (e.data.size) this.audioChunks.push(e.data); };
      this.mediaRecorder.onstop = () => { stream.getTracks().forEach((t) => t.stop()); this.processWithWhisper(new Blob(this.audioChunks, { type: "audio/webm" })); };
      this.mediaRecorder.start(); this.isRecording = true; this.updateUI(); this.startDurationTimer();
      this.showToast("Recording. Tap the mic when you finish.");
    }).catch(() => this.showToast("Microphone access denied."));
  },
  async processWithWhisper(blob) {
    this.el.statusText.textContent = "Transcribing…"; this.showToast("Transcribing with Whisper…");
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      let audio = decoded.getChannelData(0);
      if (decoded.numberOfChannels === 2) {
        const left = decoded.getChannelData(0), right = decoded.getChannelData(1);
        audio = new Float32Array(left.length);
        for (let i = 0; i < left.length; i++) audio[i] = (left[i] + right[i]) / 2;
      }
      const lang = this.el.langSelect.value.split("-")[0];
      const result = await this.whisperPipeline(audio, { language: lang, task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
      this.clearPlaceholder();
      this.finalTranscript += this.cleanText(result.text || "") + " ";
      this.renderTranscript(this.finalTranscript, ""); this.showToast("Done");
    } catch (err) { this.showToast("Transcription failed: " + err.message); }
    this.isRecording = false; this.updateUI(); this.stopDurationTimer();
  },
  renderTranscript(finalText, interim) {
    this.clearPlaceholder();
    let html = "";
    if (finalText) html += '<span class="final">' + this.escapeHtml(finalText) + "</span>";
    if (interim) html += '<span class="interim">' + this.escapeHtml(interim) + "</span>";
    this.el.transcriptArea.innerHTML = html || '<p class="placeholder">Tap the mic and talk naturally.</p>';
    this.updateStats(); this.el.transcriptArea.scrollTop = this.el.transcriptArea.scrollHeight;
  },
  updateUI() {
    const rec = this.isRecording;
    this.el.micButton.classList.toggle("recording", rec);
    this.el.micButton.querySelector(".mic-icon").style.display = rec ? "none" : "block";
    this.el.micButton.querySelector(".stop-icon").style.display = rec ? "block" : "none";
    this.el.micHint.textContent = rec ? "Tap to stop" : "Tap to speak. Space on laptop.";
    this.el.statusBadge.classList.toggle("listening", rec);
    this.el.statusBadge.classList.toggle("ready", !rec);
    this.el.statusText.textContent = rec ? "Listening" : "Ready";
  },
  updateStats() {
    const text = this.finalTranscript || "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    this.el.wordCount.textContent = words + (words === 1 ? " word" : " words");
    this.el.charCount.textContent = text.length;
  },
  startDurationTimer() {
    this.startTime = Date.now();
    this.durationTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      this.el.durationDisplay.textContent = String(Math.floor(elapsed / 60)).padStart(2, "0") + ":" + String(elapsed % 60).padStart(2, "0");
    }, 250);
  },
  stopDurationTimer() { if (this.durationTimer) clearInterval(this.durationTimer); this.durationTimer = null; },
  getText() {
    const t = (this.finalTranscript || this.getEditableText() || "").trim();
    if (!t || t.includes("Tap the mic")) return ""; return t;
  },
  getEditableText() { return (this.el.transcriptArea.innerText || "").trim(); },
  copyTranscript() {
    const text = this.getText(); if (!text) return this.showToast("Nothing to copy yet.");
    navigator.clipboard.writeText(text).then(() => this.showToast("Copied")).catch(() => this.showToast("Copy failed"));
  },
  async shareTranscript() {
    const text = this.getText(); if (!text) return this.showToast("Nothing to share yet.");
    if (navigator.share) { try { await navigator.share({ title: "EchoScribe note", text }); return; } catch (_) {} }
    this.copyTranscript();
  },
  downloadTranscript() {
    const text = this.getText(); if (!text) return this.showToast("Nothing to download.");
    const blob = new Blob([text], { type: "text/plain" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "echoscribe-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".txt";
    a.click(); URL.revokeObjectURL(url); this.showToast("Downloaded");
  },
  saveNote() {
    const text = this.getText(); if (!text) return this.showToast("Speak something first.");
    this.notes.unshift({ id: Date.now(), text, at: new Date().toISOString(), words: text.split(/\s+/).length });
    this.persist(); this.renderNotes(); this.showToast("Saved to Notes");
  },
  renderNotes() {
    if (!this.notes.length) { this.el.notesList.innerHTML = '<p class="muted">No notes yet. Dictate, then tap Save.</p>'; return; }
    this.el.notesList.innerHTML = this.notes.map((n) => '<article class="note-card" data-id="' + n.id + '"><div class="note-meta"><span>' + new Date(n.at).toLocaleString() + ' · ' + n.words + ' words</span><span><button class="icon-btn" data-act="copy">Copy</button> <button class="icon-btn danger" data-act="del">Delete</button></span></div><p>' + this.escapeHtml(n.text) + '</p></article>').join("");
    this.el.notesList.querySelectorAll(".note-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        const note = this.notes.find((n) => n.id === Number(card.dataset.id)); if (!note) return;
        if (e.target.dataset.act === "copy") navigator.clipboard.writeText(note.text).then(() => this.showToast("Copied"));
        if (e.target.dataset.act === "del") { this.notes = this.notes.filter((n) => n.id !== note.id); this.persist(); this.renderNotes(); }
      });
    });
  },
  exportNotes() {
    if (!this.notes.length) return this.showToast("No notes to export.");
    const text = this.notes.map((n) => "# " + new Date(n.at).toLocaleString() + "\n" + n.text).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "echoscribe-notes.txt"; a.click(); URL.revokeObjectURL(url);
  },
  renderVocab() {
    if (!this.vocab.length) { this.el.vocabList.innerHTML = '<p class="muted">Example: hear echo, write EchoScribe.</p>'; return; }
    this.el.vocabList.innerHTML = this.vocab.map((v) => '<div class="vocab-item" data-id="' + v.id + '"><span><strong>' + this.escapeHtml(v.from) + '</strong> → ' + this.escapeHtml(v.to) + '</span><button class="icon-btn danger" data-act="del">Remove</button></div>').join("");
    this.el.vocabList.querySelectorAll(".vocab-item").forEach((row) => {
      row.querySelector("[data-act=del]").addEventListener("click", () => {
        this.vocab = this.vocab.filter((v) => v.id !== Number(row.dataset.id)); this.persist(); this.renderVocab();
      });
    });
  },
  clearTranscript() { this.finalTranscript = ""; this.interimText = ""; this.renderTranscript("", ""); this.el.durationDisplay.textContent = "00:00"; },
  clearPlaceholder() { const ph = this.el.transcriptArea.querySelector(".placeholder"); if (ph) ph.remove(); },
  showToast(msg) {
    this.el.toast.textContent = msg; this.el.toast.classList.add("show");
    clearTimeout(this._toastTimer); this._toastTimer = setTimeout(() => this.el.toast.classList.remove("show"), 2200);
  },
  escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c])); },
  escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); },
  registerServiceWorker() { if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {}); },
  setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); this.deferredPrompt = e; this.el.installBanner.hidden = false; });
  },
  async triggerInstall() {
    if (!this.deferredPrompt) { this.showToast("Use browser menu → Add to Home Screen"); return; }
    this.deferredPrompt.prompt(); await this.deferredPrompt.userChoice; this.deferredPrompt = null; this.el.installBanner.hidden = true;
  }
};
document.addEventListener("DOMContentLoaded", () => App.init());
