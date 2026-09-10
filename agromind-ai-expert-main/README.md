# Agro AI 🌱

Agro AI is an AI-powered farming assistant built for farmers across Ethiopia and Oromia. The interface is in Afaan Oromo throughout.

## Features

- 🌾 AI-powered crop recommendations (Gemini)
- 🐛 AI-powered crop disease detection from a photo (Gemini)
- 🌦️ Live weather forecast and farming advice (Open-Meteo, no key needed)

## Technologies

Plain static site — HTML, CSS, and vanilla JavaScript. No build step, no backend, no framework.

## Running it locally

This is a static site, so there's nothing to install or build. Just serve the folder:

```bash
# Option 1: Python's built-in server
python3 -m http.server 8000

# Option 2: Node's http-server (if you have it)
npx http-server .
```

Then open `http://localhost:8000` in your browser.

You can also just open `index.html` directly in a browser, though a local server is recommended so relative paths behave correctly.

## Setting up your Gemini API key

Both the **Disease Detection** and **Crop Recommendation** pages use Google's Gemini API. Since this is a static site with no server to hide a secret behind, **each visitor supplies their own free API key**, entered once in the browser:

1. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Open the site, go to Disease Detection or Crop Recommendation, and click **"Furtii API Kee Bulchi"** (Manage your API key)
3. Paste the key in — it's saved only in your own browser's local storage and is never sent anywhere except directly to Google's API

This also means: **no API key is ever committed to this repository.** If you're contributing, never hardcode a real key into `assets/js/upload.js` or `assets/js/recommendation.js` — it would be publicly visible in the repo and GitHub's secret scanning will flag and likely trigger revocation of the key.

## Project structure

```
├── index.html              Home page
├── disease.html            Disease detection (photo upload)
├── recommendation.html     Crop recommendation form
├── weather.html            Weather forecast
├── assets/
│   ├── css/                Stylesheets
│   └── js/
│       ├── main.js         Shared nav/theme/contact-form logic
│       ├── settings.js     Per-user Gemini API key manager
│       ├── upload.js       Disease detection + Gemini integration
│       ├── recommendation.js  Crop recommendation + Gemini integration
│       └── weather.js      Weather forecast (Open-Meteo)
└── components/             Reference copies of the shared navbar/footer markup
```

## Future Improvements

- Telegram or SMS bot for low-bandwidth access
- Community Q&A between farmers
- Crowdsourced, map-based disease outbreak reporting
- Offline mode

## License

MIT License.
