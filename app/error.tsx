"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="loading">
      <h1>Something interrupted your budget.</h1>
      <p>Your saved data is still there. Please try loading again.</p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
