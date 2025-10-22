let currentTrackIndex = 0;
let musicFiles = [];
let audioCache = new Map(); // Cache for audio elements
let preloadedTracks = new Set(); // Track which files are preloaded
let trackMetadata = new Map(); // Cache for track metadata

// Media Session helpers
function updateMediaSessionMetadata(metadata) {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.title || "Unknown Track",
      artist: metadata.artist || "Unknown Artist",
      album: metadata.album || "Unknown Album",
    });
  }
}

function updateMediaSessionPlaybackState(state) {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = state;
  }
}

// Setup Media Session action handlers bound to a given audio element
function setupMediaSession(audio) {
  if (!("mediaSession" in navigator) || !audio) return;

  navigator.mediaSession.setActionHandler("play", () => audio.play());
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
  navigator.mediaSession.setActionHandler("previoustrack", async () => {
    currentTrackIndex =
      (currentTrackIndex - 1 + musicFiles.length) % musicFiles.length;
    await loadTrack(currentTrackIndex);
    audio.play();
  });
  navigator.mediaSession.setActionHandler("nexttrack", async () => {
    currentTrackIndex = (currentTrackIndex + 1) % musicFiles.length;
    await loadTrack(currentTrackIndex);
    audio.play();
  });
  navigator.mediaSession.setActionHandler("seekto", (details) => {
    if (details && details.seekTime !== undefined)
      audio.currentTime = details.seekTime;
  });
}

// Extract metadata (cache-first)
async function extractMetadata(filename) {
  if (trackMetadata.has(filename)) return trackMetadata.get(filename);

  try {
    const response = await fetch(
      `/api/metadata/${encodeURIComponent(filename)}`
    );
    if (response.ok) {
      const metadata = await response.json();
      trackMetadata.set(filename, metadata);
      return metadata;
    }
  } catch (error) {
    console.warn(`Failed to fetch metadata for ${filename}:`, error);
  }

  const fallback = parseFilenameMetadata(filename);
  trackMetadata.set(filename, fallback);
  return fallback;
}

// Filename parsing fallback
function parseFilenameMetadata(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  const dashSplit = nameWithoutExt.split(" - ");
  if (dashSplit.length >= 2) {
    return {
      title: dashSplit.slice(1).join(" - ").trim(),
      artist: dashSplit[0].trim(),
      album: "Unknown Album",
    };
  }

  const underscoreSplit = nameWithoutExt.split("_");
  if (underscoreSplit.length >= 2) {
    return {
      title: underscoreSplit.slice(1).join("_").replace(/_/g, " ").trim(),
      artist: underscoreSplit[0].replace(/_/g, " ").trim(),
      album: "Unknown Album",
    };
  }

  const cleanTitle = nameWithoutExt
    .replace(/^\d+[\s\-\.]*/, "")
    .replace(/[\(\[].*?[\)\]]/g, "")
    .trim();

  return {
    title: cleanTitle || nameWithoutExt,
    artist: "Unknown Artist",
    album: "Unknown Album",
  };
}

// Load list of music and initialize player
async function loadMusic() {
  try {
    const response = await fetch("/api/music", {
      cache: "no-cache",
      headers: { "Content-Type": "application/music" },
    });
    musicFiles = await response.json();

    if (!musicFiles || musicFiles.length === 0) {
      const el = document.getElementById("track-title");
      if (el) el.textContent = "No music files available";
      return;
    }

    const audio = document.createElement("audio");
    audio.id = "audio-element";
    audio.preload = "metadata";
    document.body.appendChild(audio);

    setupMediaSession(audio);

    await loadTrack(0);
    initializePlayer();
    preloadAdjacentTracks(0);
  } catch (error) {
    console.error("Error loading music:", error);
    const el = document.getElementById("track-title");
    if (el) el.textContent = "Error loading music";
  }
}

// Preload helpers
function preloadAdjacentTracks(currentIndex) {
  if (!musicFiles || musicFiles.length === 0) return;
  const toPreload = [
    (currentIndex - 1 + musicFiles.length) % musicFiles.length,
    (currentIndex + 1) % musicFiles.length,
  ];
  toPreload.forEach((i) => {
    const filename = musicFiles[i];
    if (filename && !preloadedTracks.has(filename)) preloadTrack(filename);
  });
}

