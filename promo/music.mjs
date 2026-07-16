// Synthesizes an intense, fun electronic promo track (~53s, 128bpm) as a WAV.
// Structure matches stage.html: sparse-but-building intro → riser → big drop
// at the logo (7.4s) → driving beat with lead hook through the features →
// open outro under the CTA (from ~44.7s).
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const SR = 44100, DUR = 53.0, N = Math.floor(SR * DUR);
const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4;
const out = new Float64Array(N);

const clamp = (x) => Math.max(-1, Math.min(1, x));
function addAt(t, gen, dur) {
  const start = Math.floor(t * SR), len = Math.floor(dur * SR);
  for (let i = 0; i < len && start + i < N; i++) out[start + i] += gen(i / SR);
}

// --- instruments ---
const kick = (t) => Math.sin(2 * Math.PI * (52 + 100 * Math.exp(-t * 30)) * t) * Math.exp(-t * 6.5) * 1.0;
const hat = (t) => (Math.random() * 2 - 1) * Math.exp(-t * 70) * 0.14;
const openHat = (t) => (Math.random() * 2 - 1) * Math.exp(-t * 15) * 0.13;
const snare = (t) => ((Math.random() * 2 - 1) * 0.7 + Math.sin(2 * Math.PI * 190 * t) * 0.4) * Math.exp(-t * 24) * 0.42;
const bass = (f) => (t) => {
  const saw = 2 * ((f * t) % 1) - 1, saw2 = 2 * ((f * 1.005 * t) % 1) - 1, sub = Math.sin(2 * Math.PI * f * 0.5 * t);
  return ((saw + saw2) * 0.22 + sub * 0.5) * Math.min(1, t * 90) * Math.exp(-t * 4) * 0.44;
};
const pluck = (f) => (t) => {
  const tri = Math.asin(Math.sin(2 * Math.PI * f * t)) * (2 / Math.PI);
  return tri * Math.exp(-t * 10) * 0.17;
};
const lead = (f) => (t) => {
  const sq = Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.5 + Math.sign(Math.sin(2 * Math.PI * f * 1.01 * t)) * 0.5;
  const vib = Math.sin(2 * Math.PI * (f + Math.sin(2 * Math.PI * 6 * t) * 3) * t);
  return (sq * 0.4 + vib * 0.6) * Math.min(1, t * 60) * Math.exp(-t * 5) * 0.16;
};
const pad = (f) => (t) => {
  const a = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.5 * t) * 0.5 + Math.sin(2 * Math.PI * f * 2.02 * t) * 0.3;
  const env = Math.min(1, t * 1.4) * Math.min(1, Math.max(0, (BAR * 2 - t) * 1.4));
  return a * env * 0.05;
};

// --- notes (A minor): Am F C G ---
const PROG = [55, 43.65, 65.41, 49.0];
const ARPS = [
  [220, 261.63, 329.63, 440],
  [174.61, 220, 261.63, 349.23],
  [261.63, 329.63, 392, 523.25],
  [196, 246.94, 293.66, 392],
];
// 8-bar lead hook (two bars per chord), scale degrees over A minor
const HOOK = [
  [440, 0, 523.25, 440, 0, 392, 440, 0],      // over Am
  [349.23, 0, 440, 349.23, 0, 523.25, 440, 0],// over F
  [523.25, 0, 659.25, 523.25, 0, 440, 523.25, 0], // over C
  [587.33, 523.25, 0, 493.88, 440, 0, 392, 440],  // over G — run down
];

const DROP = 7.4;           // logo reveal
const OUTRO_START = 44.7;   // CTA
const totalBars = Math.ceil(DUR / BAR);

