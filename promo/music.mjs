// Synthesizes a dark, minimal, bass-driven electro-pop track (~53s, 135bpm)
// in a "bad guy"-adjacent style: bouncy syncopated sub-bass riff, finger
// snaps, tight dry kick, hushed textures. Original composition — no melody
// borrowed. Structure matches stage.html: sparse intro → drop at the logo
// (7.4s) → full groove through features → stripped outro from ~44.7s.
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const SR = 44100, DUR = 53.0, N = Math.floor(SR * DUR);
const BPM = 135, BEAT = 60 / BPM, BAR = BEAT * 4, SIX = BEAT / 4;
const out = new Float64Array(N);

const clamp = (x) => Math.max(-1, Math.min(1, x));
function addAt(t, gen, dur) {
  const start = Math.floor(t * SR), len = Math.floor(dur * SR);
  for (let i = 0; i < len && start + i < N; i++) out[start + i] += gen(i / SR);
}

// --- instruments ---
// tight dry kick, short decay (that dry thump)
const kick = (t) => Math.sin(2 * Math.PI * (48 + 85 * Math.exp(-t * 38)) * t) * Math.exp(-t * 11) * 0.95;
// finger snap: filtered noise ping around 1.9kHz, very short
const snap = (t) => {
  const n = (Math.random() * 2 - 1);
  const ping = Math.sin(2 * Math.PI * 1900 * t) * 0.5 + Math.sin(2 * Math.PI * 1100 * t) * 0.3;
  return (n * 0.45 + ping * 0.55) * Math.exp(-t * 90) * 0.5;
};
// hushed closed hat
const hat = (t) => (Math.random() * 2 - 1) * Math.exp(-t * 110) * 0.06;
// bouncy sub-bass: sine sub + a touch of saw bite, slight pitch glide down into each note
const bass = (f, glideFrom = null) => (t) => {
  const g = glideFrom ? glideFrom + (f - glideFrom) * Math.min(1, t * 30) : f;
  const sub = Math.sin(2 * Math.PI * g * t);
  const bite = (2 * ((g * 2 * t) % 1) - 1) * 0.12;
  return (sub * 0.85 + bite) * Math.min(1, t * 120) * Math.exp(-t * 7) * 0.62;
};
// dark staccato pluck for sparse accents
const pluck = (f) => (t) => {
  const tri = Math.asin(Math.sin(2 * Math.PI * f * t)) * (2 / Math.PI);
  return tri * Math.exp(-t * 16) * 0.10;
};
// airy pad whisper (very quiet, fills space without brightness)
const pad = (f) => (t) => {
  const a = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.6;
  const env = Math.min(1, t * 0.8) * Math.min(1, Math.max(0, (BAR * 2 - t) * 0.8));
  return a * env * 0.022;
};

// --- riff (G minor, original): syncopated 16th-note bass pattern per bar ---
// steps: [sixteenth index, semitone offset from root, isGlide]
const G1 = 49.0; // G1
const st = (semi) => G1 * Math.pow(2, semi / 12);
// two alternating bar patterns — bouncy, chromatic approach like the style
const RIFF_A = [[0, 0], [2, 0], [4, 3], [6, 0], [8, 5, true], [10, 3], [12, 0], [14, -2]];
const RIFF_B = [[0, 0], [2, 0], [4, 3], [6, 5], [8, 7, true], [10, 5], [12, 3], [14, 2]];
// bar-level root movement: Gm Gm Eb F (i i VI VII) — dark but fun
const ROOTS = [0, 0, 8, 10];

const DROP = 7.4;
const OUTRO_START = 44.7;
const totalBars = Math.ceil(DUR / BAR);

