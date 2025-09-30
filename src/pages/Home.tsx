import React, { useEffect, useRef, useState } from "react";
import SearchBar from "../components/SearchBar";
import ThemeToggle from "../components/ThemeToggle";
import CurrentWeatherCard from "../components/CurrentWeatherCard";
import SavedLocations from "../components/SavedLocations";
import WeatherAlerts from "../components/WeatherAlerts";

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

  const hasAutoRequested = useRef(false);

  const API_KEY = (import.meta as any).env?.VITE_OPENWEATHER_API_KEY as string | undefined;

  const reverseGeocodeOSM = async (
    lat: number,
    lon: number
  ): Promise<{ name: string; country: string } | null> => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      const addr = data?.address || {};
      // Exclude municipality to avoid labels like 'Msunduzi Local Municipality'.
      // Prefer city/town, then suburb, then village/hamlet.
      const city = addr.city || addr.town || addr.suburb || addr.village || addr.hamlet;
      const country = addr.country_code ? String(addr.country_code).toUpperCase() : (addr.country || "");
      const name = city || data?.name || "Your location";
      return { name, country };
    } catch {
      return null;
    }
  };

  const reverseGeocodeNearest = async (
    lat: number,
    lon: number,
    preferName?: string
  ): Promise<{ name: string; country: string } | null> => {
    try {
      if (!API_KEY) return null;
      const r = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=10&appid=${API_KEY}`
      );
      const arr = await r.json();
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const toRad = (x: number) => (x * Math.PI) / 180;
      const haversine = (la1: number, lo1: number, la2: number, lo2: number) => {
        const R = 6371000;
        const dLat = toRad(la2 - la1);
        const dLon = toRad(lo2 - lo1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      let best = arr[0];
      if (preferName) {
        const match = arr.find((loc: any) => String(loc.name).toLowerCase() === String(preferName).toLowerCase());
        if (match) best = match;
      }
      if (!best) best = arr[0];
      let bestDist = haversine(lat, lon, best.lat, best.lon);
      for (const loc of arr) {
        const d = haversine(lat, lon, loc.lat, loc.lon);
        if (d < bestDist) { best = loc; bestDist = d; }
      }
      const name = best.name ? String(best.name) : "Your location";
      const country = best.country ? String(best.country) : "";
      const label = name;
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

  useEffect(() => {
    if (hasAutoRequested.current) return;
    hasAutoRequested.current = true;
    handleUseLocation();
  }, []);

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
    longitude: number,
    opts?: { labelName?: string; labelCountry?: string }
  ) => {
    setLoading(true);
    try {
      if (!isOnline) throw new Error("Offline: can't fetch live data");
      if (!API_KEY) throw new Error("Missing OpenWeather API key. Set VITE_OPENWEATHER_API_KEY.");

      const latSnap = Math.round(latitude * 1000) / 1000;
      const lonSnap = Math.round(longitude * 1000) / 1000;

      const currentRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latSnap}&lon=${lonSnap}&units=metric&appid=${API_KEY}`
      );
      const current = await currentRes.json();
      if (!current || !current.main) throw new Error("No weather data returned");

      const humidity = typeof current.main.humidity === "number" ? current.main.humidity : null;
      const windKmh = typeof current.wind?.speed === "number" ? round(current.wind.speed * 3.6) : null;
 
      let finalName: string = (opts?.labelName && String(opts.labelName)) || "";
      let finalCountry: string = (opts?.labelCountry && String(opts.labelCountry)) || "";
      if (!finalName) {
        try {
          const osm = await reverseGeocodeOSM(latitude, longitude);
          if (osm) { finalName = osm.name; finalCountry = osm.country || finalCountry; }
        } catch {}
      }
      if (!finalName) {
        finalName = (current.name && String(current.name)) || "Your location";
        finalCountry = (current.sys && current.sys.country && String(current.sys.country)) || finalCountry;
      }
      if (!finalName) {
        try {
          const bestOW = await reverseGeocodeNearest(latitude, longitude);
          if (bestOW) { finalName = bestOW.name; finalCountry = bestOW.country || finalCountry; }
        } catch {}
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
      const weatherMsg = current.weather?.[0]?.description
        ? `${current.weather[0].description} in ${finalName}`
        : `Weather for ${finalName} loaded`;
      setNotification({ message: weatherMsg, type: "success" });

      (async () => {
        try {
          const fcRes = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${latSnap}&lon=${lonSnap}&units=metric&appid=${API_KEY}`
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
      const q = query.trim().toLowerCase();
      const exact = results.find((r: any) => String(r.name || "").toLowerCase() === q);
      if (exact) {
        await fetchWeatherByCoords(exact.lat, exact.lon, { labelName: String(exact.name || ""), labelCountry: String(exact.country || "") });
      } else if (results.length === 1) {
        const only = results[0];
        await fetchWeatherByCoords(only.lat, only.lon, { labelName: String(only.name || ""), labelCountry: String(only.country || "") });
      } else {
        const mapped = results.map((r: any) => ({
          name: r.name as string,
          state: r.state as string | undefined,
          country: r.country as string | undefined,
          lat: r.lat as number,
          lon: r.lon as number,
        }));
        setSuggestions(mapped);
        setNotification({ message: "Multiple matches found. Please pick one from the list.", type: "info" });
      }
    } catch (e: any) {
      setNotification({ message: e.message || "Error searching for location", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = async (q: string) => {
    setSuggestions([]);
    const query = q.trim();
    if (query.length < 2) return;
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
    } catch (_) {}
  };

  const handlePickSuggestion = async (s: { name: string; state?: string; country?: string; lat: number; lon: number }) => {
    setSuggestions([]);
    await fetchWeatherByCoords(s.lat, s.lon, { labelName: s.name, labelCountry: s.country });
  };
  const getBestPosition = async (): Promise<GeolocationPosition> => {
    const hiOpts: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
    const loOpts: PositionOptions = { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 };

    try {
      const p = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, hiOpts);
      });
      return p;
    } catch {}

    const fallback = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, loOpts);
    });
    return fallback;
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
    try {
      const pos = await getBestPosition();
      const { latitude, longitude, accuracy } = pos.coords as any;

      // Always fetch, but warn if accuracy is poor
      if (typeof accuracy === "number") {
        if (accuracy > 5000) {
          setNotification({ message: `Your location might be off by about ${Math.round(accuracy)} meters.`, type: "info" });
        } else if (accuracy > 1000) {
          setNotification({ message: `Your location might be off by about ${Math.round(accuracy)} meters.`, type: "info" });
        }
      }

      await fetchWeatherByCoords(latitude, longitude);
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
        <div className="header">
          <div className="header-center">
            <div style={{ width: "100%" }}>
              <div className="section-title" style={{ marginBottom: 8 }}>Weather application</div>
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
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button className={`toggle-pill ${unit === "celsius" ? "active" : ""}`} onClick={() => toggleUnit("celsius")}>°C</button>
            <button className={`toggle-pill ${unit === "fahrenheit" ? "active" : ""}`} onClick={() => toggleUnit("fahrenheit")}>°F</button>
          </div>
        </div>

        {!isOnline && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#fff3bf", color: "#92400e" }}>
            You are currently offline.
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <div className="main-card">
            {loading && <div style={{ fontWeight: 600, marginBottom: 8 }}>Loading…</div>}
            {weather && (
              <CurrentWeatherCard weather={weather} unit={unit} onSave={addCurrentToSaved} />
            )}
          </div>
        </div>

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
            <SavedLocations saved={saved} unit={unit} onRemove={removeFromSaved} />
            <WeatherAlerts message={notification ? notification.message : null} type={notification?.type} />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Home;


