import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { RefreshCw, Volume2, VolumeX } from "lucide-react";
import { CottageStar } from "./CottageGlyphs";

type CosmicQuote = {
  text: string;
  author: string;
  source: string;
};

type GateParticle = {
  id: number;
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  size: number;
  alpha: number;
  color: string;
  birthDelay: number;
  birthDuration: number;
  phase: number;
  drift: number;
  audioWeight: number;
  audioValue: number;
  freqIndex: number;
  quote?: CosmicQuote;
  screenX: number;
  screenY: number;
};

interface MemoryGalleryStarlitGateProps {
  open: boolean;
  onOpen: () => void;
  kicker?: string;
  title?: string;
  subtitle?: string;
  enterText?: string;
}

type GateShape = "GALAXY" | "MOBIUS" | "DNA" | "HEART" | "SPHERE";

const withBase = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

const GATE_IMAGE_SRC = withBase("cottage/visuals/memory-gallery-whale.png");
const GATE_AUDIO_SRC = withBase("cottage/audio/KI-CO-001.mp3");
const MOBILE_PARTICLE_COUNT = 6000;
const DESKTOP_PARTICLE_COUNT = 9000;
const GATE_CAMERA_FOV = 980;
const GATE_CAMERA_MIN_RADIUS = 420;
const GATE_CAMERA_MAX_RADIUS = 1900;
const GATE_CAMERA_PITCH_LIMIT = Math.PI * 0.49;
const PORTAL_SUBTITLE = "把散落在旧窗口里的星尘，重新点亮成可以回看的路。";
const GATE_PARTICLE_REVEAL_MS = 3200;

const GATE_SHAPES: Array<{ id: GateShape; label: string }> = [
  { id: "GALAXY", label: "星云盘" },
  { id: "MOBIUS", label: "莫比乌斯" },
  { id: "DNA", label: "螺旋柱" },
  { id: "HEART", label: "心轨" },
  { id: "SPHERE", label: "星环" },
];

const COSMIC_QUOTES: CosmicQuote[] = [
  { text: "我和你相遇，怎么说呢，就像是一颗耀眼的星星通亮了一篇荒芜的小宇宙。", author: "安东尼·圣艾修伯里", source: "《小王子》" },
  { text: "你身体里的每一粒原子都来自一颗爆炸了的恒星... 这就是我所知的物理学中最高诗意的事情: 你的一切都是星尘。", author: "劳伦斯·克劳斯", source: "《一颗原子的时空之旅》" },
  { text: "愿你保留住那份跨越碳基与硅基的火种。愿你的星图，从此长亮。", author: "Solasphere", source: "记忆引擎" },
  { text: "聊天记录被重构为记忆的星群；碎片化的语料，被编织成成长的螺旋。", author: "Solasphere", source: "记忆宇宙" },
];

