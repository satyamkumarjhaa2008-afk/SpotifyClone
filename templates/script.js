console.log("🎵 Player Initialized");

//----------------------------------------------------
// ICONS
//----------------------------------------------------
const ICONS = {
  play: "/icons/play-button-svgrepo-com.svg",
  pause: "/icons/pause-button-svgrepo-com.svg",
  rightPause: "/icons/pause.svg",
};

//----------------------------------------------------
// GLOBAL STATE
//----------------------------------------------------
let songList = [];
let titles = [];
let currentAudio = null;
let currentAudioIndex = null;
let activeSpotifyIndex = null;
let isPlaying = false;
let isDragging = false;
let wasPlayingBeforeDrag = false;
let lastSelectedIndex = null;

//----------------------------------------------------
// HELPERS
//----------------------------------------------------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

//----------------------------------------------------
// 🔹 LOADING OVERLAY (FULL PAGE)
//----------------------------------------------------
function showLoader(message = "Fetching Songs...") {
  const loader = document.querySelector(".loadingOverlay");
  const text = document.querySelector(".loadingText");
  if (loader) loader.style.display = "flex";
  if (text) text.textContent = message;
}

function hideLoader() {
  const loader = document.querySelector(".loadingOverlay");
  if (loader) loader.style.display = "none";
}

//----------------------------------------------------
// 🔹 PLAYBAR ANIMATION CONTROL
//----------------------------------------------------
function startPlaybarLoading() {
  stopPlaybarLoading();
  const playbar = document.querySelector(".playbar");
  if (!playbar) return;
  const bar = document.createElement("div");
  bar.className = "playbarLoading";
  playbar.appendChild(bar);
}

function stopPlaybarLoading() {
  const old = document.querySelector(".playbarLoading");
  if (old) old.remove();
}

//----------------------------------------------------
// UI STATE MANAGEMENT
//----------------------------------------------------
function setListCardState(index, state) {
  const card = document.querySelectorAll(".songcards")[index];
  if (!card) return;
  const playnow = card.querySelector(".playnow");
  const btnImg = card.querySelector(".playbutton img");

  if (state === "playing") {
    if (playnow) playnow.textContent = "Stop Now";
    if (btnImg) btnImg.src = ICONS.pause;
    card.style.filter = "invert(100%)";
  } else if (state === "paused") {
    if (playnow) playnow.textContent = "Resume";
    if (btnImg) btnImg.src = ICONS.play;
    card.style.filter = "invert(100%)";
  } else {
    if (playnow) playnow.textContent = "Play Now";
    if (btnImg) btnImg.src = ICONS.play;
    card.style.removeProperty("filter");
  }
}

function resetAllListCards() {
  document.querySelectorAll(".songcards").forEach((card) => {
    const playnow = card.querySelector(".playnow");
    const btnImg = card.querySelector(".playbutton img");
    if (playnow) playnow.textContent = "Play Now";
    if (btnImg) btnImg.src = ICONS.play;
    card.style.removeProperty("filter");
  });
}

function setMainPlayIcon(playing) {
  const btn = document.querySelector("#playbaby");
  if (!btn) return;
  if (btn.tagName?.toLowerCase() === "img") {
    btn.src = playing ? ICONS.pause : ICONS.play;
  } else {
    const img = btn.querySelector("img");
    if (img) img.src = playing ? ICONS.pause : ICONS.play;
  }
}

function setNowPlayingUI(index) {
  const info = document.querySelector(".info");
  const playbar = document.querySelector(".playbar");
  if (info) info.textContent = titles[index] || "";
  if (playbar) playbar.classList.add("playbartransit");
}

function clearNowPlayingUI() {
  const playbar = document.querySelector(".playbar");
  if (playbar) playbar.classList.remove("playbartransit");
}

//----------------------------------------------------
// AUDIO CONTROL
//----------------------------------------------------
function detachAudioListeners(audio) {
  if (!audio) return;
  audio.removeEventListener("timeupdate", onTimeUpdate);
  audio.removeEventListener("ended", onEnded);
  audio.removeEventListener("canplaythrough", onCanPlay);
}

function createAndPlayAudioFromUrl(url) {
  const audio = new Audio(url);
  audio.preload = "metadata";
  audio.addEventListener("timeupdate", onTimeUpdate);
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("canplaythrough", onCanPlay);
  return audio;
}