for (let bar = 0; bar < totalBars; bar++) {
  const t0 = bar * BAR;
  const chord = bar % 4;
  const root = PROG[chord], arp = ARPS[chord];
  const inIntro = t0 < DROP - 0.05, inOutro = t0 >= OUTRO_START;

  if (bar % 2 === 0) { addAt(t0, pad(root * 4), BAR * 2); addAt(t0, pad(root * 6), BAR * 2); }

  // 16th arp — always running (fun energy layer)
  for (let s = 0; s < 16; s++) {
    addAt(t0 + s * (BEAT / 4), pluck(arp[[0, 2, 1, 3, 2, 0, 3, 1][s % 8] % arp.length]), 0.22);
  }

  if (!inIntro && !inOutro) {
    for (let b = 0; b < 4; b++) {
      const bt = t0 + b * BEAT;
      addAt(bt, kick, 0.24);
      addAt(bt + BEAT / 2, b === 3 ? openHat : hat, 0.12);
      addAt(bt + BEAT / 4, hat, 0.08); addAt(bt + BEAT * 0.75, hat, 0.08); // 16th hats
      if (b === 1 || b === 3) addAt(bt, snare, 0.22);
      // driving 8th-note bass
      addAt(bt, bass(root), BEAT * 0.48);
      addAt(bt + BEAT / 2, bass(root * (b === 3 && chord === 3 ? 1.5 : 1)), BEAT * 0.48);
    }
    // lead hook, 8th notes
    const hook = HOOK[chord];
    for (let s = 0; s < 8; s++) {
      const f = hook[s];
      if (f) addAt(t0 + s * (BEAT / 2), lead(f), BEAT * 0.55);
    }
    // snare roll into every 4th bar (scene-change fills)
    if (bar % 4 === 3) {
      for (let r = 0; r < 8; r++) addAt(t0 + 3 * BEAT + r * (BEAT / 8), snare, 0.08);
    }
  } else if (inOutro) {
    addAt(t0, kick, 0.24);
    addAt(t0 + 2 * BEAT, kick, 0.24);
    addAt(t0, bass(root), BAR * 0.8);
    const hook = HOOK[chord];
    for (let s = 0; s < 8; s += 2) if (hook[s]) addAt(t0 + s * (BEAT / 2), lead(hook[s]), BEAT);
  } else {
    // intro: kick builds density bar by bar
    addAt(t0, kick, 0.24);
    if (bar >= 1) { addAt(t0 + 2 * BEAT, kick, 0.24); addAt(t0 + BEAT, snare, 0.2); addAt(t0 + 3 * BEAT, snare, 0.2); }
    if (bar >= 2) for (let b = 0; b < 4; b++) addAt(t0 + b * BEAT + BEAT / 2, hat, 0.1);
  }
}

// riser into the drop (noise sweep + rising tone, last 2s of intro)
const riseStart = DROP - 2.0;
for (let i = Math.floor(riseStart * SR); i < Math.floor(DROP * SR) && i < N; i++) {
  const p = (i / SR - riseStart) / 2.0;
  out[i] += (Math.random() * 2 - 1) * p * p * 0.14 + Math.sin(2 * Math.PI * (200 + 500 * p * p) * (i / SR)) * p * 0.06;
}
// snare roll into the drop
for (let r = 0; r < 16; r++) addAt(DROP - 1 + r * (1 / 16), snare, 0.06);
// impact at the drop
addAt(DROP, (t) => Math.sin(2 * Math.PI * 44 * t) * Math.exp(-t * 3.5) * 0.8, 1.4);
addAt(DROP, (t) => (Math.random() * 2 - 1) * Math.exp(-t * 9) * 0.3, 0.5);

// master: beat-synced pump (sidechain feel), soft clip, fades
const fadeIn = 0.3 * SR, fadeOut = 2.8 * SR;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const inBeat = (t % BEAT) / BEAT;
  const pump = t > DROP && t < OUTRO_START ? 0.82 + 0.18 * Math.min(1, inBeat * 3.2) : 1;
  let v = Math.tanh(out[i] * pump * 1.15) * 0.85;
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
console.log("music.wav written:", (bytes.length / 1024 / 1024).toFixed(1), "MB,", DUR + "s");