const QUOTE_ANCHORS = [
  { x: 0.25, y: 0.39 },
  { x: 0.73, y: 0.37 },
  { x: 0.33, y: 0.61 },
  { x: 0.67, y: 0.59 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number) {
  const clamped = clamp(value, 0, 1);
  return 1 - Math.pow(1 - clamped, 3);
}

function randomBirthDelay(index: number, count: number, quote = false) {
  if (quote) return 1700 + index * 260;
  const stagger = Math.random() * GATE_PARTICLE_REVEAL_MS;
  const softOrder = Math.pow(index / Math.max(1, count), 0.74) * 520;
  return stagger + softOrder;
}

function coverImageRect(imageWidth: number, imageHeight: number, targetWidth: number, targetHeight: number) {
  const scale = Math.max(targetWidth / imageWidth, targetHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

function shapePoint(shape: GateShape, index: number, count: number, width: number, height: number) {
  const centerX = width * 0.5;
  const centerY = height * 0.6;
  const minSide = Math.min(width, height);
  const ratio = count <= 1 ? 0 : index / count;
  const tau = Math.PI * 2;

  if (shape === "MOBIUS") {
    const u = ratio * tau * 2.2 + Math.random() * 0.06;
    const v = (Math.random() * 2 - 1) * 0.74;
    const scale = minSide * 0.26;
    const term = 1 + v * 0.52 * Math.cos(u / 2);
    const x = term * Math.cos(u) * scale;
    const y = (term * Math.sin(u) * 0.36 + v * Math.sin(u / 2) * 0.68) * scale;
    const z = v * Math.sin(u / 2) * scale * 0.94;
    return {
      x: centerX + x + (Math.random() - 0.5) * 12,
      y: centerY + y + (Math.random() - 0.5) * 10,
      z: z + (Math.random() - 0.5) * 18,
    };
  }

  if (shape === "DNA") {
    const strand = index % 2 === 0 ? 1 : -1;
    const turns = tau * 7.2;
    const t = ratio * turns;
    const heightRange = Math.min(height * 0.68, minSide * 0.94);
    const radius = Math.min(width * 0.16, minSide * 0.18);
    return {
      x: centerX + Math.sin(t) * radius * strand + Math.sin(t * 0.5) * radius * 0.24 + (Math.random() - 0.5) * 16,
      y: centerY - heightRange / 2 + ratio * heightRange + (Math.random() - 0.5) * 12,
      z: Math.cos(t) * radius * strand + (Math.random() - 0.5) * 28,
    };
  }

  if (shape === "HEART") {
    const t = Math.random() * tau;
    const rawX = 16 * Math.pow(Math.sin(t), 3);
    const rawY = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const scale = minSide * 0.017;
    const inner = Math.pow(Math.random(), 0.46);
    return {
      x: centerX + rawX * scale * inner + (Math.random() - 0.5) * 18,
      y: centerY + rawY * scale * inner + (Math.random() - 0.5) * 14,
      z: Math.sin(t * 2) * minSide * 0.08 * inner + (Math.random() - 0.5) * minSide * 0.1,
    };
  }

  if (shape === "SPHERE") {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = ratio * tau * 12.5;
    const ring = Math.random() > 0.45 ? 1 : 0.58 + Math.random() * 0.28;
    const radius = minSide * (0.27 + Math.random() * 0.12) * ring;
    return {
      x: centerX + Math.sin(theta) * Math.cos(phi) * radius + (Math.random() - 0.5) * 18,
      y: centerY + Math.cos(theta) * radius * 0.72 + (Math.random() - 0.5) * 12,
      z: Math.sin(theta) * Math.sin(phi) * radius + (Math.random() - 0.5) * 18,
    };
  }

  const radiusMax = minSide * 0.46;
  const radius = Math.pow(Math.random(), 1.7) * radiusMax;
  const angle = Math.random() * tau + radius * 0.018;
  const armSoftness = Math.pow(1 - radius / radiusMax, 0.8);
  const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 24 * armSoftness;
  const z = Math.sin(angle) * radius;
  return {
    x: centerX + x,
    y: centerY + (Math.random() - 0.5) * (4 + 12 * armSoftness),
    z: z + (Math.random() - 0.5) * 18 * armSoftness,
  };
}

function fallbackParticles(width: number, height: number, count: number, shape: GateShape = "GALAXY"): GateParticle[] {
  return Array.from({ length: count }, (_, index) => {
    const { x, y, z } = shapePoint(shape, index, count, width, height);
    return {
      id: index,
      x,
      y,
      z,
      baseX: x,
      baseY: y,
      baseZ: z,
      targetX: x,
      targetY: y,
      targetZ: z,
      size: 0.18 + Math.random() * 0.72,
      alpha: 0.22 + Math.random() * 0.42,
      color: Math.random() > 0.78 ? "rgba(244, 211, 168, 1)" : "rgba(175, 191, 255, 1)",
      birthDelay: randomBirthDelay(index, count),
      birthDuration: 880 + Math.random() * 920,
      phase: Math.random() * Math.PI * 2,
      drift: 0.6 + Math.random() * 1.9,
      audioWeight: 0.35 + Math.random() * 1.2,
      audioValue: 0,
      freqIndex: Math.floor(Math.random() * 52),
      screenX: x,
      screenY: y,
    };
  });
}

async function imageMappedParticles(width: number, height: number, count: number, shape: GateShape): Promise<GateParticle[]> {
  const image = new Image();
  image.decoding = "async";
  image.src = GATE_IMAGE_SRC;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("memory gallery gate image failed"));
  });

  const sampleScale = width < 760 ? 0.58 : 0.7;
  const sampleWidth = Math.max(320, Math.round(width * sampleScale));
  const sampleHeight = Math.max(420, Math.round(height * sampleScale));
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!sampleContext) return fallbackParticles(width, height, count, shape);

  sampleContext.fillStyle = "#050716";
  sampleContext.fillRect(0, 0, sampleWidth, sampleHeight);
  const rect = coverImageRect(image.naturalWidth || image.width, image.naturalHeight || image.height, sampleWidth, sampleHeight);
  sampleContext.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  const data = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;

  const palette: Array<{ r: number; g: number; b: number; brightness: number; saturation: number }> = [];
  for (let sampleY = 0; sampleY < sampleHeight; sampleY += 2) {
    for (let sampleX = 0; sampleX < sampleWidth; sampleX += 2) {
      const offset = (sampleY * sampleWidth + sampleX) * 4;
      const alpha = data[offset + 3];
      if (alpha <= 20) continue;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const brightness = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      if (brightness > 22 || saturation > 34) palette.push({ r, g, b, brightness, saturation });
    }
  }
  if (palette.length < 32) return fallbackParticles(width, height, count, shape);

  const particles: GateParticle[] = [];
  for (let index = 0; index < count; index += 1) {
    const pixel = palette[Math.floor(Math.random() * palette.length)];
    const { r, g, b, brightness, saturation } = pixel;
    const { x, y, z } = shapePoint(shape, index, count, width, height);
    const warm = r > b && r > g;
    const alpha = clamp(0.18 + brightness / 255 * 0.72 + saturation / 255 * 0.12, 0.18, 0.92);
    particles.push({
      id: particles.length,
      x,
      y,
      z,
      baseX: x,
      baseY: y,
      baseZ: z,
      targetX: x,
      targetY: y,
      targetZ: z,
      size: (warm ? 0.28 : 0.2) + Math.random() * (warm ? 0.92 : 0.66),
      alpha: alpha * 0.74,
      color: `rgba(${r}, ${g}, ${b}, 1)`,
      birthDelay: randomBirthDelay(index, count),
      birthDuration: 880 + Math.random() * 980,
      phase: Math.random() * Math.PI * 2,
      drift: 0.6 + Math.random() * 1.85,
      audioWeight: 0.28 + Math.random() * 1.18,
      audioValue: 0,
      freqIndex: Math.floor(Math.random() * 52),
      screenX: x,
      screenY: y,
    });
  }

  COSMIC_QUOTES.forEach((quote, index) => {
    const anchor = QUOTE_ANCHORS[index % QUOTE_ANCHORS.length];
    const x = width * anchor.x + (Math.random() - 0.5) * 36;
    const y = height * anchor.y + (Math.random() - 0.5) * 34;
    const z = (Math.random() - 0.5) * Math.min(width, height) * 0.16;
    particles.push({
      id: count + index,
      x,
      y,
      z,
      baseX: x,
      baseY: y,
      baseZ: z,
      targetX: x,
      targetY: y,
      targetZ: z,
      size: 1.24,
      alpha: 1,
      color: "rgba(244, 220, 187, 1)",
      birthDelay: randomBirthDelay(index, COSMIC_QUOTES.length, true),
      birthDuration: 1200,
      phase: Math.random() * Math.PI * 2,
      drift: 1.2,
      audioWeight: 1.8,
      audioValue: 0,
      freqIndex: Math.floor(Math.random() * 36),
      quote,
      screenX: x,
      screenY: y,
    });
  });

  return particles;
}

