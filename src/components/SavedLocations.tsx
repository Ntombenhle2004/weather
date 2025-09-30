import React from "react";

type HistoryItem = {
  city: string;
  country?: string;
  tempC: number;
  wind?: number;
  humidity?: number | null;
};

type Props = {
  saved: HistoryItem[];
  unit: "celsius" | "fahrenheit";
  onRemove: (item: HistoryItem) => void;
};

const cToF = (c: number) => Math.round(((c * 9) / 5 + 32) * 10) / 10;

const SavedLocations: React.FC<Props> = ({ saved, unit, onRemove }) => {
  return (
    <div className="side-card">
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Saved Locations</div>
      {saved.length === 0 && (
        <div style={{ color: "#6b7280" }}>No saved locations yet</div>
      )}
      {saved.map((h, idx) => (
        <div
          key={idx}
          className="saved-card"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
        >
          <div>
            <div className="city-small">{h.city}</div>
            <div className="country-small">{h.country}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div className="temp-small">
                {unit === "celsius" ? `${h.tempC}°C` : `${cToF(h.tempC)}°F`}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{h.humidity ?? "-"}%</div>
            </div>
            <button
              className="toggle-pill"
              onClick={() => onRemove(h)}
              aria-label={`Remove ${h.city}`}
              title="Remove"
            >
              Clear
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SavedLocations;
