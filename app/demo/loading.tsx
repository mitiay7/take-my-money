export default function DemoLoading() {
  return (
    <div className="demo-shell shell" aria-live="polite">
      <div className="loading-panel">
        <span className="loading-pulse" aria-hidden="true" />
        <p>Preparing the synthetic demo environment…</p>
      </div>
    </div>
  );
}
