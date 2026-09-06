// OCR + AI integration client script
// Adds a "Capture Screen (OCR)" button and wires OCR -> AI Reply flow.

(function () {
  function getTranscript() {
    const el = document.getElementById('transcriptArea');
    return el ? el.innerText : '';
  }

  function appendAiReply(text) {
    const area = document.getElementById('transcriptArea');
    if (!area) return;
    const p = document.createElement('p');
    p.className = 'ai-reply';
    p.style.borderLeft = '3px solid #7C3AED';
    p.style.paddingLeft = '10px';
    p.style.marginTop = '8px';
    p.style.color = '#C7B9FF';
    p.textContent = 'AI: ' + text;
    area.appendChild(p);
    area.scrollTop = area.scrollHeight;
  }

  async function callAiReply(transcript, ocr) {
    try {
      const resp = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, ocr })
      });
      if (!resp.ok) {
        const t = await resp.text();
        App?.showToast?.('AI request failed');
        console.error('AI reply failed:', resp.status, t);
        return null;
      }
      const data = await resp.json();
      return data.reply || data;
    } catch (e) {
      console.error('AI call error', e);
      App?.showToast?.('AI call error');
      return null;
    }
  }

  async function captureScreenAndOcr() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      App?.showToast?.('Screen capture not supported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const image = await captureFrame(track);
      track.stop();
      App?.showToast?.('Running OCR...');
      // Use Tesseract (assumes tesseract.js is loaded on the page)
      if (!window.Tesseract) {
        App?.showToast?.('Tesseract not loaded');
        return;
      }
      const { data: { text } } = await Tesseract.recognize(image, 'eng', { logger: m => console.log('TESS', m) });
      App?.showToast?.('OCR complete');
      return text;
    } catch (e) {
      console.error('Capture error', e);
      App?.showToast?.('Screen capture failed');
      return null;
    }
  }

  function captureFrame(track) {
    return new Promise((resolve) => {
      const imageCapture = new ImageCapture(track);
      imageCapture.grabFrame().then((bitmap) => {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      }).catch(async (err) => {
        // Fallback: draw video to canvas
        const video = document.createElement('video');
        video.srcObject = new MediaStream([track]);
        await video.play();
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        video.pause();
        track.stop();
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.controls-bar');
    if (!container) return;
    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    btn.id = 'captureScreenBtn';
    btn.textContent = 'Capture Screen (OCR)';
    btn.style.marginLeft = '8px';

    btn.addEventListener('click', async () => {
      App?.showToast?.('Capture started');
      const ocrText = await captureScreenAndOcr();
      if (!ocrText) return;
      // Show OCR in translation area (temporary)
      const ta = document.getElementById('translationArea');
      if (ta) ta.innerHTML = '<pre style="white-space:pre-wrap; color:#C7B9FF;">' + ocrText + '</pre>';
      // Optionally call AI with transcript + ocr
      const transcript = getTranscript();
      App?.showToast?.('Sending to AI...');
      const reply = await callAiReply(transcript, ocrText);
      if (reply) appendAiReply(reply);
    });

    container.appendChild(btn);
  });
})();
