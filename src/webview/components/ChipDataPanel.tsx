import { useState } from "react";
import { usePinMapStore } from "../state/usePinMapStore";
import { vscode } from "../vscodeApi";

export const ChipDataPanel = (): JSX.Element => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const chips = usePinMapStore((state) => state.chips);
  const remoteQuery = usePinMapStore((state) => state.remoteQuery);
  const remoteChips = usePinMapStore((state) => state.remoteChips);
  const remoteSearchStatus = usePinMapStore((state) => state.remoteSearchStatus);
  const downloadingChipId = usePinMapStore((state) => state.downloadingChipId);
  const importingCsv = usePinMapStore((state) => state.importingCsv);
  const setRemoteQuery = usePinMapStore((state) => state.setRemoteQuery);
  const setRemoteSearchLoading = usePinMapStore((state) => state.setRemoteSearchLoading);
  const setDownloadingChipId = usePinMapStore((state) => state.setDownloadingChipId);
  const setImportingCsv = usePinMapStore((state) => state.setImportingCsv);
  const installedChipIds = new Set(chips.map((chip) => chip.id.toLowerCase()));
  const isSearchLoading = remoteSearchStatus === "loading";
  const isChipDataBusy = importingCsv || Boolean(downloadingChipId);

  const searchRemote = (): void => {
    if (isSearchLoading) {
      return;
    }

    setRemoteSearchLoading();
    vscode.postMessage({ type: "searchRemoteChips", query: remoteQuery });
  };

  return (
    <section className="panel chip-data-panel" aria-labelledby="chip-data-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Data Library</p>
          <h2 id="chip-data-title">Chip Data</h2>
        </div>
        <div className="chip-data-heading-actions">
          <button
            className="ghost-action"
            type="button"
            aria-expanded={!isCollapsed}
            aria-controls="chip-data-body"
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          >
            {isCollapsed ? "Expand" : "Collapse"}
          </button>
          <button
            className="ghost-action"
            type="button"
            onClick={() => vscode.postMessage({ type: "refreshInstalledChips" })}
          >
            Refresh
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <div id="chip-data-body" className="chip-data-body">
          <div className="library-actions" aria-label="Chip data actions">
            <button
              className="primary-action"
              type="button"
              disabled={isChipDataBusy}
              onClick={() => {
                setImportingCsv(true);
                vscode.postMessage({ type: "importLocalCsv" });
              }}
            >
              {importingCsv ? "Importing..." : "Import CSV"}
            </button>
          </div>

          <div className="remote-search-form">
            <input
              type="search"
              value={remoteQuery}
              placeholder="Search online chip data"
              aria-label="Search online chip data"
              disabled={isSearchLoading}
              onChange={(event) => setRemoteQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  searchRemote();
                }
              }}
            />
            <button
              className="primary-action"
              type="button"
              disabled={isSearchLoading}
              onClick={searchRemote}
            >
              {isSearchLoading ? "Searching..." : "Search"}
            </button>
          </div>

          {remoteSearchStatus === "ready" ? (
            <div className="remote-chip-list" aria-label="Remote chip results">
              {remoteChips.length === 0 ? <p className="empty-state">No matching chips.</p> : null}
              {remoteChips.map((chip) => {
                const isInstalled = installedChipIds.has(chip.id.toLowerCase());
                const isDownloading = downloadingChipId === chip.id;

                return (
                  <article key={chip.id} className="remote-chip-row">
                    <div>
                      <strong>{chip.displayName}</strong>
                      <small>
                        {chip.vendor} / {chip.family} / {chip.status}
                      </small>
                      {chip.packages.length > 0 ? (
                        <div className="package-badges" aria-label={`${chip.displayName} packages`}>
                          {chip.packages.map((packageName) => (
                            <span key={packageName}>{packageName}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="remote-chip-actions">
                      <button
                        className={isInstalled ? "secondary-action" : "primary-action"}
                        type="button"
                        disabled={isChipDataBusy}
                        onClick={() => {
                          setDownloadingChipId(chip.id);
                          vscode.postMessage({ type: "downloadRemoteChip", chipId: chip.id });
                        }}
                      >
                        {isDownloading ? "Downloading..." : isInstalled ? "Update" : "Download"}
                      </button>
                      {isInstalled ? (
                        <button
                          className="ghost-action"
                          type="button"
                          disabled={isChipDataBusy}
                          onClick={() =>
                            vscode.postMessage({ type: "removeInstalledChip", chipId: chip.id })
                          }
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
