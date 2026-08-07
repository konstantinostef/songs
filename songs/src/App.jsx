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

  const closeLyricsModal = () => {
    setLyricsSnapshot(null);
    setLyricsStartIndex(0);
  };

  // --- Πλοήγηση με page turner πεντάλ (mode Space bar / Enter) ---
  // Αριστερό πεντάλ (Space) -> προχωράει την επισήμανση στο επόμενο ορατό
  // στοιχείο (τίτλος τραγουδιού ή κουμπί "Στίχοι"), με auto-scroll.
  // Δεξί πεντάλ (Enter) -> ενεργοποιεί (κάνει "κλικ") ό,τι είναι επισημασμένο,
  // μέσω της φυσικής συμπεριφοράς εστίασης του browser (native focus + click).
  const moveFocusToNextPedalTarget = () => {
    const focusables = Array.from(document.querySelectorAll('[data-pt-focusable="true"]'));
    if (focusables.length === 0) return;
    const currentIndex = focusables.indexOf(document.activeElement);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % focusables.length;
    const next = focusables[nextIndex];
    next.focus();
    next.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    // Απενεργοποιημένο όσο είναι ανοιχτό το lyrics modal (έχει δικό του
    // focus/scroll context) ή όσο πληκτρολογεί κανείς σε πεδίο κειμένου.
    const handlePedalKeyDown = (e) => {
      if (lyricsSnapshot) return;
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        moveFocusToNextPedalTarget();
      }
    };
    window.addEventListener("keydown", handlePedalKeyDown);
    return () => window.removeEventListener("keydown", handlePedalKeyDown);
  }, [lyricsSnapshot]);

  return (
    <div className="panigyri-app">
      <Garland />

      <div className="header">
        <h1>Λίστα Τραγουδιών</h1>
        <p>Πανηγύρι / Συναυλία — Live Manager</p>
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