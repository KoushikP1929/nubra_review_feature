"use client";

import { useEffect, useState } from "react";

/**
 * Reflection note box — saved ONLY in the trader's own browser
 * (localStorage). The note is never sent to any server or database.
 */
export function ReflectionNote({
  positionId,
  prompt,
}: {
  positionId: string;
  prompt: string;
}) {
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savedTick, setSavedTick] = useState(0);

  const storageKey = `nubra-review-note-${positionId}`;

  useEffect(() => {
    const existing = window.localStorage.getItem(storageKey);
    if (existing != null) setNote(existing);
    setLoaded(true);
  }, [storageKey]);

  const save = () => {
    window.localStorage.setItem(storageKey, note);
    setSavedTick((t) => t + 1);
  };

  return (
    <div className="mt-6">
      <p className="text-sm leading-relaxed text-slate-600">{prompt}</p>
      <textarea
        value={loaded ? note : undefined}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Jot down your answer (saved in this browser only)..."
        rows={4}
        className="mt-3 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Save note
        </button>
        <span className="text-xs text-slate-400" aria-live="polite">
          {savedTick > 0
            ? `Note saved in this browser only (${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })})`
            : "Saved in this browser only"}
        </span>
      </div>
    </div>
  );
}
