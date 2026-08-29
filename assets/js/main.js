/**
 * main.js — Agro AI shared behavior
 *
 * Loads on every page. Handles: Lucide icon init, dark mode toggle,
 * active nav link detection, hamburger menu, footer year, Learning Center
 * category filtering, contact form validation, smooth scroll, and Gemini AI.
 */

// ============================================
// 🔑 GEMINI API KEY — YOUR KEY
// ============================================
const GEMINI_API_KEY = "AQ.Ab8RN6LwJfVU_nbROLOINShtUWiWWCwZOy7WEv2XaphyG1p9xg";

document.addEventListener('DOMContentLoaded', function () {

  // ─────────────────────────────────────────────
  // Lucide icon initialization
  // ─────────────────────────────────────────────
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // ─────────────────────────────────────────────
  // Dark mode toggle
  // ─────────────────────────────────────────────
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const themeIcon = document.getElementById('theme-icon');

  function updateToggleUI(theme) {
    if (!darkModeToggle || !themeIcon) return;

    if (theme === 'dark') {
      darkModeToggle.setAttribute('aria-label', 'Switch to light mode');
      themeIcon.setAttribute('data-lucide', 'sun');
    } else {
      darkModeToggle.setAttribute('aria-label', 'Switch to dark mode');
      themeIcon.setAttribute('data-lucide', 'moon');
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ root: themeIcon.parentElement || document.body });
    }
  }

  const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
  updateToggleUI(initialTheme);

  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = current === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('agroai-theme', newTheme);
      updateToggleUI(newTheme);
    });
  }

  // ─────────────────────────────────────────────
  // Active navigation link detection
  // ─────────────────────────────────────────────
  const pathname = window.location.pathname;
  const currentFile = pathname.split('/').pop() || 'index.html';

  document.querySelectorAll('.nav-link').forEach(function (link) {
    link.classList.remove('nav-link--active');

    const linkHref = link.getAttribute('href');
    if (linkHref === currentFile) {
      link.classList.add('nav-link--active');
    }
  });

  // ─────────────────────────────────────────────
  // Hamburger menu
  // ─────────────────────────────────────────────
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navMenu = document.getElementById('nav-menu');

  function openMenu() {
    if (!navMenu || !hamburgerBtn) return;
    navMenu.classList.add('nav-menu--open');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    hamburgerBtn.setAttribute('aria-label', 'Close navigation menu');

    const firstLink = navMenu.querySelector('.nav-link');
    if (firstLink) firstLink.focus();
  }

  function closeMenu() {
    if (!navMenu || !hamburgerBtn) return;
    navMenu.classList.remove('nav-menu--open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    hamburgerBtn.setAttribute('aria-label', 'Open navigation menu');
    hamburgerBtn.focus();
  }

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', function () {
      const isOpen = navMenu && navMenu.classList.contains('nav-menu--open');
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && navMenu && navMenu.classList.contains('nav-menu--open')) {
      closeMenu();
    }
  });

  document.addEventListener('click', function (e) {
    if (!navMenu || !navMenu.classList.contains('nav-menu--open')) return;

    const navbar = document.querySelector('.navbar');
    if (navbar && !navbar.contains(e.target)) {
      closeMenu();
    }
  });

  // ─────────────────────────────────────────────
  // Copyright year in footer
  // ─────────────────────────────────────────────
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ─────────────────────────────────────────────
  // Learning Center category filtering
  // ─────────────────────────────────────────────
  const categoryTablist = document.querySelector('.category-tablist');

  if (categoryTablist) {
    const tabs = Array.from(document.querySelectorAll('.category-tab'));
    const cards = Array.from(document.querySelectorAll('.content-card'));

    function filterByCategory(selectedCategory) {
      tabs.forEach(function (tab) {
        const isSelected = tab.dataset.category === selectedCategory;
        tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });

      cards.forEach(function (card) {
        if (card.dataset.category === selectedCategory) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        filterByCategory(tab.dataset.category);
      });
    });

    if (tabs.length > 0) {
      tabs[0].click();
    }
  }

  // ─────────────────────────────────────────────
  // Contact form validation
  // ─────────────────────────────────────────────
  const contactForm = document.getElementById('contact-form');

  if (contactForm) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const nameField    = document.getElementById('name');
      const emailField   = document.getElementById('email');
      const messageField = document.getElementById('message');

      const nameError    = document.getElementById('name-error');
      const emailError   = document.getElementById('email-error');
      const messageError = document.getElementById('message-error');
      const successBox   = document.getElementById('contact-success');

      if (nameError)    nameError.textContent    = '';
      if (emailError)   emailError.textContent   = '';
      if (messageError) messageError.textContent = '';

      let hasError = false;
      let firstInvalidField = null;

      if (nameField && nameField.value.trim() === '') {
        if (nameError) nameError.textContent = 'Name is required';
        hasError = true;
        if (!firstInvalidField) firstInvalidField = nameField;
      }

      if (emailField) {
        if (emailField.value.trim() === '') {
          if (emailError) emailError.textContent = 'Email is required';
          hasError = true;
          if (!firstInvalidField) firstInvalidField = emailField;
        } else if (!emailRegex.test(emailField.value.trim())) {
          if (emailError) emailError.textContent = 'Please enter a valid email address';
          hasError = true;
          if (!firstInvalidField) firstInvalidField = emailField;
        }
      }

      if (messageField && messageField.value.trim() === '') {
        if (messageError) messageError.textContent = 'Message is required';
        hasError = true;
        if (!firstInvalidField) firstInvalidField = messageField;
      }

      if (hasError) {
        if (firstInvalidField) firstInvalidField.focus();
        return;
      }

      if (successBox) {
        successBox.removeAttribute('hidden');

        setTimeout(function () {
          successBox.setAttribute('hidden', '');
        }, 5000);
      }

      contactForm.reset();
    });
  }

  // ─────────────────────────────────────────────
  // Smooth scroll for anchor links
  // ─────────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

}); // end DOMContentLoaded

