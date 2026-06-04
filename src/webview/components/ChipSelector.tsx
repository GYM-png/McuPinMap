import { usePinMapStore } from "../state/usePinMapStore";
import { vscode } from "../vscodeApi";

export const ChipSelector = (): JSX.Element => {
  const chips = usePinMapStore((state) => state.chips);
  const chip = usePinMapStore((state) => state.chip);

  return (
    <section className="panel selector-panel" aria-labelledby="chip-selector-title">
      <div className="panel-heading">
        <p className="eyebrow">Target</p>
        <h2 id="chip-selector-title">Chip</h2>
      </div>
      <select
        aria-label="Select chip"
        value={chip?.id ?? ""}
        disabled={chips.length === 0}
        onChange={(event) => {
          vscode.postMessage({ type: "selectChip", chipId: event.target.value });
        }}
      >
        <option value="" disabled>
          {chips.length === 0 ? "Waiting for chips..." : "Select a chip"}
        </option>
        {chips.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.displayName}
          </option>
        ))}
      </select>
      <button
        className="import-csv-action"
        type="button"
        onClick={() => {
          vscode.postMessage({ type: "importLocalCsv" });
        }}
      >
        Import CSV
      </button>
      {chip ? (
        <p className="meta-line">
          {chip.vendor} / {chip.family} / {chip.pins.length} pins
        </p>
      ) : null}
    </section>
  );
};
