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
  // το τραγούδι ως ειπωμένο — μόνο το "Επόμενο" το κάνει. Στέλνουμε πάνω το
  // id του επόμενου τραγουδιού (ή του τρέχοντος αν ήταν το τελευταίο) ώστε
  // η λίστα να μπορεί να το επισημάνει για το page turner.
  const handleClose = () => {
    onClose(nextSong ? nextSong.id : current.id);
  };

  // --- Πλοήγηση με page turner πεντάλ μέσα στο modal (mode Space / Enter) ---
  //
  // Ίδια λογική με τη λίστα τραγουδιών: αντί για πραγματικό DOM focus (που
  // δεν φτάνει αξιόπιστα τα πλήκτρα Bluetooth σε πολλά tablet browsers),
  // χρησιμοποιούμε ένα αόρατο πεδίο-παγίδα + CSS κλάση για την επισήμανση.
  //
  // 1 κλικ -> βήμα προς την τρέχουσα κατεύθυνση. 2 γρήγορα διαδοχικά κλικ ->
  // αλλάζει μόνιμα κατεύθυνση + βήμα προς τη νέα. Προεπιλογή σε κάθε
  // άνοιγμα/αλλαγή τραγουδιού: επισήμανση στο "Επόμενο" (ή "Κλείσιμο" αν
  // είναι το τελευταίο) και κατεύθυνση "forward".
  const BURST_GAP_MS = 150;
  const DOUBLE_TAP_WINDOW_MS = 350;
  const pedalCatcherRef = React.useRef(null);
  const pedalHighlightElRef = React.useRef(null);
  const pedalDirectionRef = React.useRef("forward");
  const pedalBurstActiveRef = React.useRef(false);
  const pedalBurstEndTimerRef = React.useRef(null);
  const pedalPendingSingleTimerRef = React.useRef(null);

  const getModalFocusables = () => {
    const modalEl = document.querySelector(".lyrics-modal");
    if (!modalEl) return [];
    return Array.from(modalEl.querySelectorAll('[data-pt-focusable="true"]:not([disabled])'));
  };

  const setPedalHighlight = (el) => {
    if (pedalHighlightElRef.current) {
      pedalHighlightElRef.current.classList.remove("pt-active");
    }
    pedalHighlightElRef.current = el || null;
    if (el) el.classList.add("pt-active");
  };

  const stepPedalHighlight = (direction) => {
    const list = getModalFocusables();
    if (list.length === 0) return;
    const currentIndex = pedalHighlightElRef.current
      ? list.indexOf(pedalHighlightElRef.current)
      : -1;
    let nextIndex;
    if (currentIndex === -1) {
      nextIndex = direction === "forward" ? 0 : list.length - 1;
    } else {
      nextIndex =
        direction === "forward"
          ? (currentIndex + 1) % list.length
          : (currentIndex - 1 + list.length) % list.length;
    }
    setPedalHighlight(list[nextIndex]);
  };

  const activatePedalHighlight = () => {
    if (pedalHighlightElRef.current) pedalHighlightElRef.current.click();
  };

  const focusPedalCatcher = () => {
    if (pedalCatcherRef.current) pedalCatcherRef.current.focus({ preventScroll: true });
  };

  const clearPedalTimers = () => {
    if (pedalBurstEndTimerRef.current) {
      clearTimeout(pedalBurstEndTimerRef.current);
      pedalBurstEndTimerRef.current = null;
    }
    if (pedalPendingSingleTimerRef.current) {
      clearTimeout(pedalPendingSingleTimerRef.current);
      pedalPendingSingleTimerRef.current = null;
    }
  };

  const handlePedalTapComplete = () => {
    if (pedalPendingSingleTimerRef.current) {
      clearTimeout(pedalPendingSingleTimerRef.current);
      pedalPendingSingleTimerRef.current = null;
      pedalDirectionRef.current = pedalDirectionRef.current === "forward" ? "backward" : "forward";
      stepPedalHighlight(pedalDirectionRef.current);
      return;
    }
    pedalPendingSingleTimerRef.current = setTimeout(() => {
      pedalPendingSingleTimerRef.current = null;
      stepPedalHighlight(pedalDirectionRef.current);
    }, DOUBLE_TAP_WINDOW_MS);
  };

  // Το πεδίο-παγίδα παραμένει πάντα εστιασμένο όσο το modal είναι ανοιχτό.
  useEffect(() => {
    focusPedalCatcher();
    return clearPedalTimers;
  }, []);

  // Προεπιλεγμένη επισήμανση: "Επόμενο" (ή "Κλείσιμο" αν είναι το τελευταίο).
  useEffect(() => {
    pedalDirectionRef.current = "forward";
    const id = requestAnimationFrame(() => {
      const list = getModalFocusables();
      const target = list.find((el) =>
        el.classList.contains(isLast ? "lyrics-close-btn" : "lyrics-next-btn")
      );
      setPedalHighlight(target || list[0] || null);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isLast]);

  const handlePedalCatcherBlur = () => {
    requestAnimationFrame(focusPedalCatcher);
  };

  const handlePedalCatcherKeyDown = (e) => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (pedalBurstEndTimerRef.current) {
        clearTimeout(pedalBurstEndTimerRef.current);
        pedalBurstEndTimerRef.current = null;
      }
      pedalBurstActiveRef.current = true;
    } else if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  const handlePedalCatcherKeyUp = (e) => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (pedalBurstEndTimerRef.current) clearTimeout(pedalBurstEndTimerRef.current);
      pedalBurstEndTimerRef.current = setTimeout(() => {
        pedalBurstActiveRef.current = false;
        pedalBurstEndTimerRef.current = null;
        handlePedalTapComplete();
      }, BURST_GAP_MS);
    } else if (e.key === "Enter") {
      e.preventDefault();
      activatePedalHighlight();
    }
  };

  if (!current) return null;

  return (
    <div className="lyrics-backdrop" onClick={handleClose}>
      <input
        ref={pedalCatcherRef}
        className="pt-key-catcher"
        aria-hidden="true"
        tabIndex={-1}
        readOnly
        value=""
        onKeyDown={handlePedalCatcherKeyDown}
        onKeyUp={handlePedalCatcherKeyUp}
        onBlur={handlePedalCatcherBlur}
      />
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
          <button className="lyrics-close-btn" onClick={handleClose} data-pt-focusable="true">
            <X size={16} /> Κλείσιμο
          </button>

          {isLast ? (
            <div className="lyrics-end-note">Τέλος ομάδας</div>
          ) : (
            <button className="lyrics-next-btn" onClick={handleNext} data-pt-focusable="true">
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
            data-pt-focusable="true"
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
            data-pt-focusable="true"
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