import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FaVolumeUp,
  FaCheck,
  FaTimes,
  FaArrowRight,
  FaSpinner,
  FaRobot,
  FaCog,
} from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';
import InteractiveAIExplanationPanel from '../../ai/InteractiveAIExplanationPanel';
import {
  getSavedInteractivePrefs,
  getSavedInteractiveAISettings,
  saveInteractivePrefs,
  saveInteractiveAISettings,
  speedLabelToRate,
} from '../../interactiveQuiz/interactiveSettings';

const TTS_VOICES = {
  zh: 'zh-CN-XiaoxiaoMultilingualNeural',
  my: 'my-MM-NilarNeural',
  en: 'en-US-JennyNeural',
};

const TEACHER_IMAGE_URL =
  'https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png';

const DEFAULT_PREFS = {
  showQuestionPinyin: true,
  showOptionPinyin: true,
  autoPlay: true,
  ttsSpeed: 'normal',
};

const DEFAULT_AI_SETTINGS = {
  aiMode: 'api', // api | deepseek
  vibration: true,
  soundFx: true,
  ttsApiUrl: 'https://t.leftsite.cn/tts',
  zhVoice: TTS_VOICES.zh,
  myVoice: TTS_VOICES.my,
};

const CHOICE_QUESTION_SCHEMA_TEXT = `
{
  "id": "string",
  "question": {
    "text": "题干文字",
    "imageUrl": "可选，没图就空字符串"
  },
  "options": [
    { "id": "A", "text": "选项A", "imageUrl": "" },
    { "id": "B", "text": "选项B", "imageUrl": "" },
    { "id": "C", "text": "选项C", "imageUrl": "" },
    { "id": "D", "text": "选项D", "imageUrl": "" }
  ],
  "correctAnswer": "A",
  "explanation": "简短解析"
}
`;

function getMergedPrefs() {
  return {
    ...DEFAULT_PREFS,
    ...(getSavedInteractivePrefs() || {}),
  };
}

function getMergedAISettings() {
  const saved = getSavedInteractiveAISettings() || {};
  return {
    ...DEFAULT_AI_SETTINGS,
    ...saved,
    aiMode: saved.aiMode || 'api',
    vibration: saved.vibration !== false,
    soundFx: saved.soundFx !== false,
    zhVoice: saved.zhVoice || TTS_VOICES.zh,
    myVoice: saved.myVoice || TTS_VOICES.my,
    ttsApiUrl: saved.ttsApiUrl || DEFAULT_AI_SETTINGS.ttsApiUrl,
  };
}

