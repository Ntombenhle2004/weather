import React from "react";

type Props = {
  theme: "light" | "dark";
  onToggle: (t: "light" | "dark") => void;
};

const ThemeToggle: React.FC<Props> = ({ theme, onToggle }) => {
  return (
    <>
      <button
        className={`toggle-pill ${theme === "light" ? "active" : ""}`}
        onClick={() => onToggle("light")}
        aria-label="Light theme"
      >
        Light
      </button>
      <button
        className={`toggle-pill ${theme === "dark" ? "active" : ""}`}
        onClick={() => onToggle("dark")}
        aria-label="Dark theme"
      >
        Dark
      </button>
    </>
  );
};

export default ThemeToggle;
