import React, { useState, useEffect, useMemo } from "react";
import {
  RefreshCw,
  WifiOff,
  Music2,
  Undo2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Search,
  Settings,
  BookOpenText,
  CheckCircle2,
} from "lucide-react";

import Garland from "./Garland";
import LyricsModal from "./LyricsModal";
import { fetchSongsFromGoogleSheet, computeGroups } from "./GoogleSheetService";
import "./PanigyriApp.css";

export default function PanigyriApp() {
  const [sheetId, setSheetId] = useState(
    () => localStorage.getItem("google_sheet_id") || "1YourGoogleSheetIdHere..."
  );
  const [lyricsGid, setLyricsGid] = useState(
    () => localStorage.getItem("lyrics_sheet_gid") || ""
  );
  const [showSettings, setShowSettings] = useState(false);
  const [pedalModeOn, setPedalModeOn] = useState(false);

  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [threshold, setThreshold] = useState(3);
  const [showSung, setShowSung] = useState(false);
  const [search, setSearch] = useState("");

  // --- Lyrics modal state ---
  const [lyricsSnapshot, setLyricsSnapshot] = useState(null); // array τραγουδιών ομάδας
  const [lyricsStartIndex, setLyricsStartIndex] = useState(0);

  useEffect(() => {
    const savedState = localStorage.getItem("active_session_songs");
    const lastSyncTime = localStorage.getItem("last_sync_timestamp");
    if (lastSyncTime) setLastSync(lastSyncTime);

    if (savedState) {
      setSongs(JSON.parse(savedState));
    } else {
      loadDataFromSheet();
    }
  }, []);

  useEffect(() => {
    if (songs.length > 0) {
      localStorage.setItem("active_session_songs", JSON.stringify(songs));
    }
  }, [songs]);

  const loadDataFromSheet = async () => {
    if (!sheetId || sheetId.includes("YourGoogleSheetIdHere")) {
      setErrorMsg("Παρακαλώ εισάγετε ένα έγκυρο Google Sheet ID στις ρυθμίσεις.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const result = await fetchSongsFromGoogleSheet(sheetId);

      setSongs((prevSongs) => {
        const sungIds = new Set(prevSongs.filter((s) => s.sung).map((s) => s.id));
        return result.songs.map((s) => ({
          ...s,
          sung: sungIds.has(s.id),
        }));
      });

      setIsOfflineMode(result.fromCache);
      setLastSync(localStorage.getItem("last_sync_timestamp"));
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSheetId = (newId) => {
    setSheetId(newId);
    localStorage.setItem("google_sheet_id", newId);
  };

  const handleSaveLyricsGid = (newGid) => {
    setLyricsGid(newGid);
    localStorage.setItem("lyrics_sheet_gid", newGid);
  };

  const { groups, regionOrder } = useMemo(() => computeGroups(songs, threshold), [songs, threshold]);
  const sungSongs = useMemo(() => songs.filter((s) => s.sung), [songs]);
  const activeCount = songs.length - sungSongs.length;

  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;
  const searchMatches = isSearching
    ? songs.filter((s) => s.title.toLowerCase().includes(query) || s.dance.toLowerCase().includes(query))
    : [];
  const searchResults = isSearching ? searchMatches : sungSongs;

  const toggleSung = (id) => {
    setSongs((prev) => prev.map((s) => (s.id === id ? { ...s, sung: !s.sung } : s)));
  };

  // Κατά προσέγγιση ύψος μιας γραμμής τραγουδιού, για όταν η πραγματική
  // γραμμή δεν είναι διαθέσιμη στη σελίδα (π.χ. είναι κρυμμένη σε αναζήτηση).
  const ROW_SHIFT_FALLBACK = 76;

  // Ολισθαίνει απαλά όλη τη σελίδα προς τα κάτω κατά το ύψος μιας γραμμής,
  // ώστε τα προηγούμενα τραγούδια να ανέβουν εκτός οθόνης και να μη χρειαστεί
  // χειροκίνητο scroll από όποιον διαβάζει τη λίστα.
  const shiftPageDown = (height) => {
    if (!height) return;
    requestAnimationFrame(() => {
      window.scrollBy({ top: height, behavior: "smooth" });
    });
  };

  // Κλικ στο κουμπί "Το 'παμε" / "Αναίρεση" πάνω σε μια γραμμή τραγουδιού.
  // Μαρκάρισμα ως ειπωμένο -> γίνεται η ολίσθηση. Αναίρεση -> όχι.
  const handleMarkButtonClick = (e, song) => {
    if (song.sung) {
      setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, sung: false } : s)));
      return;
    }
    const row = e.currentTarget.closest(".song-row");
    const height = row ? row.getBoundingClientRect().height : 0;
    setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, sung: true } : s)));
    shiftPageDown(height);
  };

  // Μόνο θέτει sung=true, ποτέ toggle πίσω. Χρησιμοποιείται από το lyrics modal.
  const markSungOnly = (id) => {
    const el = document.getElementById(`song-${id}`);
    const height = el ? el.getBoundingClientRect().height : ROW_SHIFT_FALLBACK;
    setSongs((prev) => prev.map((s) => (s.id === id ? { ...s, sung: true } : s)));
    shiftPageDown(height);
  };

  const resetNight = () => {
    if (window.confirm("Θέλετε να επαναφέρετε όλα τα τραγούδια για νέα βραδιά;")) {
      setSongs((prev) => prev.map((s) => ({ ...s, sung: false })));
      localStorage.removeItem("active_session_songs");
    }
  };

  // --- Πλοήγηση από αποτέλεσμα αναζήτησης στη θέση του τραγουδιού στη λίστα ---
  const goToSongInList = (songId) => {
    setSearch("");
    setTimeout(() => {
      const el = document.getElementById(`song-${songId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-flash");
        setTimeout(() => el.classList.remove("highlight-flash"), 1600);
      }
    }, 100);
  };

  // --- Άνοιγμα lyrics modal με ένα snapshot τραγουδιών (ομάδα ή αποτελέσματα αναζήτησης) ---
  const openLyricsForSong = (song, snapshotSongs) => {
    const idx = snapshotSongs.findIndex((s) => s.id === song.id);
    setLyricsSnapshot(snapshotSongs);
    setLyricsStartIndex(idx >= 0 ? idx : 0);
  };

  const closeLyricsModal = (highlightSongId) => {
    setLyricsSnapshot(null);
    setLyricsStartIndex(0);
    if (pedalModeOn) {
      // Το κρυφό πεδίο-παγίδα της λίστας είχε χάσει την εστίαση όσο ήταν
      // ανοιχτό το modal (είχε το δικό του) — την επαναφέρουμε.
      focusPedalCatcher();
    }
    if (highlightSongId != null) {
      // Περιμένουμε το επόμενο render (η λίστα τραγουδιών) πριν ψάξουμε το DOM.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.querySelector(
            `[data-pt-song-id="${highlightSongId}"][data-pt-role="title"]`
          );
          if (el) {
            pedalDirectionRef.current = "forward";
            setPedalHighlight(el);
          }
          if (pedalModeOn) focusPedalCatcher();
        });
      });
    }
  };

  // --- Πλοήγηση με page turner πεντάλ (mode Space bar / Enter) ---
  //
  // ΣΗΜΑΝΤΙΚΟ: σε tablet browsers (κυρίως iOS/iPadOS Safari), τα πλήκτρα από
  // μια Bluetooth συσκευή φτάνουν στο JavaScript ΜΟΝΟ όταν η εστίαση είναι
  // πάνω σε πραγματικό πεδίο κειμένου (input/textarea). Γι' αυτό διατηρούμε
  // ένα αόρατο <input> πάντα εστιασμένο όσο είναι ενεργή η λειτουργία, και
  // εκεί «πιάνουμε» τα Space/Enter. Η επισήμανση γίνεται με CSS κλάση (όχι
  // πραγματικό DOM focus) και η ενεργοποίηση καλεί απευθείας το click() του
  // στοιχείου.
  //
  // Αριστερό πεντάλ (Space): 1 κλικ -> βήμα προς την τρέχουσα κατεύθυνση.
  // 2 γρήγορα διαδοχικά κλικ -> αλλάζει μόνιμα κατεύθυνση (μπρος/πίσω) και
  // κάνει ένα βήμα προς τη νέα. Δεξί πεντάλ (Enter): ενεργοποιεί το επισημασμένο.
  const BURST_GAP_MS = 150; // ενώνει γρήγορα διαδοχικά keydown/keyup ενός φυσικού πατήματος σε ένα "tap"
  const DOUBLE_TAP_WINDOW_MS = 350; // μέγιστο κενό ανάμεσα σε 2 tap ώστε να μετρήσουν ως διπλό κλικ
  const pedalCatcherRef = React.useRef(null);
  const pedalHighlightElRef = React.useRef(null);
  const pedalDirectionRef = React.useRef("forward");
  const pedalBurstActiveRef = React.useRef(false);
  const pedalBurstEndTimerRef = React.useRef(null);
  const pedalPendingSingleTimerRef = React.useRef(null);

  const getPedalFocusables = () =>
    Array.from(document.querySelectorAll('[data-pt-focusable="true"]'));

  const setPedalHighlight = (el) => {
    if (pedalHighlightElRef.current) {
      pedalHighlightElRef.current.classList.remove("pt-active");
    }
    pedalHighlightElRef.current = el || null;
    if (el) {
      el.classList.add("pt-active");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const stepPedalHighlight = (direction) => {
    const list = getPedalFocusables();
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
    if (pedalHighlightElRef.current) {
      pedalHighlightElRef.current.click();
    }
  };

  const focusPedalCatcher = () => {
    if (pedalCatcherRef.current) {
      pedalCatcherRef.current.focus({ preventScroll: true });
    }
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

  // Καλείται όταν ένα ολόκληρο φυσικό πάτημα (μαζί με τυχόν εσωτερική
  // επανάληψη του firmware) έχει πραγματικά ολοκληρωθεί.
  const handlePedalTapComplete = () => {
    if (pedalPendingSingleTimerRef.current) {
      // Υπήρχε ήδη ένα tap σε αναμονή -> αυτό είναι το 2ο: διπλό κλικ.
      clearTimeout(pedalPendingSingleTimerRef.current);
      pedalPendingSingleTimerRef.current = null;
      pedalDirectionRef.current = pedalDirectionRef.current === "forward" ? "backward" : "forward";
      stepPedalHighlight(pedalDirectionRef.current);
      return;
    }
    // Πρώτο tap -> περίμενε λίγο μήπως ακολουθήσει δεύτερο (διπλό κλικ).
    pedalPendingSingleTimerRef.current = setTimeout(() => {
      pedalPendingSingleTimerRef.current = null;
      stepPedalHighlight(pedalDirectionRef.current);
    }, DOUBLE_TAP_WINDOW_MS);
  };

  // Κρατάμε το κρυφό πεδίο εστιασμένο όσο η λειτουργία είναι ενεργή.
  useEffect(() => {
    if (!pedalModeOn) {
      setPedalHighlight(null);
      pedalDirectionRef.current = "forward";
      clearPedalTimers();
      return;
    }
    focusPedalCatcher();
    return clearPedalTimers;
  }, [pedalModeOn]);

  const handlePedalCatcherBlur = (e) => {
    if (!pedalModeOn) return;
    // Άσε ελεύθερο το πεδίο αναζήτησης (ή άλλο πεδίο κειμένου) να κρατήσει
    // κανονικά το focus του — μην κλέβεις εστίαση ενώ κάποιος πληκτρολογεί.
    const next = e.relatedTarget;
    if (next && (next.tagName === "INPUT" || next.tagName === "TEXTAREA") && next !== pedalCatcherRef.current) {
      return;
    }
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

  return (
    <div className="panigyri-app">
      <Garland />

      {/* Αόρατο πεδίο που "πιάνει" τα πλήκτρα Space/Enter από το page turner.
          Παραμένει εστιασμένο όσο το pedalModeOn === true. */}
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

      <div className="header">
        <h1>Λίστα Τραγουδιών</h1>
        <p>Πανηγύρι / Συναυλία — Live Manager</p>
        <button
          className={`pedal-mode-toggle${pedalModeOn ? " active" : ""}`}
          onClick={() => setPedalModeOn((v) => !v)}
        >
          {pedalModeOn ? "📟 Page Turner: ΟΝ" : "📟 Page Turner: OFF"}
        </button>
      </div>

      <div className="sync-card">
        <div className="sync-flex">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "13px", fontWeight: "600" }}>Google Sheet Sync</span>
              <button
                className="settings-toggle"
                onClick={() => setShowSettings((v) => !v)}
                title="Ρυθμίσεις Sheet ID"
              >
                <Settings size={14} />
              </button>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted)" }}>
              {lastSync ? `Sync: ${lastSync}` : "Δεν έγινε συγχρονισμός"}
            </p>
          </div>
          <button className="sync-btn" onClick={loadDataFromSheet} disabled={loading}>
            <RefreshCw size={14} />
            {loading ? "Φόρτωση..." : "Συγχρονισμός"}
          </button>
        </div>

        {showSettings && (
          <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
            <label style={{ fontSize: "11px", color: "var(--muted)" }}>Google Sheet ID:</label>
            <input
              type="text"
              className="sheet-input"
              value={sheetId}
              onChange={(e) => handleSaveSheetId(e.target.value)}
              placeholder="Εισάγετε το Google Sheet ID"
            />
            <label style={{ fontSize: "11px", color: "var(--muted)", marginTop: "8px", display: "block" }}>
              Lyrics Sheet GID:
            </label>
            <input
              type="text"
              className="sheet-input"
              value={lyricsGid}
              onChange={(e) => handleSaveLyricsGid(e.target.value)}
              placeholder="π.χ. 123456789"
            />
          </div>
        )}

        {isOfflineMode && (
          <div
            style={{
              marginTop: "8px",
              background: "#E1563F",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <WifiOff size={13} /> Λειτουργία Offline (Δεδομένα από cache)
          </div>
        )}

        {errorMsg && (
          <p style={{ color: "#ff6b6b", fontSize: "11px", margin: "6px 0 0" }}>{errorMsg}</p>
        )}
      </div>

      <div className="search-bar">
        <Search size={14} color="#A9A6C4" />
        <input
          type="text"
          placeholder="Αναζήτηση τραγουδιού ή χορού…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value.trim()) setShowSung(true);
          }}
        />
      </div>

      <div className="controls">
        <div>
          <label>Όριο ομάδας</label>
          <input
            type="number"
            min={1}
            max={10}
            className="threshold-input"
            value={threshold}
            onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div className="stat">
          Ενεργά: <b>{activeCount}</b> / {songs.length}
        </div>
        <button className="reset-btn" onClick={resetNight}>
          <RotateCcw size={14} /> Νέα Βραδιά
        </button>
      </div>

      {!isSearching &&
        regionOrder.map((region) => {
          const list = groups[region] || [];
          return (
            <div className="region-block" key={region}>
              <h2 className="region-title">
                <Music2 size={16} /> {region}
              </h2>
              {list.length === 0 ? (
                <p className="empty-region">Ειπώθηκαν όλα τα τραγούδια αυτής της περιοχής.</p>
              ) : (
                list.map((g) => (
                  <div className="group-card" key={g.hostDance}>
                    <div className="group-head">
                      <span className="name">{g.hostDance}</span>
                      <span className="count">
                        {g.songs.filter((s) => !s.sung).length} / {g.songs.length} τραγούδια
                      </span>
                    </div>
                    {g.mergedFrom.length > 0 && (
                      <div className="merged-note">
                        <Sparkles size={12} /> Συγχωνεύτηκαν εδώ: {g.mergedFrom.join(", ")}
                      </div>
                    )}
                    {g.songs.map((s) => (
                      <div className={`song-row${s.sung ? " is-sung" : ""}`} key={s.id} id={`song-${s.id}`}>
                        <div
                          className="song-row-info"
                          onClick={(e) => handleMarkButtonClick(e, s)}
                          tabIndex={0}
                          role="button"
                          data-pt-focusable="true"
                          data-pt-song-id={s.id}
                          data-pt-role="title"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleMarkButtonClick(e, s);
                          }}
                        >
                          <span className="title">
                            {s.sung && <CheckCircle2 size={14} className="sung-check" />}
                            {s.title}
                          </span>
                          {s.originTag !== g.hostDance && (
                            <span className="origin-tag">{s.originTag}</span>
                          )}
                        </div>
                        <div className="song-row-actions">
                          <button
                            className="song-action-btn lyrics-btn"
                            onClick={() => openLyricsForSong(s, g.songs)}
                            data-pt-focusable="true"
                            data-pt-song-id={s.id}
                            data-pt-role="lyrics"
                          >
                            <BookOpenText size={18} />
                            Στίχοι
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          );
        })}

      <div className="sung-section">
        <button className="sung-toggle" onClick={() => setShowSung((v) => !v)}>
          <span>
            {isSearching ? "Αποτελέσματα Αναζήτησης" : `Ειπωμένα τραγούδια (${sungSongs.length})`}
            {isSearching ? ` (${searchResults.length})` : ""}
          </span>
          {showSung ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showSung && (
          <div className="sung-list">
            {searchResults.length === 0 ? (
              <p className="empty-region">
                {isSearching ? "Δεν βρέθηκε τραγούδι." : "Κανένα ακόμα."}
              </p>
            ) : isSearching ? (
              <div className="group-card">
                {searchResults.map((s) => (
                  <div className={`song-row${s.sung ? " is-sung" : ""}`} key={s.id}>
                    <div
                      className="song-row-info"
                      onClick={(e) => handleMarkButtonClick(e, s)}
                      tabIndex={0}
                      role="button"
                      data-pt-focusable="true"
                      data-pt-song-id={s.id}
                      data-pt-role="title"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleMarkButtonClick(e, s);
                      }}
                    >
                      <span className="title">
                        {s.sung && <CheckCircle2 size={14} className="sung-check" />}
                        {s.title}
                      </span>
                      <span
                        className="origin-tag origin-tag-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToSongInList(s.id);
                        }}
                        title="Μετάβαση στη θέση του στη λίστα"
                      >
                        {s.dance} · {s.region}
                      </span>
                    </div>
                    <div className="song-row-actions">
                      <button
                        className="song-action-btn lyrics-btn"
                        onClick={() => openLyricsForSong(s, searchResults)}
                        data-pt-focusable="true"
                        data-pt-song-id={s.id}
                        data-pt-role="lyrics"
                      >
                        <BookOpenText size={18} />
                        Στίχοι
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              searchResults.map((s) => (
                <div
                  className="sung-row"
                  key={s.id}
                  style={s.sung ? undefined : { color: "var(--text)" }}
                >
                  <span className="title" style={s.sung ? undefined : { textDecoration: "none" }}>
                    {s.title} · {s.dance}, {s.region}
                  </span>
                  <button className="undo-btn" onClick={() => toggleSung(s.id)}>
                    <Undo2 size={12} /> {s.sung ? "Επαναφορά" : "Ειπώθηκε"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <p className="footnote">
        Τα δεδομένα αντλούνται ζωντανά από το Google Sheet. Σε περίπτωση απώλειας σήματος, η εφαρμογή
        συνεχίζει να λειτουργεί αυτόματα με τα τοπικά αποθηκευμένα δεδομένα.
      </p>

      {lyricsSnapshot && (
        <LyricsModal
          songs={lyricsSnapshot}
          startIndex={lyricsStartIndex}
          sheetId={sheetId}
          lyricsGid={lyricsGid}
          onMarkSung={markSungOnly}
          onClose={closeLyricsModal}
        />
      )}
    </div>
  );
}