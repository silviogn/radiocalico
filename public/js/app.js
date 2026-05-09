const STREAM   = "https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8";
const METADATA = "/api/metadata";

const audio          = document.getElementById("audio");
const playBtn        = document.getElementById("playBtn");
const iconPlay       = document.getElementById("iconPlay");
const iconPause      = document.getElementById("iconPause");
const volumeSlider   = document.getElementById("volumeSlider");
const statusDot      = document.getElementById("statusDot");
const statusText     = document.getElementById("statusText");
const elapsed        = document.getElementById("elapsed");
const npArtist       = document.getElementById("npArtist");
const npTitle        = document.getElementById("npTitle");
const npAlbum        = document.getElementById("npAlbum");
const qualitySource  = document.getElementById("qualitySource");
const qualityStream  = document.getElementById("qualityStream");
const recentList     = document.getElementById("recentList");
const btnUp          = document.getElementById("btnUp");
const btnDown        = document.getElementById("btnDown");
const countUp        = document.getElementById("countUp");
const countDown      = document.getElementById("countDown");
const albumArt       = document.getElementById("albumArt");
const albumArtPlaceholder = document.getElementById("albumArtPlaceholder");

let hls = null;
let playing = false;
let elapsedSecs = 0;
let elapsedTimer = null;
let metaTimer = null;
let currentSongId = null;

function setStatus(state, text) {
  statusDot.className = "status-dot " + state;
  statusText.textContent = text;
}

function showPlayIcon(isPlaying) {
  iconPlay.style.display  = isPlaying ? "none"  : "block";
  iconPause.style.display = isPlaying ? "block" : "none";
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return `${m}:${sec}`;
}

function startElapsed() {
  stopElapsed();
  elapsedSecs = 0;
  elapsed.textContent = "0:00";
  elapsedTimer = setInterval(() => {
    elapsedSecs++;
    elapsed.textContent = formatTime(elapsedSecs);
  }, 1000);
}

function stopElapsed() {
  clearInterval(elapsedTimer);
  elapsedTimer = null;
}

function makeSongId(artist, title) {
  return `${(artist || "").trim().toLowerCase()}::${(title || "").trim().toLowerCase()}`;
}

