import React, { useEffect, useState } from "react";
import SearchBar from "../components/SearchBar";

// 1-decimal precision for better fidelity with API values
const cToF = (c: number) => Math.round(((c * 9) / 5 + 32) * 10) / 10;
const round = (n: number) => Math.round(n * 10) / 10;

type HistoryItem = {
  city: string;
  country?: string;
  tempC: number;
  wind?: number;
  humidity?: number | null;
  ts?: number;
};

const Home: React.FC = () => {
  const [notification, setNotification] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);
  const [weather, setWeather] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [forecastType, setForecastType] = useState<"hourly" | "daily">("daily");
  const [hourly, setHourly] = useState<any[]>([]);
  const [daily, setDaily] = useState<any[]>([]);
  const [unit, setUnit] = useState<"celsius" | "fahrenheit">("celsius");
  const [theme, setTheme] = useState<"light" | "dark">(
    (localStorage.getItem("weather-theme") as "light" | "dark") || "light"
  );
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [saved, setSaved] = useState<HistoryItem[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; state?: string; country?: string; lat: number; lon: number }>>([]);

  const API_KEY = (import.meta as any).env?.VITE_OPENWEATHER_API_KEY as string | undefined;

  // Reverse geocode helper to get the nearest city/state for coordinates
  const reverseGeocodeNearest = async (
    lat: number,
    lon: number
  ): Promise<{ name: string; country: string } | null> => {
    try {
      if (!API_KEY) return null;
      const r = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=5&appid=${API_KEY}`
      );
      const arr = await r.json();
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const toRad = (x: number) => (x * Math.PI) / 180;
      const haversine = (la1: number, lo1: number, la2: number, lo2: number) => {
        const R = 6371000; // meters
        const dLat = toRad(la2 - la1);
        const dLon = toRad(lo2 - lo1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      let best = arr[0];
      let bestDist = Infinity;
      for (const loc of arr) {
        const d = haversine(lat, lon, loc.lat, loc.lon);
        if (d < bestDist) {
          best = loc;
          bestDist = d;
        }
      }
      const name = best.name ? String(best.name) : "Your location";
      const state = best.state ? String(best.state) : "";
      const country = best.country ? String(best.country) : "";
      const label = state ? `${name}, ${state}` : name;
      return { name: label, country };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("weather-history");
    if (stored) setHistory(JSON.parse(stored));
    const savedStored = localStorage.getItem("weather-saved");
    if (savedStored) setSaved(JSON.parse(savedStored));
    // Apply initial theme to document
    document.documentElement.classList.toggle("dark-theme", theme === "dark");
    document.documentElement.classList.toggle("light-theme", theme === "light");

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Keep document class and localStorage in sync when theme changes
  useEffect(() => {
    localStorage.setItem("weather-theme", theme);
    document.documentElement.classList.toggle("dark-theme", theme === "dark");
    document.documentElement.classList.toggle("light-theme", theme === "light");
  }, [theme]);

  const saveHistory = (entry: HistoryItem) => {
    const updated = [
      entry,
      ...history.filter((h) => !(h.city === entry.city && h.country === entry.country)),
    ].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("weather-history", JSON.stringify(updated));
  };

  const saveSaved = (list: HistoryItem[]) => {
    setSaved(list);
    localStorage.setItem("weather-saved", JSON.stringify(list));
  };

  const removeFromSaved = (item: HistoryItem) => {
    const ok = window.confirm(`Remove ${item.city}${item.country ? ", " + item.country : ""} from Saved Locations?`);
    if (!ok) return;
    const filtered = saved.filter(
      (s) => !(s.city === item.city && (s.country || "") === (item.country || ""))
    );
    saveSaved(filtered);
    setNotification({ message: `${item.city} removed`, type: "info" });
  };

  const addCurrentToSaved = () => {
    if (!weather) return;
    const updated = [
      weather,
      ...saved.filter((s) => !(s.city === weather.city && s.country === weather.country)),
    ].slice(0, 20);
    saveSaved(updated);
    setNotification({ message: `${weather.city} saved`, type: "success" });
  };

  const fetchWeatherByCoords = async (
    latitude: number,
    longitude: number
  ) => {
    setLoading(true);
    try {
      if (!isOnline) throw new Error("Offline: can't fetch live data");
      if (!API_KEY) throw new Error("Missing OpenWeather API key. Set VITE_OPENWEATHER_API_KEY.");

      // Reduce small GPS jitter by snapping to ~100m precision
      const lat = Math.round(latitude * 1000) / 1000;
      const lon = Math.round(longitude * 1000) / 1000;

      const currentRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
      );
      const current = await currentRes.json();
      if (!current || !current.main) throw new Error("No weather data returned");

      const humidity = typeof current.main.humidity === "number" ? current.main.humidity : null; // %
      const windKmh = typeof current.wind?.speed === "number" ? round(current.wind.speed * 3.6) : null; // m/s -> km/h (1-decimal)
 
      // Phase 1: Strictly prefer reverse geocoded label for precision; fall back to API label only if needed
      let finalName: string = "Your location";
      let finalCountry: string = "";
      try {
        const best = await reverseGeocodeNearest(lat, lon);
        if (best) {
          finalName = best.name || finalName;
          finalCountry = best.country || finalCountry;
        } else {
          finalName = (current.name && String(current.name)) || finalName;
          finalCountry = (current.sys && current.sys.country && String(current.sys.country)) || finalCountry;
        }
      } catch {
        finalName = (current.name && String(current.name)) || finalName;
        finalCountry = (current.sys && current.sys.country && String(current.sys.country)) || finalCountry;
      }

      const entry: HistoryItem = {
        city: finalName,
        country: finalCountry,
        tempC: round(current.main.temp),
        wind: windKmh ?? undefined,
        humidity,
        ts: Date.now(),
      };

      setWeather(entry);
      saveHistory(entry);
      // No caching of labels to avoid stale/wrong names across refreshes.
      const weatherMsg = current.weather?.[0]?.description
        ? `${current.weather[0].description} in ${finalName}`
        : `Weather for ${finalName} loaded`;
      setNotification({ message: weatherMsg, type: "success" });

      // Phase 2a (background): fetch forecast and update when ready
      (async () => {
        try {
          const fcRes = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
          );
          const fc = await fcRes.json();
          const hourlyArr: any[] = Array.isArray(fc?.list)
            ? fc.list.map((it: any) => ({
                time: it.dt_txt,
                tempC: typeof it.main?.temp === "number" ? round(it.main.temp) : null,
                humidity: typeof it.main?.humidity === "number" ? it.main.humidity : null,
                wind: typeof it.wind?.speed === "number" ? round(it.wind.speed * 3.6) : null,
              }))
            : [];
          const dailyMap: Record<string, { minC: number | null; maxC: number | null; precipitation: number | null; date: string }> = {};
          if (Array.isArray(fc?.list)) {
            fc.list.forEach((it: any) => {
              const date = (it.dt_txt || "").slice(0, 10);
              if (!date) return;
              const t = typeof it.main?.temp === "number" ? it.main.temp : null;
              const rain = typeof it.rain?.["3h"] === "number" ? it.rain["3h"] : 0;
              if (!dailyMap[date]) dailyMap[date] = { minC: t, maxC: t, precipitation: rain, date };
              else {
                dailyMap[date].minC =
                  dailyMap[date].minC == null || (t != null && t < (dailyMap[date].minC as number)) ? t : dailyMap[date].minC;
                dailyMap[date].maxC =
                  dailyMap[date].maxC == null || (t != null && t > (dailyMap[date].maxC as number)) ? t : dailyMap[date].maxC;
                dailyMap[date].precipitation = (dailyMap[date].precipitation || 0) + rain;
              }
            });
          }
          const dailyArr = Object.values(dailyMap).map((d) => ({
            date: d.date,
            maxC: d.maxC != null ? round(d.maxC) : null,
            minC: d.minC != null ? round(d.minC) : null,
            precipitation: d.precipitation != null ? Math.round(d.precipitation) : null,
          }));
          setHourly(hourlyArr);
          setDaily(dailyArr);
        } catch (_) {}
      })();

      // Keep the initial label stable to avoid confusion. If you want refinement, we can re-enable it.

    } catch (e: any) {
      setNotification({ message: e.message || "Error fetching weather", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query || query.trim().length === 0) return;
    setLoading(true);
    try {
      if (!isOnline) throw new Error("You are offline. Only cached data available.");
      if (!API_KEY) throw new Error("Missing OpenWeather API key. Set VITE_OPENWEATHER_API_KEY.");
      const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=10&appid=${API_KEY}`;
      const geoRes = await fetch(url);
      const results = await geoRes.json();
      if (!Array.isArray(results) || results.length === 0) throw new Error("Location not found");
      const pick = results[0];
      await fetchWeatherByCoords(pick.lat, pick.lon);
    } catch (e: any) {
      setNotification({ message: e.message || "Error searching for location", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Input change handler to populate suggestions (villages supported)
  const handleInputChange = async (q: string) => {
    setSuggestions([]);
    const query = q.trim();
    if (query.length < 2) return; // avoid noisy requests
    try {
      if (!API_KEY || !isOnline) return;
      const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=10&appid=${API_KEY}`;
      const res = await fetch(url);
      const arr = await res.json();
      if (Array.isArray(arr)) {
        const mapped = arr.map((r: any) => ({
          name: r.name as string,
          state: r.state as string | undefined,
          country: r.country as string | undefined,
          lat: r.lat as number,
          lon: r.lon as number,
        }));
        setSuggestions(mapped);
      }
    } catch (_) {
      // ignore suggestion errors
    }
  };

  const handlePickSuggestion = async (s: { name: string; state?: string; country?: string; lat: number; lon: number }) => {
    setSuggestions([]);
    await fetchWeatherByCoords(s.lat, s.lon);
  };

  const handleUseLocation = async () => {
    if (!isOnline) {
      setNotification({ message: "You are offline. Location fetch requires internet.", type: "error" });
      return;
    }
    if (!("geolocation" in navigator)) {
      setNotification({ message: "Geolocation is not supported by your browser.", type: "error" });
      return;
    }
    if (!API_KEY) {
      setNotification({ message: "Missing OpenWeather API key. Set VITE_OPENWEATHER_API_KEY.", type: "error" });
      return;
    }
    setLoading(true);

    // Use a single, faster position request with reasonable timeout and cached locations
    const getPosition = (): Promise<GeolocationPosition> => {
      const opts: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });
    };

    try {
      const pos = await getPosition();
      const { latitude, longitude } = pos.coords;
      // Fetch weather directly for these coordinates; label will come from the weather API itself
      await fetchWeatherByCoords(latitude, longitude);
      if (typeof pos.coords.accuracy === "number" && pos.coords.accuracy > 150) {
        setNotification({ message: `Location may be approximate (±${Math.round(pos.coords.accuracy)}m).`, type: "info" });
      }
    } catch (err: any) {
      setNotification({ message: err?.message || "Unable to access your location.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = (t: "light" | "dark") => {
    setTheme(t);
    setNotification({ message: t === "light" ? "Switched to Light Theme" : "Switched to Dark Theme", type: "info" });
  };
  const toggleUnit = (u: "celsius" | "fahrenheit") => {
    setUnit(u);
    setNotification({ message: u === "celsius" ? "Switched to Celsius" : "Switched to Fahrenheit", type: "info" });
  };
  const handleSelectHistory = (city: string) => {
    handleSearch(city);
  };

  const displayTemp = (tempC: number | null | undefined) => {
    if (tempC === null || tempC === undefined) return "-";
    return unit === "celsius" ? `${tempC}°C` : `${cToF(tempC)}°F`;
  };

  return (
    <div className={`app-root ${theme === "light" ? "light-theme" : "dark-theme"}`}>
      <div className="app-frame">
        {/* Header bar styled like mock */}
        <div className="header">
          <div className="header-center">
            <div style={{ width: "100%" }}>
              <SearchBar
                onSearch={handleSearch}
                onUseLocation={handleUseLocation}
                suggestions={suggestions}
                onInputChange={handleInputChange}
                onPickSuggestion={handlePickSuggestion}
              />
            </div>
          </div>
          <div className="controls">
            <button className={`toggle-pill ${theme === "light" ? "active" : ""}`} onClick={() => toggleTheme("light")} aria-label="Light theme">Light</button>
            <button className={`toggle-pill ${theme === "dark" ? "active" : ""}`} onClick={() => toggleTheme("dark")} aria-label="Dark theme">Dark</button>
            <button className={`toggle-pill ${unit === "celsius" ? "active" : ""}`} onClick={() => toggleUnit("celsius")}>°C</button>
            <button className={`toggle-pill ${unit === "fahrenheit" ? "active" : ""}`} onClick={() => toggleUnit("fahrenheit")}>°F</button>
          </div>
        </div>

        {!isOnline && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#fff3bf", color: "#92400e" }}>
            You are currently offline.
          </div>
        )}

        {/* Hero full width */}
        <div style={{ marginTop: 14 }}>
          <div className="main-card">
            {loading && <div style={{ fontWeight: 600, marginBottom: 8 }}>Loading…</div>}
            {/* Placeholder removed as requested */}

            {weather && (
              <div className="current-row hero">
                <div className="current-left">
                  <div className="city" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📍 {weather.city}{weather.country ? `, ${weather.country}` : ""}</span>
                  </div>
                  <div>
                    <button className="toggle-pill" onClick={addCurrentToSaved} title="Save to Saved Locations" aria-label="Save to Saved Locations">+ Save</button>
                  </div>
                  <p className="big-temp">
                    {unit === "celsius" ? `${weather.tempC}°C` : `${cToF(weather.tempC)}°F`}
                  </p>
                  <div className="kv">
                    <div>💧 {weather.humidity ?? "-"}%</div>
                    <div>🌬 {weather.wind ?? "-"} km/h</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Grid below hero: forecast left, sidebar right */}
        <div style={{ marginTop: 14 }} className="layout">
          <div className="main-card">
            <div style={{ fontWeight: 700, marginTop: 0, marginBottom: 8 }}>Weather Forecast</div>
            <div className="tabs" style={{ marginTop: 6 }}>
              <div className={`tab ${forecastType === "daily" ? "active" : ""}`} onClick={() => setForecastType("daily")}>Daily</div>
              <div className={`tab ${forecastType === "hourly" ? "active" : ""}`} onClick={() => setForecastType("hourly")}>Hourly</div>
            </div>

            {forecastType === "hourly" && hourly.length > 0 && (
              <div className="hourly-table">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Temp</th>
                      <th>Humidity</th>
                      <th>Wind</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hourly.slice(0, 24).map((h, i) => (
                      <tr key={i}>
                        <td>{new Date(h.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                        <td>{displayTemp(h.tempC)}</td>
                        <td>{h.humidity ?? "-"}</td>
                        <td>{h.wind ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {forecastType === "daily" && daily.length > 0 && (
              <div className="card-daily">
                <div className="forecast-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Max</th>
                        <th>Min</th>
                        <th>Precip (mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daily.slice(0, 10).map((d, i) => (
                        <tr key={i}>
                          <td>{new Date(d.date).toLocaleDateString()}</td>
                          <td>{displayTemp(d.maxC)}</td>
                          <td>{displayTemp(d.minC)}</td>
                          <td>{d.precipitation ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <aside className="sidebar">
            <div className="side-card">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Saved Locations</div>
              {saved.length === 0 && <div style={{ color: "#6b7280" }}>No saved locations yet</div>}
              {saved.map((h, idx) => (
                <div key={idx} className="saved-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div className="city-small">{h.city}</div>
                    <div className="country-small">{h.country}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "right" }}>
                      <div className="temp-small">{unit === "celsius" ? `${h.tempC}°C` : `${cToF(h.tempC)}°F`}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{h.humidity ?? "-"}%</div>
                    </div>
                    <button className="toggle-pill" onClick={() => removeFromSaved(h)} aria-label={`Remove ${h.city}`} title="Remove">
                      Clear
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="side-card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Weather Alerts</div>
              <div className={`alert-box${notification && notification.type === "error" ? " error" : ""}`}>
                {notification ? notification.message : "No weather alerts for your locations"}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Home;
