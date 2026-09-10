/**
 * settings.js — Agro AI personal API key manager
 *
 * Each visitor supplies their own free Gemini API key, stored only in
 * their own browser (localStorage) — never on a server, never hardcoded
 * in the source. This avoids shipping a shared secret in public code
 * and means the app keeps working even if one key is rate-limited.
 *
 * Public API (window.AgroAISettings):
 *   getKey()      -> string | null
 *   setKey(key)   -> void
 *   clearKey()    -> void
 *   openModal()   -> opens the "enter API key" dialog
 */
(function () {
  const STORAGE_KEY = 'agroai-gemini-key';

  function getKey() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function setKey(key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  }

  function clearKey() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── Modal UI ──────────────────────────────────────────────────────
  let modalEl = null;

  function buildModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.id = 'api-key-modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'api-key-modal-title');
    modalEl.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;' +
      'align-items:center;justify-content:center;z-index:9999;padding:1rem;';

    modalEl.innerHTML = `
      <div style="background:var(--surface,#fff);color:var(--text,#1a1a1a);
                  border:1px solid var(--border,#e0e0e0);
                  border-radius:12px;max-width:440px;width:100%;padding:1.75rem;
                  box-shadow:0 20px 60px rgba(0,0,0,0.35);">
        <h2 id="api-key-modal-title" style="margin:0 0 0.5rem;font-size:1.25rem;color:var(--text,#1a1a1a);">
          Furtii API Gemini Kee Galchi
        </h2>
        <p style="font-size:0.9rem;margin:0 0 1rem;line-height:1.5;color:var(--text,#1a1a1a);">
          Agro AI'n adda baasuu dhukkubaa fi gorsa midhaanii hojjachiisuuf furtii API
          Gemini kan matii kee barbaachisa. Kun bilisaan Google AI Studio irraa
          argamuu danda'a, kompiitara kee qofa keessa kaa'ama — server keenya irratti hin kuufamu.
        </p>
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"
           style="display:inline-block;font-size:0.85rem;color:var(--primary-green,#2E7D32);
                  margin-bottom:1rem;text-decoration:underline;">
          Furtii API bilisaa Google AI Studio irraa argadhu →
        </a>
        <label for="api-key-input" style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:0.35rem;color:var(--text,#1a1a1a);">
          Furtii API
        </label>
        <input type="password" id="api-key-input" placeholder="AIza..."
               style="width:100%;padding:0.65rem 0.8rem;border:1px solid var(--border,#ccc);border-radius:8px;
                      font-size:0.95rem;margin-bottom:0.25rem;box-sizing:border-box;
                      background:var(--bg,#fff);color:var(--text,#1a1a1a);">
        <p id="api-key-status" style="font-size:0.8rem;color:#E57373;min-height:1.1em;margin:0.25rem 0 1rem;"></p>
        <div style="display:flex;gap:0.6rem;justify-content:flex-end;">
          <button id="api-key-cancel" type="button"
                  style="padding:0.55rem 1.1rem;border-radius:8px;border:1px solid var(--border,#ccc);
                         background:transparent;color:var(--text,#1a1a1a);cursor:pointer;font-size:0.9rem;">
            Dhiisi
          </button>
          <button id="api-key-save" type="button"
                  style="padding:0.55rem 1.1rem;border-radius:8px;border:none;
                         background:var(--primary-green,#2E7D32);color:#fff;cursor:pointer;font-size:0.9rem;">
            Kuusi
          </button>
        </div>
      </div>`;

    document.body.appendChild(modalEl);

    const input     = modalEl.querySelector('#api-key-input');
    const statusEl  = modalEl.querySelector('#api-key-status');
    const saveBtn   = modalEl.querySelector('#api-key-save');
    const cancelBtn = modalEl.querySelector('#api-key-cancel');

    function close() {
      modalEl.style.display = 'none';
      statusEl.textContent = '';
    }

    saveBtn.addEventListener('click', function () {
      const val = input.value.trim();
      if (!val) {
        statusEl.textContent = 'Maaloo furtii API galchi.';
        return;
      }
      setKey(val);
      close();
      window.dispatchEvent(new CustomEvent('agroai-key-saved'));
    });

    cancelBtn.addEventListener('click', close);
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalEl.style.display !== 'none') close();
    });

    return modalEl;
  }

  function openModal() {
    const modal = buildModal();
    const input = modal.querySelector('#api-key-input');
    input.value = getKey() || '';
    modal.style.display = 'flex';
    setTimeout(function () { input.focus(); }, 0);
  }

  window.AgroAISettings = { getKey, setKey, clearKey, openModal };
})();
