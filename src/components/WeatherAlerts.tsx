import React from "react";

type Props = {
  message: string | null;
  type?: "success" | "error" | "info";
};

const WeatherAlerts: React.FC<Props> = ({ message, type }) => {
  return (
    <div className="side-card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Weather Alerts</div>
      <div className={`alert-box${type === "error" ? " error" : ""}`}>
        {message ?? "No weather alerts for your locations"}
      </div>
    </div>
  );
};

export default WeatherAlerts;
