/**
 * upload.js — Disease Detection page state machine + Gemini AI integration
 *
 * Flow: user picks image → preview shown → AI analyses AUTOMATICALLY → results displayed
 * States: IDLE → ANALYZING → RESULT
 */

// ── State machine ────────────────────────────────────────────────────────────
const UploadState = {
  IDLE:      'idle',
  LOADED:    'loaded',
  ANALYZING: 'analyzing',
  RESULT:    'result',
};

let currentState       = UploadState.IDLE;
let currentImageBase64 = null;    // full data-URL including prefix
let currentMimeType    = null;    // actual MIME type of the uploaded file

// ── Gemini API ───────────────────────────────────────────────────────────────
// The user's own key is stored in their browser via settings.js — never
// hardcoded here. Get a free key at https://aistudio.google.com/apikey
function getGeminiKey() {
  return (window.AgroAISettings && window.AgroAISettings.getKey()) || null;
}
// Model fallback chain — tries each in order if previous returns 503/404.
// gemini-1.5-flash and gemini-1.0-pro-vision were retired and now return 404,
// which is why detection was failing. Updated to the current stable, vision-
// capable models (Aug 2026).
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

// ── Allowed MIME types ───────────────────────────────────────────────────────
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ── DOM refs (resolved on DOMContentLoaded) ──────────────────────────────────
let uploadArea;
let fileInput;
let uploadPrompt;
let uploadPreview;
let previewImg;
let resetBtn;
let analyzeBtn;
let uploadError;
let spinnerOverlay;
let resultPanel;
let uploadActions;

// ── extractSection ───────────────────────────────────────────────────────────
// Parses "FieldName: value" from Gemini's structured text response.
function extractSection(text, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex   = new RegExp(escaped + ':\\s*(.+)', 'i');
  const match   = text.match(regex);
  return match ? match[1].trim() : 'Hin argamne';
}

// ── sleep helper ─────────────────────────────────────────────────────────────
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── callGeminiWithRetry ───────────────────────────────────────────────────────
// Tries each model in GEMINI_MODELS with up to 3 retries + exponential backoff.
// Updates spinner text so the user can see what's happening.
async function callGeminiWithRetry(body) {
  const MAX_RETRIES = 3;
  const spinnerText = spinnerOverlay ? spinnerOverlay.querySelector('p') : null;

  for (let m = 0; m < GEMINI_MODELS.length; m++) {
    const model = GEMINI_MODELS[m];
    const url   = GEMINI_BASE + model + ':generateContent';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (spinnerText) {
        if (m === 0 && attempt === 1) {
          spinnerText.textContent = 'Suuraa midhaan kee xiinxalaa jira…';
        } else if (attempt > 1) {
          spinnerText.textContent = `Sarviisiin qabama jira — irra deebi'ee yaalaa jira (${attempt}/${MAX_RETRIES})…`;
        } else {
          spinnerText.textContent = `Moodeela biraa yaalaa jira…`;
        }
      }

      const response = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'X-goog-api-key':  getGeminiKey(),
        },
        body: JSON.stringify(body),
      });

      // Success
      if (response.ok) {
        return response.json();
      }

      // 503 = overloaded — retry with backoff
      if (response.status === 503) {
        if (attempt < MAX_RETRIES) {
          await sleep(1000 * Math.pow(2, attempt - 1)); // 1s, 2s, 4s
          continue;
        }
        // All retries exhausted for this model — try next model
        break;
      }

      // 404 = model retired/unknown — skip straight to the next model,
      // no point retrying the same dead model.
      if (response.status === 404) {
        break;
      }

      // 401/403 = bad or missing API key — no point retrying or trying
      // another model, tell the user to fix their key.
      if (response.status === 401 || response.status === 403) {
        throw new Error('Furtiin API kee sirrii miti ykn dhumeera. "Furtii API Kee Bulchi" cuqaasiitii furtii haaraa galchi.');
      }

      // Any other error (400…) — read body and throw immediately
      const errBody = await response.text().catch(() => '');
      throw new Error('Gemini ' + response.status + ': ' + errBody.slice(0, 200));
    }
  }

  // All models exhausted
  throw new Error("Moodeelonni Gemini hundi yeroo ammaa baay'ee itti fe'amaniiru. Maaloo daqiiqaa tokko booda irra deebi'ii yaali.");
}