const cssStyles = `
.xzt-container {
  font-family:"Padauk","Noto Sans SC",sans-serif;
  display:flex;
  flex-direction:column;
  background:transparent;
  width:100%;
  height:100%;
  position:relative;
  overflow:hidden;
}
.xzt-container.ai-open .result-sheet,
.xzt-container.ai-open .submit-bar {
  visibility:hidden;
  opacity:0;
  pointer-events:none;
}
.xzt-header {
  flex-shrink:0;
  padding:8px 16px 2px;
  display:flex;
  justify-content:center;
}
.top-hint-row {
  width:100%;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  margin-bottom:4px;
}
.top-left-text {
  font-size:15px;
  font-weight:900;
  color:#334155;
  line-height:1.2;
}
.top-actions {
  display:flex;
  align-items:center;
  gap:10px;
}
.settings-btn {
  display:flex;
  align-items:center;
  justify-content:center;
  color:#64748b;
  cursor:pointer;
  font-size:18px;
  padding:2px;
  background:none;
  border:none;
}

.scene-wrapper {
  width:100%;
  display:flex;
  align-items:flex-start;
  gap:10px;
  margin-top:0;
}
.teacher-img {
  height:116px;
  object-fit:contain;
  flex-shrink:0;
  margin-top:14px;
  filter:drop-shadow(0 8px 12px rgba(15,23,42,0.08));
}
.question-zone {
  flex:1;
  min-width:0;
  display:flex;
  flex-direction:column;
  gap:10px;
}

.bubble-container {
  flex:1;
  position:relative;
  min-height:92px;
  padding:16px 48px 16px 16px;
  border-radius:22px;
  border:2px solid #dbeafe;
  border-bottom-width:5px;
  background:#ffffff;
  box-shadow:0 8px 18px rgba(37,99,235,0.08);
  display:flex;
  align-items:center;
  overflow:visible;
}
.bubble-tail {
  position:absolute;
  left:-9px;
  top:31px;
  width:16px;
  height:16px;
  background:#ffffff;
  border-left:2px solid #dbeafe;
  border-bottom:2px solid #dbeafe;
  transform:rotate(45deg);
  border-bottom-left-radius:4px;
}

.bubble-text {
  flex:1;
  min-width:0;
  display:flex;
  flex-wrap:wrap;
  align-items:flex-end;
  gap:3px 4px;
  color:#3c3c3c;
  line-height:1.55;
}

.zh-seg {
  display:inline-flex;
  flex-direction:column;
  align-items:center;
  justify-content:flex-end;
  margin:0 1px;
}

.zh-py {
  display:block;
  min-height:15px;
  height:15px;
  line-height:15px;
  font-size:0.64rem;
  color:#94a3b8;
  font-weight:800;
  margin-bottom:3px;
  text-align:center;
  font-family:Arial, "Helvetica Neue", "Noto Sans", sans-serif;
  text-rendering:geometricPrecision;
  -webkit-font-smoothing:antialiased;
}

.zh-char {
  font-size:1.34rem;
  font-weight:900;
  color:#1e293b;
  line-height:1.18;
}
.bubble-text.is-long .zh-char {
  font-size:1.18rem;
}
.bubble-text.is-very-long .zh-char {
  font-size:1.04rem;
}
.bubble-text.is-long .zh-py {
  font-size:0.58rem;
  min-height:14px;
  height:14px;
  line-height:14px;
}

.my-seg {
  font-size:1rem;
  font-weight:800;
  color:#334155;
  white-space:pre-wrap;
  line-height:1.85;
  word-break:break-word;
  overflow-wrap:anywhere;
}
.bubble-text.is-myanmar .my-seg {
  font-size:0.98rem;
  line-height:1.9;
}
.bubble-text.is-myanmar.is-long .my-seg {
  font-size:0.93rem;
  line-height:1.95;
}
.bubble-text.is-myanmar.is-very-long .my-seg {
  font-size:0.88rem;
  line-height:2;
}

.inline-seg {
  font-size:1rem;
  font-weight:800;
  color:#475569;
  white-space:pre-wrap;
  line-height:1.65;
}

.bubble-audio-btn {
  position:absolute;
  right:12px;
  top:12px;
  flex-shrink:0;
  width:31px;
  height:31px;
  margin:0;
  border-radius:9999px;
  border:2px solid #ddf4ff;
  background:#ffffff;
  color:#1cb0f6;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  box-shadow:0 3px 0 #ddf4ff;
}
.bubble-audio-btn.playing {
  background:#ddf4ff;
  color:#1cb0f6;
  border-color:#84d8ff;
  box-shadow:0 3px 0 #84d8ff;
}
.bubble-audio-btn:active {
  transform:translateY(3px);
  box-shadow:none;
}

.question-image {
  width:100%;
  max-width:310px;
  align-self:center;
  border-radius:18px;
  border:2px solid #e5e5e5;
  border-bottom-width:5px;
  background:#fff;
  box-shadow:0 2px 0 rgba(0,0,0,0.02);
  object-fit:cover;
}

.xzt-scroll-area {
  flex:1;
  overflow-y:auto;
  padding:10px 16px 132px;
  display:flex;
  flex-direction:column;
  align-items:center;
  -webkit-overflow-scrolling:touch;
}
.options-grid {
  width:100%;
  display:grid;
  gap:12px;
  grid-template-columns:1fr;
}
.options-grid.has-images {
  grid-template-columns:1fr 1fr;
}

.option-card {
  background:#fff;
  border-radius:16px;
  padding:14px;
  border:2px solid #e5e7eb;
  border-bottom-width:5px;
  cursor:pointer;
  transition:all .12s ease;
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:68px;
  position:relative;
  user-select:none;
  -webkit-tap-highlight-color:transparent;
  box-shadow:0 2px 0 rgba(0,0,0,0.02);
}
.option-card:active {
  transform:translateY(2px);
  border-bottom-width:3px;
}
.option-card.selected {
  border-color:#58cc02;
  background:#d7ffb8;
  color:#3f7d20;
}
.option-card.playing {
  border-color:#84d8ff;
  background:#ddf4ff;
  color:#1cb0f6;
}
.option-card.correct {
  border-color:#58cc02;
  background:#d7ffb8;
  color:#3f7d20;
}
.option-card.wrong {
  border-color:#ff4b4b;
  background:#ffdfe0;
  color:#d32626;
}
.option-card.locked {
  cursor:default;
  transform:none;
}
.option-card.has-image-layout {
  flex-direction:column;
  align-items:stretch;
  justify-content:flex-start;
  padding:12px;
}
.option-text-wrap {
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
}

.option-py {
  display:block;
  min-height:18px;
  height:18px;
  line-height:18px;
  font-size:.68rem;
  color:#94a3b8;
  font-weight:800;
  margin-bottom:4px;
  text-align:center;
  font-family:Arial, "Helvetica Neue", "Noto Sans", sans-serif;
  text-rendering:geometricPrecision;
  -webkit-font-smoothing:antialiased;
}

.option-text {
  font-size:1.15rem;
  font-weight:900;
  text-align:center;
  color:inherit;
}

.submit-bar {
  position:absolute;
  bottom:0;
  left:0;
  right:0;
  padding:16px 16px calc(16px + env(safe-area-inset-bottom));
  background:linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 20%);
  display:flex;
  justify-content:center;
  z-index:30;
  transition:opacity .3s;
}
.submit-btn {
  width:100%;
  max-width:400px;
  padding:16px;
  border-radius:16px;
  font-size:1.15rem;
  font-weight:900;
  background:#58cc02;
  color:#fff;
  border:none;
  border-bottom:5px solid #46a302;
  cursor:pointer;
  transition:all .1s;
  box-shadow:0 6px 16px rgba(88,204,2,.22);
}
.submit-btn:active {
  transform:translateY(4px);
  border-bottom-width:1px;
  box-shadow:0 2px 0 #46a302;
}
.submit-btn:disabled {
  background:#e5e5e5;
  color:#9ca3af;
  border-bottom-color:#d1d5db;
  box-shadow:none;
  cursor:not-allowed;
}

.result-sheet {
  position:absolute;
  bottom:0;
  left:0;
  right:0;
  padding:20px 16px calc(20px + env(safe-area-inset-bottom));
  border-top-left-radius:20px;
  border-top-right-radius:20px;
  display:flex;
  flex-direction:column;
  gap:12px;
  transform:translateY(100%);
  transition:transform .3s cubic-bezier(.175,.885,.32,1.275), opacity .3s;
  box-shadow:0 -10px 30px rgba(0,0,0,.08);
  z-index:100;
}
.result-sheet.show {
  transform:translateY(0);
}
.result-sheet.correct {
  background:#d7ffb8;
  border-top:3px solid #58cc02;
}
.result-sheet.wrong {
  background:#ffdfe0;
  border-top:3px solid #ff4b4b;
}
.sheet-header {
  display:flex;
  align-items:center;
  gap:8px;
  font-size:1.35rem;
  font-weight:900;
}
.result-sheet.correct .sheet-header {
  color:#58cc02;
}
.result-sheet.wrong .sheet-header {
  color:#ff4b4b;
}
.sheet-sub {
  font-size:.95rem;
  font-weight:800;
  color:#64748b;
  margin-bottom:8px;
}

.result-actions {
  display:grid;
  grid-template-columns:1fr;
  gap:10px;
}

.ai-btn {
  background:#fff;
  padding:13px;
  border-radius:16px;
  font-weight:900;
  color:#8b5cf6;
  border:2px solid #ddd6fe;
  border-bottom-width:5px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  cursor:pointer;
  margin-bottom:0;
}
.ai-btn:active {
  transform:translateY(3px);
  border-bottom-width:2px;
}
.ai-btn.secondary {
  color:#2563eb;
  border-color:#bfdbfe;
}

.next-btn {
  width:100%;
  padding:16px;
  border-radius:16px;
  font-size:1.15rem;
  font-weight:900;
  color:#fff;
  border:none;
  border-bottom:5px solid;
  cursor:pointer;
  display:flex;
  justify-content:center;
  align-items:center;
  gap:8px;
  transition:all .1s;
}
.btn-correct {
  background:#58cc02;
  border-bottom-color:#46a302;
  box-shadow:0 6px 16px rgba(88,204,2,.22);
}
.btn-wrong {
  background:#ff4b4b;
  border-bottom-color:#d32626;
  box-shadow:0 6px 16px rgba(255,75,75,.22);
}
.next-btn:active {
  transform:translateY(4px);
  border-bottom-width:1px;
  box-shadow:none;
}

.modal-backdrop {
  position:fixed;
  inset:0;
  background:rgba(15,23,42,.35);
  backdrop-filter:blur(4px);
}
.panel-modal {
  position:fixed;
  inset:0;
  z-index:2147483600;
  display:flex;
  align-items:flex-end;
  justify-content:center;
  padding:16px;
}
.panel-card {
  width:100%;
  max-width:420px;
  max-height:min(82vh,760px);
  overflow-y:auto;
  background:#fff;
  border:2px solid #e5e7eb;
  border-radius:20px;
  box-shadow:0 20px 50px rgba(15,23,42,.20);
  padding:16px;
}
.panel-header {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:8px;
}
.panel-title {
  font-size:16px;
  font-weight:900;
  color:#334155;
}
.panel-close-btn {
  width:34px;
  height:34px;
  border:none;
  background:#f1f5f9;
  color:#64748b;
  border-radius:9999px;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
}
.settings-section-title {
  font-size:11px;
  font-weight:900;
  color:#94a3b8;
  text-transform:uppercase;
  letter-spacing:.08em;
  margin-bottom:10px;
  margin-top:14px;
}
.setting-row {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:10px 2px;
}
.setting-label {
  font-size:13px;
  font-weight:900;
  color:#334155;
}
.setting-desc {
  font-size:11px;
  color:#94a3b8;
  font-weight:700;
  margin-top:2px;
}
.switch {
  width:42px;
  height:24px;
  border-radius:9999px;
  position:relative;
  transition:all .2s;
  cursor:pointer;
  flex:0 0 auto;
}
.switch-dot {
  position:absolute;
  top:3px;
  width:16px;
  height:16px;
  border-radius:9999px;
  background:#fff;
  transition:all .2s;
  box-shadow:0 1px 4px rgba(0,0,0,.15);
}
.speed-group,
.ai-mode-group {
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:8px;
  margin-top:6px;
}
.ai-mode-group {
  grid-template-columns:1fr 1fr;
}
.speed-btn,
.ai-mode-btn {
  border:2px solid #e5e7eb;
  background:#fff;
  color:#64748b;
  border-radius:12px;
  font-size:12px;
  font-weight:900;
  padding:10px 0;
  cursor:pointer;
}
.speed-btn.active,
.ai-mode-btn.active {
  background:#ecfccb;
  border-color:#bef264;
  color:#3f6212;
}

.bounce-in {
  animation:xzt-bounce .28s ease-out;
}
@keyframes xzt-bounce {
  0% { transform:scale(.97); }
  60% { transform:scale(1.02); }
  100% { transform:scale(1); }
}
`;