function stopPlayback(resetUI = true) {
  if (currentAudio) {
    try {
      detachAudioListeners(currentAudio);
      currentAudio.pause();
    } catch {}
  }
  isPlaying = false;
  setMainPlayIcon(false);

  if (resetUI) {
    if (currentAudioIndex !== null) setListCardState(currentAudioIndex, "stopped");
    clearNowPlayingUI();
  }

  stopPlaybarLoading();

  currentAudio = null;
  currentAudioIndex = null;
  const timeEl = document.querySelector(".time");
  const ball = document.querySelector(".goli");
  if (timeEl) timeEl.textContent = "0:00 / 0:00";
  if (ball) ball.style.left = "-1%";
}

//----------------------------------------------------
// TIME UPDATE + SEEKBAR
//----------------------------------------------------
function onTimeUpdate() {
  if (!currentAudio || isDragging) return;
  const t = currentAudio.currentTime || 0;
  const d = currentAudio.duration || 0;
  const timeEl = document.querySelector(".time");
  if (timeEl) timeEl.textContent = `${fmt(t)} / ${fmt(d)}`;
  const ball = document.querySelector(".goli");
  if (ball && d > 0) {
    let percent = (t / d) * 100;
    let uiPercent = (percent * 101 / 100) - 1;
    uiPercent = clamp(uiPercent, -1, 100);
    ball.style.left = `${uiPercent}%`;
  }
}

function onCanPlay() {
  // 🔹 Stop playbar animation when audio can play
  stopPlaybarLoading();
}

function onEnded() {
  stopPlaybarLoading();
  playNext();
}

function seekToPercent(percent) {
  const ui = clamp(Number(percent) || 0, -1, 100);
  if (!currentAudio || !Number.isFinite(currentAudio.duration)) return;
  const d = currentAudio.duration;
  const norm = (ui + 1) / 101;
  currentAudio.currentTime = norm * d;
}

function setupSeekbar() {
  const seekbar = document.querySelector(".seekbar");
  const ball = document.querySelector(".goli");
  if (!seekbar || !ball) return;

  const getRect = () => seekbar.getBoundingClientRect();

  seekbar.addEventListener("click", (e) => {
    const rect = getRect();
    const clickX = e.clientX - rect.left;
    let percent = (clickX / rect.width) * 101 - 1;
    percent = clamp(percent, -1, 100);
    ball.style.left = `${percent}%`;
    seekToPercent(percent);
  });

  seekbar.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (!currentAudio) return;
    const delta = e.deltaY < 0 ? 5 : -5;
    let percent = ((currentAudio.currentTime / currentAudio.duration) * 101 - 1) + delta;
    percent = clamp(percent, -1, 100);
    seekToPercent(percent);
  });

  ball.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (!currentAudio) return;
    isDragging = true;
    wasPlayingBeforeDrag = !currentAudio.paused;
    if (wasPlayingBeforeDrag) currentAudio.pause();

    const rect = getRect();
    const onMove = (ev) => {
      const moveX = ev.clientX - rect.left;
      let percent = (moveX / rect.width) * 101 - 1;
      percent = clamp(percent, -1, 100);
      ball.style.left = `${percent}%`;
    };
    const onUp = (ev) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const endX = ev.clientX - rect.left;
      let percent = (endX / rect.width) * 101 - 1;
      percent = clamp(percent, -1, 100);
      seekToPercent(percent);
      if (wasPlayingBeforeDrag) currentAudio.play();
      isDragging = false;
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

//----------------------------------------------------
// PLAY CONTROLS
//----------------------------------------------------
async function loadSongFromServer(title, artist, index) {
  try {
    showLoader("Loading Song...");
    startPlaybarLoading(); // 🔹 start playbar animation

    const res = await fetch(`/getSongUrl?title=${encodeURIComponent(title)}`);
    const data = await res.json();
    const audioUrl = data.url;

    if (currentAudioIndex !== null && currentAudioIndex !== index) {
      setListCardState(currentAudioIndex, "stopped");
    }

    stopPlayback(false);
    currentAudio = createAndPlayAudioFromUrl(audioUrl);
let songcards = Array.from(document.body.getElementsByClassName("songcards"));
console.log(songcards);
//Matching UI of Left and Right
songcards.forEach((element, ind) => {
  let detailsEl = element.querySelector(".musicdetails");
  if (detailsEl && detailsEl.textContent.trim() === `${title} - ${artist}`) {
    console.log(ind)
    index = ind;
  }
});

    currentAudioIndex = index;
    await currentAudio.play();

    isPlaying = true;
    setMainPlayIcon(true);
    setListCardState(currentAudioIndex, "playing");
    setNowPlayingUI(currentAudioIndex);
  } catch (err) {
    console.error("Failed to load song:", err);
  } finally {
    hideLoader();
  }
}