function preloadTrack(filename) {
  if (preloadedTracks.has(filename)) return Promise.resolve();

  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = `music/${filename}`;

    const onLoad = () => {
      audioCache.set(filename, audio);
      preloadedTracks.add(filename);
      console.log(`Preloaded: ${filename}`);
      cleanup();
      resolve();
    };
    const onError = () => {
      console.warn(`Failed to preload: ${filename}`);
      cleanup();
      resolve();
    };
    const cleanup = () => {
      audio.removeEventListener("canplaythrough", onLoad);
      audio.removeEventListener("error", onError);
    };

    audio.addEventListener("canplaythrough", onLoad, { once: true });
    audio.addEventListener("error", onError, { once: true });
  });
}

// Load a specific track into main audio element
async function loadTrack(index) {
  const audio = document.getElementById("audio-element");
  const trackTitle = document.getElementById("track-title");
  const trackArtist = document.querySelector(".track-artist");

  if (!musicFiles || !musicFiles[index]) return;

  const filename = musicFiles[index];
  const trackUrl = `music/${filename}`;

  // Optional diagnostics
  fetch(trackUrl, { method: "HEAD" })
    .then((headRes) => {
      console.log("HEAD", filename, headRes.status, {
        "Content-Type": headRes.headers.get("content-type"),
        "Content-Length": headRes.headers.get("content-length"),
        "Accept-Ranges": headRes.headers.get("accept-ranges"),
        ETag: headRes.headers.get("etag"),
      });
    })
    .catch((err) => console.warn("HEAD failed", err));

  const metadata = await extractMetadata(filename);

  // Attach lightweight metadata/duration diagnostics once per load
  audio.addEventListener(
    "loadedmetadata",
    () => {
      console.log(
        "loadedmetadata",
        filename,
        "duration=",
        audio.duration,
        "readyState=",
        audio.readyState
      );
      const durationEl = document.getElementById("duration");
      const meta = trackMetadata.get(filename) || {};
      const serverDur = meta.duration;
      if ((!isFinite(audio.duration) || audio.duration === 0) && serverDur) {
        if (durationEl) durationEl.textContent = formatTime(serverDur);
        if (
          "mediaSession" in navigator &&
          "setPositionState" in navigator.mediaSession
        ) {
          try {
            navigator.mediaSession.setPositionState({
              duration: serverDur,
              playbackRate: audio.playbackRate,
              position: audio.currentTime || 0,
            });
          } catch (e) {
            /* ignore */
          }
        }
      } else {
        if (durationEl && isFinite(audio.duration) && audio.duration > 0)
          durationEl.textContent = formatTime(audio.duration);
      }
    },
    { once: true }
  );

  audio.addEventListener(
    "error",
    () => console.error("audio error", filename, audio.error),
    { once: true }
  );
  audio.addEventListener(
    "stalled",
    () => console.warn("audio stalled", filename),
    { once: true }
  );

  if (audioCache.has(filename)) {
    const cachedAudio = audioCache.get(filename);
    audio.src = cachedAudio.src;
    console.log(`Using cached audio for: ${filename}`);
  } else {
    audio.src = trackUrl;
    audio.addEventListener(
      "canplaythrough",
      () => preloadedTracks.add(filename),
      { once: true }
    );
  }

  if (trackTitle) trackTitle.textContent = metadata.title;
  if (trackArtist) trackArtist.textContent = metadata.artist;
  currentTrackIndex = index;

  const durationEl = document.getElementById("duration");
  if (metadata.duration && durationEl)
    durationEl.textContent = formatTime(metadata.duration);
  else if (durationEl) durationEl.textContent = "0:00";

  updateMediaSessionMetadata(metadata);
  preloadAdjacentTracks(index);
}

