"use client";

import { useState } from "react";
import { imageCandidates, videoCandidates } from "@/lib/exercise";

export function ExerciseImage({
  slug,
  className = "",
  alt = "Exercise photo",
}: {
  slug: string;
  className?: string;
  alt?: string;
}) {
  const candidates = imageCandidates(slug);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-brand-100 text-3xl ${className}`}
        role="img"
        aria-label={alt}
      >
        🏋️
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={candidates[index]}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (index + 1 < candidates.length) setIndex(index + 1);
        else setFailed(true);
      }}
    />
  );
}

export function ExerciseVideo({ slug }: { slug: string }) {
  const candidates = videoCandidates(slug);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
        <span className="text-3xl">🎬</span>
        <p className="text-sm font-medium text-slate-600">
          No video added yet for this exercise.
        </p>
        <p className="text-xs text-slate-400">
          Drop a file into <code className="rounded bg-slate-100 px-1">public/exercise/videos/{slug}.mp4</code> and it appears here automatically.
        </p>
      </div>
    );
  }

  return (
    <video
      key={candidates[index]}
      src={candidates[index]}
      controls
      preload="metadata"
      playsInline
      className="aspect-video w-full rounded-xl bg-black"
      onError={() => {
        if (index + 1 < candidates.length) setIndex(index + 1);
        else setFailed(true);
      }}
    />
  );
}