// ============================================
// 🤖 GEMINI AI FUNCTIONS (Available Globally)
// ============================================

/**
 * Call Gemini API with text prompt
 */
async function callGemini(prompt) {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            console.error('Gemini API Error:', error);
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
        
    } catch (error) {
        console.error('Error calling Gemini:', error);
        return null;
    }
}

/**
 * Call Gemini Vision API with image
 */
async function callGeminiVision(prompt, imageBase64) {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: "image/jpeg",
                                    data: imageBase64
                                }
                            }
                        ]
                    }]
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            console.error('Gemini Vision API Error:', error);
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
        
    } catch (error) {
        console.error('Error calling Gemini Vision:', error);
        return null;
    }
}

// ============================================
// 🌾 AGRO AI SPECIFIC FUNCTIONS
// ============================================

/**
 * Detect crop disease from image
 */
async function detectDisease(imageBase64, cropType) {
    const prompt = `You are an agricultural expert specializing in Ethiopian crops. Analyze this ${cropType} plant image.

Provide a detailed analysis in this exact format:

**Symptoms Observed:**
[Describe visible symptoms]

**Possible Diseases:**
[List 2-3 likely diseases with brief descriptions]

**Confidence Level:** [High/Medium/Low]

**Treatment Recommendations:**
[Practical, actionable steps for Ethiopian farmers]

**Prevention Tips:**
[How to prevent this in the future]

Be specific, practical, and use language that's easy for farmers to understand.`;

    const result = await callGeminiVision(prompt, imageBase64);
    return result || "⚠️ Unable to analyze the image. Please try again with a clearer photo.";
}

/**
 * Get crop recommendation based on location and conditions
 */
async function getCropRecommendation(region, soilType, season) {
    const prompt = `You are an agricultural expert in Ethiopia.

Recommend the best crops for:
- Region: ${region}
- Soil Type: ${soilType}
- Season: ${season}

Provide recommendations in this format:

**Top 5 Recommended Crops:**
1. [Crop name] - [Brief reason]
2. [Crop name] - [Brief reason]
...

**Expected Yield:** [per hectare]

**Planting & Harvesting Months:** [When to plant and harvest]

**Water Requirements:** [How much water needed]

**Common Challenges & Solutions:** [Potential problems and fixes]

Focus on crops that are culturally relevant and practical for Ethiopian farmers.`;

    const result = await callGemini(prompt);
    return result || "⚠️ Unable to get recommendations. Please try again.";
}

/**
 * Get weather-based farming advice
 */
async function getWeatherAdvice(weatherData) {
    const prompt = `Based on this weather forecast: ${JSON.stringify(weatherData)}

Provide farming advice for the next 7 days:

**Best Times for Planting:** [When to plant]

**Irrigation Recommendations:** [When and how much to water]

**Pest Risk Assessment:** [What pests to watch for]

**Harvesting Advice:** [If applicable]

**General Tips:** [Any other practical advice]

Be specific to Ethiopian farming conditions.`;

    const result = await callGemini(prompt);
    return result || "⚠️ Unable to generate weather advice. Please try again.";
}

/**
 * Generate farming tips based on crop and season
 */
async function getFarmingTips(cropType, season) {
    const prompt = `You are an agricultural expert. Provide practical farming tips for ${cropType} during the ${season} season in Ethiopia.

Include:
1. Soil preparation
2. Planting depth and spacing
3. Fertilizer recommendations
4. Irrigation schedule
5. Pest control
6. Harvesting signs

Keep it practical and easy to understand.`;

    const result = await callGemini(prompt);
    return result || "⚠️ Unable to generate farming tips. Please try again.";
}

// ============================================
// 📤 EXPOSE FUNCTIONS GLOBALLY
// ============================================
window.callGemini = callGemini;
window.callGeminiVision = callGeminiVision;
window.detectDisease = detectDisease;
window.getCropRecommendation = getCropRecommendation;
window.getWeatherAdvice = getWeatherAdvice;
window.getFarmingTips = getFarmingTips;