const indexedBlobCache = {
  db: null,
  initPromise: null,

  async init() {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return null;
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      const request = indexedDB.open('LessonCacheDB', 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('tts_audio')) {
          db.createObjectStore('tts_audio');
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = () => resolve(null);
    });

    return this.initPromise;
  },

  async get(key) {
    const db = await this.init();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction('tts_audio', 'readonly');
      const req = tx.objectStore('tts_audio').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  },

  async set(key, blob) {
    const db = await this.init();
    if (!db || !blob) return;

    try {
      const tx = db.transaction('tts_audio', 'readwrite');
      tx.objectStore('tts_audio').put(blob, key);
    } catch (_) {}
  },
};

function vibrate(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

function playBeep(type = 'tap') {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const tones =
      type === 'correct'
        ? [
            { frequency: 720, start: 0, duration: 0.08, volume: 0.045 },
            { frequency: 920, start: 0.09, duration: 0.11, volume: 0.04 },
          ]
        : type === 'wrong'
        ? [
            { frequency: 240, start: 0, duration: 0.1, volume: 0.055 },
            { frequency: 170, start: 0.11, duration: 0.14, volume: 0.05 },
          ]
        : [{ frequency: 520, start: 0, duration: 0.06, volume: 0.03 }];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.value = tone.frequency;

      gain.gain.setValueAtTime(0.0001, ctx.currentTime + tone.start);
      gain.gain.exponentialRampToValueAtTime(
        tone.volume,
        ctx.currentTime + tone.start + 0.01
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + tone.start + tone.duration
      );

      osc.start(ctx.currentTime + tone.start);
      osc.stop(ctx.currentTime + tone.start + tone.duration + 0.02);
    });

    const totalMs =
      Math.max(...tones.map((tone) => tone.start + tone.duration)) * 1000 + 120;

    setTimeout(() => {
      try {
        ctx.close();
      } catch (_) {}
    }, totalMs);
  } catch (_) {}
}

const isChineseChar = (char = '') => /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u.test(char);
const isMyanmarChar = (char = '') => /[\u1000-\u109F\uA9E0-\uA9FF\uAA60-\uAA7F]/u.test(char);
const isLatinOrDigit = (char = '') => /[a-zA-Z0-9]/.test(char);
const isWhitespace = (char = '') => /\s/.test(char);
const containsChinese = (text = '') => /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u.test(text);

const isPunctuationOrSymbol = (char = '') =>
  !isChineseChar(char) &&
  !isMyanmarChar(char) &&
  !isLatinOrDigit(char) &&
  !isWhitespace(char);