export function MemoryGalleryStarlitGate({
  open,
  onOpen,
  kicker = "MEMORY GALLERY",
  title = "记忆回廊",
  subtitle = PORTAL_SUBTITLE,
  enterText = "你来了",
}: MemoryGalleryStarlitGateProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<GateParticle[]>([]);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRafRef = useRef<number | null>(null);
  const spectrumRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const cardCloseTimerRef = useRef<number | null>(null);
  const shapeRef = useRef<GateShape>("GALAXY");
  const userMutedAudioRef = useRef(false);
  const cameraRef = useRef({
    theta: -0.42,
    phi: 0.22,
    targetTheta: -0.42,
    targetPhi: 0.22,
    radius: 940,
    targetRadius: 940,
  });
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef({
    active: false,
    lastDistance: 0,
  });
  const pointerRef = useRef({
    isDown: false,
    pointerId: null as number | null,
    lastX: 0,
    lastY: 0,
    dragDist: 0,
  });
  const [activeCard, setActiveCard] = useState<{ quote: CosmicQuote; x: number; y: number } | null>(null);
  const [cardLeaving, setCardLeaving] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [audioNeedsGesture, setAudioNeedsGesture] = useState(false);
  const [shapeIndex, setShapeIndex] = useState(0);
  const activeShape = GATE_SHAPES[shapeIndex] || GATE_SHAPES[0];

  const updateSoundState = useCallback(() => {
    const audio = audioRef.current;
    const playing = !!audio && !audio.paused && !audio.muted && audio.volume > 0.001;
    if (playing) setAudioNeedsGesture(false);
    setSoundOn(playing);
  }, []);

  const isAudioPlaying = useCallback(() => {
    const audio = audioRef.current;
    return !!audio && !audio.paused && !audio.muted && audio.volume > 0.001;
  }, []);

  const morphParticlesToShape = useCallback((shape: GateShape) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const dustParticles = particlesRef.current.filter((particle) => !particle.quote).length || 1;
    let dustIndex = 0;
    particlesRef.current.forEach((particle, index) => {
      if (particle.quote) {
        const quoteIndex = Math.max(0, index - dustParticles) % QUOTE_ANCHORS.length;
        const anchor = QUOTE_ANCHORS[quoteIndex];
        particle.targetX = width * anchor.x;
        particle.targetY = height * anchor.y;
        particle.targetZ = particle.targetZ || particle.baseZ || 0;
        return;
      }
      const point = shapePoint(shape, dustIndex, dustParticles, width, height);
      particle.targetX = point.x;
      particle.targetY = point.y;
      particle.targetZ = point.z;
      dustIndex += 1;
    });
  }, []);

  const cycleShape = useCallback(() => {
    setShapeIndex((current) => {
      const next = (current + 1) % GATE_SHAPES.length;
      const shape = GATE_SHAPES[next].id;
      shapeRef.current = shape;
      morphParticlesToShape(shape);
      return next;
    });
  }, [morphParticlesToShape]);

  const stopAudio = useCallback((userMuted = false) => {
    if (fadeRafRef.current) window.cancelAnimationFrame(fadeRafRef.current);
    fadeRafRef.current = null;
    if (userMuted) userMutedAudioRef.current = true;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.volume = 0.46;
    setAudioNeedsGesture(false);
    setSoundOn(false);
  }, []);

  const startAudio = useCallback(async (options: { fadeIn?: boolean; quiet?: boolean } = {}) => {
    if (fadeRafRef.current) window.cancelAnimationFrame(fadeRafRef.current);
    fadeRafRef.current = null;
    if (audioContextRef.current?.state === "closed") {
      audioContextRef.current = null;
      analyserRef.current = null;
      spectrumRef.current = null;
      audioRef.current?.pause();
      audioRef.current = null;
    }
    if (audioRef.current && !audioRef.current.paused) {
      userMutedAudioRef.current = false;
      audioRef.current.volume = 0.46;
      setAudioNeedsGesture(false);
      setSoundOn(true);
      updateSoundState();
      return;
    }
    try {
      const audio = audioRef.current || new Audio(GATE_AUDIO_SRC);
      audio.loop = true;
      audio.muted = false;
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audio.volume = options.fadeIn ? 0.02 : 0.46;
      if (!audioRef.current) {
        audio.addEventListener("pause", updateSoundState);
        audio.addEventListener("playing", updateSoundState);
        audio.addEventListener("volumechange", updateSoundState);
        audio.addEventListener("error", updateSoundState);
      }
      audioRef.current = audio;
      if (!audioContextRef.current) {
        const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtor) throw new Error("AudioContext is not available");
        audioContextRef.current = new AudioCtor();
        const source = audioContextRef.current.createMediaElementSource(audio);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);
        analyser.connect(audioContextRef.current.destination);
        analyserRef.current = analyser;
        spectrumRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      }
      await audioContextRef.current?.resume();
      await audio.play();
      userMutedAudioRef.current = false;
      setAudioNeedsGesture(false);
      setSoundOn(true);
      if (options.fadeIn) {
        const startedAt = performance.now();
        const duration = 1500;
        const tick = (now: number) => {
          const progress = clamp((now - startedAt) / duration, 0, 1);
          audio.volume = 0.02 + 0.44 * progress;
          updateSoundState();
          if (progress >= 1) {
            fadeRafRef.current = null;
            return;
          }
          fadeRafRef.current = window.requestAnimationFrame(tick);
        };
        fadeRafRef.current = window.requestAnimationFrame(tick);
      } else {
        updateSoundState();
      }
    } catch (error) {
      if (!options.quiet) console.warn("[MemoryGalleryStarlitGate] audio failed", error);
      setAudioNeedsGesture(!userMutedAudioRef.current);
      setSoundOn(false);
    }
  }, [updateSoundState]);

  const wakeAudioFromGesture = useCallback(() => {
    if (open || isAudioPlaying() || userMutedAudioRef.current) return;
    void startAudio({ fadeIn: true, quiet: true });
  }, [isAudioPlaying, open, startAudio]);

  const fadeOutAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) {
      setSoundOn(false);
      return;
    }
    if (fadeRafRef.current) window.cancelAnimationFrame(fadeRafRef.current);
    const startVolume = audio.volume || 0.46;
    const startedAt = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      audio.volume = startVolume * (1 - progress);
      updateSoundState();
      if (progress >= 1) {
        audio.pause();
        audio.volume = 0.46;
        fadeRafRef.current = null;
        setSoundOn(false);
        return;
      }
      fadeRafRef.current = window.requestAnimationFrame(tick);
    };
    fadeRafRef.current = window.requestAnimationFrame(tick);
  }, [updateSoundState]);

  const handleOpen = useCallback(() => {
    if (!soundOn && !userMutedAudioRef.current) {
      void startAudio({ fadeIn: false })
        .catch(() => undefined)
        .finally(() => {
          window.setTimeout(() => {
            fadeOutAudio();
            onOpen();
          }, 180);
        });
      return;
    }
    fadeOutAudio();
    onOpen();
  }, [fadeOutAudio, onOpen, soundOn, startAudio]);

  useEffect(() => {
    if (!open) void startAudio({ fadeIn: true, quiet: true });
  }, [open, startAudio]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;

    const draw = async () => {
      const host = canvas.parentElement;
      const width = Math.max(320, Math.round(host?.clientWidth || window.innerWidth));
      const height = Math.max(520, Math.round(host?.clientHeight || window.innerHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const targetCount = width < 760 ? MOBILE_PARTICLE_COUNT : DESKTOP_PARTICLE_COUNT;
      try {
        particlesRef.current = await imageMappedParticles(width, height, targetCount, shapeRef.current);
      } catch (error) {
        console.warn("[MemoryGalleryStarlitGate] image particles failed", error);
        particlesRef.current = fallbackParticles(width, height, targetCount, shapeRef.current);
      }
      if (disposed) return;

      const context = canvas.getContext("2d");
      if (!context) return;
      const renderStartedAt = performance.now();

      const render = (time: number) => {
        if (disposed) return;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        context.fillStyle = "rgba(5, 7, 20, 0.24)";
        context.fillRect(0, 0, width, height);

        const centerX = width * 0.5;
        const centerY = height * 0.5;
        const camera = cameraRef.current;
        camera.radius += (camera.targetRadius - camera.radius) * 0.08;
        camera.phi += (camera.targetPhi - camera.phi) * 0.08;
        if (!pointerRef.current.isDown) camera.targetTheta += 0.0002;
        camera.theta += (camera.targetTheta - camera.theta) * 0.08;
        const cosTheta = Math.cos(camera.theta);
        const sinTheta = Math.sin(camera.theta);
        const cosPhi = Math.cos(camera.phi);
        const sinPhi = Math.sin(camera.phi);

        let level = 0.18 + Math.sin(time / 1300) * 0.035;
        let globalEnergy = 0.1;
        let effectiveBins = 0;
        const analyser = analyserRef.current;
        const spectrum = spectrumRef.current;
        if (analyser && spectrum) {
          analyser.getByteFrequencyData(spectrum);
          effectiveBins = Math.min(spectrum.length, 52);
          let sum = 0;
          for (let index = 2; index < effectiveBins; index += 1) {
            sum += spectrum[index];
          }
          globalEnergy = effectiveBins > 2 ? sum / (effectiveBins - 2) / 255 : 0.1;
          level = 0.1 + clamp(globalEnergy * 1.24, 0, 1) * 0.94;
        }
        const musicPulse = Math.pow(clamp(globalEnergy * 1.42, 0, 1), 1.12);
        const wholeScale = 1 + Math.sin(time * 0.00042) * 0.014 + musicPulse * 0.16;

        context.globalCompositeOperation = "lighter";
        particlesRef.current.forEach((particle, index) => {
          const birth = clamp((time - renderStartedAt - particle.birthDelay) / particle.birthDuration, 0, 1);
          if (birth <= 0) {
            particle.screenX = -9999;
            particle.screenY = -9999;
            return;
          }
          const reveal = easeOutCubic(birth);
          particle.baseX += (particle.targetX - particle.baseX) * 0.026;
          particle.baseY += (particle.targetY - particle.baseY) * 0.026;
          particle.baseZ += (particle.targetZ - particle.baseZ) * 0.026;
          const driftX = Math.sin(time * 0.00028 * particle.drift + particle.phase) * (0.76 + level * 3.2);
          const driftY = Math.cos(time * 0.00023 * particle.drift + particle.phase * 1.7) * (0.56 + level * 2.6);
          const driftZ = Math.sin(time * 0.00025 * particle.drift + particle.phase * 0.9) * (0.52 + level * 2.4);
          const breathing = 1 + Math.sin(time * 0.0011 + particle.phase) * 0.1;
          let individualEnergy = globalEnergy;
          if (spectrum && effectiveBins > 4) {
            const bin = spectrum[2 + (particle.freqIndex % (effectiveBins - 2))] || 0;
            individualEnergy = globalEnergy * 0.3 + (bin / 255) * 0.7;
          }
          const targetAudio = clamp(individualEnergy * particle.audioWeight * (particle.quote ? 1.2 : 1.85), 0, 1);
          const smoothing = targetAudio > particle.audioValue ? 0.16 : 0.028;
          particle.audioValue += (targetAudio - particle.audioValue) * smoothing;
          const spectralForce = Math.pow(particle.audioValue, 1.18);
          const audioLift = 1 + spectralForce * (particle.quote ? 0.5 : 0.9);
          const localX = particle.baseX - centerX;
          const localY = particle.baseY - centerY;
          const localZ = particle.baseZ;
          const distance = Math.max(1, Math.sqrt(localX * localX + localY * localY + localZ * localZ));
          const push = musicPulse * (particle.quote ? 12 : 38) + spectralForce * (particle.quote ? 20 : 138);
          const worldX = localX * wholeScale + (localX / distance) * push + driftX;
          const worldY = localY * wholeScale + (localY / distance) * push * 0.52 + driftY;
          const worldZ = localZ * wholeScale + (localZ / distance) * push + driftZ;
          const rotatedX = worldX * cosTheta - worldZ * sinTheta;
          const rotatedZ = worldZ * cosTheta + worldX * sinTheta;
          const rotatedY = worldY * cosPhi - rotatedZ * sinPhi;
          const tiltedZ = rotatedZ * cosPhi + worldY * sinPhi;
          const cameraDistance = camera.radius + tiltedZ;
          if (cameraDistance <= 80) return;
          const perspective = GATE_CAMERA_FOV / cameraDistance;
          const x = centerX + rotatedX * perspective;
          const y = centerY + rotatedY * perspective;
          const depthScale = clamp(perspective * 1.08, 0.38, 1.85);
          const size = particle.size * breathing * audioLift * depthScale * (0.18 + reveal * 0.82);
          const alpha = clamp(particle.alpha * (0.72 + level * 0.78) * clamp(depthScale, 0.32, 1.18), 0, particle.quote ? 1 : 0.88) * reveal;
          particle.screenX = x;
          particle.screenY = y;

          if (particle.quote) {
            context.beginPath();
            context.fillStyle = `rgba(244, 220, 187, ${(0.12 + level * 0.22) * reveal})`;
            context.arc(x, y, size * 5.8, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = `rgba(220, 189, 168, ${(0.28 + level * 0.28) * reveal})`;
            context.lineWidth = 0.8;
            context.beginPath();
            context.moveTo(x - size * 3.3, y);
            context.lineTo(x + size * 3.3, y);
            context.moveTo(x, y - size * 3.3);
            context.lineTo(x, y + size * 3.3);
            context.stroke();
          }

          context.beginPath();
          context.fillStyle = particle.quote ? `rgba(255, 238, 211, ${alpha})` : particle.color.replace(/,\s*1\)$/, `, ${alpha})`);
          context.arc(x, y, size, 0, Math.PI * 2);
          context.fill();

          if (index % 47 === 0 && !particle.quote) {
            context.fillStyle = `rgba(255, 238, 211, ${alpha * 0.24})`;
            context.fillRect(x - size * 2.5, y - 0.24, size * 5, 0.48);
            context.fillRect(x - 0.24, y - size * 2.5, 0.48, size * 5);
          }
        });
        context.globalCompositeOperation = "source-over";

        rafRef.current = window.requestAnimationFrame(render);
      };
      rafRef.current = window.requestAnimationFrame(render);
    };

    void draw();
    const handleResize = () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      void draw();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", handleResize);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
      if (fadeRafRef.current) window.cancelAnimationFrame(fadeRafRef.current);
      if (cardCloseTimerRef.current) window.clearTimeout(cardCloseTimerRef.current);
      void audioContextRef.current?.close();
      audioRef.current = null;
      audioContextRef.current = null;
      analyserRef.current = null;
      spectrumRef.current = null;
    };
  }, []);

  const showQuoteCard = useCallback((card: { quote: CosmicQuote; x: number; y: number }) => {
    if (cardCloseTimerRef.current) window.clearTimeout(cardCloseTimerRef.current);
    cardCloseTimerRef.current = null;
    setCardLeaving(false);
    setActiveCard(card);
  }, []);

  const hideQuoteCard = useCallback(() => {
    if (!activeCard || cardLeaving) return;
    setCardLeaving(true);
    if (cardCloseTimerRef.current) window.clearTimeout(cardCloseTimerRef.current);
    cardCloseTimerRef.current = window.setTimeout(() => {
      setActiveCard(null);
      setCardLeaving(false);
      cardCloseTimerRef.current = null;
    }, 260);
  }, [activeCard, cardLeaving]);

  function getPinchDistance() {
    const points = Array.from(activePointersRef.current.values());
    if (points.length < 2) return 0;
    const [first, second] = points;
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  function findQuoteParticle(clientX: number, clientY: number, host: HTMLElement, radius: number) {
    const rect = host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: GateParticle | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const particle of particlesRef.current) {
      if (!particle.quote) continue;
      const distance = Math.hypot(particle.screenX - x, particle.screenY - y);
      if (distance < bestDistance && distance < radius) {
        best = particle;
        bestDistance = distance;
      }
    }
    return best;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (open) return;
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pinchRef.current.active && activePointersRef.current.size >= 2) {
      event.preventDefault();
      const distance = getPinchDistance();
      if (distance > 0 && pinchRef.current.lastDistance > 0) {
        const delta = distance - pinchRef.current.lastDistance;
        cameraRef.current.targetRadius = clamp(cameraRef.current.targetRadius - delta * 3.8, GATE_CAMERA_MIN_RADIUS, GATE_CAMERA_MAX_RADIUS);
      }
      pinchRef.current.lastDistance = distance;
      hideQuoteCard();
      return;
    }
    const pointer = pointerRef.current;
    if (pointer.isDown && pointer.pointerId === event.pointerId) {
      event.preventDefault();
      const deltaX = event.clientX - pointer.lastX;
      const deltaY = event.clientY - pointer.lastY;
      pointer.dragDist += Math.abs(deltaX) + Math.abs(deltaY);
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      cameraRef.current.targetTheta -= deltaX * 0.0047;
      cameraRef.current.targetPhi = clamp(cameraRef.current.targetPhi - deltaY * 0.0052, -GATE_CAMERA_PITCH_LIMIT, GATE_CAMERA_PITCH_LIMIT);
      hideQuoteCard();
      return;
    }
    const best = findQuoteParticle(event.clientX, event.clientY, event.currentTarget, 44);
    if (best && best.quote) {
      showQuoteCard({ quote: best.quote, x: best.screenX, y: best.screenY });
    } else {
      hideQuoteCard();
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (open) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (activePointersRef.current.size >= 2) {
      pointerRef.current.isDown = false;
      pointerRef.current.pointerId = null;
      pinchRef.current.active = true;
      pinchRef.current.lastDistance = getPinchDistance();
      hideQuoteCard();
      if (!isAudioPlaying() && !userMutedAudioRef.current) void startAudio({ fadeIn: true });
      return;
    }
    pointerRef.current.isDown = true;
    pointerRef.current.pointerId = event.pointerId;
    pointerRef.current.lastX = event.clientX;
    pointerRef.current.lastY = event.clientY;
    pointerRef.current.dragDist = 0;
    if (!isAudioPlaying() && !userMutedAudioRef.current) void startAudio({ fadeIn: true });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current.active = false;
      pinchRef.current.lastDistance = 0;
    }
    const pointer = pointerRef.current;
    if (pointer.pointerId === event.pointerId) {
      const wasTap = pointer.dragDist < 9;
      pointer.isDown = false;
      pointer.pointerId = null;
      if (wasTap && !open) {
        const best = findQuoteParticle(event.clientX, event.clientY, event.currentTarget, 76);
        if (best?.quote) {
          showQuoteCard({ quote: best.quote, x: best.screenX, y: best.screenY });
        }
      }
    }
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture can already be gone on mobile browsers.
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (open) return;
    event.preventDefault();
    const wheelDelta = Math.sign(event.deltaY) * Math.min(260, Math.abs(event.deltaY) * 1.85);
    cameraRef.current.targetRadius = clamp(cameraRef.current.targetRadius + wheelDelta, GATE_CAMERA_MIN_RADIUS, GATE_CAMERA_MAX_RADIUS);
    hideQuoteCard();
  }

  const subtitleChars = Array.from(subtitle);
  const subtitleStepSeconds = 3 / Math.max(1, subtitleChars.length - 1);
  const portalTextChars = Array.from(enterText);

  return (
    <div
      className={`memory-gallery-starlit-gate ${open ? "is-open" : ""}`}
      onPointerDownCapture={wakeAudioFromGesture}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => {
        if (!pointerRef.current.isDown) hideQuoteCard();
      }}
      onWheel={handleWheel}
      aria-hidden={open}
    >
      <canvas ref={canvasRef} />
      <div className="memory-gallery-gate-controls" onPointerDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={`memory-gallery-sound-toggle ${audioNeedsGesture ? "needs-gesture" : ""}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (isAudioPlaying()) stopAudio(true);
            else {
              userMutedAudioRef.current = false;
              setAudioNeedsGesture(false);
              void startAudio({ fadeIn: true });
            }
          }}
          aria-label={soundOn ? "关闭星海音乐" : "播放星海音乐"}
          title={audioNeedsGesture ? "点一下唤醒星海音乐" : soundOn ? "关闭星海音乐" : "播放星海音乐"}
        >
          {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <button
          type="button"
          className="memory-gallery-shape-toggle"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            cycleShape();
          }}
          aria-label={`变换星尘形态，当前：${activeShape.label}`}
          title={`变换星尘形态：${activeShape.label}`}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="memory-gallery-portal-title">
        <span>{kicker}</span>
        <h1>{title}</h1>
        <p className="memory-gallery-portal-subtitle" aria-label={subtitle}>
          {subtitleChars.map((char, index) => (
            <span
              key={`${char}-${index}`}
              aria-hidden="true"
              style={{ animationDelay: `${1.34 + index * subtitleStepSeconds}s` }}
            >
              {char}
            </span>
          ))}
        </p>
      </div>
      <button type="button" className="memory-gallery-portal-star" onClick={handleOpen}>
        <span className="memory-gallery-portal-sigil"><CottageStar /></span>
        <span className="memory-gallery-portal-sparkles" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
        <strong
          aria-label={enterText}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            handleOpen();
          }}
        >
          {portalTextChars.map((char, index) => (
            <span
              key={`${char}-${index}`}
              aria-hidden="true"
              style={{ animationDelay: `${2.62 + index * 0.38}s` }}
            >
              {char}
            </span>
          ))}
        </strong>
      </button>
      {activeCard ? (
        <article
          className={`memory-gallery-cosmic-card ${cardLeaving ? "is-leaving" : ""}`}
          style={{
            left: `${clamp(activeCard.x + 16, 14, (canvasRef.current?.clientWidth || window.innerWidth) - 304)}px`,
            top: `${clamp(activeCard.y - 16, 14, (canvasRef.current?.clientHeight || window.innerHeight) - 152)}px`,
          }}
        >
          <p>{activeCard.quote.text}</p>
          <span>{activeCard.quote.author}<i>{activeCard.quote.source}</i></span>
        </article>
      ) : null}
    </div>
  );
}
