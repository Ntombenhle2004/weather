import React, { useState } from "react";

interface SearchBarProps {
  onSearch: (q: string) => void;
  onUseLocation?: () => void;
  suggestions?: Array<{ name: string; state?: string; country?: string; lat: number; lon: number }>;
  onInputChange?: (q: string) => void;
  onPickSuggestion?: (s: { name: string; state?: string; country?: string; lat: number; lon: number }) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onUseLocation, suggestions = [], onInputChange, onPickSuggestion }) => {
  const [input, setInput] = useState("");

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (input.trim().length === 0) return;
    onSearch(input.trim());
    setInput("");
  };

  return (
    <form onSubmit={submit} className="sb" style={{ margin: "0 auto", position: "relative" }}>
      <div className="si" style={{ position: "relative" }}>
        <input
          value={input}
          onChange={(e) => {
            const v = e.target.value;
            setInput(v);
            onInputChange && onInputChange(v);
          }}
          placeholder="Search..."
        />
        {suggestions.length > 0 && (
          <div
            className="sugg"
          >
            {suggestions.map((s, i) => (
              <div
                key={`${s.name}-${s.lat}-${s.lon}-${i}`}
                onClick={() => {
                  onPickSuggestion && onPickSuggestion(s);
                  setInput("");
                }}
              >
                <div>
                  <div >{s.name}</div>
                  <div>
                    {(s.state ? `${s.state}, ` : "") + (s.country || "")}
                  </div>
                </div>
                <div>select</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="submit" className="sbtn">
        Search
      </button>
      {onUseLocation && (
        <button
          type="button"
          className="locbtn"
          onClick={() => onUseLocation()}
          aria-label="Use my current location"
        >
          use current location
        </button>
      )}
    </form>
  );
};

export default SearchBar;

