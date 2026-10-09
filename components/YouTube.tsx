"use client";

import { useState } from "react";
import type { Piece } from "@/lib/types";
import { ExternalIcon } from "./icons";
import { youtubeSearch } from "./pieces";

/** Lightweight YouTube facade: thumbnail first, the iframe only loads when played. */
export function YouTube({ piece, autoplay = false }: { piece: Piece; autoplay?: boolean }) {
  const rec = piece.recording;
  const ids = rec ? [rec.id, ...rec.alternates] : [];
  const [which, setWhich] = useState(0);
  const [playing, setPlaying] = useState(autoplay); // state resets via the key set by PieceDetail

  if (!rec) {
    return (
      <div className="no-video">
        <span>No recording picked yet.</span>
        <a className="link-underline" href={youtubeSearch(piece)} target="_blank" rel="noreferrer">
          Search YouTube <ExternalIcon />
        </a>
      </div>
    );
  }
  const id = ids[which];
  return (
    <>
      <div className="video">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
            title={`${piece.composerName}: ${piece.title}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
            <button onClick={() => setPlaying(true)} aria-label={`Play ${piece.title}`}>
              <span>
                <i />
              </span>
              {which === 0 && rec.title && <div className="caption">{rec.title}</div>}
            </button>
          </>
        )}
      </div>
      <div className="video-links">
        {ids.length > 1 && (
          <button
            onClick={() => {
              setWhich((which + 1) % ids.length);
              setPlaying(true);
            }}
          >
            Try another recording ({which + 1}/{ids.length})
          </button>
        )}
        <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer">
          Open on YouTube <ExternalIcon />
        </a>
        <a href={youtubeSearch(piece)} target="_blank" rel="noreferrer">
          More recordings <ExternalIcon />
        </a>
      </div>
    </>
  );
}