function normalizeTtsText(text = '') {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectWholeTextType(text = '') {
  const hasZh = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u.test(text);
  const hasMy = /[\u1000-\u109F\uA9E0-\uA9FF\uAA60-\uAA7F]/u.test(text);
  const hasLatin = /[a-zA-Z0-9]/.test(text);
  const count = [hasZh, hasMy, hasLatin].filter(Boolean).length;

  if (count <= 1) {
    if (hasZh) return 'zh';
    if (hasMy) return 'my';
    if (hasLatin) return 'en';
  }

  return 'mixed';
}

function splitMixedText(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const wholeType = detectWholeTextType(raw);
  if (wholeType !== 'mixed') {
    return [{ text: raw, lang: wholeType || 'zh' }];
  }

  const segments = [];
  let currentText = '';
  let currentLang = null;

  const pushCurrent = () => {
    const trimmed = currentText.trim();
    if (trimmed) {
      segments.push({ text: trimmed, lang: currentLang || 'zh' });
    }
    currentText = '';
    currentLang = null;
  };

  for (const char of Array.from(raw)) {
    let lang = null;

    if (isChineseChar(char)) lang = 'zh';
    else if (isMyanmarChar(char)) lang = 'my';
    else if (isLatinOrDigit(char)) lang = 'en';
    else if (isWhitespace(char) || isPunctuationOrSymbol(char)) {
      currentText += char;
      continue;
    }

    if (!currentLang) {
      currentLang = lang;
      currentText += char;
      continue;
    }

    if (lang === currentLang) {
      currentText += char;
    } else {
      pushCurrent();
      currentLang = lang;
      currentText = char;
    }
  }

  pushCurrent();

  return segments.length ? segments : [{ text: raw, lang: 'zh' }];
}

function splitLongTextForTTS(text = '', maxLen = 90, hardMax = 150) {
  const raw = normalizeTtsText(text);
  if (!raw) return [];
  if (Array.from(raw).length <= maxLen) return [raw];

  const parts = raw.match(/[^。！？!?；;\n]+[。！？!?；;\n]*|[^\s]+/g) || [raw];
  const chunks = [];
  let buffer = '';

  const pushBuffer = () => {
    const value = normalizeTtsText(buffer);
    if (value) chunks.push(value);
    buffer = '';
  };

  const pushLongPart = (part) => {
    const chars = Array.from(part);
    for (let i = 0; i < chars.length; i += hardMax) {
      const piece = chars.slice(i, i + hardMax).join('').trim();
      if (piece) chunks.push(piece);
    }
  };

  parts.forEach((part) => {
    const next = buffer ? `${buffer}${part}` : part;

    if (Array.from(next).length <= maxLen) {
      buffer = next;
      return;
    }

    pushBuffer();

    if (Array.from(part).length > hardMax) {
      pushLongPart(part);
    } else {
      buffer = part;
    }
  });

  pushBuffer();
  return chunks;
}

function buildTTSUnits(text = '') {
  const segments = splitMixedText(text);
  const units = [];

  segments.forEach((segment) => {
    splitLongTextForTTS(segment.text).forEach((chunk) => {
      if (chunk) {
        units.push({
          text: chunk,
          lang: segment.lang || 'zh',
        });
      }
    });
  });

  return units;
}

async function getTTSBlob(
  text,
  voice,
  rate = 0,
  apiUrl = 'https://t.leftsite.cn/tts',
  signal
) {
  const safeText = normalizeTtsText(text);
  if (!safeText) throw new Error('Empty TTS text');

  const cacheKey = `${apiUrl}-${voice}-${rate}-${safeText}`;
  let blob = await indexedBlobCache.get(cacheKey);

  if (!blob) {
    const url = `${apiUrl}?t=${encodeURIComponent(safeText)}&v=${encodeURIComponent(
      voice
    )}&r=${rate}`;

    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error('TTS request failed');
    }

    blob = await response.blob();

    if (!blob || blob.size <= 100) {
      throw new Error('Empty TTS audio');
    }

    await indexedBlobCache.set(cacheKey, blob);
  }

  return blob;
}

class AudioPlaybackController {
  constructor() {
    this.currentAudio = null;
    this.latestRequestId = 0;
    this.activeUrls = [];
    this.prefetchMap = new Map();
    this.abortController = null;
    this.stopCurrentAudio = null;
  }

  stop() {
    this.latestRequestId += 1;

    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch (_) {}

      this.abortController = null;
    }

    if (this.stopCurrentAudio) {
      try {
        this.stopCurrentAudio();
      } catch (_) {}

      this.stopCurrentAudio = null;
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (_) {}

      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio = null;
    }

    this.activeUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    });

    this.activeUrls = [];
    this.prefetchMap.clear();
  }

  getVoiceForLang(lang, aiSettings) {
    if (lang === 'my') return aiSettings?.myVoice || TTS_VOICES.my;
    if (lang === 'en') return TTS_VOICES.en;
    return aiSettings?.zhVoice || TTS_VOICES.zh;
  }

  createObjectUrl(blob) {
    const url = URL.createObjectURL(blob);
    this.activeUrls.push(url);
    return url;
  }

  revokeObjectUrl(url) {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}

    this.activeUrls = this.activeUrls.filter((item) => item !== url);
  }

  playUrl(url, requestId) {
    return new Promise((resolve) => {
      if (requestId !== this.latestRequestId) {
        resolve();
        return;
      }

      const audio = new Audio(url);
      this.currentAudio = audio;

      let finished = false;
      let stopThisAudio = null;

      const finish = () => {
        if (finished) return;
        finished = true;

        audio.onended = null;
        audio.onerror = null;

        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }

        if (this.stopCurrentAudio === stopThisAudio) {
          this.stopCurrentAudio = null;
        }

        resolve();
      };

      stopThisAudio = () => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (_) {}

        finish();
      };

      this.stopCurrentAudio = stopThisAudio;
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().catch(finish);
    });
  }

  async playMixed(text, { rate = 0, aiSettings = null } = {}, onStart, onEnd) {
    this.stop();

    const raw = normalizeTtsText(text);
    if (!raw) {
      onEnd?.();
      return;
    }

    const requestId = this.latestRequestId;
    const controller = new AbortController();
    this.abortController = controller;

    const units = buildTTSUnits(raw);
    if (!units.length) {
      onEnd?.();
      return;
    }

    const apiUrl = aiSettings?.ttsApiUrl || DEFAULT_AI_SETTINGS.ttsApiUrl;

    const prefetch = (index) => {
      if (index < 0 || index >= units.length) return null;
      if (this.prefetchMap.has(index)) return this.prefetchMap.get(index);

      const unit = units[index];
      const voice = this.getVoiceForLang(unit.lang, aiSettings);

      const promise = getTTSBlob(unit.text, voice, rate, apiUrl, controller.signal)
        .then((blob) => {
          if (requestId !== this.latestRequestId) return null;
          return this.createObjectUrl(blob);
        })
        .catch((error) => {
          if (error?.name !== 'AbortError') {
            console.warn('[TTS Prefetch Error]', error);
          }

          return null;
        });

      this.prefetchMap.set(index, promise);
      return promise;
    };

    try {
      onStart?.();

      prefetch(0);
      prefetch(1);

      for (let i = 0; i < units.length; i += 1) {
        if (requestId !== this.latestRequestId) return;

        prefetch(i + 1);
        prefetch(i + 2);

        const url = await prefetch(i);

        if (requestId !== this.latestRequestId) return;
        if (!url) continue;

        await this.playUrl(url, requestId);
        this.revokeObjectUrl(url);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn('[TTS Error]', error);
      }
    } finally {
      if (requestId === this.latestRequestId) {
        this.currentAudio = null;
        this.abortController = null;
        this.stopCurrentAudio = null;
        this.prefetchMap.clear();
        onEnd?.();
      }
    }
  }
}

const pinyinCache = new Map();
const pinyinArrayCache = new Map();