for (let bar = 0; bar < totalBars; bar++) {
  const t0 = bar * BAR;
  const rootSemi = ROOTS[bar % 4];
  const riff = bar % 2 === 0 ? RIFF_A : RIFF_B;
  const inIntro = t0 < DROP - 0.05, inOutro = t0 >= OUTRO_START;

  // whisper pad every 2 bars (barely there)
  if (bar % 2 === 0) addAt(t0, pad(st(rootSemi) * 4), BAR * 2);

  // snaps on 2 & 4 — the signature — present in every section
  addAt(t0 + BEAT, snap, 0.12);
  addAt(t0 + 3 * BEAT, snap, 0.12);

  // bass riff: intro plays it sparse (every other note), groove plays it full
  for (const [s, semi, glide] of riff) {
    if (inIntro && s % 4 !== 0) continue;
    const f = st(rootSemi + semi);
    addAt(t0 + s * SIX, bass(f, glide ? f * 1.35 : null), SIX * 1.8);
  }

  if (!inIntro && !inOutro) {
    // dry kick: 1, the "and" of 2, and 3 — bouncy, not four-on-floor
    addAt(t0, kick, 0.18);
    addAt(t0 + 1.5 * BEAT, kick, 0.18);
    addAt(t0 + 2 * BEAT, kick, 0.18);
    // hushed 8th hats
    for (let e = 0; e < 8; e++) addAt(t0 + e * (BEAT / 2) + BEAT / 4, hat, 0.05);
    // sparse dark pluck answering the riff on the last beat of odd bars
    if (bar % 2 === 1) {
      addAt(t0 + 3 * BEAT, pluck(st(rootSemi + 12)), 0.3);
      addAt(t0 + 3.5 * BEAT, pluck(st(rootSemi + 15)), 0.3);
    }
    // bass slide fill into each 4-bar loop
    if (bar % 4 === 3) {
      const f = st(ROOTS[(bar + 1) % 4]);
      addAt(t0 + 3.5 * BEAT, bass(f, f * 0.66), BEAT * 0.9);
    }
  } else if (inOutro) {
    addAt(t0, kick, 0.18);
  } else {
    // intro: kick on 1 only from bar 1
    if (bar >= 1) addAt(t0, kick, 0.18);
  }
}

// pre-drop: one bar of near-silence with a rising sub sweep, then slam
const hushStart = DROP - BAR * 0.5;
for (let i = Math.floor(hushStart * SR); i < Math.floor(DROP * SR) && i < N; i++) {
  out[i] *= 0.25; // duck everything for the "hold your breath" moment
}
for (let i = Math.floor((DROP - 1.2) * SR); i < Math.floor(DROP * SR) && i < N; i++) {
  const p = (i / SR - (DROP - 1.2)) / 1.2;
  out[i] += Math.sin(2 * Math.PI * (30 + 50 * p * p) * (i / SR)) * p * 0.3;
}
// drop impact: deep 808 boom + snap flam
addAt(DROP, (t) => Math.sin(2 * Math.PI * (40 + 20 * Math.exp(-t * 6)) * t) * Math.exp(-t * 3) * 0.85, 1.6);
addAt(DROP, snap, 0.12);
addAt(DROP + 0.03, snap, 0.12);

// master: subtle beat pump, soft clip, fades
const fadeIn = 0.25 * SR, fadeOut = 2.8 * SR;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const inBeat = (t % BEAT) / BEAT;
  const pump = t > DROP && t < OUTRO_START ? 0.88 + 0.12 * Math.min(1, inBeat * 4) : 1;
  let v = Math.tanh(out[i] * pump * 1.25) * 0.88;
  if (i < fadeIn) v *= i / fadeIn;
  if (i > N - fadeOut) v *= (N - i) / fadeOut;
  out[i] = v;
}

// write 16-bit stereo WAV
const bytes = Buffer.alloc(44 + N * 4);
bytes.write("RIFF", 0); bytes.writeUInt32LE(36 + N * 4, 4); bytes.write("WAVEfmt ", 8);
bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
bytes.writeUInt32LE(SR, 24); bytes.writeUInt32LE(SR * 4, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34);
bytes.write("data", 36); bytes.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const v = Math.round(clamp(out[i]) * 32767);
  bytes.writeInt16LE(v, 44 + i * 4); bytes.writeInt16LE(v, 46 + i * 4);
}
const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, "music.wav"), bytes);
console.log("music.wav written:", (bytes.length / 1024 / 1024).toFixed(1), "MB,", DUR + "s, badguy-style");
