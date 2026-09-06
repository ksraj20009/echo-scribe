// Minimal client integration: sends current transcript to backend /api/ai/reply
// Adds a click handler to the #aiReplyBtn button (present in index.html)

(async function() {
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

  async function callAiReply(transcript) {
    try {
      const resp = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
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

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('aiReplyBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const t = getTranscript();
      if (!t || t.trim().length === 0) {
        App?.showToast?.('No transcript to send to AI');
        return;
      }
      App?.showToast?.('Asking AI...');
      const r = await callAiReply(t);
      if (r) {
        appendAiReply(r);
        App?.showToast?.('AI replied');
      }
    });
  });
})();