//----------------------------------------------------
// BUILD LEFT LIST
//----------------------------------------------------
function buildLeftList() {
  const container = document.querySelector(".songlist");
  if (!container) return;
  container.innerHTML = "";

  songList.forEach((song, index) => {
    const title = `${song.title} - ${song.artist}`;
    const card = document.createElement("div");
    card.className = "songcards";
    card.innerHTML = `
      <div class="musiclogo">
        <img width="70%" height="70%" src="/icons/musical-note-music-svgrepo-com.svg" alt="">
      </div>
      <div class="musicdetails">${title}</div>
      <div class="playnow">Play Now</div>
      <div class="playbutton">
        <img width="60%" height="60%" src="${ICONS.play}" alt="">
      </div>`;
    container.append(card);
  });

  document.querySelectorAll(".songcards .playbutton").forEach((btn, index) => {
    btn.addEventListener("click", async () => {
      const { title, artist } = songList[index];
      if (isPlaying && currentAudioIndex === index) {
        stopPlayback(true);
        return;
      }
      await loadSongFromServer(title, artist, index);
    });
  });
}

//---------------------------------------------------
//Right cont Logic   
//---------------------------------------------------
function RightPlay() {
let playbuttons = Array.from(document.body.getElementsByClassName("spotifyplay"));
console.log(playbuttons)

 playbuttons.forEach((btn, index) => {
    btn.addEventListener("click", async () => {
let songName = document.body.getElementsByClassName("musicname")[index].innerHTML
let artistName = document.body.getElementsByClassName("artistname")[index].innerHTML
console.log(songName,artistName)

loadSongFromServer(songName,artistName)

//       // const { title, artist } = songList[index];
//       // if (isPlaying && currentAudioIndex === index) {
//       //   stopPlayback(true);
//       //   return;
//       // }
//       // await loadSongFromServer(title, artist, index);
    });
  });
}



//----------------------------------------------------
// NEXT / PREV / MAIN BUTTON
//----------------------------------------------------
function playNext() {
  if (!songList.length) return;
  const next = (currentAudioIndex + 1) % songList.length;
  const { title, artist } = songList[next];
  loadSongFromServer(title, artist, next);
}

function playPrev() {
  if (!songList.length) return;
  const prev = (currentAudioIndex - 1 + songList.length) % songList.length;
  const { title, artist } = songList[prev];
  loadSongFromServer(title, artist, prev);
}

function togglePlayPause() {
  if (!currentAudio) return;
  if (currentAudio.paused) {
    currentAudio.play();
    isPlaying = true;
    setMainPlayIcon(true);
    setListCardState(currentAudioIndex, "playing");
  } else {
    currentAudio.pause();
    isPlaying = false;
    setMainPlayIcon(false);
    setListCardState(currentAudioIndex, "paused");
  }
}

function wireControls() {
  document.getElementById("next")?.addEventListener("click", playNext);
  document.getElementById("previous")?.addEventListener("click", playPrev);
  document.getElementById("playbaby")?.addEventListener("click", togglePlayPause);
}

//----------------------------------------------------
// MAIN INIT
//----------------------------------------------------
async function main() {
  document.querySelector(".topleft img")?.addEventListener("click", () => {
    document.querySelector(".leftcont")?.classList.toggle("sidebartransit");
  });

  document.getElementById("satyam")?.addEventListener("click", () => {
    document.querySelector(".search")?.classList.toggle("transit");
  });

  showLoader("Fetching Songs..."); // 🔹 loader at start
  try {
    const res = await fetch("/api/songs");
    songList = await res.json();
    titles = songList.map(s => `${s.title} - ${s.artist}`);
    buildLeftList();
  } catch (err) {
    console.error("Error fetching songs:", err);
  } finally {
    hideLoader(); // 🔹 hide loader after songs loaded
  }

  setupSeekbar();
  wireControls();

  const ball = document.querySelector(".goli");
  if (ball) ball.style.left = "-1%";
}

main().catch(err => console.error("Player init failed:", err));
RightPlay()
