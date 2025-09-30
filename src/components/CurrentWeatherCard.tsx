import React from "react";

type WeatherItem = {
  city: string;
  country?: string;
  tempC: number;
  wind?: number;
  humidity?: number | null;
};

type Props = {
  weather: WeatherItem;
  unit: "celsius" | "fahrenheit";
  onSave: () => void;
};

const cToF = (c: number) => Math.round(((c * 9) / 5 + 32) * 10) / 10;

const CurrentWeatherCard: React.FC<Props> = ({ weather, unit, onSave }) => {
  const displayTemp = (tempC: number) =>
    unit === "celsius" ? `${tempC}°C` : `${cToF(tempC)}°F`;

  return (
    <div className="current-row hero">
      <div className="current-left">
        <div className="city" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>
             {weather.city}
            {weather.country ? `, ${weather.country}` : ""}
          </span>
        </div>
        <div style={{ marginTop: 8 }}>
          <button
            className="toggle-pill"
            onClick={onSave}
            title="Save to Saved Locations"
            aria-label="Save to Saved Locations"
          >
            + Save
          </button>
        </div>
        <p className="big-temp">{displayTemp(weather.tempC)}</p>
        <div className="kv">
          <div>💧 {weather.humidity ?? "-"}%</div>
          <div>🌬 {weather.wind ?? "-"} km/h</div>
        </div>
      </div>
    </div>
  );
};

export default CurrentWeatherCard;
