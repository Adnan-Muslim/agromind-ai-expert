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
    const t   = c.temperature_2m;
    const h   = c.relative_humidity_2m;
    const p   = c.precipitation;
    const uv  = c.uv_index;
    const w   = c.wind_speed_10m;

    if      (t > 35)          parts.push(`🌡️ Ho'ni har'a ${t}°C dha — akka malee guddaa. Dhangala'aa dabali, gaaddisas midhaan tuqama qabuuf kenni.`);
    else if (t > 30)          parts.push(`🌡️ Ho'ni har'a ${t}°C dha — giddu-galeessaa ol. Dhangala'aa yeroo sirriitti hordofi.`);
    else if (t < 5)           parts.push(`❄️ Ho'ni har'a ${t}°C dha — sodaa qorraa. Midhaan tuqama qabu haguuggi, har'as biqiltuu dhaabuu irraa of qusadhu.`);
    else if (t < 12)          parts.push(`🌥️ Ho'ni har'a ${t}°C dha — qabbanaa'aa. Biqiltuu haaraa dhaabuuf yeroo eegi.`);
    else if (t >= 20 && t <= 30) parts.push(`🌱 Ho'ni har'a ${t}°C dha — midhaan hedduuf gaarii. Guyyaa facaasaaf ykn hojii lafa qonnaatiif gaarii dha.`);
    else                       parts.push(`🌡️ Ho'ni har'a ${t}°C dha.`);

    if      (p > 10)          parts.push(`🌧️ Roobni har'a ${p} mm ta'e argameera — guddaa dha. Dhangala'aa dhiisi, bishaan lafa irratti hafuus ilaali.`);
    else if (p > 2)           parts.push(`🌦️ Roobni har'a ${p} mm ta'e argameera. Dhangala'aa xiqqeessi.`);
    else if (p === 0 && h < 40) parts.push(`💧 Har'a rooba hin qabu, jiidhinnis ${h}% gadi bu'aa dha — haala gogaa. Ganama barii ykn galgala dhangala'i.`);

    if  (h > 85)  parts.push(`🍄 Jiidhinni qilleensaa har'a ${h}% dha — akka malee ol'aanaa. Dhukkuba fangasii baala irratti cimsii eeggadhu.`);
    else if (h > 70) parts.push(`🍄 Jiidhinni qilleensaa har'a ${h}% dha. Dhukkuba fangasii baala irratti eeggadhu.`);

    if  (uv > 8)  parts.push(`☀️ Sadarkaan UV har'a ${uv} dha — baay'ee ol'aanaa. Hojii alaa hojjettu yeroo, of eeggannoo aduu godhadhu.`);
    if  (w > 30)  parts.push(`💨 Bubbeen har'a km/sa'atiitti ${w} ta'e — jabaadha. Har'a sprei ilbiisaa godhuu irraa of qusadhu.`);

    return parts.length ? parts.join(' ') : `✅ Haalli har'a gaarii dha (Ho'a ${t}°C, Jiidhina ${h}%). Hojii qonnaa idilee itti fufi.`;
  }

  // ── Farming advice (tomorrow) ─────────────────────────────────────
  function generateTomorrowAdvice(daily) {
    const rain = daily.precipitation_sum  && daily.precipitation_sum[1];
    const tmax = daily.temperature_2m_max && daily.temperature_2m_max[1];
    const parts = [];

    if      (rain > 10) parts.push(`🌧️ Boru roobni ${rain} mm ta'e eegama — guddaa dha. Bishaan lafa keessaa baasuu qopheessi, hojii mana keessaa karoorsi.`);
    else if (rain > 2)  parts.push(`🌦️ Boru roobni ${rain} mm ta'e eegama. Haalli biqiltuu dhaabuuf gaarii dha.`);
    else if (rain > 0)  parts.push(`🌦️ Boru roobni xiqqoo (${rain} mm) eegama.`);
    else                parts.push(`☀️ Boru guyyaa gogaa (rooba 0 mm) ta'a. Dhangala'aa karoorsi, haguuggii biyyee (mulching) yaadi.`);

    if      (tmax > 35) parts.push(`🌡️ Boru ho'ni ol'aanaa ${tmax}°C ga'a. Ganama barii hojjedhu, midhaan bishaan gahaa qabaachuu isaa mirkaneessi.`);
    else if (tmax < 10) parts.push(`❄️ Boru ho'ni gadi bu'aa ${tmax}°C ga'a. Midhaan tuqama qabu eeggadhu.`);

    return parts.length ? parts.join(' ') : `✅ Boru haalli qilleensaa hamaan hin jiru (Ho'a ol'aanaa ${tmax}°C, Rooba ${rain} mm). Hojii idilee itti fufuu dandeessa.`;
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
        setText(errorEl, 'Yeroon gaaffii dhumeera. Tajaajilli haala qilleensaa suuta jira — maaloo irra deebi\'ii yaali.');
      } else if (err.message === 'LOCATION_NOT_FOUND') {
        setText(errorEl, 'Bakki hin argamne. Maaloo maqaa magaalaa biraa yaali.');
      } else {
        setText(errorEl, 'Daataa haala qilleensaa fiduun hin milkoofne. Maaloo walqunnamtii intarneetii kee mirkaneeffadhuutii irra deebi\'ii yaali.');
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
      setText(locationErrorEl, 'Maaloo bakka seensisi');
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
