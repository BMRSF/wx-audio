import { wrapToReadableStream } from "webuix";

const fileInterface =
  window[Object.keys(window).find((key) => key.match(/^\$(\w{2})File$/m))];
const fileInputInterface =
  window[
    Object.keys(window).find((key) => key.match(/^\$(\w{2})FileInputStream$/m))
  ];

const fileListEl = document.getElementById("fileList");
const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const loader = document.getElementById("loader");
/**
 * @type {HTMLInputElement}
 */
const pathLoader = document.getElementById("pathLoader");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");

let currentFilename = null;
let audioContext = null;
let sourceNode = null;
let animationFrame = null;
let audioBuffer = null;
let startTime = 0;
let isPlaying = false;
let currentPath = "/sdcard/Music/Telegram";

refreshFileList();

pathLoader.value = currentPath;
pathLoader.addEventListener("change", (e) => {
  const path = e.target.value;
  if (!path) return;
  if (fileInterface.isDirectory(path)) {
    pathLoader.value = path;
    currentPath = path;
  }

  currentPath = path;
  refreshFileList();
});

playBtn.onclick = async () => {
  if (isPlaying) return;

  playBtn.disabled = true;
  stopBtn.disabled = false;
  loader.classList.add("active");

  try {
    const path = `/sdcard/Music/Telegram/${currentFilename}`;
    const inputStream = fileInputInterface.open(path);
    const stream = await wrapToReadableStream(inputStream, {
      chunkSize: 64 * 1024,
    });
    const reader = stream.getReader();

    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const merged = new Uint8Array(chunks.reduce((a, b) => a + b.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioBuffer = await audioContext.decodeAudioData(merged.buffer);

    startPlayback();
  } catch (e) {
    console.error(e);
  } finally {
    loader.classList.remove("active");
  }
};

stopBtn.onclick = () => {
  stopPlayback();
  playBtn.disabled = false;
};

function startPlayback(offset = 0) {
  if (!audioBuffer) return;
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(audioContext.destination);
  sourceNode.start(0, offset);
  startTime = audioContext.currentTime - offset;
  isPlaying = true;
  animationFrame = requestAnimationFrame(updateProgress);
  sourceNode.onended = stopPlayback;
}

function stopPlayback() {
  if (sourceNode) {
    sourceNode.stop();
    sourceNode.disconnect();
  }
  if (audioContext) audioContext.close();
  if (animationFrame) cancelAnimationFrame(animationFrame);
  sourceNode = null;
  audioContext = null;
  audioBuffer = null;
  isPlaying = false;
  stopBtn.disabled = true;
  progressBar.style.width = "0%";
}

function updateProgress() {
  if (!audioContext || !audioBuffer) return;
  const elapsed = audioContext.currentTime - startTime;
  const percent = (elapsed / audioBuffer.duration) * 100;
  progressBar.style.width = `${Math.min(100, percent)}%`;
  if (isPlaying) animationFrame = requestAnimationFrame(updateProgress);
}

progressContainer.onclick = (e) => {
  if (!audioBuffer || !audioContext) return;
  const rect = progressContainer.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const ratio = clickX / rect.width;
  const seekTime = ratio * audioBuffer.duration;
  stopPlayback();
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  startPlayback(seekTime);
};

function refreshFileList() {
  fileListEl.innerHTML = "";
  const files = fileInterface.list(currentPath).split(",");

  const filter = files.filter((file) => {
    const ext = file.split(".").pop().toLowerCase();
    return ["mp3", "wav", "ogg"].includes(ext);
  });

  filter.forEach((file) => {
    const el = document.createElement("div");
    el.className = "file-item";
    el.textContent = file;
    el.onclick = () => {
      document
        .querySelectorAll(".file-item")
        .forEach((i) => i.classList.remove("active"));
      el.classList.add("active");
      currentFilename = file;
      playBtn.disabled = false;
      stopPlayback();
    };
    fileListEl.appendChild(el);
  });
}
