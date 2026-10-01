// Sound and Speech Synthesis Service

let audioCtx: AudioContext | null = null;
let sirenOscillator: OscillatorNode | null = null;
let sirenGainNode: GainNode | null = null;
let sirenInterval: any = null;
let isSirenActive = false;
let isSirenMuted = false;

// Voice Synthesis Cache
let cachedFemaleVoice: SpeechSynthesisVoice | null = null;

function findBestFemaleSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Filter Spanish voices
  const esVoices = voices.filter(
    (v) => v.lang.startsWith('es') || v.lang === 'es-PE' || v.lang === 'es-CO' || v.lang === 'es-ES' || v.lang === 'es-US' || v.lang === 'es-MX'
  );

  // 1. High-priority sensual, clear female voice names
  const topFemale = esVoices.find((v) =>
    /salome|sabina|paulina|monica|helena|elena|dalia|laura|sofia|mia|lupe|penelope|lucia|victoria|paloma|esmeralda|female|mujer/i.test(v.name)
  );
  if (topFemale) return topFemale;

  // 2. Any Spanish voice with Google or Natural female profile
  const googleOrNatural = esVoices.find((v) => /google|natural|online/i.test(v.name));
  if (googleOrNatural) return googleOrNatural;

  // 3. Fallback to any Spanish voice
  return esVoices[0] || voices[0] || null;
}

// Preload voices listener
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedFemaleVoice = findBestFemaleSpanishVoice();
  };
  // Initial check
  cachedFemaleVoice = findBestFemaleSpanishVoice();
}

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function unlockAudioAndSpeech(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      getAudioContext();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        cachedFemaleVoice = findBestFemaleSpanishVoice();
      }
      resolve(true);
    } catch (e) {
      resolve(false);
    }
  });
}

export function playKeypadBeep(frequency = 600, duration = 0.05) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // ignore
  }
}

export function startEmergencySiren() {
  if (isSirenActive || isSirenMuted) return;
  isSirenActive = true;

  try {
    const ctx = getAudioContext();
    sirenInterval = setInterval(() => {
      if (isSirenMuted || !isSirenActive) {
        stopEmergencySiren();
        return;
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.linearRampToValueAtTime(1150, now + 0.38);
      osc.frequency.linearRampToValueAtTime(650, now + 0.78);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.1);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.7);
      gain.gain.linearRampToValueAtTime(0, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
    }, 850);
  } catch (e) {
    console.error('Error starting siren:', e);
  }
}

export function stopEmergencySiren() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  isSirenActive = false;
}

export function muteSirenPermanently(muted: boolean) {
  isSirenMuted = muted;
  if (muted) {
    stopEmergencySiren();
  }
}

export function isMuted(): boolean {
  return isSirenMuted;
}

export function playVictoryFanfare() {
  try {
    const ctx = getAudioContext();
    const notes = [
      { f: 261.63, dur: 0.14, delay: 0 },
      { f: 329.63, dur: 0.14, delay: 0.14 },
      { f: 392.0, dur: 0.14, delay: 0.28 },
      { f: 523.25, dur: 0.5, delay: 0.42 },
    ];
    notes.forEach((n) => {
      setTimeout(() => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'triangle';
          osc.frequency.value = n.f;
          const now = ctx.currentTime;
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + n.dur);
          osc.start(now);
          osc.stop(now + n.dur);
        } catch (e) {}
      }, n.delay * 1000);
    });
  } catch (e) {}
}

export function speakNotification(text: string) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const femaleVoice = cachedFemaleVoice || findBestFemaleSpanishVoice();

    if (femaleVoice) {
      utterance.voice = femaleVoice;
      utterance.lang = femaleVoice.lang;
    } else {
      utterance.lang = 'es-PE';
    }

    // Tono femenino, cálido y seductor con pronunciación clara
    utterance.rate = 0.94; // Cadencia natural y elegante
    utterance.pitch = 1.18; // Matiz cálido femenino
    utterance.volume = 1.0;

    // Cancela cualquier locución previa y ejecuta con breve tick para evitar atasco de Chrome
    window.speechSynthesis.cancel();
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Speech synthesis speak error:', err);
      }
    }, 45);
  } catch (e) {
    console.error('Speech synthesis error:', e);
  }
}
