import React, { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, Loader2 } from "lucide-react";
import { fetchLyricsFromGoogleSheet } from "./GoogleSheetService";

// songs: snapshot (σταθερός πίνακας) των τραγουδιών της ομάδας τη στιγμή ανοίγματος
// startIndex: index μέσα στο snapshot όπου ανοίξαμε
// onMarkSung(songDbId): μαρκάρει ένα τραγούδι ως sung στον γονικό state
// onClose(): κλείνει το modal (η ίδια η mark-sung λογική γίνεται εδώ μέσα πριν το καλέσουμε)
export default function LyricsModal({ songs, startIndex, sheetId, lyricsGid, onMarkSung, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [lyricsText, setLyricsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState(null); // 'no-songid' | 'not-found' | 'network' | null

  const current = songs[index];
  const isLast = index === songs.length - 1;

  const loadLyrics = useCallback(async () => {
    if (!current) return;

    if (!current.songId) {
      setErrorType("no-songid");
      setLyricsText("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorType(null);

    try {
      const { lyricsMap } = await fetchLyricsFromGoogleSheet(sheetId, lyricsGid);
      const found = lyricsMap[current.songId];
      if (found) {
        setLyricsText(found);
        setErrorType(null);
      } else {
        setLyricsText("");
        setErrorType("not-found");
      }
    } catch (err) {
      setLyricsText("");
      setErrorType("network");
    } finally {
      setLoading(false);
    }
  }, [current, sheetId, lyricsGid]);

  useEffect(() => {
    loadLyrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const handleNext = () => {
    if (isLast) return;
    onMarkSung(current.id);
    setIndex((i) => i + 1);
  };

  const handleClose = () => {
    if (current) onMarkSung(current.id);
    onClose();
  };

  if (!current) return null;

  return (
    <div className="lyrics-backdrop" onClick={handleClose}>
      <div className="lyrics-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lyrics-header">
          <div>
            <h3>{current.title}</h3>
            <p>
              {current.dance} · {current.region}
            </p>
          </div>
          <button className="lyrics-close" onClick={handleClose} title="Κλείσιμο">
            <X size={18} />
          </button>
        </div>

        <div className="lyrics-body">
          {loading && (
            <div className="lyrics-status">
              <Loader2 size={20} className="lyrics-spin" /> Φόρτωση στίχων…
            </div>
          )}

          {!loading && errorType === "no-songid" && (
            <p className="lyrics-status lyrics-error">
              Αυτό το τραγούδι δεν έχει ακόμα <b>songId</b> στο Google Sheet, οπότε δεν μπορεί να
              συνδεθεί με στίχους.
            </p>
          )}

          {!loading && errorType === "not-found" && (
            <p className="lyrics-status lyrics-error">
              Δεν βρέθηκαν στίχοι για αυτό το τραγούδι στο φύλλο Lyrics.
            </p>
          )}

          {!loading && errorType === "network" && (
            <p className="lyrics-status lyrics-error">
              Αποτυχία σύνδεσης με το φύλλο Στίχων. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.
            </p>
          )}

          {!loading && !errorType && (
            <pre className="lyrics-text">{lyricsText}</pre>
          )}
        </div>

        <div className="lyrics-footer">
          {isLast ? (
            <div className="lyrics-end-note">Τέλος ομάδας</div>
          ) : (
            <button className="lyrics-next-btn" onClick={handleNext}>
              Επόμενο <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}