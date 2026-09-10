// recommendation.js — Agro AI Crop Recommendation Page
// Handles: form validation, Gemini AI crop recommendation, reset

document.addEventListener('DOMContentLoaded', function () {

  // ── Field configuration ──────────────────────────────────────────
  const FIELDS = [
    { id: 'country',      label: 'Biyya',                type: 'text',   required: true },
    { id: 'region',       label: 'Naannoo',              type: 'text',   required: true },
    { id: 'season',       label: 'Waggaa Guddinaa',      type: 'select', required: true },
    { id: 'temperature',  label: 'Ho\'a',                 type: 'number', required: true, min: -20, max: 60 },
    { id: 'rainfall',     label: 'Roobni Waggaa',        type: 'number', required: true, min: 0 },
    { id: 'humidity',     label: 'Jiidhina Giddu-galeessaa', type: 'number', required: true, min: 0, max: 100 },
    { id: 'soilType',     label: 'Gosa Biyyee',          type: 'select', required: true },
    { id: 'soilPh',       label: 'pH Biyyee',            type: 'number', required: true, min: 0, max: 14 },
    { id: 'previousCrop', label: 'Midhaan Darbe',        type: 'text',   required: true },
  ];

  // ── Gemini API configuration ─────────────────────────────────────
  // The user's own key is stored in their browser via settings.js — never
  // hardcoded here. This file will be public on GitHub, so no secret can
  // live in it. Get a free key at https://aistudio.google.com/apikey
  function getGeminiKey() {
    return (window.AgroAISettings && window.AgroAISettings.getKey()) || null;
  }
  // Model fallback chain — 1.5-flash was retired (404); use current stable models
  const GEMINI_MODELS   = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  const GEMINI_BASE     = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const sleep           = ms => new Promise(r => setTimeout(r, ms));

  // ── DOM references ───────────────────────────────────────────────
  const form        = document.getElementById('recommendation-form');
  const outputPanel = document.getElementById('recommendation-output');
  const resetBtn    = document.getElementById('reset-recommendation-btn');
  const submitBtn     = document.getElementById('rec-submit-btn');
  const submitBtnText = document.getElementById('rec-submit-text');

  const outCrop        = document.getElementById('out-crop');
  const outExplanation = document.getElementById('out-explanation');
  const outYield       = document.getElementById('out-yield');
  const outDuration    = document.getElementById('out-duration');
  const outWater       = document.getElementById('out-water');
  const outFertilizer  = document.getElementById('out-fertilizer');
  const outProfit      = document.getElementById('out-profit');
  const outMarket      = document.getElementById('out-market');

  // Inline error element for API failures
  let apiErrorEl = document.getElementById('api-error-msg');
  if (!apiErrorEl && form) {
    apiErrorEl = document.createElement('p');
    apiErrorEl.id = 'api-error-msg';
    apiErrorEl.setAttribute('role', 'alert');
    apiErrorEl.style.cssText = 'color:#B71C1C; margin-top:0.75rem; font-size:0.9rem;';
    apiErrorEl.setAttribute('hidden', '');
    form.appendChild(apiErrorEl);
  }

  if (!form) return; // guard — only run on recommendation.html

  // ── extractSection helper ────────────────────────────────────────
  // Pulls a named field value out of the structured text Gemini returns.
  function extractSection(text, fieldName) {
    const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex   = new RegExp(escaped + ':\\s*(.+)', 'i');
    const match   = text.match(regex);
    return match ? match[1].trim() : 'Hin argamne';
  }

  // ── getAICropRecommendation(formData) ────────────────────────────
  // Calls Gemini with retry + model fallback to handle 503 overload errors.
  async function getAICropRecommendation(formData) {
    const prompt = `You are an expert agricultural advisor working with Oromia's regional agricultural extension system, with deep, specific knowledge of Oromia's zones and agro-ecological zones — dega (highland, cool, >2300m), woyna dega (midland, temperate, 1500-2300m), and kolla (lowland, hot, <1500m). Based on the following farm conditions, recommend the best crop to grow.

Country: ${formData.country}
Region: ${formData.region}
Season: ${formData.season}
Average Temperature: ${formData.temperature}°C
Annual Rainfall: ${formData.rainfall}mm
Average Humidity: ${formData.humidity}%
Soil Type: ${formData.soilType}
Soil pH: ${formData.soilPh}
Previous Crop: ${formData.previousCrop}

When the location is in Oromia (or Ethiopia generally, or unspecified), give strong preference to crops actually grown in that zone's real agricultural pattern: teff and wheat/barley across the dega and woyna dega highlands (North Shewa, West Shewa, Arsi, Bale, West Arsi); maize and haricot bean across woyna dega and kolla (Jimma, Illubabor, Buno Bedele, East/West Wollega, Horo Guduru Wollega); coffee in the woyna dega zones of Jimma, Illubabor, and Buno Bedele; enset (false banana) in the highland-fringe woyna dega areas of Jimma, Illubabor, and Guji; khat and sorghum in the drier kolla zones of East/West Hararghe and Bale; sorghum and pastoralism-adjacent crops in Borana and Guji's lowlands. If the season given is "Meher" (the main rainy season, roughly June–September, harvested Oct–Jan), "Belg" (the short rains, roughly Feb–May), or "Bega" (the dry season, roughly June–Sept in some readings, or Oct-Jan depending on zone), reason using Ethiopia's actual agricultural calendar rather than Western four-season assumptions. Base fertilizer, yield, and market guidance on realistic conditions for Oromia smallholder farmers, and avoid recommending a crop from the same family as the previous crop where that would harm soil health via pest/disease carryover.

IMPORTANT: Write every value in Afaan Oromo (the Oromo language). Do NOT translate or alter the field labels themselves (keep them exactly in English as shown below, followed by a colon) — this is required so the response can be parsed automatically. Only the text after each colon should be in Afaan Oromo.

Provide a detailed recommendation in this exact format:
Recommended Crop: [maqaa midhaanii Afaan Oromootiin]
Scientific Explanation: [sababa haala kanaaf midhaan kun akka ta'u godhu himoota 2-3 Afaan Oromootiin, naannoo qilleensaa (dega/woyna dega/kolla) fi godina Oromiyaa yoo beekame caqasuu dabalatee]
Expected Yield: [oomisha hektaara tokko irratti eegamu Afaan Oromootiin]
Growing Duration: [guyyaa/ji'a facaasaa irraa hanga haamaatti Afaan Oromootiin]
Water Requirement: [mm waggaa tokkotti ykn yeroo dhangala'aa Afaan Oromootiin]
Fertilizer Advice: [gorsa NPK addaa fi xurii biqiltuu uumamaa Afaan Oromootiin]
Profitability Estimate: [tilmaama galii hektaara tokko irratti Afaan Oromootiin]
Market Demand: [ibsa fedhii gabaa yeroo ammaa Afaan Oromootiin]`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        // Raised from no explicit limit: these models "think" before
        // answering, sharing the same token budget as the visible answer.
        // A generous cap avoids the response getting cut off partway through.
        maxOutputTokens: 8192
      }
    };

    const MAX_RETRIES = 3;

    for (let m = 0; m < GEMINI_MODELS.length; m++) {
      const url = GEMINI_BASE + GEMINI_MODELS[m] + ':generateContent';

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // Update button text so user sees progress
        if (submitBtnText) {
          if (attempt > 1) {
            submitBtnText.textContent = `Sarviisiin qabama jira — irra deebi'ee yaalaa jira (${attempt}/${MAX_RETRIES})…`;
          } else if (m > 0) {
            submitBtnText.textContent = 'Moodeela deeggarsaa yaalaa jira…';
          } else {
            submitBtnText.textContent = 'Gorsa AI argachaa jira…';
          }
        }

        const response = await fetch(url, {
          method:  'POST',
          headers: {
            'Content-Type':   'application/json',
            'X-goog-api-key': getGeminiKey(),
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = await response.json();

          if (!data.candidates || !data.candidates[0] ||
              !data.candidates[0].content || !data.candidates[0].content.parts) {
            throw new Error('Deebiin Gemini irraa eegamaa hin turre. Maaloo irra deebi\'ii yaali.');
          }

          // If the response was cut off before finishing, don't silently show
          // "Hin argamne" for every field — tell the user clearly to retry.
          if (data.candidates[0].finishReason === 'MAX_TOKENS') {
            throw new Error('Deebiin Gemini utuu hin xumuramin dhaabate. Maaloo irra deebi\'ii yaali.');
          }

          const text = data.candidates[0].content.parts[0].text;
          return {
            crop:        extractSection(text, 'Recommended Crop'),
            explanation: extractSection(text, 'Scientific Explanation'),
            yield:       extractSection(text, 'Expected Yield'),
            duration:    extractSection(text, 'Growing Duration'),
            water:       extractSection(text, 'Water Requirement'),
            fertilizer:  extractSection(text, 'Fertilizer Advice'),
            profit:      extractSection(text, 'Profitability Estimate'),
            market:      extractSection(text, 'Market Demand'),
          };
        }

        if (response.status === 503) {
          if (attempt < MAX_RETRIES) {
            await sleep(1000 * Math.pow(2, attempt - 1)); // 1s, 2s, 4s
            continue;
          }
          break; // try next model
        }

        // 404 = model retired/unknown — skip to next model
        if (response.status === 404) {
          break;
        }

        // 401/403 = bad or missing API key
        if (response.status === 401 || response.status === 403) {
          throw new Error('Furtiin API kee sirrii miti ykn dhumeera. "Furtii API Kee Bulchi" cuqaasiitii furtii haaraa galchi.');
        }

        // Non-503/404/401/403 error — fail immediately
        const errBody = await response.text().catch(() => '');
        throw new Error('Gemini ' + response.status + ': ' + errBody.slice(0, 200));
      }
    }

    throw new Error('Moodeelonni AI hundi yeroo ammaa itti fe\'amaniiru. Maaloo xinnoo eegii irra deebi\'ii yaali.');
  }

  // ── renderOutput(result) ─────────────────────────────────────────
  // Populates all #out-* elements and shows the output panel.
  function renderOutput(result) {
    if (outCrop)        outCrop.textContent        = result.crop;
    if (outExplanation) outExplanation.textContent = result.explanation;
    if (outYield)       outYield.textContent       = result.yield;
    if (outDuration)    outDuration.textContent    = result.duration;
    if (outWater)       outWater.textContent       = result.water;
    if (outFertilizer)  outFertilizer.textContent  = result.fertilizer;
    if (outProfit)      outProfit.textContent      = result.profit;
    if (outMarket)      outMarket.textContent      = result.market;

    outputPanel.removeAttribute('hidden');
    outputPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ── Validate form ────────────────────────────────────────────────
  function validateForm() {
    const errors = [];

    FIELDS.forEach(function (field) {
      const el      = document.getElementById(field.id);
      const errorEl = document.getElementById(field.id + '-error');
      if (!el || !errorEl) return;

      errorEl.textContent = '';
      el.classList.remove('form-input--error', 'form-select--error');

      const value = el.value.trim();

      if (field.required && value === '') {
        const msg = field.label + ' barbaachisaadha';
        errorEl.textContent = msg;
        el.classList.add(field.type === 'select' ? 'form-select--error' : 'form-input--error');
        errors.push({ fieldId: field.id, message: msg });
        return;
      }

      if (field.type === 'number' && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num)) {
          const msg = field.label + ' lakkoofsa sirrii ta\'uu qaba';
          errorEl.textContent = msg;
          el.classList.add('form-input--error');
          errors.push({ fieldId: field.id, message: msg });
          return;
        }
        if (field.min !== undefined && num < field.min) {
          const msg = field.label + ' yoo xiqqaate ' + field.min + ' ta\'uu qaba';
          errorEl.textContent = msg;
          el.classList.add('form-input--error');
          errors.push({ fieldId: field.id, message: msg });
          return;
        }
        if (field.max !== undefined && num > field.max) {
          const msg = field.label + ' ' + field.max + ' ol ta\'uu hin qabu';
          errorEl.textContent = msg;
          el.classList.add('form-input--error');
          errors.push({ fieldId: field.id, message: msg });
        }
      }
    });

    return errors;
  }

  // ── Clear all field errors ───────────────────────────────────────
  function clearAllErrors() {
    FIELDS.forEach(function (field) {
      const errorEl = document.getElementById(field.id + '-error');
      const el      = document.getElementById(field.id);
      if (errorEl) errorEl.textContent = '';
      if (el) el.classList.remove('form-input--error', 'form-select--error');
    });
  }

  // ── Collect form values into an object ───────────────────────────
  function collectFormData() {
    const result = {};
    FIELDS.forEach(function (field) {
      const el = document.getElementById(field.id);
      result[field.id] = el ? el.value.trim() : '';
    });
    return result;
  }

  // ── Form submit handler ──────────────────────────────────────────
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAllErrors();

    // Hide any previous API error
    if (apiErrorEl) {
      apiErrorEl.textContent = '';
      apiErrorEl.setAttribute('hidden', '');
    }

    const errors = validateForm();
    if (errors.length > 0) {
      const firstEl = document.getElementById(errors[0].fieldId);
      if (firstEl) firstEl.focus();
      outputPanel.setAttribute('hidden', '');
      return;
    }

    if (!getGeminiKey()) {
      if (apiErrorEl) {
        apiErrorEl.textContent = 'Duraan dursii furtii API Gemini kee galchi ("Furtii API Kee Bulchi" cuqaasi).';
        apiErrorEl.removeAttribute('hidden');
      }
      if (window.AgroAISettings) window.AgroAISettings.openModal();
      outputPanel.setAttribute('hidden', '');
      return;
    }

    // Disable submit button and show loading state
    if (submitBtn) submitBtn.disabled = true;
    if (submitBtnText) submitBtnText.textContent = 'Gorsa AI argachaa jira...';

    try {
      const formData = collectFormData();
      const result   = await getAICropRecommendation(formData);
      renderOutput(result);
    } catch (error) {
      if (apiErrorEl) {
        apiErrorEl.textContent = error.message || 'Gorsa AI hin milkoofne. Maaloo irra deebi\'ii yaali.';
        apiErrorEl.removeAttribute('hidden');
      }
      outputPanel.setAttribute('hidden', '');
    } finally {
      // Re-enable submit button
      if (submitBtn) submitBtn.disabled = false;
      if (submitBtnText) submitBtnText.textContent = 'Gorsa Midhaanii Koo Argadhu';
    }
  });

  // ── Reset handler ────────────────────────────────────────────────
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      form.reset();
      clearAllErrors();
      outputPanel.setAttribute('hidden', '');
      if (apiErrorEl) {
        apiErrorEl.textContent = '';
        apiErrorEl.setAttribute('hidden', '');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

});