// ── analyzeImageWithAI ───────────────────────────────────────────────────────
async function analyzeImageWithAI(imageBase64, mimeType) {
  const base64Data = imageBase64.split(',')[1];

  const prompt = `You are an expert plant pathologist specialising in Ethiopian agriculture, with deep familiarity with crops and growing conditions in Oromia and the wider Ethiopian highlands and lowlands (teff, enset/false banana, coffee, khat, maize, sorghum, wheat, barley, haricot bean, and vegetables). Carefully analyze this crop/plant image for any diseases, pests, or health issues.

Ground your analysis in the Ethiopian context: prioritise diseases and pests common in Ethiopia and the Oromia region. Recommend treatments that are realistically available to a smallholder farmer in Ethiopia — organic options should favour inputs and practices accessible locally, and chemical treatments should note if they require a licensed agro-dealer or Ministry of Agriculture extension office.

IMPORTANT: Write every value in Afaan Oromo (the Oromo language). Do NOT translate or alter the field labels themselves (keep them exactly in English as shown below, followed by a colon) — this is required so the response can be parsed automatically. Only the text after each colon should be in Afaan Oromo.

Provide your analysis in this exact format (one value per line, no extra text):
Disease Name: [maqaa dhukkubaa Afaan Oromootiin, ykn "Fayyaa Qabu" yoo dhukkubni hin argamin]
Confidence: [Ol'aanaa, Giddu-galeessaa, ykn Gadi Aanaa]
Symptoms: [mallattoolee suuraa keessatti mul'atan Afaan Oromootiin]
Causes: [sababoota, dhukkubsiisaa, ykn haala naannoo Afaan Oromootiin]
Organic Treatment: [yaala uumamaa/tarii uumamaa irratti hundaa'e Afaan Oromootiin, kan naannoo keessatti argamu dursu]
Chemical Treatment: [yaala kemikaalaa gorfamu Afaan Oromootiin, argamiinsa naannoo ibsuu dabalatee]
Prevention: [tarkaanfii ittisaa deebi'ee akka hin mudanne godhu Afaan Oromootiin]
Recovery Time: [yeroo fayyuu yaalaan tilmaamame Afaan Oromootiin]
Harvest Impact: [dhiibbaa oomisha fi qulqullina oomishaa irratti qabu Afaan Oromootiin]`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Data } }
      ]
    }],
    generationConfig: {
      temperature: 0.2,
      // Raised from 1024: these models "think" before answering, and that
      // reasoning shares the same token budget as the visible answer, so a
      // small cap was cutting the structured response off partway through.
      maxOutputTokens: 8192
    }
  };

  const data = await callGeminiWithRetry(requestBody);

  if (!data.candidates || !data.candidates[0] ||
      !data.candidates[0].content || !data.candidates[0].content.parts) {
    throw new Error('Deebiin Gemini irraa eegamaa hin turre. Maaloo irra deebi\'ii yaali.');
  }

  // If the response was cut off before finishing, don't silently show
  // "Hin argamne" for every field — tell the user clearly so they know to retry.
  if (data.candidates[0].finishReason === 'MAX_TOKENS') {
    throw new Error('Deebiin Gemini utuu hin xumuramin dhaabate. Maaloo irra deebi\'ii yaali.');
  }

  const text = data.candidates[0].content.parts[0].text;

  return {
    diseaseName:       extractSection(text, 'Disease Name'),
    confidence:        extractSection(text, 'Confidence'),
    symptoms:          extractSection(text, 'Symptoms'),
    causes:            extractSection(text, 'Causes'),
    organicTreatment:  extractSection(text, 'Organic Treatment'),
    chemicalTreatment: extractSection(text, 'Chemical Treatment'),
    prevention:        extractSection(text, 'Prevention'),
    recoveryTime:      extractSection(text, 'Recovery Time'),
    harvestImpact:     extractSection(text, 'Harvest Impact'),
  };
}