// Initialize UI controls and single timeupdate handler (also updates Media Session)
function initializePlayer() {
  const audio = document.getElementById("audio-element");
  const playBtn = document.getElementById("play-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const progressBar = document.getElementById("progress-bar");
  const progress = document.getElementById("progress");
  const currentTimeEl = document.getElementById("current-time");
  const durationEl = document.getElementById("duration");
  const volumeSlider = document.getElementById("volume-slider");

  if (!audio) return;

  const togglePlayPause = () => (audio.paused ? audio.play() : audio.pause());

  const updatePlayButton = (isPlaying) => {
    if (!playBtn) return;
    playBtn.innerHTML = isPlaying
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M16 19q-.825 0-1.412-.587T14 17V7q0-.825.588-1.412T16 5t1.413.588T18 7v10q0 .825-.587 1.413T16 19m-8 0q-.825 0-1.412-.587T6 17V7q0-.825.588-1.412T8 5t1.413.588T10 7v10q0 .825-.587 1.413T8 19"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M8 17.175V6.825q0-.425.3-.713t.7-.287q.125 0 .263.037t.262.113l8.15 5.175q.225.15.338.375t.112.475t-.112.475t-.338.375l-8.15 5.175q-.125.075-.262.113T9 18.175q-.4 0-.7-.288t-.3-.712"/></svg>`;
    updateMediaSessionPlaybackState(isPlaying ? "playing" : "paused");
  };

  if (playBtn) playBtn.addEventListener("click", togglePlayPause);
  audio.addEventListener("play", () => updatePlayButton(true));
  audio.addEventListener("pause", () => updatePlayButton(false));

  const playCurrentTrack = async () => {
    await loadTrack(currentTrackIndex);
    audio.play();
  };

  if (prevBtn)
    prevBtn.addEventListener("click", () => {
      currentTrackIndex =
        (currentTrackIndex - 1 + musicFiles.length) % musicFiles.length;
      playCurrentTrack();
    });
  if (nextBtn)
    nextBtn.addEventListener("click", () => {
      currentTrackIndex = (currentTrackIndex + 1) % musicFiles.length;
      playCurrentTrack();
    });

  // Single timeupdate handler updates UI and media session position state
  audio.addEventListener("timeupdate", () => {
    const filename = musicFiles[currentTrackIndex];
    const meta = trackMetadata.get(filename) || {};
    const duration =
      isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : meta.duration || 0;

    if (duration > 0) {
      const progressPercent = (audio.currentTime / duration) * 100;
      if (progress) progress.style.width = progressPercent + "%";
      if (currentTimeEl)
        currentTimeEl.textContent = formatTime(audio.currentTime);
      if (durationEl) durationEl.textContent = formatTime(duration);
    } else {
      if (currentTimeEl)
        currentTimeEl.textContent = formatTime(audio.currentTime || 0);
      if (durationEl) durationEl.textContent = "0:00";
    }

    if (
      "mediaSession" in navigator &&
      "setPositionState" in navigator.mediaSession
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration || 0,
          playbackRate: audio.playbackRate,
          position: audio.currentTime || 0,
        });
      } catch (e) {
        /* ignore */
      }
    }
  });

  if (progressBar) {
    progressBar.addEventListener("click", (e) => {
      const rect = progressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickRatio = clickX / rect.width;

      const filename = musicFiles[currentTrackIndex];
      const meta = trackMetadata.get(filename) || {};
      const duration =
        isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : meta.duration || 0;

      if (duration > 0) audio.currentTime = clickRatio * duration;
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      audio.volume = e.target.value / 100;
    });
  }
  audio.volume = 0.5;

  audio.addEventListener("ended", async () => {
    currentTrackIndex = (currentTrackIndex + 1) % musicFiles.length;
    await loadTrack(currentTrackIndex);
    audio.play();
  });

  audio.onseeking = () => console.log("Audio is seeking a new position.");

  // Periodic cache cleanup
  setInterval(() => {
    if (audioCache.size > 10) {
      const keys = Array.from(audioCache.keys());
      const oldestKey = keys[0];
      audioCache.delete(oldestKey);
      preloadedTracks.delete(oldestKey);
      console.log(`Cleaned up cached audio: ${oldestKey}`);
    }
  }, 30000);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

window.addEventListener("load", loadMusic);
