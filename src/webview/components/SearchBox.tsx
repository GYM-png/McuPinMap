import { usePinMapStore } from "../state/usePinMapStore";

export const SearchBox = (): JSX.Element => {
  const query = usePinMapStore((state) => state.query);
  const searchResults = usePinMapStore((state) => state.searchResults);
  const setQuery = usePinMapStore((state) => state.setQuery);
  const selectPin = usePinMapStore((state) => state.selectPin);

  return (
    <section className="panel search-panel" aria-labelledby="search-title">
      <div className="panel-heading">
        <p className="eyebrow">Find</p>
        <h2 id="search-title">Search Pins</h2>
      </div>
      <input
        type="search"
        value={query}
        placeholder="Try PA9, USART, ADC..."
        aria-label="Search pins and functions"
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      {searchResults.length > 0 ? (
        <div className="search-results" aria-label="Search results">
          {searchResults.slice(0, 8).map((result) => (
            <button
              key={`${result.kind}-${result.pinName}-${result.label}`}
              type="button"
              onClick={() => selectPin(result.pinName)}
            >
              <span>{result.pinName}</span>
              <small>
                {result.kind} / {result.label}
              </small>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
};