// ── displayAIResults ─────────────────────────────────────────────────────────
// Injects the full results card into #result-panel.
function displayAIResults(results) {
  const isHealthy       = results.diseaseName.toLowerCase().includes('fayyaa');
  const badgeClass      = isHealthy ? 'badge-healthy' : 'badge-disease';
  const headerIcon      = isHealthy ? 'leaf' : 'stethoscope';
  const headerTitle     = isHealthy ? 'Dhukkubni Hin Argamne' : 'Dhukkubni Argameera';
  const confidenceLabel = results.confidence;

  resultPanel.innerHTML = `
<div class="ai-results">
  <div class="result-header">
    <i data-lucide="${headerIcon}" class="result-icon" aria-hidden="true"></i>
    <h2>${headerTitle}</h2>
  </div>

  <div class="result-summary">
    <span class="disease-badge ${badgeClass}">${results.diseaseName}</span>
    <span class="confidence-indicator">Sadarkaa Amantaa: ${confidenceLabel}</span>
  </div>

  <div class="result-sections">
    <div class="result-section">
      <h3>Mallattoolee Argaman</h3>
      <p>${results.symptoms}</p>
    </div>
    <div class="result-section">
      <h3>Sababoota</h3>
      <p>${results.causes}</p>
    </div>
    <div class="result-section">
      <h3>Yaala Uumamaa</h3>
      <p>${results.organicTreatment}</p>
    </div>
    <div class="result-section">
      <h3>Yaala Kemikaalaa</h3>
      <p>${results.chemicalTreatment}</p>
    </div>
    <div class="result-section">
      <h3>Ittisa</h3>
      <p>${results.prevention}</p>
    </div>
    <div class="result-grid">
      <div class="result-item">
        <strong>Yeroo Fayyuu Tilmaamame</strong>
        <span>${results.recoveryTime}</span>
      </div>
      <div class="result-item">
        <strong>Dhiibbaa Oomisha Irratti</strong>
        <span>${results.harvestImpact}</span>
      </div>
    </div>
  </div>

  <div class="result-actions">
    <button id="analyze-another-btn-ai" class="btn btn--secondary" type="button">
      Suuraa Biraa Xiinxali
    </button>
    <a href="recommendation.html" class="btn btn--primary">
      Gorsa Midhaanii Argadhu
    </a>
  </div>
</div>`;

  resultPanel.removeAttribute('hidden');

  const btn = document.getElementById('analyze-another-btn-ai');
  if (btn) btn.addEventListener('click', resetUpload);

  if (typeof lucide !== 'undefined') lucide.createIcons();
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── handleAnalyze ────────────────────────────────────────────────────────────
// Called automatically after image loads. Runs the full AI pipeline.
async function handleAnalyze() {
  if (!currentImageBase64 || !currentMimeType) return;
  if (currentState === UploadState.ANALYZING || currentState === UploadState.RESULT) return;

  if (!getGeminiKey()) {
    uploadError.textContent = 'Duraan dursii furtii API Gemini kee galchi ("Furtii API Kee Bulchi" cuqaasi).';
    uploadError.removeAttribute('hidden');
    if (window.AgroAISettings) window.AgroAISettings.openModal();
    return;
  }

  currentState = UploadState.ANALYZING;

  // Hide the Analyse button row, show spinner
  if (uploadActions) uploadActions.setAttribute('hidden', '');
  spinnerOverlay.removeAttribute('hidden');

  const spinnerText = spinnerOverlay.querySelector('p');
  if (spinnerText) spinnerText.textContent = 'Suuraa midhaan kee xiinxalaa jira…';

  try {
    const results = await analyzeImageWithAI(currentImageBase64, currentMimeType);
    currentState = UploadState.RESULT;
    spinnerOverlay.setAttribute('hidden', '');
    displayAIResults(results);
  } catch (err) {
    console.error('Gemini error:', err);
    currentState = UploadState.LOADED;
    spinnerOverlay.setAttribute('hidden', '');
    if (uploadActions) uploadActions.removeAttribute('hidden');

    // Show a helpful error with the actual reason
    uploadError.textContent = err.message || 'Xiinxalli AI hin milkoofne. Maaloo irra deebi\'ii yaali.';
    uploadError.removeAttribute('hidden');
  }
}

// ── validateAndPreview ───────────────────────────────────────────────────────
// Validates file type, shows preview, then AUTOMATICALLY starts analysis.
// FIX: calls handleAnalyze() right after image loads — no button press needed.
function validateAndPreview(file) {
  if (!file) return;

  // Reject non-image files
  if (!ALLOWED_TYPES.includes(file.type)) {
    uploadError.textContent = 'Maaloo faayilii suuraa sirrii ta\'e fe\'i (JPEG, PNG, ykn WebP)';
    uploadError.removeAttribute('hidden');
    currentState = UploadState.IDLE;
    return;
  }

  // Clear previous errors
  uploadError.textContent = '';
  uploadError.setAttribute('hidden', '');

  // Store the real MIME type NOW, from the File object (reliable)
  currentMimeType = file.type;

  const reader = new FileReader();

  reader.onload = function (e) {
    currentImageBase64 = e.target.result;

    // Show the image preview
    previewImg.src = e.target.result;
    uploadPreview.removeAttribute('hidden');
    uploadPrompt.setAttribute('hidden', '');

    // Transition to LOADED then immediately kick off AI analysis
    currentState = UploadState.LOADED;
    handleAnalyze();   // ← FIX: auto-analyze, no button press required
  };

  reader.readAsDataURL(file);
}

// ── resetUpload ──────────────────────────────────────────────────────────────
function resetUpload() {
  currentState       = UploadState.IDLE;
  currentImageBase64 = null;
  currentMimeType    = null;

  if (previewImg)    { previewImg.src = ''; }
  if (uploadPreview) { uploadPreview.setAttribute('hidden', ''); }
  if (resultPanel)   { resultPanel.innerHTML = ''; resultPanel.setAttribute('hidden', ''); }
  if (uploadPrompt)  { uploadPrompt.removeAttribute('hidden'); }
  if (analyzeBtn)    { analyzeBtn.setAttribute('disabled', ''); analyzeBtn.setAttribute('aria-disabled', 'true'); }
  if (uploadError)   { uploadError.textContent = ''; uploadError.setAttribute('hidden', ''); }
  if (uploadActions) { uploadActions.removeAttribute('hidden'); }
  if (fileInput)     { fileInput.value = ''; }
  if (spinnerOverlay){ spinnerOverlay.setAttribute('hidden', ''); }
  if (uploadArea)    { uploadArea.classList.remove('upload-area--drag-over'); }
}

// ── DOMContentLoaded ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  uploadArea     = document.getElementById('upload-area');
  fileInput      = document.getElementById('file-input');
  uploadPrompt   = document.getElementById('upload-prompt');
  uploadPreview  = document.getElementById('upload-preview');
  previewImg     = document.getElementById('preview-img');
  resetBtn       = document.getElementById('reset-btn');
  analyzeBtn     = document.getElementById('analyze-btn');
  uploadError    = document.getElementById('upload-error');
  spinnerOverlay = document.getElementById('spinner-overlay');
  resultPanel    = document.getElementById('result-panel');
  uploadActions  = document.getElementById('upload-actions');

  // Click upload area → open file picker
  uploadArea.addEventListener('click', function (e) {
    // Don't trigger if clicking reset/analyze buttons
    if (resetBtn && (e.target === resetBtn || resetBtn.contains(e.target))) return;
    if (analyzeBtn && (e.target === analyzeBtn || analyzeBtn.contains(e.target))) return;
    if (e.target === fileInput) return;
    // Only open picker when not currently analysing
    if (currentState === UploadState.IDLE || currentState === UploadState.LOADED) {
      fileInput.click();
    }
  });

  // File input change → validate, preview, and auto-analyze
  fileInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) {
      validateAndPreview(e.target.files[0]);
    }
  });

  // Drag over
  uploadArea.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadArea.classList.add('upload-area--drag-over');
  });

  // Drag leave
  uploadArea.addEventListener('dragleave', function () {
    uploadArea.classList.remove('upload-area--drag-over');
  });

  // Drop → validate, preview, and auto-analyze
  uploadArea.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadArea.classList.remove('upload-area--drag-over');
    const file = e.dataTransfer.files[0];
    if (file) validateAndPreview(file);
  });

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      resetUpload();
    });
  }

  // Analyse button (manual fallback — still works if auto-analyze fails)
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', function () {
      if (currentState === UploadState.LOADED) handleAnalyze();
    });
  }

  // API key settings button
  const apiKeyBtn = document.getElementById('open-api-key-settings');
  if (apiKeyBtn) {
    apiKeyBtn.addEventListener('click', function () {
      if (window.AgroAISettings) window.AgroAISettings.openModal();
    });
  }
});