function getPinyinArraySafe(text = '') {
  const cleaned = String(text).replace(/[^\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/gu, '');
  if (!cleaned) return [];
  if (pinyinArrayCache.has(cleaned)) return pinyinArrayCache.get(cleaned);

  let value = [];

  try {
    value = pinyin(cleaned, {
      type: 'array',
      toneType: 'symbol',
    });
  } catch (_) {
    value = [];
  }

  pinyinArrayCache.set(cleaned, value);
  return value;
}

function getCachedPinyin(text = '') {
  const key = String(text || '');
  if (!key) return '';
  if (pinyinCache.has(key)) return pinyinCache.get(key);

  let value = '';

  try {
    value = pinyin(key.replace(/[^\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/gu, ''), {
      toneType: 'symbol',
    });
  } catch (_) {
    value = '';
  }

  pinyinCache.set(key, value);
  return value;
}

function renderTextWithOptionalPinyin(text, showPinyin, textClass = 'zh-char', pyClass = 'zh-py') {
  if (!text) return null;

  const parts =
    String(text).match(/([\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+|[\u1000-\u109F\uA9E0-\uA9FF\uAA60-\uAA7F]+|[^\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u1000-\u109F\uA9E0-\uA9FF\uAA60-\uAA7F]+)/gu) || [];

  return parts.map((part, partIndex) => {
    if (/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u.test(part)) {
      const pinyinList = getPinyinArraySafe(part);

      return part.split('').map((char, charIndex) => (
        <div key={`${partIndex}-${charIndex}`} className="zh-seg">
          {showPinyin ? <span className={pyClass}>{pinyinList[charIndex] || ''}</span> : null}
          <span className={textClass}>{char}</span>
        </div>
      ));
    }

    if (/[\u1000-\u109F\uA9E0-\uA9FF\uAA60-\uAA7F]/u.test(part)) {
      return (
        <span key={partIndex} className="my-seg">
          {part}
        </span>
      );
    }

    return (
      <span key={partIndex} className="inline-seg">
        {part}
      </span>
    );
  });
}

function hashStringToSeed(input = '') {
  let h = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return h >>> 0;
}

function seededRandom(seed) {
  let t = seed + 0x6d2b79f5;

  return function next() {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeOptionId(value) {
  return String(value ?? '').trim();
}

function normalizeCorrectAnswers(raw) {
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map(normalizeOptionId).filter(Boolean);
}

function makeDeepSeekAutoPromptUrl(payload) {
  return `https://chat.deepseek.com/?auto_prompt=${encodeURIComponent(payload)}`;
}

function openUrlWithFallback(url) {
  if (typeof window === 'undefined') return;

  const opened = window.open(url, '_blank');
  if (!opened) {
    window.location.href = url;
  }
}

function buildChoiceQuestionPayloadForDeepSeek({
  questionText,
  questionImg,
  options,
  selectedIds,
  correctAnswers,
}) {
  const selectedTexts = options
    .filter((option) => selectedIds.includes(normalizeOptionId(option.id)))
    .map((option) => option.text || `选项 ${option.id}`)
    .filter(Boolean);

  const correctTexts = options
    .filter((option) => correctAnswers.includes(normalizeOptionId(option.id)))
    .map((option) => option.text || `选项 ${option.id}`)
    .filter(Boolean);

  const wrongText = selectedTexts.length ? selectedTexts.join('；') : '未选择';
  const correctText = correctTexts.length ? correctTexts.join('；') : '未知';

  const qText = [
    questionText || '',
    questionImg ? `图片：${questionImg}` : '',
    options.length
      ? `选项：${options
          .map((option) => `${normalizeOptionId(option.id)}. ${option.text || ''}`)
          .join('；')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `${qText}||${wrongText}||${correctText}`;
}

function buildSimilarQuestionGenerationPrompt({ questionText, options, correctAnswers }) {
  return [
    '你现在不是讲题，而是生成一道新的互动选择题。',
    '请根据下面原题生成一道同类型、同难度的新题。',
    '',
    '必须只输出合法 JSON，不要 Markdown，不要代码块，不要解释。',
    'JSON 必须符合这个结构：',
    CHOICE_QUESTION_SCHEMA_TEXT.trim(),
    '',
    '规则：',
    '1. options 必须是 A、B、C、D 四个选项。',
    '2. correctAnswer 必须是 A/B/C/D 之一。',
    '3. 题干和选项适合直接给 React 选择题组件渲染。',
    '4. explanation 要简短，适合作为题库解析。',
    '5. 不要复用原题原句，要生成新的题。',
    '',
    '原题：',
    questionText || '',
    '',
    '原选项：',
    options.map((option) => `${normalizeOptionId(option.id)}. ${option.text || ''}`).join('\n'),
    '',
    '原正确答案：',
    correctAnswers.join(', '),
  ].join('\n');
}

function useTimeoutManager() {
  const timeoutsRef = useRef(new Set());

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach((timer) => clearTimeout(timer));
    timeoutsRef.current.clear();
  }, []);

  const add = useCallback((fn, ms) => {
    const timer = setTimeout(() => {
      timeoutsRef.current.delete(timer);
      fn();
    }, ms);

    timeoutsRef.current.add(timer);
    return timer;
  }, []);

  useEffect(() => clearAll, [clearAll]);

  return { addTimeout: add, clearTimeouts: clearAll };
}

function useOverlayHistory() {
  const stackRef = useRef([]);

  const open = useCallback((type, setter) => {
    setter(true);

    if (typeof window === 'undefined') return;
    if (stackRef.current[stackRef.current.length - 1] === type) return;

    stackRef.current.push(type);
    window.history.pushState({ __xztOverlay: type }, '');
  }, []);

  const close = useCallback((type, setter) => {
    setter(false);
    stackRef.current = stackRef.current.filter((item) => item !== type);
  }, []);

  const closeTop = useCallback((map) => {
    const top = stackRef.current[stackRef.current.length - 1];
    if (!top) return false;

    const closer = map[top];
    if (closer) {
      closer();
      return true;
    }

    return false;
  }, []);

  const reset = useCallback(() => {
    stackRef.current = [];
  }, []);

  return {
    overlayStackRef: stackRef,
    openOverlay: open,
    closeOverlay: close,
    closeTopOverlay: closeTop,
    resetOverlayStack: reset,
  };
}

const SettingsPanel = memo(function SettingsPanel({
  prefs,
  aiSettings,
  onPrefsChange,
  onAISettingsChange,
  onClose,
}) {
  const updatePref = useCallback(
    (key, value) => {
      onPrefsChange((prev) => ({ ...prev, [key]: value }));
    },
    [onPrefsChange]
  );

  const updateAISetting = useCallback(
    (key, value) => {
      onAISettingsChange((prev) => ({ ...prev, [key]: value }));
    },
    [onAISettingsChange]
  );

  const aiMode = aiSettings?.aiMode || 'api';

  return (
    <div className="panel-modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="panel-card relative">
        <div className="panel-header">
          <span className="panel-title">学习设置</span>
          <button className="panel-close-btn" onClick={onClose} type="button">
            <FaTimes />
          </button>
        </div>

        <div className="settings-section-title" style={{ marginTop: 0 }}>
          显示与朗读
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">题干拼音</div>
            <div className="setting-desc">长句和缅语题干会自动隐藏拼音</div>
          </div>
          <div
            className="switch"
            onClick={() => updatePref('showQuestionPinyin', !prefs.showQuestionPinyin)}
            style={{ background: prefs.showQuestionPinyin ? '#58cc02' : '#cbd5e1' }}
          >
            <div
              className="switch-dot"
              style={{ left: prefs.showQuestionPinyin ? '22px' : '4px' }}
            />
          </div>
        </div>

        <div className="setting-row">
          <span className="setting-label">选项拼音</span>
          <div
            className="switch"
            onClick={() => updatePref('showOptionPinyin', !prefs.showOptionPinyin)}
            style={{ background: prefs.showOptionPinyin ? '#58cc02' : '#cbd5e1' }}
          >
            <div
              className="switch-dot"
              style={{ left: prefs.showOptionPinyin ? '22px' : '4px' }}
            />
          </div>
        </div>

        <div className="setting-row">
          <span className="setting-label">自动朗读</span>
          <div
            className="switch"
            onClick={() => updatePref('autoPlay', !prefs.autoPlay)}
            style={{ background: prefs.autoPlay ? '#58cc02' : '#cbd5e1' }}
          >
            <div className="switch-dot" style={{ left: prefs.autoPlay ? '22px' : '4px' }} />
          </div>
        </div>

        <div className="setting-row">
          <span className="setting-label">震动反馈</span>
          <div
            className="switch"
            onClick={() => updateAISetting('vibration', !aiSettings.vibration)}
            style={{ background: aiSettings.vibration ? '#58cc02' : '#cbd5e1' }}
          >
            <div className="switch-dot" style={{ left: aiSettings.vibration ? '22px' : '4px' }} />
          </div>
        </div>

        <div className="setting-row">
          <span className="setting-label">答题音效</span>
          <div
            className="switch"
            onClick={() => updateAISetting('soundFx', !aiSettings.soundFx)}
            style={{ background: aiSettings.soundFx ? '#58cc02' : '#cbd5e1' }}
          >
            <div className="switch-dot" style={{ left: aiSettings.soundFx ? '22px' : '4px' }} />
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div className="setting-label" style={{ marginBottom: 8 }}>
            题目语速
          </div>

          <div className="speed-group">
            {[
              { key: 'slow', label: '慢' },
              { key: 'normal', label: '正常' },
              { key: 'fast', label: '快' },
            ].map((item) => (
              <button
                key={item.key}
                className={`speed-btn ${prefs.ttsSpeed === item.key ? 'active' : ''}`}
                onClick={() => updatePref('ttsSpeed', item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section-title">AI 解析方式</div>

        <div className="ai-mode-group">
          <button
            className={`ai-mode-btn ${aiMode === 'api' ? 'active' : ''}`}
            onClick={() => updateAISetting('aiMode', 'api')}
            type="button"
          >
            API 内嵌
          </button>
          <button
            className={`ai-mode-btn ${aiMode === 'deepseek' ? 'active' : ''}`}
            onClick={() => updateAISetting('aiMode', 'deepseek')}
            type="button"
          >
            DeepSeek 网页
          </button>
        </div>

        <div className="setting-desc" style={{ marginTop: 8 }}>
          API 内嵌适合留在应用里直接讲题；DeepSeek 网页适合配合油猴脚本、专家模式、网页上下文。
        </div>
      </div>
    </div>
  );
});

const OptionCard = memo(function OptionCard({
  option,
  isSubmitted,
  isSelected,
  isCorrectAnswer,
  isSpeaking,
  isBouncing,
  showPinyin,
  onToggle,
}) {
  const optionId = normalizeOptionId(option.id);
  const hasImage = Boolean(option.img || option.imageUrl);

  const className = useMemo(() => {
    let cls = 'option-card';
    if (hasImage) cls += ' has-image-layout';
    if (isBouncing) cls += ' bounce-in';

    if (isSubmitted) {
      cls += ' locked';
      if (isCorrectAnswer) cls += ' correct';
      else if (isSelected) cls += ' wrong';
    } else if (isSpeaking) {
      cls += ' playing';
    } else if (isSelected) {
      cls += ' selected';
    }

    return cls;
  }, [hasImage, isBouncing, isCorrectAnswer, isSelected, isSpeaking, isSubmitted]);

  const optionPinyin = useMemo(() => {
    if (!showPinyin || !containsChinese(option.text)) return '';
    return getCachedPinyin(option.text);
  }, [option.text, showPinyin]);

  return (
    <button className={className} onClick={() => onToggle(optionId)} type="button">
      {isSpeaking ? (
        <FaSpinner className="absolute top-3 right-3 text-blue-500 animate-spin" />
      ) : null}

      {hasImage ? (
        <img
          src={option.img || option.imageUrl}
          alt="option"
          className="h-24 w-full object-cover rounded-xl mb-2"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : null}

      <div className="option-text-wrap">
        {optionPinyin ? <div className="option-py">{optionPinyin}</div> : null}
        <span className="option-text">{option.text}</span>
      </div>
    </button>
  );
});

export default function XuanZeTi({
  data: rawData,
  onCorrect,
  onWrong,
  onNext,
  onOverlayChange,
}) {
  const data = rawData?.content || rawData || {};
  const question = data.question || {};
  const questionObj = typeof question === 'object' && question !== null ? question : {};
  const questionText = typeof question === 'string' ? question : questionObj.text || '';
  const questionImg = data.imageUrl || questionObj.imageUrl || questionObj.img || '';
  const options = useMemo(() => (Array.isArray(data.options) ? data.options : []), [data.options]);

  const correctAnswers = useMemo(() => normalizeCorrectAnswers(data.correctAnswer), [data.correctAnswer]);

  const optionSignature = useMemo(
    () => options.map((opt) => `${normalizeOptionId(opt.id)}:${opt.text || ''}`).join('|'),
    [options]
  );

  const optionShuffleKey = useMemo(
    () => `${data?.id || questionText || 'question'}__${optionSignature}`,
    [data?.id, questionText, optionSignature]
  );

  const shuffledOptions = useMemo(() => {
    const nextOptions = [...options];
    const random = seededRandom(hashStringToSeed(optionShuffleKey));

    for (let i = nextOptions.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [nextOptions[i], nextOptions[j]] = [nextOptions[j], nextOptions[i]];
    }

    return nextOptions;
  }, [options, optionShuffleKey]);

  const hasOptionImages = useMemo(
    () => shuffledOptions.some((opt) => opt.img || opt.imageUrl),
    [shuffledOptions]
  );

  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [isQuestionPlaying, setIsQuestionPlaying] = useState(false);
  const [speakingOptionId, setSpeakingOptionId] = useState(null);
  const [showResultSheet, setShowResultSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cardPopId, setCardPopId] = useState(null);
  const [questionImgVisible, setQuestionImgVisible] = useState(Boolean(questionImg));
  const [showAIExplanation, setShowAIExplanation] = useState(false);

  const [prefs, setPrefs] = useState(() => getMergedPrefs());
  const [aiSettings, setAISettings] = useState(() => getMergedAISettings());

  const audioControllerRef = useRef(new AudioPlaybackController());
  const mountedRef = useRef(false);
  const aiSettingsRef = useRef(aiSettings);
  const currentRateRef = useRef(0);
  const autoPlayRef = useRef(prefs.autoPlay);

  const { addTimeout, clearTimeouts } = useTimeoutManager();
  const { openOverlay, closeOverlay, closeTopOverlay, resetOverlayStack } = useOverlayHistory();

  const hasOverlayOpen = showAIExplanation || showSettings;
  const aiMode = aiSettings?.aiMode || 'api';

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      audioControllerRef.current.stop();
      clearTimeouts();
      resetOverlayStack();
    };
  }, [clearTimeouts, resetOverlayStack]);

  useEffect(() => {
    onOverlayChange?.(hasOverlayOpen);

    return () => {
      onOverlayChange?.(false);
    };
  }, [hasOverlayOpen, onOverlayChange]);

  useEffect(() => {
    saveInteractivePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    saveInteractiveAISettings(aiSettings);
  }, [aiSettings]);

  useEffect(() => {
    setQuestionImgVisible(Boolean(questionImg));
  }, [questionImg]);

  const currentRate = useMemo(() => speedLabelToRate(prefs.ttsSpeed), [prefs.ttsSpeed]);

  useEffect(() => {
    aiSettingsRef.current = aiSettings;
  }, [aiSettings]);

  useEffect(() => {
    currentRateRef.current = currentRate;
  }, [currentRate]);

  useEffect(() => {
    autoPlayRef.current = prefs.autoPlay;
  }, [prefs.autoPlay]);

  const hasMyanmar = useMemo(() => /[\u1000-\u109F\uA9E0-\uA9FF\uAA60-\uAA7F]/u.test(questionText), [questionText]);
  const questionLength = String(questionText || '').trim().length;
  const isLongQuestion = questionLength > 24;
  const isVeryLongQuestion = questionLength > 40;
  const shouldHideQuestionPinyin = hasMyanmar || isLongQuestion;

  const questionTextClass = useMemo(
    () =>
      [
        'bubble-text',
        hasMyanmar ? 'is-myanmar' : '',
        isLongQuestion ? 'is-long' : '',
        isVeryLongQuestion ? 'is-very-long' : '',
      ]
        .filter(Boolean)
        .join(' '),
    [hasMyanmar, isLongQuestion, isVeryLongQuestion]
  );

  const stopAllAudio = useCallback(() => {
    audioControllerRef.current.stop();
    setIsQuestionPlaying(false);
    setSpeakingOptionId(null);
  }, []);

  const feedbackTap = useCallback(() => {
    if (aiSettings.vibration) vibrate(15);
    if (aiSettings.soundFx) playBeep('tap');
  }, [aiSettings.soundFx, aiSettings.vibration]);

  const feedbackCorrect = useCallback(() => {
    if (aiSettings.vibration) vibrate([30, 40, 30]);
    if (aiSettings.soundFx) playBeep('correct');
  }, [aiSettings.soundFx, aiSettings.vibration]);

  const feedbackWrong = useCallback(() => {
    if (aiSettings.vibration) vibrate([50, 40, 60]);
    if (aiSettings.soundFx) playBeep('wrong');
  }, [aiSettings.soundFx, aiSettings.vibration]);

  const playQuestion = useCallback(() => {
    if (!questionText) return;

    setSpeakingOptionId(null);
    audioControllerRef.current.playMixed(
      questionText,
      { rate: currentRate, aiSettings },
      () => mountedRef.current && setIsQuestionPlaying(true),
      () => mountedRef.current && setIsQuestionPlaying(false)
    );
  }, [aiSettings, currentRate, questionText]);

  const playOptionText = useCallback(
    (optionId, optionText) => {
      if (!optionText) return;

      setIsQuestionPlaying(false);
      audioControllerRef.current.playMixed(
        optionText,
        { rate: currentRate, aiSettings },
        () => mountedRef.current && setSpeakingOptionId(optionId),
        () => mountedRef.current && setSpeakingOptionId(null)
      );
    },
    [aiSettings, currentRate]
  );

  useEffect(() => {
    clearTimeouts();
    stopAllAudio();

    setSelectedIds([]);
    setIsSubmitted(false);
    setIsRight(false);
    setShowResultSheet(false);
    setShowSettings(false);
    setCardPopId(null);
    setShowAIExplanation(false);
    resetOverlayStack();

    if (questionText && autoPlayRef.current) {
      addTimeout(() => {
        audioControllerRef.current.playMixed(
          questionText,
          { rate: currentRateRef.current, aiSettings: aiSettingsRef.current },
          () => mountedRef.current && setIsQuestionPlaying(true),
          () => mountedRef.current && setIsQuestionPlaying(false)
        );
      }, 260);
    }
  }, [
    addTimeout,
    clearTimeouts,
    optionShuffleKey,
    questionText,
    resetOverlayStack,
    stopAllAudio,
  ]);

  const closeSettings = useCallback(() => {
    closeOverlay('settings', setShowSettings);
  }, [closeOverlay]);

  const closeAIExplanation = useCallback(() => {
    closeOverlay('ai-explanation', setShowAIExplanation);
  }, [closeOverlay]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onPopState = () => {
      closeTopOverlay({
        settings: closeSettings,
        'ai-explanation': closeAIExplanation,
      });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [closeAIExplanation, closeSettings, closeTopOverlay]);

  const toggleOption = useCallback(
    (optionId) => {
      if (isSubmitted) return;

      feedbackTap();

      if (correctAnswers.length === 1) {
        setSelectedIds([optionId]);
      } else {
        setSelectedIds((prev) =>
          prev.includes(optionId) ? prev.filter((item) => item !== optionId) : [...prev, optionId]
        );
      }

      setCardPopId(optionId);

      addTimeout(() => {
        if (mountedRef.current) {
          setCardPopId((prev) => (prev === optionId ? null : prev));
        }
      }, 180);

      const option = shuffledOptions.find((item) => normalizeOptionId(item.id) === optionId);
      if (option?.text) {
        playOptionText(optionId, option.text);
      }
    },
    [
      addTimeout,
      correctAnswers.length,
      feedbackTap,
      isSubmitted,
      playOptionText,
      shuffledOptions,
    ]
  );

  const handleSubmit = useCallback(() => {
    if (!selectedIds.length || isSubmitted) return;

    const correct =
      selectedIds.length === correctAnswers.length &&
      selectedIds.every((id) => correctAnswers.includes(id));

    setIsRight(correct);
    setIsSubmitted(true);
    stopAllAudio();

    if (correct) {
      feedbackCorrect();
      onCorrect?.();
    } else {
      feedbackWrong();
      onWrong?.();
    }

    setShowResultSheet(true);
  }, [
    correctAnswers,
    feedbackCorrect,
    feedbackWrong,
    isSubmitted,
    onCorrect,
    onWrong,
    selectedIds,
    stopAllAudio,
  ]);

  const handleOpenSettings = useCallback(() => {
    if (showAIExplanation) return;
    openOverlay('settings', setShowSettings);
  }, [openOverlay, showAIExplanation]);

  const explanationPayload = useMemo(
    () => ({
      questionType: 'choice',
      questionText,
      questionImage: questionImg || '',
      options: shuffledOptions.map((option) => ({
        id: normalizeOptionId(option.id),
        text: option.text,
        imageUrl: option.img || option.imageUrl || '',
      })),
      selectedIds: selectedIds.map(String),
      correctAnswers: correctAnswers.map(String),
      isRight,
      extraContext: {
        multiSelect: correctAnswers.length > 1,
      },
    }),
    [correctAnswers, isRight, questionImg, questionText, selectedIds, shuffledOptions]
  );

  const handleOpenDeepSeekWeb = useCallback(() => {
    stopAllAudio();

    const payload = buildChoiceQuestionPayloadForDeepSeek({
      questionText,
      questionImg,
      options: shuffledOptions,
      selectedIds,
      correctAnswers,
    });

    openUrlWithFallback(makeDeepSeekAutoPromptUrl(payload));
  }, [
    correctAnswers,
    questionImg,
    questionText,
    selectedIds,
    shuffledOptions,
    stopAllAudio,
  ]);

  const handleGenerateSimilarQuestion = useCallback(() => {
    stopAllAudio();

    const generationPrompt = buildSimilarQuestionGenerationPrompt({
      questionText,
      options: shuffledOptions,
      correctAnswers,
    });

    const payload = `${generationPrompt}||生成同类互动选择题||只输出组件可用 JSON`;
    openUrlWithFallback(makeDeepSeekAutoPromptUrl(payload));
  }, [correctAnswers, questionText, shuffledOptions, stopAllAudio]);

  const handleOpenAIExplanation = useCallback(() => {
    stopAllAudio();
    setShowSettings(false);

    if (aiMode === 'deepseek') {
      handleOpenDeepSeekWeb();
      return;
    }

    openOverlay('ai-explanation', setShowAIExplanation);
  }, [aiMode, handleOpenDeepSeekWeb, openOverlay, stopAllAudio]);

  const updateAISettings = useCallback((patch) => {
    setAISettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <div className={`xzt-container ${hasOverlayOpen ? 'ai-open' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />

      <div className="xzt-header">
        <div className="w-full relative">
          <div className="top-hint-row">
            <div className="top-left-text">请选择正确答案</div>

            <div className="top-actions">
              <button className="settings-btn" onClick={handleOpenSettings} type="button">
                <FaCog size={18} />
              </button>
            </div>
          </div>

          <div className="scene-wrapper">
            <img
              src={TEACHER_IMAGE_URL}
              className="teacher-img"
              alt="Teacher"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />

            <div className="question-zone">
              <div className="bubble-container">
                <div className="bubble-tail" />

                {questionText ? (
                  <button
                    className={`bubble-audio-btn ${isQuestionPlaying ? 'playing' : ''}`}
                    onClick={playQuestion}
                    aria-label="播放题干"
                    type="button"
                  >
                    {isQuestionPlaying ? (
                      <FaSpinner className="animate-spin" size={12} />
                    ) : (
                      <FaVolumeUp size={12} />
                    )}
                  </button>
                ) : null}

                <div className={questionTextClass}>
                  {renderTextWithOptionalPinyin(
                    questionText,
                    prefs.showQuestionPinyin && !shouldHideQuestionPinyin,
                    'zh-char',
                    'zh-py'
                  )}
                </div>
              </div>

              {questionImg && questionImgVisible ? (
                <img
                  src={questionImg}
                  alt="question"
                  className="question-image"
                  onError={() => setQuestionImgVisible(false)}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="xzt-scroll-area">
        <div className={`options-grid ${hasOptionImages ? 'has-images' : ''}`}>
          {shuffledOptions.map((option) => {
            const optionId = normalizeOptionId(option.id);

            return (
              <OptionCard
                key={optionId}
                option={option}
                isSubmitted={isSubmitted}
                isSelected={selectedIds.includes(optionId)}
                isCorrectAnswer={correctAnswers.includes(optionId)}
                isSpeaking={speakingOptionId === optionId}
                isBouncing={cardPopId === optionId}
                showPinyin={prefs.showOptionPinyin}
                onToggle={toggleOption}
              />
            );
          })}
        </div>
      </div>

      {!isSubmitted ? (
        <div className="submit-bar">
          <button
            className="submit-btn"
            disabled={!selectedIds.length}
            onClick={handleSubmit}
            type="button"
          >
            检查答案
          </button>
        </div>
      ) : null}

      <div
        className={`result-sheet ${showResultSheet ? 'show' : ''} ${
          isRight ? 'correct' : 'wrong'
        }`}
      >
        <div className="sheet-header">
          {isRight ? <FaCheck /> : <FaTimes />}
          <span>{isRight ? '答对了！' : '再试试看'}</span>
        </div>

        <div className="sheet-sub">
          {isRight ? '太棒了，也可以看看为什么对。' : '你已经很接近正确答案了。'}
        </div>

        <div className="result-actions">
          <button className="ai-btn" onClick={handleOpenAIExplanation} type="button">
            <FaRobot /> {aiMode === 'deepseek' ? 'DeepSeek 解析' : isRight ? '为什么对？' : 'AI 解析'}
          </button>

          <button className="ai-btn secondary" onClick={handleGenerateSimilarQuestion} type="button">
            <FaRobot /> DeepSeek 出同类题
          </button>
        </div>

        <button
          className={`next-btn ${isRight ? 'btn-correct' : 'btn-wrong'}`}
          onClick={() => {
            stopAllAudio();
            onNext?.();
          }}
          type="button"
        >
          继续 <FaArrowRight />
        </button>
      </div>

      {showSettings ? (
        <SettingsPanel
          prefs={prefs}
          aiSettings={aiSettings}
          onPrefsChange={setPrefs}
          onAISettingsChange={setAISettings}
          onClose={closeSettings}
        />
      ) : null}

      <InteractiveAIExplanationPanel
        open={showAIExplanation}
        onClose={closeAIExplanation}
        settings={aiSettings}
        updateSettings={updateAISettings}
        title="AI 讲题老师"
        initialPayload={explanationPayload}
      />
    </div>
  );
}
