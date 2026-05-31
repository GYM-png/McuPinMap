import { usePinMapStore } from "../state/usePinMapStore";

export const PeripheralFilter = (): JSX.Element => {
  const chip = usePinMapStore((state) => state.chip);
  const query = usePinMapStore((state) => state.query);
  const setQuery = usePinMapStore((state) => state.setQuery);
  const peripherals = (chip?.pins ?? [])
    .reduce<string[]>((items, pin) => {
      for (const fn of pin.functions) {
        if (fn.peripheral && !items.includes(fn.peripheral)) {
          items.push(fn.peripheral);
        }
      }

      return items;
    }, [])
    .sort((left, right) => left.localeCompare(right));

  return (
    <section className="panel peripheral-panel" aria-labelledby="peripheral-title">
      <div className="panel-heading">
        <p className="eyebrow">Filter</p>
        <h2 id="peripheral-title">Peripherals</h2>
      </div>
      <div className="chip-cloud">
        {peripherals.length === 0 ? <p className="empty-state">No peripherals loaded.</p> : null}
        {peripherals.map((peripheral) => (
          <button
            key={peripheral}
            type="button"
            className={query === peripheral ? "is-active" : undefined}
            onClick={() => setQuery(peripheral)}
          >
            {peripheral}
          </button>
        ))}
      </div>
    </section>
  );
};
