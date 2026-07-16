// Synthesizes an upbeat electronic promo track (~37s, 124bpm) as a WAV.
// Structure matches stage.html: sparse intro → full beat at the logo drop
// (~5s) → energy through the feature scenes → open outro under the CTA.
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const SR = 44100, DUR = 37.5, N = Math.floor(SR * DUR);
const BPM = 124, BEAT = 60 / BPM, BAR = BEAT * 4;
const out = new Float64Array(N);

const clamp = (x) => Math.max(-1, Math.min(1, x));
function addAt(t, gen, dur) {
  const start = Math.floor(t * SR), len = Math.floor(dur * SR);
  for (let i = 0; i < len && start + i < N; i++) out[start + i] += gen(i / SR);
}

// --- instruments ---
const kick = (t) => Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-t * 28)) * t) * Math.exp(-t * 7) * 0.9;
const hat = (t) => (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.16;
const openHat = (t) => (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.12;
const clap = (t) => (Math.random() * 2 - 1) * Math.exp(-t * 22) * (t < 0.002 || (t > 0.01 && t < 0.012) ? 1.6 : 1) * 0.3;
const bass = (f) => (t) => {
  const saw = 2 * ((f * t) % 1) - 1, sub = Math.sin(2 * Math.PI * f * 0.5 * t);
  return (saw * 0.35 + sub * 0.5) * Math.min(1, t * 80) * Math.exp(-t * 3.2) * 0.42;
};
const pluck = (f) => (t) => {
  const tri = Math.asin(Math.sin(2 * Math.PI * f * t)) * (2 / Math.PI);
  return tri * Math.exp(-t * 9) * 0.2;
};
const pad = (f) => (t) => {
  const a = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.5 * t) * 0.5 + Math.sin(2 * Math.PI * f * 2 * t) * 0.3;
  const env = Math.min(1, t * 1.2) * Math.min(1, Math.max(0, (BAR * 2 - t) * 1.2));
  return a * env * 0.05;
};

// --- notes (A minor): progression Am F C G, roots ---
const A1 = 55, F1 = 43.65, C2 = 65.41, G1 = 49.0;
const PROG = [A1, F1, C2, G1];
const ARPS = [
  [220, 261.63, 329.63, 440],   // Am
  [174.61, 220, 261.63, 349.23],// F
  [261.63, 329.63, 392, 523.25],// C
  [196, 246.94, 293.66, 392],   // G
];

const INTRO_END = 4.8;      // hook words: sparse
const OUTRO_START = 30.0;   // CTA: pull back drums, keep pad+pluck
const totalBars = Math.ceil(DUR / BAR);

for (let bar = 0; bar < totalBars; bar++) {
  const t0 = bar * BAR;
  const root = PROG[bar % 4], arp = ARPS[bar % 4];
  const inIntro = t0 < INTRO_END - 0.01, inOutro = t0 >= OUTRO_START;

  // pad every 2 bars
  if (bar % 2 === 0) { addAt(t0, pad(root * 4), BAR * 2); addAt(t0, pad(root * 6), BAR * 2); }

  // 16th-note arp pluck (always — carries intro & outro)
  for (let s = 0; s < 16; s++) {
    if (s % 2 === 0 || !inIntro) addAt(t0 + s * (BEAT / 4), pluck(arp[[0, 2, 1, 3, 0, 2, 3, 1][s % 8] % arp.length]), 0.3);
  }

  if (!inIntro && !inOutro) {
    for (let b = 0; b < 4; b++) {
      const bt = t0 + b * BEAT;
      addAt(bt, kick, 0.25);                                  // 4-on-floor
      addAt(bt + BEAT / 2, b === 3 ? openHat : hat, 0.12);    // offbeat hats
      if (b === 1 || b === 3) addAt(bt, clap, 0.2);           // clap 2 & 4
      addAt(bt, bass(root), BEAT * 0.9);                      // bassline
      addAt(bt + BEAT * 0.5, bass(root), BEAT * 0.4);
      addAt(bt + BEAT * 0.75, bass(root * (b === 3 ? 1.5 : 1)), BEAT * 0.22);
    }
  } else if (inOutro) {
    addAt(t0, kick, 0.25); // downbeat only
    addAt(t0, bass(root), BAR * 0.8);
  } else {
    addAt(t0, kick, 0.25); // intro: sparse kick each bar
    if (bar >= 1) addAt(t0 + 2 * BEAT, hat, 0.1);
  }
}

// riser into the logo drop (white-noise sweep 3.2s→4.8s)
for (let i = Math.floor(3.2 * SR); i < Math.floor(4.8 * SR) && i < N; i++) {
  const p = (i / SR - 3.2) / 1.6;
  out[i] += (Math.random() * 2 - 1) * p * p * 0.12;
}
// impact at the drop
addAt(4.8, (t) => Math.sin(2 * Math.PI * 45 * t) * Math.exp(-t * 4) * 0.7, 1.2);

// master: soft clip + fades
const fadeIn = 0.3 * SR, fadeOut = 2.5 * SR;
for (let i = 0; i < N; i++) {
  let v = Math.tanh(out[i] * 1.1) * 0.85;
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
console.log("music.wav written:", (bytes.length / 1024 / 1024).toFixed(1), "MB");
