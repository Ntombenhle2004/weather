<img src="https://socialify.git.ci/Ntombenhle2004/weather/image?language=1&owner=1&name=1&stargazers=1&theme=Light" alt="weather" width="640" height="320" />

# Weather Application (React + Vite + TypeScript)

A modern weather application built with **React 19**, **Vite**, and **TypeScript**.  
It fetches real-time weather data using the **OpenWeather API**, supports **geolocation**, **unit toggling (°C/°F)**, **theme switching (Light/Dark)**, and allows saving favorite locations.  

---

##  Features

- **Search by city name** with live suggestions.
-  **Use current location** via browser geolocation.
-  **Current weather card** (temperature, humidity, wind).
-  **Forecasts**:
  - Daily (10-day max/min temperatures & precipitation).
  - Hourly (24-hour temperature, humidity, wind).
-  **History tracking** (last 10 searches stored locally).
-  **Save & remove favorite locations** (persisted in localStorage).
- **Theme toggle**: Light / Dark mode.
-  **Unit toggle**: Celsius / Fahrenheit.
-  **Offline support**: cached history & saved data available when offline.
-  **Notifications & alerts** for success, errors, and info.

---

## Tech Stack

- **React 19** (functional components + hooks)
- **TypeScript**
- **Vite** (dev/build tool)
- **React Router v7**
- **LocalStorage** (for persistence)
- **OpenWeather API**
- **OpenStreetMap Nominatim** (reverse geocoding)

---

## Dependencies

Main libraries:

- `react` ^19.1.1
- `react-dom` ^19.1.1
- `react-router-dom` ^7.9.3

Dev tools:

- `vite` ^7.1.7
- `typescript` ~5.8.3
- `@vitejs/plugin-react` ^5.0.3
- `eslint` ^9.36.0
- `typescript-eslint` ^8.44.0

---

   ```bash
   VITE_OPENWEATHER_API_KEY=your_api_key_here
   ```

3. Restart the dev server after adding the key.

---

## Running the Project

Clone and install dependencies:

```bash
git clone https://github.com/Ntombenhle2004/weather.git
cd weather-app
npm install
```

Run development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

---

## Project Structure

```
src/
 ├── components/
 │    ├── SearchBar.tsx
 │    ├── ThemeToggle.tsx
 │    ├── CurrentWeatherCard.tsx
 │    ├── SavedLocations.tsx
 │    └── WeatherAlerts.tsx
 ├── pages/
 │    └── Home.tsx        # Main app page
 ├── App.tsx              # Router setup
 ├── main.tsx             # Entry point
 └── index.css / App.css  # Styles
```

---

## Geolocation & Reverse Geocoding

- Uses `navigator.geolocation` API to get coordinates.
- Falls back between **OpenStreetMap Nominatim** and **OpenWeather Geo API** to resolve city/country.

---



##  License

MIT License © 2025 — Built for learning & demo purposes.

