"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card stack" role="alert">
      <h2>Something went wrong</h2>
      <p className="muted">This view failed to load.</p>
      <div><button type="button" className="btn" onClick={reset}>Try again</button></div>
    </div>
  );
}
