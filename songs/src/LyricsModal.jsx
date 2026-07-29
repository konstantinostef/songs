import React, { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ChevronsRight, Loader2 } from "lucide-react";
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

  const previousSong = index > 0 ? songs[index - 1] : null;
  const nextSong = !isLast ? songs[index + 1] : null;
  const nextNextSong = index + 2 < songs.length ? songs[index + 2] : null;

  const handleNext = () => {
    if (isLast) return;
    onMarkSung(current.id);
    setIndex((i) => i + 1);
  };

  // Πάει στο μεθεπόμενο τραγούδι, προσπερνώντας το αμέσως επόμενο (το οποίο
  // παραμένει ενεργό/μη ειπωμένο στη λίστα). Μαρκάρει ως ειπωμένο μόνο το
  // τρέχον, ακριβώς όπως κάνει και το "Επόμενο".
  const handleSkipNext = () => {
    if (!nextNextSong) return;
    onMarkSung(current.id);
    setIndex((i) => i + 2);
  };

  // Επιστροφή στο προηγούμενο τραγούδι — απλή πλοήγηση, δεν μαρκάρει τίποτα.
  const handlePrevious = () => {
    if (!previousSong) return;
    setIndex((i) => i - 1);
  };

  // Το κλείσιμο (X, backdrop, Esc, ή το κουμπί "Κλείσιμο") ΔΕΝ μαρκάρει
  // το τραγούδι ως ειπωμένο — μόνο το "Επόμενο" το κάνει.
  const handleClose = () => {
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

        <div className="lyrics-footer lyrics-footer-grid">
          <button className="lyrics-close-btn" onClick={handleClose}>
            <X size={16} /> Κλείσιμο
          </button>

          {isLast ? (
            <div className="lyrics-end-note">Τέλος ομάδας</div>
          ) : (
            <button className="lyrics-next-btn" onClick={handleNext}>
              <span className="lyrics-nav-text">
                <span className="lyrics-nav-label">Επόμενο</span>
                <span className="lyrics-nav-title">{nextSong.title}</span>
              </span>
              <ChevronRight size={20} />
            </button>
          )}

          <button
            className="lyrics-nav-btn lyrics-prev-btn"
            onClick={handlePrevious}
            disabled={!previousSong}
          >
            <ChevronLeft size={18} />
            <span className="lyrics-nav-text">
              <span className="lyrics-nav-label">Προηγούμενο</span>
              <span className="lyrics-nav-title">{previousSong ? previousSong.title : "—"}</span>
            </span>
          </button>

          <button
            className="lyrics-nav-btn lyrics-skip-btn"
            onClick={handleSkipNext}
            disabled={!nextNextSong}
          >
            <span className="lyrics-nav-text">
              <span className="lyrics-nav-label">Μεθεπόμενο</span>
              <span className="lyrics-nav-title">{nextNextSong ? nextNextSong.title : "—"}</span>
            </span>
            <ChevronsRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}