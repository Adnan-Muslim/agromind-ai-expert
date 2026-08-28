// recommendation.js — Agro AI Crop Recommendation Page
// Handles: form validation, Gemini AI crop recommendation, reset

document.addEventListener('DOMContentLoaded', function () {

  // ── Field configuration ──────────────────────────────────────────
  const FIELDS = [
    { id: 'country',      label: 'Country',            type: 'text',   required: true },
    { id: 'region',       label: 'Region',             type: 'text',   required: true },
    { id: 'season',       label: 'Growing Season',     type: 'select', required: true },
    { id: 'temperature',  label: 'Temperature',        type: 'number', required: true, min: -20, max: 60 },
    { id: 'rainfall',     label: 'Annual Rainfall',    type: 'number', required: true, min: 0 },
    { id: 'humidity',     label: 'Average Humidity',   type: 'number', required: true, min: 0, max: 100 },
    { id: 'soilType',     label: 'Soil Type',          type: 'select', required: true },
    { id: 'soilPh',       label: 'Soil pH',            type: 'number', required: true, min: 0, max: 14 },
    { id: 'previousCrop', label: 'Previous Crop',      type: 'text',   required: true },
  ];

  // ── Gemini API configuration ─────────────────────────────────────
  const GEMINI_API_KEY  = 'AQ.Ab8RN6KwVq_kpG0T3wMN2GABeEjIwockMOl60zYxxp5q2ivBhA';
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
    return match ? match[1].trim() : 'Not available';
  }

  // ── getAICropRecommendation(formData) ────────────────────────────
  // Calls Gemini with retry + model fallback to handle 503 overload errors.
  async function getAICropRecommendation(formData) {
    const prompt = `You are an expert agricultural advisor specialising in Ethiopian farming systems, with particular depth on Oromia and the Ethiopian highlands/lowlands. Based on the following farm conditions, recommend the best crop to grow.

Country: ${formData.country}
Region: ${formData.region}
Season: ${formData.season}
Average Temperature: ${formData.temperature}°C
Annual Rainfall: ${formData.rainfall}mm
Average Humidity: ${formData.humidity}%
Soil Type: ${formData.soilType}
Soil pH: ${formData.soilPh}
Previous Crop: ${formData.previousCrop}

When the location is in Ethiopia (or unspecified), give strong preference to crops well-suited to Ethiopian agriculture — such as teff, enset (false banana), coffee, wheat, barley, sorghum, maize, and haricot bean — where the conditions support them, and mention the Amharic and/or Afaan Oromo name for the recommended crop in brackets if well known. Base fertilizer, yield, and market guidance on realistic conditions for Ethiopian smallholder farmers.

Provide a detailed recommendation in this exact format:
Recommended Crop: [crop name with scientific name in brackets]
Scientific Explanation: [2-3 sentences explaining why this crop suits these conditions]
Expected Yield: [expected yield per hectare]
Growing Duration: [days/months from planting to harvest]
Water Requirement: [mm per season or irrigation frequency]
Fertilizer Advice: [specific NPK and organic recommendations]
Profitability Estimate: [estimated income range per hectare]
Market Demand: [current market demand description]`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    const MAX_RETRIES = 3;

    for (let m = 0; m < GEMINI_MODELS.length; m++) {
      const url = GEMINI_BASE + GEMINI_MODELS[m] + ':generateContent';

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // Update button text so user sees progress
        if (submitBtnText) {
          if (attempt > 1) {
            submitBtnText.textContent = `Server busy — retrying (${attempt}/${MAX_RETRIES})…`;
          } else if (m > 0) {
            submitBtnText.textContent = 'Trying backup model…';
          } else {
            submitBtnText.textContent = 'Getting AI recommendation…';
          }
        }

        const response = await fetch(url, {
          method:  'POST',
          headers: {
            'Content-Type':   'application/json',
            'X-goog-api-key': GEMINI_API_KEY,
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = await response.json();
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

        // Non-503/404 error — fail immediately
        const errBody = await response.text().catch(() => '');
        throw new Error('Gemini ' + response.status + ': ' + errBody.slice(0, 200));
      }
    }

    throw new Error('All AI models are currently overloaded. Please wait a moment and try again.');
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
        const msg = field.label + ' is required';
        errorEl.textContent = msg;
        el.classList.add(field.type === 'select' ? 'form-select--error' : 'form-input--error');
        errors.push({ fieldId: field.id, message: msg });
        return;
      }

      if (field.type === 'number' && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num)) {
          const msg = field.label + ' must be a valid number';
          errorEl.textContent = msg;
          el.classList.add('form-input--error');
          errors.push({ fieldId: field.id, message: msg });
          return;
        }
        if (field.min !== undefined && num < field.min) {
          const msg = field.label + ' must be at least ' + field.min;
          errorEl.textContent = msg;
          el.classList.add('form-input--error');
          errors.push({ fieldId: field.id, message: msg });
          return;
        }
        if (field.max !== undefined && num > field.max) {
          const msg = field.label + ' must be no more than ' + field.max;
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

    // Disable submit button and show loading state
    if (submitBtn) submitBtn.disabled = true;
    if (submitBtnText) submitBtnText.textContent = 'Getting AI recommendation...';

    try {
      const formData = collectFormData();
      const result   = await getAICropRecommendation(formData);
      renderOutput(result);
    } catch (error) {
      if (apiErrorEl) {
        apiErrorEl.textContent = error.message || 'AI recommendation failed. Please try again.';
        apiErrorEl.removeAttribute('hidden');
      }
      outputPanel.setAttribute('hidden', '');
    } finally {
      // Re-enable submit button
      if (submitBtn) submitBtn.disabled = false;
      if (submitBtnText) submitBtnText.textContent = 'Get My Crop Recommendation';
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
