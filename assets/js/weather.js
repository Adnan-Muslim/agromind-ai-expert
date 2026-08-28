// weather.js — Agro AI Weather Page
// Open-Meteo free API — no API key required
// Optimisations: AbortController timeout, result caching, minimal payload

document.addEventListener('DOMContentLoaded', function () {

  // ── DOM references ──────────────────────────────────────────────
  const locationInput    = document.getElementById('location');
  const getWeatherBtn    = document.getElementById('get-weather-btn');
  const loadingEl        = document.getElementById('weather-loading');
  const errorEl          = document.getElementById('weather-error');
  const locationErrorEl  = document.getElementById('location-error');
  const weatherCardsEl   = document.getElementById('weather-cards');
  const farmingAdviceEl  = document.getElementById('farming-advice');
  const tomorrowAdviceEl = document.getElementById('tomorrow-advice');

  const valTemperature     = document.getElementById('val-temperature');
  const valHumidity        = document.getElementById('val-humidity');
  const valRainfall        = document.getElementById('val-rainfall');
  const valWind            = document.getElementById('val-wind');
  const valUV              = document.getElementById('val-uv');
  const valSunrise         = document.getElementById('val-sunrise');
  const valSunset          = document.getElementById('val-sunset');
  const todayAdviceText    = document.getElementById('today-advice-text');
  const tomorrowAdviceText = document.getElementById('tomorrow-advice-text');

  // ── Simple in-memory cache { cityKey -> { data, ts } } ──────────
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const cache = {};

  // ── Helpers ──────────────────────────────────────────────────────
  function show(el)          { if (el) el.removeAttribute('hidden'); }
  function hide(el)          { if (el) el.setAttribute('hidden', ''); }
  function setText(el, text) { if (el) el.textContent = text; }

  function clearResults() {
    hide(weatherCardsEl);
    hide(farmingAdviceEl);
    hide(tomorrowAdviceEl);
    hide(errorEl);
    setText(errorEl, '');
  }

  // ── fetchWithTimeout — aborts after ms milliseconds ──────────────
  function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }

  // ── Geocode city — returns { latitude, longitude, name } ─────────
  async function geocodeCity(name) {
    const url =
      'https://geocoding-api.open-meteo.com/v1/search' +
      '?name=' + encodeURIComponent(name) +
      '&count=1&language=en&format=json';

    const res = await fetchWithTimeout(url, 5000); // 5 s timeout
    if (!res.ok) throw new Error('API_ERROR');
    const json = await res.json();
    if (!json.results || json.results.length === 0) throw new Error('LOCATION_NOT_FOUND');
    const r = json.results[0];
    return { latitude: r.latitude, longitude: r.longitude, name: r.name };
  }

  // ── Fetch forecast — minimal parameters for speed ────────────────
  async function fetchForecast(lat, lon) {
    // Request only the fields we actually display to keep the payload small
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      '?latitude='  + lat +
      '&longitude=' + lon +
      '&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,uv_index' +
      '&daily=sunrise,sunset,precipitation_sum,temperature_2m_max' +
      '&timezone=auto' +
      '&forecast_days=2';

    const res = await fetchWithTimeout(url, 7000); // 7 s timeout
    if (!res.ok) throw new Error('API_ERROR');
    return res.json();
  }

  // ── Render 7 weather cards ────────────────────────────────────────
  function renderWeatherCards(data) {
    const c = data.current;
    const d = data.daily;

    function val(v) { return v !== undefined && v !== null ? v : '—'; }

    setText(valTemperature, val(c.temperature_2m));
    setText(valHumidity,    val(c.relative_humidity_2m));
    setText(valRainfall,    val(c.precipitation));
    setText(valWind,        val(c.wind_speed_10m));
    setText(valUV,          val(c.uv_index));

    function fmtTime(iso) {
      if (!iso) return '—';
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    setText(valSunrise, fmtTime(d && d.sunrise && d.sunrise[0]));
    setText(valSunset,  fmtTime(d && d.sunset  && d.sunset[0]));

    show(weatherCardsEl);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ── Farming advice (today) ────────────────────────────────────────
  function generateFarmingAdvice(c) {
    const parts = [];
    if      (c.temperature_2m > 35)                          parts.push('🌡️ High heat stress. Increase irrigation and provide shade for sensitive crops.');
    else if (c.temperature_2m < 5)                           parts.push('❄️ Frost risk. Cover sensitive crops and avoid transplanting seedlings today.');
    else if (c.temperature_2m >= 20 && c.temperature_2m <= 30) parts.push('🌱 Ideal temperature for most crops. Great day for planting or field work.');

    if      (c.precipitation > 10)                           parts.push('🌧️ Heavy rain detected. Skip irrigation and check for waterlogging.');
    else if (c.precipitation === 0 && c.relative_humidity_2m < 40) parts.push('💧 Dry conditions. Irrigate in the early morning or evening.');

    if  (c.relative_humidity_2m > 80) parts.push('🍄 High humidity — watch for fungal disease on leaves.');
    if  (c.uv_index > 8)              parts.push('☀️ Very high UV. Wear sun protection during outdoor work.');
    if  (c.wind_speed_10m > 30)       parts.push('💨 Strong winds. Avoid pesticide spraying today.');

    return parts.length ? parts.join(' ') : '✅ Conditions are favourable. Proceed with normal farming activities.';
  }

  // ── Farming advice (tomorrow) ─────────────────────────────────────
  function generateTomorrowAdvice(daily) {
    const rain = daily.precipitation_sum  && daily.precipitation_sum[1];
    const tmax = daily.temperature_2m_max && daily.temperature_2m_max[1];
    const parts = [];

    if      (rain > 10) parts.push('🌧️ Heavy rain expected tomorrow. Prepare drainage and plan indoor tasks.');
    else if (rain > 0)  parts.push('🌦️ Light rain forecast tomorrow. Good conditions for transplanting.');
    else                parts.push('☀️ Dry day tomorrow. Plan irrigation and consider mulching.');

    if (tmax > 35) parts.push('🌡️ Very hot tomorrow. Work early morning and keep crops well-watered.');

    return parts.length ? parts.join(' ') : '✅ No extreme weather tomorrow. Normal activities can proceed.';
  }

  // ── Main pipeline ─────────────────────────────────────────────────
  async function fetchAndRenderWeather(cityName) {
    const cacheKey = cityName.trim().toLowerCase();

    // Serve from cache if fresh
    const cached = cache[cacheKey];
    if (cached && (Date.now() - cached.ts < CACHE_TTL_MS)) {
      renderWeatherCards(cached.data);
      setText(todayAdviceText,    generateFarmingAdvice(cached.data.current));
      setText(tomorrowAdviceText, generateTomorrowAdvice(cached.data.daily));
      show(farmingAdviceEl);
      show(tomorrowAdviceEl);
      return;
    }

    clearResults();
    hide(locationErrorEl);
    show(loadingEl);
    getWeatherBtn.disabled = true;

    try {
      // Step 1: geocode (fast — small JSON response)
      const geo = await geocodeCity(cityName);

      // Step 2: forecast fetch
      const data = await fetchForecast(geo.latitude, geo.longitude);

      // Store in cache
      cache[cacheKey] = { data, ts: Date.now() };

      renderWeatherCards(data);
      setText(todayAdviceText,    generateFarmingAdvice(data.current));
      setText(tomorrowAdviceText, generateTomorrowAdvice(data.daily));
      show(farmingAdviceEl);
      show(tomorrowAdviceEl);

    } catch (err) {
      clearResults();
      if (err.name === 'AbortError') {
        setText(errorEl, 'Request timed out. The weather service is slow — please try again.');
      } else if (err.message === 'LOCATION_NOT_FOUND') {
        setText(errorEl, 'Location not found. Please try a different city name.');
      } else {
        setText(errorEl, 'Unable to fetch weather data. Please check your connection and try again.');
      }
      show(errorEl);
    } finally {
      hide(loadingEl);
      getWeatherBtn.disabled = false;
    }
  }

  // ── Button click ──────────────────────────────────────────────────
  getWeatherBtn.addEventListener('click', function () {
    const city = locationInput.value.trim();
    if (!city) {
      setText(locationErrorEl, 'Please enter a location');
      show(locationErrorEl);
      locationInput.focus();
      return;
    }
    hide(locationErrorEl);
    fetchAndRenderWeather(city);
  });

  // ── Enter key ─────────────────────────────────────────────────────
  locationInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') getWeatherBtn.click();
  });

});
