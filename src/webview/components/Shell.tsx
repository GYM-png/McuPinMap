import type { PropsWithChildren } from "react";

type ShellProps = PropsWithChildren<{
  sidebar: JSX.Element;
  detail: JSX.Element;
  error?: string;
}>;

export const Shell = ({ sidebar, detail, error, children }: ShellProps): JSX.Element => (
  <main className="pin-workspace">
    <header className="workspace-header">
      <div>
        <p className="eyebrow">McuPinFunc</p>
        <h1>Pin Map Workspace</h1>
      </div>
      <p className="workspace-kicker">
        Search alternate functions, assign signals, and catch pin conflicts before firmware
        setup.
      </p>
    </header>

    {error ? <p className="error-banner">{error}</p> : null}

    <section className="workspace-grid" aria-label="Pin map workspace">
      <aside className="sidebar-region">{sidebar}</aside>
      <section className="map-region">{children}</section>
      <aside className="detail-region">{detail}</aside>
    </section>
  </main>
);
