// --- Γενικός CSV parser: σέβεται quotes, escaped "" και literal newlines μέσα σε πεδία ---
function parseCSVRows(rawText) {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // skip το δεύτερο "
        } else {
          inQuotes = false;
        }
      } else {
        field += char; // περιλαμβάνει και literal \n μέσα σε quotes
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

// --- Παρσάρισμα φύλλου τραγουδιών (region, dance, title, key, songId) ---
export function parseSongsCSV(text) {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return [];

  const songs = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].map((c) => c.trim());
    if (cells.length < 3) continue;

    const region = cells[0];
    const dance = cells[1];
    const title = cells[2];
    const key = cells[3] || "";
    const songId = cells[4] || "";

    if (region && dance && title) {
      songs.push({
        id: songId || `sheet-${i}-${title}`,
        songId: songId || null,
        region,
        dance,
        title: key ? `${title} (${key})` : title,
        sung: false,
      });
    }
  }
  return songs;
}

export async function fetchSongsFromGoogleSheet(sheetId) {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  try {
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("Αποτυχία σύνδεσης με το Google Sheet");

    const csvText = await response.text();
    const parsedSongs = parseSongsCSV(csvText);

    if (parsedSongs.length === 0) {
      throw new Error("Δεν βρέθηκαν έγκυρα τραγούδια στο Sheet");
    }

    localStorage.setItem("cached_songs_data", JSON.stringify(parsedSongs));
    localStorage.setItem("last_sync_timestamp", new Date().toLocaleString("el-GR"));

    return { songs: parsedSongs, fromCache: false };
  } catch (error) {
    const cachedData = localStorage.getItem("cached_songs_data");
    if (cachedData) {
      return { songs: JSON.parse(cachedData), fromCache: true };
    }
    throw new Error("Δεν υπάρχει σύνδεση και δεν βρέθηκαν αποθηκευμένα τραγούδια.");
  }
}

// --- Παρσάρισμα φύλλου στίχων: επιστρέφει map { songId: lyrics } ---
export function parseLyricsCSV(text) {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return {};

  const map = {};
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length < 2) continue;

    const songId = (cells[0] || "").trim();
    const lyrics = (cells[1] || "").trim();

    if (songId) map[songId] = lyrics;
  }
  return map;
}

// Κανένα caching — καλείται φρέσκο σε κάθε double-click/άνοιγμα modal.
export async function fetchLyricsFromGoogleSheet(sheetId, lyricsGid) {
  if (!sheetId || !lyricsGid) {
    throw new Error("Λείπει το Sheet ID ή το Lyrics Sheet GID.");
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${lyricsGid}`;

  const response = await fetch(csvUrl);
  if (!response.ok) throw new Error("Αποτυχία σύνδεσης με το φύλλο Στίχων.");

  const csvText = await response.text();
  const lyricsMap = parseLyricsCSV(csvText);

  return { lyricsMap };
}

export function computeGroups(songs, threshold) {
  const byRegion = {};
  const regionOrder = [];

  songs.forEach((s) => {
    if (s.sung) return;

    if (!byRegion[s.region]) {
      byRegion[s.region] = {};
      regionOrder.push(s.region);
    }
    if (!byRegion[s.region][s.dance]) {
      byRegion[s.region][s.dance] = [];
    }
    byRegion[s.region][s.dance].push(s);
  });

  const result = { groups: {}, regionOrder };

  regionOrder.forEach((region) => {
    const danceMap = byRegion[region] || {};
    let list = Object.entries(danceMap).map(([dance, arr]) => ({
      hostDance: dance,
      mergedFrom: [],
      songs: arr.map((s) => ({ ...s, originTag: dance })),
    }));

    let changed = true;
    while (changed && list.length > 1) {
      changed = false;
      list.sort((a, b) => a.songs.length - b.songs.length);
      if (list[0].songs.length < threshold) {
        const source = list[0];
        const target = list[1];
        target.songs = target.songs.concat(source.songs);
        target.mergedFrom = [...target.mergedFrom, source.hostDance, ...source.mergedFrom];
        list = list.slice(1);
        changed = true;
      }
    }
    list.sort((a, b) => a.hostDance.localeCompare(b.hostDance, "el"));
    result.groups[region] = list;
  });

  return result;
}