function esc(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function applyRating({ thumbsUp, thumbsDown, myVote }) {
  countUp.textContent   = thumbsUp;
  countDown.textContent = thumbsDown;
  btnUp.classList.toggle("voted-up",    myVote === "up");
  btnDown.classList.toggle("voted-down", myVote === "down");
  btnUp.disabled   = false;
  btnDown.disabled = false;
}

async function fetchRatings(sid) {
  try {
    const r = await fetch(`/api/ratings/${encodeURIComponent(sid)}`);
    if (r.ok) applyRating(await r.json());
  } catch (_) {}
}

async function submitVote(vote) {
  if (!currentSongId) return;
  btnUp.disabled = btnDown.disabled = true;
  try {
    const r = await fetch(`/api/ratings/${encodeURIComponent(currentSongId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });
    applyRating(await r.json());
  } catch (_) {
    btnUp.disabled = btnDown.disabled = false;
  }
}

btnUp.addEventListener("click",   () => submitVote("up"));
btnDown.addEventListener("click", () => submitVote("down"));

async function loadAlbumArt(artist, album) {
  albumArt.style.display = "none";
  albumArtPlaceholder.style.display = "flex";
  if (!artist && !album) return;
  try {
    // Strip parenthetical suffixes like "(Deluxe)" before querying
    const cleanAlbum = (album || "").replace(/\s*\(.*?\)\s*/g, "").trim();
    const q = encodeURIComponent(`release:${cleanAlbum} AND artist:${artist}`);
    const mbRes = await fetch(
      `https://musicbrainz.org/ws/2/release/?query=${q}&limit=1&fmt=json`,
      { headers: { "User-Agent": "RadioCalico/1.0 (radio)" } }
    );
    if (!mbRes.ok) return;
    const mbData = await mbRes.json();
    const releaseId = mbData?.releases?.[0]?.id;
    if (!releaseId) return;
    const artUrl = `https://coverartarchive.org/release/${releaseId}/front-250`;
    albumArt.onload = () => {
      albumArtPlaceholder.style.display = "none";
      albumArt.style.display = "block";
    };
    albumArt.onerror = () => {
      albumArt.style.display = "none";
      albumArtPlaceholder.style.display = "flex";
    };
    albumArt.src = artUrl;
  } catch (_) {}
}

async function fetchMetadata() {
  try {
    const res = await fetch(METADATA);
    if (!res.ok) return;
    renderMetadata(await res.json());
  } catch (_) {}
}

function renderMetadata(d) {
  npArtist.textContent = d.artist || "—";
  npTitle.textContent  = d.title  || "—";
  npAlbum.textContent  = d.album  || "";

  const bit = d.bit_depth   ? d.bit_depth + "-bit"               : "";
  const khz = d.sample_rate ? (d.sample_rate / 1000).toFixed(0) + " kHz" : "";
  const srcQ = [bit, khz].filter(Boolean).join(" / ");
  qualitySource.innerHTML = srcQ
    ? `<strong>Source quality:</strong> ${esc(srcQ)} lossless`
    : "";
  qualityStream.innerHTML = srcQ
    ? `<strong>Stream quality:</strong> 44kHz / 16 Lossless`
    : "";

  const sid = makeSongId(d.artist, d.title);
  if (sid !== currentSongId) {
    currentSongId = sid;
    countUp.textContent = countDown.textContent = "0";
    btnUp.classList.remove("voted-up");
    btnDown.classList.remove("voted-down");
    btnUp.disabled = btnDown.disabled = false;
    fetchRatings(sid);
    loadAlbumArt(d.artist, d.album);
  }

  const prev = d.prev || [];
  const items = prev.length
    ? prev.filter(p => makeSongId(p.artist, p.title) !== sid)
        .map(p => `<li><span class="recent-track">${esc(p.title)}</span><span class="recent-sep">–</span><span class="recent-artist">${esc(p.artist)}</span></li>`)
    : (() => {
        const r = [];
        for (let i = 1; i <= 5; i++) {
          const a = d[`prev_artist_${i}`], t = d[`prev_title_${i}`];
          if ((a || t) && makeSongId(a, t) !== sid)
            r.push(`<li><span class="recent-track">${esc(t)}</span><span class="recent-sep">–</span><span class="recent-artist">${esc(a)}</span></li>`);
        }
        return r;
      })();

  if (items.length) recentList.innerHTML = items.join("");
}

function startMeta() {
  fetchMetadata();
  metaTimer = setInterval(fetchMetadata, 15000);
}

function stopMeta() {
  clearInterval(metaTimer);
  metaTimer = null;
}

function initHls() {
  if (hls) { hls.destroy(); hls = null; }

  if (Hls.isSupported()) {
    hls = new Hls({ lowLatencyMode: false });
    hls.loadSource(STREAM);
    hls.attachMedia(audio);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setStatus("live", "Live");
      audio.play();
    });

    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) {
        setStatus("error", "Connection error");
        showPlayIcon(false);
        playing = false;
        stopElapsed();
        stopMeta();
      }
    });
  } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
    audio.src = STREAM;
    audio.addEventListener("canplay", () => setStatus("live", "Live"), { once: true });
    audio.play();
  } else {
    setStatus("error", "HLS not supported in this browser");
  }
}

playBtn.addEventListener("click", () => {
  if (!playing) {
    setStatus("loading", "Buffering…");
    initHls();
    playing = true;
    showPlayIcon(true);
  } else {
    audio.pause();
    if (hls) { hls.destroy(); hls = null; }
    audio.src = "";
    playing = false;
    showPlayIcon(false);
    stopElapsed();
    stopMeta();
    elapsed.textContent = "0:00";
    setStatus("", "Paused");
  }
});

audio.addEventListener("playing", () => {
  setStatus("live", "Live");
  playing = true;
  showPlayIcon(true);
  startElapsed();
  startMeta();
});

audio.addEventListener("pause", () => {
  if (playing) setStatus("", "Paused");
  stopElapsed();
  stopMeta();
});

volumeSlider.addEventListener("input", () => {
  audio.volume = volumeSlider.value;
});

if (window.__INIT__) {
  renderMetadata(window.__INIT__);
} else {
  fetchMetadata();
}
