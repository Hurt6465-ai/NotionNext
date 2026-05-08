// components/WordCard.js

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { animated, useTransition } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import {
  FaCog, FaHeart, FaHome, FaMagic, FaMicrophone, FaPenFancy, FaPlayCircle,
  FaRandom, FaRedo, FaRegHeart, FaSave, FaSortAmountDown, FaStop,
  FaTimesCircle, FaVolumeUp, FaChevronDown, FaChevronUp,
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';

const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';
const SETTINGS_KEY = 'learningWordCardSettings';
const PROGRESS_PREFIX = 'word_progress_';
const HINT_KEY = 'word_card_gesture_hint_seen_v3';
const STYLE_ID = 'word-card-styles-v3';
const TTS_API = 'https://libretts.is-an.org/api/tts';
const AUDIO_BASE = 'https://audio.886.best/chinese-vocab-audio';

const DEFAULT_SETTINGS = {
  order: 'sequential',
  autoPlayChinese: true,
  autoPlayBurmese: true,
  autoPlayExample: true,
  autoBrowse: false,
  autoBrowseDelay: 6000,
  voiceChinese: 'zh-CN-XiaoyouNeural',
  voiceBurmese: 'my-MM-NilarNeural',
  speechRateChinese: -60,
  speechRateBurmese: -60,
  backgroundImage: '',
  showPinyin: true,
  showBurmese: true,
  showExplanation: true,
  showExamples: true,
  useDedicatedSpellAudio: true,
  ttsFallback: true,
};

const CHINESE_VOICES = [
  ['zh-CN-XiaoyouNeural', '晓悠 · 女孩'],
  ['zh-CN-XiaoxiaoNeural', '晓晓 · 女声'],
  ['zh-CN-XiaoyiNeural', '晓伊 · 女声'],
  ['zh-CN-XiaohanNeural', '晓涵 · 女声'],
  ['zh-CN-XiaomengNeural', '晓梦 · 女声'],
  ['zh-CN-XiaomoNeural', '晓墨 · 女声'],
  ['zh-CN-XiaoruiNeural', '晓睿 · 女声'],
  ['zh-CN-XiaoshuangNeural', '晓双 · 儿童'],
  ['zh-CN-YunxiNeural', '云希 · 男声'],
  ['zh-CN-YunjianNeural', '云健 · 男声'],
  ['zh-CN-YunyangNeural', '云扬 · 男声'],
  ['zh-CN-YunfengNeural', '云枫 · 男声'],
  ['zh-CN-YunhaoNeural', '云皓 · 男声'],
  ['zh-CN-YunxiaNeural', '云夏 · 男孩'],
].map(([value, label]) => ({ value, label }));

const BURMESE_VOICES = [
  ['my-MM-NilarNeural', 'Nilar · ဗမာ အမျိုးသမီး'],
  ['my-MM-ThihaNeural', 'Thiha · ဗမာ အမျိုးသား'],
].map(([value, label]) => ({ value, label }));

const safeLocalStorage = {
  get(key) {
    try { return typeof window === 'undefined' ? null : localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { if (typeof window !== 'undefined') localStorage.setItem(key, value); } catch {}
  },
};

function getPinyinText(text) {
  if (!text) return '';
  try {
    return pinyinConverter(text, { toneType: 'symbol', separator: ' ', v: true }).replace(/·/g, ' ');
  } catch {
    return text;
  }
}

function onlyHan(text) {
  const m = String(text || '').match(/[\u4e00-\u9fff]/g);
  return m ? m.join('') : '';
}

function clamp(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function shuffleArray(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getWordId(word, index) {
  return word?.id ?? `${word?.chinese || word?.word || 'word'}-${index}`;
}

function getRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.innerHTML = `
    html.word-card-open, html.word-card-open body {
      overflow: hidden !important;
      overscroll-behavior: none !important;
      overscroll-behavior-y: none !important;
      touch-action: none !important;
      height: 100% !important;
    }
    .word-card-no-select, .word-card-no-select * {
      -webkit-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    .word-card-scroll::-webkit-scrollbar { width: 0; height: 0; }
    @keyframes wcFadeIn { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
    @keyframes wcWave { 0%,100% { height: 8px; } 50% { height: 24px; } }
    @keyframes wcRipple { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,.42); } 70% { box-shadow: 0 0 0 20px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
    @keyframes wcHint { 0%,100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -5px); } }
  `;
  document.head.appendChild(style);
}

function setLock(enabled) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('word-card-open', enabled);
  document.body.classList.toggle('word-card-no-select', enabled);
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error || new Error('DB error'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
  });
}

function waitTx(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Transaction error'));
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

async function isFavorite(id) {
  if (!id) return false;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    const ok = await new Promise((resolve) => { req.onsuccess = () => resolve(!!req.result); req.onerror = () => resolve(false); });
    db.close();
    return ok;
  } catch { return false; }
}

async function toggleFavorite(word) {
  if (!word?.id) return false;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const existed = await new Promise((resolve) => {
      const req = store.get(word.id);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
    if (existed) store.delete(word.id);
    else store.put({ ...word, favoritedAt: Date.now() });
    await waitTx(tx);
    db.close();
    return !existed;
  } catch { return false; }
}

let activeHowl = null;
let activeObjectUrl = null;
let soundEffects = null;
let audioPlayId = 0;
let spellSequenceId = 0;

function finishOnce(cb) {
  let done = false;
  return (...args) => {
    if (done) return;
    done = true;
    if (typeof cb === 'function') cb(...args);
  };
}

function revokeObjectUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function stopHowl() {
  if (activeHowl) {
    try { activeHowl.stop(); activeHowl.unload(); } catch {}
    activeHowl = null;
  }
  revokeObjectUrl();
}

function stopAllAudio({ cancelSpell = true, stopEffects = false } = {}) {
  audioPlayId += 1;
  if (cancelSpell) spellSequenceId += 1;
  stopHowl();
  if (stopEffects && soundEffects) Object.values(soundEffects).forEach((s) => s.stop());
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

function initSounds() {
  if (!soundEffects && typeof window !== 'undefined') {
    soundEffects = { switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.42, html5: true }) };
  }
}

function playSoundEffect(type) {
  if (typeof window === 'undefined') return;
  initSounds();
  soundEffects?.[type]?.play();
}

function systemRate(rate) {
  const r = Number.isFinite(Number(rate)) ? Number(rate) : -60;
  return r >= 0 ? Math.min(1.8, 1 + r / 100) : Math.max(0.55, 1 + r / 200);
}

function voiceLang(voice) {
  return voice?.startsWith('my-MM') ? 'my-MM' : 'zh-CN';
}

async function playTTS(text, voice, rate, onEnd, event, { cancelSpell = true, stopBeforePlay = true, fallbackToSystem = true } = {}) {
  event?.stopPropagation?.();
  const done = finishOnce(onEnd);
  if (stopBeforePlay) stopAllAudio({ cancelSpell });
  if (!text || !voice) return done(false);

  const current = audioPlayId;
  try {
    const res = await fetch(TTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate: Math.round((Number(rate) || 0) / 2), pitch: 0 }),
    });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    const blob = await res.blob();
    if (current !== audioPlayId) return done(false);
    activeObjectUrl = URL.createObjectURL(blob);
    activeHowl = new Howl({
      src: [activeObjectUrl],
      format: ['mp3', 'mpeg'],
      html5: true,
      onend: () => { revokeObjectUrl(); done(true); },
      onloaderror: () => { revokeObjectUrl(); done(false); },
      onplayerror: () => { revokeObjectUrl(); done(false); },
    });
    activeHowl.play();
  } catch (e) {
    if (fallbackToSystem && typeof window !== 'undefined' && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voiceLang(voice);
      u.rate = systemRate(rate);
      u.onend = () => done(true);
      u.onerror = () => done(false);
      window.speechSynthesis.speak(u);
    } else done(false);
  }
}

function playUrl(url, onEnd, { cancelSpell = true, stopBeforePlay = true } = {}) {
  const done = finishOnce(onEnd);
  if (stopBeforePlay) stopAllAudio({ cancelSpell });
  if (!url) return done(false);
  activeHowl = new Howl({
    src: [url],
    html5: true,
    onend: () => done(true),
    onloaderror: () => done(false),
    onplayerror: () => done(false),
  });
  activeHowl.play();
}

function tryPlayUrl(url) {
  return new Promise((resolve) => {
    stopAllAudio({ cancelSpell: false });
    const done = finishOnce((ok) => resolve(ok));
    activeHowl = new Howl({
      src: [url],
      html5: true,
      onend: () => done(true),
      onloaderror: () => done(false),
      onplayerror: () => done(false),
    });
    activeHowl.play();
  });
}

function padAudioId(word) {
  return word?.id ? String(word.id).padStart(4, '0') : '';
}

function wordAudioUrl(word, level) {
  const hsk = word?.hsk_level || level;
  const id = padAudioId(word);
  return hsk && id ? `${AUDIO_BASE}/hsk${hsk}/${id}.mp3` : '';
}

function spellAudioCandidates(word, level) {
  const hsk = word?.hsk_level || level;
  const id = padAudioId(word);
  if (!hsk || !id) return [];
  return [
    `${AUDIO_BASE}/spell/hsk${hsk}/${id}.mp3`,
    `${AUDIO_BASE}/spelling/hsk${hsk}/${id}.mp3`,
    `${AUDIO_BASE}/hsk${hsk}/spell/${id}.mp3`,
    `${AUDIO_BASE}/hsk${hsk}/${id}-spell.mp3`,
    `${AUDIO_BASE}/hsk${hsk}/${id}_spell.mp3`,
  ];
}

function playR2Audio(word, onEnd, settings, level, { cancelSpell = true } = {}) {
  const done = finishOnce(onEnd);
  const url = wordAudioUrl(word, level);
  if (!url) {
    playTTS(word?.audioText || word?.chinese, settings.voiceChinese, settings.speechRateChinese, done, null, {
      cancelSpell,
      fallbackToSystem: settings.ttsFallback,
    });
    return;
  }
  playUrl(url, (ok) => {
    if (ok) return done(true);
    playTTS(word?.audioText || word?.chinese, settings.voiceChinese, settings.speechRateChinese, done, null, {
      cancelSpell,
      fallbackToSystem: settings.ttsFallback,
    });
  }, { cancelSpell });
}

async function playSpellAudio(word, settings, level, onEnd) {
  const done = finishOnce(onEnd);
  stopAllAudio({ cancelSpell: true });
  const current = ++spellSequenceId;

  if (settings.useDedicatedSpellAudio) {
    for (const url of spellAudioCandidates(word, level)) {
      if (spellSequenceId !== current) return;
      const ok = await tryPlayUrl(url);
      if (ok) return done(true);
    }
  }

  if (spellSequenceId !== current) return;
  const url = wordAudioUrl(word, level);
  if (url) return playUrl(url, done, { cancelSpell: false });

  playTTS(word?.audioText || word?.chinese, settings.voiceChinese, settings.speechRateChinese, done, null, {
    cancelSpell: false,
    fallbackToSystem: false,
  });
}

function useCardSettings() {
  const [settings, setSettings] = useState(() => {
    const saved = safeLocalStorage.get(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }; } catch { return DEFAULT_SETTINGS; }
  });
  useEffect(() => { safeLocalStorage.set(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  return [settings, setSettings];
}

const StrokeOrderModal = memo(({ word, settings, onClose }) => {
  const chars = useMemo(() => [...String(word || '')].filter((c) => c.trim()), [word]);
  const [ready, setReady] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [speak, setSpeak] = useState(true);
  const [showPinyin, setShowPinyin] = useState(true);
  const [error, setError] = useState('');
  const writers = useRef([]);
  const boxes = useRef([]);

  useEffect(() => {
    let alive = true;
    writers.current = [];
    setReady(false);
    setError('');
    import('hanzi-writer')
      .then((mod) => {
        if (!alive) return;
        const HanziWriter = mod.default || mod;
        chars.forEach((char, i) => {
          const box = boxes.current[i];
          if (!box) return;
          box.innerHTML = '';
          writers.current[i] = HanziWriter.create(box, char, {
            width: 132,
            height: 132,
            padding: 8,
            showOutline: true,
            showCharacter: false,
            strokeAnimationSpeed: speed,
            delayBetweenStrokes: 160,
            radicalColor: '#2563eb',
            strokeColor: '#334155',
            outlineColor: '#e5e7eb',
            drawingColor: '#2563eb',
          });
        });
        setReady(true);
      })
      .catch(() => setError('未检测到 hanzi-writer，已显示大字 fallback。'));
    return () => { alive = false; stopAllAudio(); };
  }, [chars, speed]);

  const speakChar = useCallback((char) => new Promise((resolve) => {
    if (!speak) return resolve();
    playTTS(char, settings.voiceChinese, settings.speechRateChinese, resolve, null, { fallbackToSystem: false });
  }), [settings.speechRateChinese, settings.voiceChinese, speak]);

  const replay = useCallback(async () => {
    stopAllAudio();
    for (let i = 0; i < chars.length; i += 1) {
      await speakChar(chars[i]);
      if (writers.current[i]) await new Promise((r) => writers.current[i].animateCharacter({ onComplete: r }));
    }
  }, [chars, speakChar]);

  const clear = () => { stopAllAudio(); writers.current.forEach((w) => w?.hideCharacter?.()); };
  const quiz = () => { stopAllAudio(); writers.current.forEach((w) => w?.quiz?.()); };

  return (
    <div style={styles.modalMask} data-no-gesture="true" onClick={onClose} role="presentation">
      <div style={styles.strokePanel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={styles.strokeTitle}>汉字笔顺：{word}</div>
        {showPinyin && <div style={styles.strokePinyin}>{getPinyinText(word)}</div>}
        <div style={styles.strokeOptions}>
          <button type="button" style={{ ...styles.smallPill, ...(speak ? styles.smallPillActive : {}) }} onClick={() => setSpeak((v) => !v)}>逐字发音：{speak ? '开' : '关'}</button>
          <button type="button" style={{ ...styles.smallPill, ...(showPinyin ? styles.smallPillActive : {}) }} onClick={() => setShowPinyin((v) => !v)}>拼音：{showPinyin ? '显示' : '隐藏'}</button>
        </div>
        <div style={styles.strokeSpeedRow}><span>速度</span><input type="range" min="0.4" max="2" step="0.1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /><strong>{speed.toFixed(1)}x</strong></div>
        {error && <div style={styles.strokeError}>{error}</div>}
        <div style={styles.strokeGrid}>
          {chars.map((char, i) => (
            <div style={styles.strokeCell} key={`${char}-${i}`}>
              <div ref={(node) => { boxes.current[i] = node; }} style={styles.strokeWriterBox}>{!ready && <span style={styles.strokeFallbackChar}>{char}</span>}</div>
            </div>
          ))}
        </div>
        <div style={styles.strokeActions}>
          <button type="button" style={styles.strokeActionButton} onClick={replay}>重播全部</button>
          <button type="button" style={styles.strokeActionButton} onClick={clear}>清屏重练</button>
          <button type="button" style={{ ...styles.strokeActionButton, ...styles.primaryButton }} onClick={quiz}>开始描红</button>
        </div>
        <button type="button" style={styles.strokeCloseButton} onClick={onClose}>关闭</button>
      </div>
    </div>
  );
});
StrokeOrderModal.displayName = 'StrokeOrderModal';

const PronunciationComparison = memo(({ word, pinyinText, settings, level, onClose }) => {
  const [status, setStatus] = useState('idle');
  const [url, setUrl] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [recognitionNote, setRecognitionNote] = useState('');
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const localHowl = useRef(null);
  const urlRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    localHowl.current?.unload?.();
    recognitionRef.current?.stop?.();
    stopAllAudio();
  }, []);

  const startRecognition = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) { setRecognitionNote('当前浏览器不支持实时语音识别，不影响录音。'); return; }
    try {
      const r = new Recognition();
      r.lang = 'zh-CN';
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 3;
      r.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const t = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) finalText += t;
          else interimText += t;
        }
        if (finalText) setTranscript((prev) => `${prev}${finalText}`);
        setInterim(interimText);
      };
      r.onerror = () => setRecognitionNote('语音识别被浏览器中断，不影响录音回放。');
      recognitionRef.current = r;
      r.start();
      setRecognitionNote('正在同时录音和识别。');
    } catch { setRecognitionNote('语音识别启动失败，不影响录音。'); }
  };

  const stopRecognition = () => { try { recognitionRef.current?.stop?.(); } catch {} };

  const startRecording = async () => {
    stopAllAudio();
    setError(''); setTranscript(''); setInterim(''); setRecognitionNote('');
    if (!(navigator?.mediaDevices?.getUserMedia) || typeof MediaRecorder === 'undefined') {
      setError('您的浏览器暂不支持录音功能。'); return;
    }
    try {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = getRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stopRecognition();
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const nextUrl = URL.createObjectURL(blob);
        urlRef.current = nextUrl;
        stream.getTracks().forEach((t) => t.stop());
        setUrl(nextUrl);
        setStatus('review');
      };
      recorderRef.current = recorder;
      recorder.start(250);
      startRecognition();
      setStatus('recording');
    } catch { setError('无法访问麦克风，请检查权限。'); }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    stopRecognition();
  };

  const reset = () => {
    localHowl.current?.unload?.();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null); setPlaying(null); setStatus('idle'); setError(''); setTranscript(''); setInterim(''); setRecognitionNote('');
  };

  const playStandard = () => { localHowl.current?.stop?.(); setPlaying('standard'); playR2Audio(word, () => setPlaying(null), settings, level); };
  const playUser = () => {
    if (!url) return;
    stopAllAudio(); setPlaying('user'); localHowl.current?.unload?.();
    localHowl.current = new Howl({ src: [url], html5: true, onend: () => setPlaying(null), onloaderror: () => setPlaying(null), onplayerror: () => setPlaying(null) });
    localHowl.current.play();
  };

  const recognized = `${transcript}${interim}`.trim();
  const hit = onlyHan(recognized) && onlyHan(word?.chinese) ? (onlyHan(recognized).includes(onlyHan(word.chinese)) || onlyHan(word.chinese).includes(onlyHan(recognized))) : false;

  return (
    <div style={styles.modalMask} data-no-gesture="true" onClick={onClose} role="presentation">
      <div style={styles.recordPanel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={styles.recordHeader}><h3 style={styles.recordTitle}>发音跟读对比</h3><button type="button" style={styles.textCloseButton} onClick={onClose}>关闭</button></div>
        <div style={styles.recordBody}>
          <div style={styles.recordWord}><div style={styles.modalPinyin}>{pinyinText}</div><div style={styles.modalChinese}>{word?.chinese}</div></div>
          {status === 'idle' && <div style={styles.recordCenter}><button type="button" style={styles.bigRecordBtn} onClick={startRecording}><FaMicrophone size={32} /></button><div style={styles.instruction}>点击开始录音，并同步语音识别</div>{error && <div style={styles.errorText}>{error}</div>}</div>}
          {status === 'recording' && <div style={styles.recordCenter}><div style={styles.waveBox}><i style={styles.waveBar} /><i style={{ ...styles.waveBar, animationDelay: '.2s' }} /><i style={{ ...styles.waveBar, animationDelay: '.4s' }} /><i style={{ ...styles.waveBar, animationDelay: '.1s' }} /></div><button type="button" style={{ ...styles.bigRecordBtn, ...styles.recordingPulse }} onClick={stopRecording}><FaStop size={32} /></button><div style={{ ...styles.instruction, color: '#ef4444' }}>录音中...点击停止</div>{(recognized || recognitionNote) && <div style={styles.recognitionBox}><b>识别：</b>{recognized || recognitionNote}</div>}</div>}
          {status === 'review' && <div style={styles.reviewBox}><div style={styles.reviewRow}><button type="button" style={{ ...styles.reviewCard, border: playing === 'standard' ? '2px solid #3b82f6' : '1px solid #e5e7eb' }} onClick={playStandard}><span style={{ ...styles.iconCircle, background: playing === 'standard' ? '#3b82f6' : '#f3f4f6', color: playing === 'standard' ? '#fff' : '#64748b' }}><FaVolumeUp /></span><b>标准音频</b></button><button type="button" style={{ ...styles.reviewCard, border: playing === 'user' ? '2px solid #10b981' : '1px solid #e5e7eb' }} onClick={playUser}><span style={{ ...styles.iconCircle, background: playing === 'user' ? '#10b981' : '#f3f4f6', color: playing === 'user' ? '#fff' : '#64748b' }}><FaPlayCircle /></span><b>我的发音</b></button></div>{(recognized || recognitionNote) && <div style={{ ...styles.recognitionBox, ...(hit ? styles.recognitionGood : {}) }}><b>识别结果：</b>{recognized || recognitionNote}{hit ? ' · 命中' : ''}</div>}<button type="button" style={styles.retryButton} onClick={reset}><FaRedo size={14} /> 重新录音</button></div>}
        </div>
      </div>
    </div>
  );
});
PronunciationComparison.displayName = 'PronunciationComparison';

const Toggle = memo(({ checked, onChange, label, desc }) => (
  <label style={styles.switchLabel}>
    <span>{label}{desc && <small style={styles.switchDesc}>{desc}</small>}</span>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={styles.hidden} />
    <span style={{ ...styles.switchTrack, background: checked ? '#3b82f6' : '#d1d5db' }}><span style={{ ...styles.switchThumb, transform: checked ? 'translateX(22px)' : 'translateX(0)' }} /></span>
  </label>
));
Toggle.displayName = 'Toggle';

const SettingsPanel = memo(({ settings, onSave, onCancel }) => {
  const [draft, setDraft] = useState(settings);
  const fileRef = useRef(null);
  const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));
  const upload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => set('backgroundImage', ev.target.result || '');
    reader.readAsDataURL(file);
  };
  return (
    <div style={styles.modalMask} data-no-gesture="true" onClick={onCancel} role="presentation">
      <div style={styles.settingsPanel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 style={styles.settingsTitle}>设置</h2>
        <div style={styles.settingGroup}><label style={styles.settingLabel}>顺序</label><div style={styles.segment}><button type="button" onClick={() => set('order', 'sequential')} style={{ ...styles.segmentBtn, ...(draft.order === 'sequential' ? styles.segmentActive : {}) }}><FaSortAmountDown /> 顺序</button><button type="button" onClick={() => set('order', 'random')} style={{ ...styles.segmentBtn, ...(draft.order === 'random' ? styles.segmentActive : {}) }}><FaRandom /> 随机</button></div></div>
        <div style={styles.settingGroup}><label style={styles.settingLabel}>显示</label><div style={styles.stack}><Toggle checked={draft.showPinyin} onChange={(v) => set('showPinyin', v)} label="中文拼音" /><Toggle checked={draft.showBurmese} onChange={(v) => set('showBurmese', v)} label="缅文释义" /><Toggle checked={draft.showExplanation} onChange={(v) => set('showExplanation', v)} label="缅文解释" /><Toggle checked={draft.showExamples} onChange={(v) => set('showExamples', v)} label="中文例句" /></div></div>
        <div style={styles.settingGroup}><label style={styles.settingLabel}>自动播放</label><div style={styles.stack}><Toggle checked={draft.autoPlayChinese} onChange={(v) => set('autoPlayChinese', v)} label="中文" /><Toggle checked={draft.autoPlayBurmese} onChange={(v) => set('autoPlayBurmese', v)} label="缅文" /><Toggle checked={draft.autoPlayExample} onChange={(v) => set('autoPlayExample', v)} label="例句" /><Toggle checked={draft.autoBrowse} onChange={(v) => set('autoBrowse', v)} label="自动切卡" /></div><div style={styles.rangeRow}><span>切卡延迟</span><input type="range" min="2500" max="15000" step="500" value={draft.autoBrowseDelay} onChange={(e) => set('autoBrowseDelay', Number(e.target.value))} /><b>{Math.round(draft.autoBrowseDelay / 1000)}s</b></div></div>
        <div style={styles.settingGroup}><label style={styles.settingLabel}>中文发音人</label><select style={styles.select} value={draft.voiceChinese} onChange={(e) => set('voiceChinese', e.target.value)}>{CHINESE_VOICES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</select><div style={styles.rangeRow}><span>中文速度</span><input type="range" min="-90" max="60" step="5" value={draft.speechRateChinese} onChange={(e) => set('speechRateChinese', Number(e.target.value))} /><b>{draft.speechRateChinese}</b></div></div>
        <div style={styles.settingGroup}><label style={styles.settingLabel}>缅文发音人</label><select style={styles.select} value={draft.voiceBurmese} onChange={(e) => set('voiceBurmese', e.target.value)}>{BURMESE_VOICES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</select><div style={styles.rangeRow}><span>缅文速度</span><input type="range" min="-90" max="60" step="5" value={draft.speechRateBurmese} onChange={(e) => set('speechRateBurmese', Number(e.target.value))} /><b>{draft.speechRateBurmese}</b></div></div>
        <div style={styles.settingGroup}><label style={styles.settingLabel}>拼读音频</label><div style={styles.stack}><Toggle checked={draft.useDedicatedSpellAudio} onChange={(v) => set('useDedicatedSpellAudio', v)} label="优先 R2 专用拼读音频" desc="找不到时回退到 R2 单词音频" /><Toggle checked={draft.ttsFallback} onChange={(v) => set('ttsFallback', v)} label="音频缺失时允许自家 TTS 兜底" /></div></div>
        <div style={styles.settingGroup}><label style={styles.settingLabel}>背景</label><div style={styles.settingBtns}><input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={upload} /><button type="button" style={styles.grayButton} onClick={() => fileRef.current?.click()}>上传图片</button><button type="button" style={styles.grayButton} onClick={() => set('backgroundImage', '')}>重置</button></div></div>
        <div style={styles.settingsFooter}><button type="button" style={styles.cancelButton} onClick={onCancel}><FaTimesCircle /> 取消</button><button type="button" style={styles.saveButton} onClick={() => onSave(draft)}><FaSave /> 保存</button></div>
      </div>
    </div>
  );
});
SettingsPanel.displayName = 'SettingsPanel';

const JumpModal = memo(({ max, current, onJump, onClose }) => {
  const [value, setValue] = useState(current + 1);
  const inputRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 80); return () => clearTimeout(t); }, []);
  const go = () => { const n = parseInt(value, 10); if (n >= 1 && n <= max) onJump(n - 1); };
  return <div style={styles.modalMask} data-no-gesture="true" onClick={onClose} role="presentation"><div style={styles.jumpPanel} onClick={(e) => e.stopPropagation()}><h3 style={{ marginTop: 0 }}>跳转到</h3><input ref={inputRef} type="number" min="1" max={max} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') onClose(); }} style={styles.jumpInput} /><button type="button" style={styles.jumpButton} onClick={go}>Go</button></div></div>;
});
JumpModal.displayName = 'JumpModal';

const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default', level }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [settings, setSettings] = useCardSettings();
  const [activeCards, setActiveCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecordingOpen, setIsRecordingOpen] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const autoTimer = useRef(null);
  const lastDirection = useRef(1);
  const isOpenRef = useRef(isOpen);

  useEffect(() => { setIsMounted(true); injectStyles(); }, []);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const getPinyin = useCallback((word) => word?.pinyin || getPinyinText(word?.chinese), []);
  const processedCards = useMemo(() => {
    const mapped = (Array.isArray(words) ? words : []).map((w, i) => ({
      id: getWordId(w, i), hsk_level: w.hsk_level, chinese: w.chinese || w.word || '', audioText: w.audioText || w.chinese || w.word || '', pinyin: w.pinyin || '', burmese: w.burmese || w.meaning || '', explanation: w.explanation || '', mnemonic: w.mnemonic || '', example: w.example || '', example2: w.example2 || '',
    })).filter((w) => w.chinese);
    return settings.order === 'random' ? shuffleArray(mapped) : mapped;
  }, [words, settings.order]);

  const currentCard = activeCards.length ? activeCards[currentIndex] : null;
  const hideHint = useCallback(() => { if (showHint) { setShowHint(false); safeLocalStorage.set(HINT_KEY, '1'); } }, [showHint]);
  const close = useCallback(() => { stopAllAudio(); setIsSettingsOpen(false); setIsRecordingOpen(false); setIsJumping(false); setWriterChar(null); setLock(false); onClose?.(); }, [onClose]);

  const navigate = useCallback((direction) => {
    if (!activeCards.length) return;
    hideHint(); stopAllAudio(); lastDirection.current = direction; setIsRevealed(false);
    setCurrentIndex((prev) => (prev + direction + activeCards.length) % activeCards.length);
  }, [activeCards.length, hideHint]);

  useEffect(() => {
    if (!isOpen) { stopAllAudio(); setLock(false); return; }
    setLock(true);
    setShowHint(safeLocalStorage.get(HINT_KEY) !== '1');
    setActiveCards(processedCards);
    const saved = safeLocalStorage.get(`${PROGRESS_PREFIX}${progressKey}`);
    const parsed = parseInt(saved, 10);
    setCurrentIndex(!Number.isNaN(parsed) && parsed >= 0 && parsed < processedCards.length ? parsed : 0);
  }, [isOpen, processedCards, progressKey]);

  useEffect(() => {
    if (isOpen && progressKey && activeCards.length) safeLocalStorage.set(`${PROGRESS_PREFIX}${progressKey}`, String(currentIndex));
  }, [currentIndex, progressKey, activeCards.length, isOpen]);

  useEffect(() => {
    let alive = true;
    if (currentCard?.id) isFavorite(currentCard.id).then((ok) => { if (alive) setIsFavoriteCard(ok); });
    else setIsFavoriteCard(false);
    setIsRevealed(false);
    return () => { alive = false; };
  }, [currentCard?.id]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const preventTouch = (e) => { if (isOpenRef.current && !e.target?.closest?.('[data-no-prevent-touch]') && !e.target?.closest?.('[data-no-gesture]')) e.preventDefault(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowUp') navigate(-1); if (e.key === 'ArrowDown') navigate(1); if (e.key === ' ') { e.preventDefault(); setIsRevealed((v) => !v); } };
    document.addEventListener('touchmove', preventTouch, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('touchmove', preventTouch); window.removeEventListener('keydown', onKey); setLock(false); };
  }, [isOpen, close, navigate]);

  useEffect(() => {
    if (!isOpen || !currentCard) return undefined;
    clearTimeout(autoTimer.current);
    stopAllAudio();
    const startTimer = () => {
      if (settings.autoBrowse && activeCards.length > 1) autoTimer.current = setTimeout(() => navigate(1), clamp(settings.autoBrowseDelay, 2500, 15000));
    };
    const afterChinese = () => {
      if (settings.autoPlayBurmese && settings.showBurmese && currentCard.burmese && isRevealed) {
        playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, () => {
          if (settings.autoPlayExample && settings.showExamples && currentCard.example && isRevealed) {
            playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, () => {
              if (currentCard.example2 && isRevealed) playTTS(currentCard.example2, settings.voiceChinese, settings.speechRateChinese, startTimer);
              else startTimer();
            });
          } else startTimer();
        });
      } else startTimer();
    };
    const t = setTimeout(() => {
      if (settings.autoPlayChinese && currentCard.chinese) playR2Audio(currentCard, afterChinese, settings, level);
      else afterChinese();
    }, 450);
    return () => { clearTimeout(t); clearTimeout(autoTimer.current); };
  }, [activeCards.length, currentCard, currentIndex, isOpen, isRevealed, level, navigate, settings]);

  const toggleFav = async (e) => {
    e?.stopPropagation?.(); e?.preventDefault?.();
    if (!currentCard) return;
    const optimistic = !isFavoriteCard;
    setIsFavoriteCard(optimistic);
    setIsFavoriteCard(await toggleFavorite(currentCard));
  };
  const goHome = (e) => { e?.stopPropagation?.(); stopAllAudio(); if (typeof window !== 'undefined') window.location.assign('https://886.best'); };
  const openRecorder = (e) => { e?.stopPropagation?.(); stopAllAudio(); setIsRecordingOpen(true); };
  const spellRead = (e) => { e?.stopPropagation?.(); if (!currentCard) return; hideHint(); playSpellAudio(currentCard, settings, level); };
  const know = () => { stopAllAudio(); if (!currentCard) return; const next = activeCards.filter((c) => c.id !== currentCard.id); setActiveCards(next); setIsRevealed(false); setCurrentIndex((prev) => (next.length && prev >= next.length ? 0 : prev)); };
  const dontKnow = () => { stopAllAudio(); if (isRevealed) navigate(1); else setIsRevealed(true); };
  const playManual = (card, e) => { e?.stopPropagation?.(); playR2Audio(card, null, settings, level); };
  const tapCard = (e) => { if (e?.target?.closest?.('[data-no-gesture]')) return; if (!isSettingsOpen && !isRecordingOpen && !isJumping && !writerChar) { stopAllAudio(); setIsRevealed((v) => !v); } };
  const jumpTo = (index) => { if (index >= 0 && index < activeCards.length) { hideHint(); stopAllAudio(); lastDirection.current = index > currentIndex ? 1 : -1; setIsRevealed(false); setCurrentIndex(index); } setIsJumping(false); };

  const pageTransitions = useTransition(isOpen, { from: { opacity: 0, transform: 'translateY(100%)' }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: 'translateY(100%)' }, config: { tension: 220, friction: 25 } });
  const cardTransitions = useTransition(currentIndex, {
    key: currentCard ? currentCard.id : currentIndex,
    from: { opacity: 0, transform: `translate3d(0, ${lastDirection.current > 0 ? '100%' : '-100%'}, 0) scale(.985)` },
    enter: { opacity: 1, transform: 'translate3d(0,0%,0) scale(1)' },
    leave: { opacity: 0, transform: `translate3d(0, ${lastDirection.current > 0 ? '-100%' : '100%'}, 0) scale(.985)`, position: 'absolute' },
    config: { mass: 1, tension: 300, friction: 32 },
    onStart: () => { if (activeCards.length > 1) playSoundEffect('switch'); },
  });
  const bind = useDrag(({ down, movement: [mx, my], velocity: [vx, vy], direction: [, yDir], event }) => {
    if (event.target?.closest?.('[data-no-gesture]')) return;
    if (down) return;
    event.preventDefault?.(); event.stopPropagation?.();
    const horizontal = Math.abs(mx) > Math.abs(my);
    if (horizontal) { if (Math.abs(mx) > 96 || (Math.abs(vx) > .45 && Math.abs(mx) > 46)) { hideHint(); close(); } return; }
    if (Math.abs(my) > 62 || (Math.abs(vy) > .34 && Math.abs(my) > 32)) navigate(yDir < 0 ? 1 : -1);
  }, { filterTaps: true, preventDefault: true, threshold: 8, pointer: { touch: true } });

  const content = pageTransitions((pageStyle, open) => {
    if (!open) return null;
    const bg = settings.backgroundImage
      ? { background: `radial-gradient(circle at 12% 12%, rgba(255,255,255,.86), transparent 30%), radial-gradient(circle at 82% 10%, rgba(191,219,254,.62), transparent 32%), radial-gradient(circle at 80% 86%, rgba(221,214,254,.66), transparent 34%), linear-gradient(135deg, rgba(248,250,252,.76), rgba(239,246,255,.72), rgba(245,243,255,.70), rgba(253,242,248,.72)), url(${settings.backgroundImage}) center/cover no-repeat` }
      : { background: 'radial-gradient(circle at 15% 18%, rgba(255,255,255,.96), transparent 28%), radial-gradient(circle at 82% 14%, rgba(191,219,254,.92), transparent 35%), radial-gradient(circle at 88% 78%, rgba(221,214,254,.84), transparent 34%), radial-gradient(circle at 8% 88%, rgba(254,226,226,.66), transparent 32%), linear-gradient(135deg, #f8fafc 0%, #eff6ff 34%, #eef2ff 62%, #f5f3ff 82%, #fdf2f8 100%)' };
    return (
      <animated.div {...bind()} onClick={tapCard} style={{ ...styles.fullScreen, ...bg, ...pageStyle }} className="word-card-no-select word-card-animated">
        <div style={styles.glassLayer} />
        {writerChar && <StrokeOrderModal word={writerChar} settings={settings} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} onCancel={() => setIsSettingsOpen(false)} onSave={(next) => { setSettings(next); setIsSettingsOpen(false); }} />}
        {isRecordingOpen && currentCard && <PronunciationComparison word={currentCard} pinyinText={getPinyin(currentCard)} settings={settings} level={level} onClose={() => setIsRecordingOpen(false)} />}
        {isJumping && <JumpModal max={activeCards.length} current={currentIndex} onJump={jumpTo} onClose={() => setIsJumping(false)} />}

        {activeCards.length > 0 && currentCard ? cardTransitions((cardStyle, index) => {
          const card = activeCards[index];
          if (!card) return null;
          return (
            <animated.div key={card.id} style={{ ...styles.cardShell, ...cardStyle }}>
              <div style={styles.flipScene}>
                <div style={{ ...styles.flipCard, transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                  <section style={{ ...styles.face, ...styles.frontFace }}>
                    <button type="button" data-no-gesture="true" style={styles.bigAudioButton} onClick={(e) => playManual(card, e)}><FaVolumeUp size={22} /></button>
                    <div style={styles.frontContent}>{settings.showPinyin && <div style={styles.pinyin}>{getPinyin(card)}</div>}<div style={styles.chinese}>{card.chinese}</div><div style={styles.tapHint}>点击翻到背面</div></div>
                  </section>
                  <section style={{ ...styles.face, ...styles.backFace }}>
                    <div style={styles.backContent} data-no-prevent-touch="true">
                      <div style={styles.backTop}>{settings.showPinyin && <div style={styles.backPinyin}>{getPinyin(card)}</div>}<div style={styles.backChinese}>{card.chinese}</div></div>
                      {settings.showBurmese && card.burmese && <button type="button" data-no-gesture="true" style={styles.definitionBox} onClick={(e) => playTTS(card.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}><div style={styles.burmese}>{card.burmese}</div></button>}
                      {settings.showExplanation && card.explanation && <button type="button" data-no-gesture="true" style={styles.explanationBox} onClick={(e) => playTTS(card.explanation, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>{card.explanation}</button>}
                      {card.mnemonic && <div style={styles.mnemonicBox}>{card.mnemonic}</div>}
                      {settings.showExamples && card.example && <button type="button" data-no-gesture="true" style={styles.exampleBox} onClick={(e) => playTTS(card.example, settings.voiceChinese, settings.speechRateChinese, null, e)}><div style={styles.examplePinyin}>{getPinyinText(card.example)}</div><div style={styles.exampleText}>{card.example}</div></button>}
                      {settings.showExamples && card.example2 && <button type="button" data-no-gesture="true" style={styles.exampleBox} onClick={(e) => playTTS(card.example2, settings.voiceChinese, settings.speechRateChinese, null, e)}><div style={styles.examplePinyin}>{getPinyinText(card.example2)}</div><div style={styles.exampleText}>{card.example2}</div></button>}
                      <div style={styles.tapHint}>点击翻回正面</div>
                    </div>
                  </section>
                </div>
              </div>
            </animated.div>
          );
        }) : <div style={styles.doneBox} data-no-gesture="true"><h2>🎉 ဂုဏ်ယူပါတယ်!</h2><p>သင် ဒီသင်ခန်းစာကို လေ့လာပြီးသွားပါပြီ။</p><button type="button" style={{ ...styles.knowButtonBase, ...styles.knowButton }} onClick={close}>ပိတ်မည်</button></div>}

        {currentCard && <div style={styles.rightControls} data-no-gesture="true"><button type="button" style={styles.iconButton} onClick={goHome}><FaHome /></button><button type="button" style={styles.iconButton} onClick={() => setIsSettingsOpen(true)}><FaCog /></button><button type="button" style={styles.iconButton} onClick={spellRead} title="音频拼读"><FaMagic /></button><button type="button" style={styles.iconButton} onClick={openRecorder}><FaMicrophone /></button>{currentCard.chinese?.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && <button type="button" style={styles.iconButton} onClick={() => setWriterChar(currentCard.chinese)}><FaPenFancy /></button>}<button type="button" style={styles.iconButton} onClick={toggleFav}>{isFavoriteCard ? <FaHeart color="#f87171" /> : <FaRegHeart />}</button></div>}
        {showHint && <div style={styles.navHint} data-no-gesture="true"><FaChevronUp size={14} /> 上滑下一张 / 下滑上一张 <FaChevronDown size={14} /></div>}
        <div style={styles.bottomControls} data-no-gesture="true">{activeCards.length > 0 && <button type="button" style={styles.counter} onClick={() => setIsJumping(true)}>{currentIndex + 1} / {activeCards.length}</button>}<div style={styles.knowWrap}><button type="button" style={{ ...styles.knowButtonBase, ...styles.dontKnowButton }} onClick={dontKnow}>မသိဘူး</button><button type="button" style={{ ...styles.knowButtonBase, ...styles.knowButton }} onClick={know}>သိတယ်</button></div></div>
      </animated.div>
    );
  });

  if (isMounted) return createPortal(content, document.body);
  return null;
};

const baseButton = { appearance: 'none', border: 'none', fontFamily: 'inherit' };
const pinyinFont = '"Noto Sans", "Noto Sans SC", "Arial Unicode MS", "Helvetica Neue", Arial, sans-serif';

const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent' },
  glassLayer: { position: 'absolute', inset: 0, zIndex: 0, backdropFilter: 'blur(18px) saturate(145%)', WebkitBackdropFilter: 'blur(18px) saturate(145%)', background: 'linear-gradient(180deg, rgba(255,255,255,.34), rgba(255,255,255,.14))', border: '1px solid rgba(255,255,255,.42)' },
  cardShell: { position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', width: '100%', height: '100%', padding: 'calc(16px + env(safe-area-inset-top)) 12px calc(126px + env(safe-area-inset-bottom)) 12px', pointerEvents: 'none' },
  flipScene: { width: '100%', height: '100%', perspective: 1200, pointerEvents: 'auto' },
  flipCard: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 520ms cubic-bezier(.2,.8,.2,1)', borderRadius: 32 },
  face: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 32, overflow: 'hidden', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'rgba(255,255,255,.28)', border: '1px solid rgba(255,255,255,.58)', boxShadow: '0 28px 90px rgba(15,23,42,.13)', backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)' },
  frontFace: { transform: 'rotateY(0deg)' },
  backFace: { transform: 'rotateY(180deg)', padding: '24px 16px' },
  frontContent: { width: '100%', maxWidth: 560, minHeight: 260, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  bigAudioButton: { ...baseButton, position: 'absolute', top: 26, right: 24, width: 58, height: 58, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.74)', color: '#2563eb', boxShadow: '0 12px 28px rgba(37,99,235,.12)', cursor: 'pointer' },
  pinyin: { fontFamily: pinyinFont, fontSize: 'clamp(1.5rem,5vw,2.35rem)', color: '#d97706', marginBottom: '1rem', letterSpacing: '.035em', fontWeight: 900, lineHeight: 1.35, fontVariantLigatures: 'none', textRendering: 'geometricPrecision' },
  chinese: { fontSize: 'clamp(4rem,22vw,10rem)', fontWeight: 950, color: '#111827', lineHeight: 1.03, wordBreak: 'break-word', textShadow: '0 12px 40px rgba(17,24,39,.08)' },
  tapHint: { marginTop: 18, fontSize: '.9rem', color: 'rgba(75,85,99,.62)', fontWeight: 700 },
  backContent: { width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 6px' },
  backTop: { textAlign: 'center', marginBottom: 4 },
  backPinyin: { fontFamily: pinyinFont, color: '#d97706', fontWeight: 850, fontSize: '1.15rem', lineHeight: 1.35, fontVariantLigatures: 'none', textRendering: 'geometricPrecision' },
  backChinese: { fontSize: '2.1rem', color: '#111827', fontWeight: 900, lineHeight: 1.15 },
  definitionBox: { ...baseButton, cursor: 'pointer', textAlign: 'center', background: 'rgba(255,255,255,.42)', borderRadius: 20, padding: '10px 16px', color: 'inherit', maxWidth: '100%' },
  burmese: { fontSize: 'clamp(1.25rem,4vw,1.75rem)', color: '#374151', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.55, wordBreak: 'break-word' },
  explanationBox: { ...baseButton, color: '#16a34a', textAlign: 'center', fontSize: '1.08rem', background: 'rgba(240,253,244,.38)', padding: '8px 14px', maxWidth: '100%', borderRadius: 18, cursor: 'pointer', fontFamily: '"Padauk", "Myanmar Text", sans-serif', lineHeight: 1.45, fontWeight: 650 },
  mnemonicBox: { color: '#6b7280', display: 'inline-block', textAlign: 'center', fontSize: '1rem', background: 'rgba(255,255,255,.34)', padding: '8px 14px', borderRadius: 16, maxWidth: '100%', lineHeight: 1.45 },
  exampleBox: { ...baseButton, color: '#374151', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', background: 'rgba(255,255,255,.42)', padding: '10px 12px', borderRadius: 18, border: '1px solid rgba(229,231,235,.88)', boxShadow: '0 8px 22px rgba(15,23,42,.05)' },
  examplePinyin: { fontFamily: pinyinFont, fontSize: '.96rem', color: '#d97706', opacity: .94, letterSpacing: '.02em', fontWeight: 700, lineHeight: 1.35, fontVariantLigatures: 'none', textRendering: 'geometricPrecision' },
  exampleText: { fontSize: '1.18rem', lineHeight: 1.4 },
  rightControls: { position: 'fixed', top: '50%', right: 10, zIndex: 1010, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', transform: 'translateY(-50%)' },
  iconButton: { ...baseButton, background: 'rgba(255,255,255,.82)', border: '1px solid rgba(229,231,235,.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', boxShadow: '0 10px 24px rgba(15,23,42,.13)', color: '#4b5563', touchAction: 'manipulation', backdropFilter: 'blur(10px)' },
  navHint: { position: 'fixed', top: 'calc(14px + env(safe-area-inset-top))', left: '50%', zIndex: 1005, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(55,65,81,.78)', fontSize: '.82rem', fontWeight: 850, background: 'rgba(255,255,255,.58)', border: '1px solid rgba(229,231,235,.75)', borderRadius: 999, padding: '8px 14px', backdropFilter: 'blur(12px)', boxShadow: '0 10px 26px rgba(15,23,42,.08)', animation: 'wcHint 1.6s ease-in-out infinite' },
  bottomControls: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px 15px max(15px, env(safe-area-inset-bottom))', zIndex: 1010, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, pointerEvents: 'auto' },
  counter: { ...baseButton, background: 'rgba(255,255,255,.74)', color: '#374151', padding: '8px 20px', borderRadius: 20, fontSize: '1rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 24px rgba(15,23,42,.1)', backdropFilter: 'blur(10px)' },
  knowWrap: { display: 'flex', width: '100%', maxWidth: 520, gap: 14 },
  knowButtonBase: { ...baseButton, flex: 1, padding: 17, borderRadius: 20, fontSize: '1.24rem', fontWeight: 950, color: 'white', cursor: 'pointer', boxShadow: '0 14px 30px rgba(15,23,42,.15)', touchAction: 'manipulation' },
  dontKnowButton: { background: 'linear-gradient(135deg,#f59e0b,#b45309)' },
  knowButton: { background: 'linear-gradient(135deg,#10b981,#047857)' },
  doneBox: { textAlign: 'center', color: '#374151', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 },

  modalMask: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 18 },
  recordPanel: { width: '100%', maxWidth: 398, background: 'rgba(255,255,255,.96)', borderRadius: 26, overflow: 'hidden', animation: 'wcFadeIn .3s ease-out', boxShadow: '0 24px 48px rgba(0,0,0,.22)' },
  recordHeader: { padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  recordTitle: { margin: 0, color: '#374151', fontSize: '1.1rem', fontWeight: 900 },
  textCloseButton: { ...baseButton, color: '#64748b', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 999, padding: '7px 12px', fontWeight: 800, cursor: 'pointer' },
  recordBody: { padding: '28px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, minHeight: 300 },
  recordWord: { textAlign: 'center', width: '100%' },
  modalPinyin: { fontFamily: pinyinFont, fontSize: '1.2rem', color: '#8b5cf6', fontWeight: 900, letterSpacing: 1, marginBottom: 8, lineHeight: 1.35, fontVariantLigatures: 'none', textRendering: 'geometricPrecision' },
  modalChinese: { fontSize: '3rem', fontWeight: 950, color: '#0f172a', lineHeight: 1.1 },
  recordCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' },
  bigRecordBtn: { ...baseButton, width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 10px 25px rgba(59,130,246,.4)', padding: 0 },
  recordingPulse: { background: 'linear-gradient(135deg,#ef4444,#dc2626)', animation: 'wcRipple 1.5s infinite' },
  instruction: { color: '#64748b', fontSize: '1rem', fontWeight: 800, textAlign: 'center' },
  errorText: { color: '#dc2626', fontSize: '.86rem', textAlign: 'center', lineHeight: 1.45, maxWidth: 300 },
  waveBox: { display: 'flex', gap: 4, alignItems: 'center', height: 24, marginBottom: -10 },
  waveBar: { display: 'block', width: 4, height: '100%', background: '#ef4444', borderRadius: 2, animation: 'wcWave 1s ease-in-out infinite' },
  recognitionBox: { width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', borderRadius: 16, padding: '10px 12px', fontSize: '.94rem', lineHeight: 1.45, textAlign: 'center' },
  recognitionGood: { background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857' },
  reviewBox: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 },
  reviewRow: { display: 'flex', justifyContent: 'center', width: '100%', gap: 16 },
  reviewCard: { ...baseButton, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '18px 10px', background: '#f8fafc', borderRadius: 20, cursor: 'pointer' },
  iconCircle: { width: 54, height: 54, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  retryButton: { ...baseButton, background: 'white', border: '1px solid #e2e8f0', color: '#64748b', padding: '10px 24px', borderRadius: 99, fontSize: '.9rem', fontWeight: 850, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },

  settingsPanel: { background: 'rgba(255,255,255,.98)', padding: 24, borderRadius: 24, width: '100%', maxWidth: 500, boxShadow: '0 20px 50px rgba(0,0,0,.24)', maxHeight: '86vh', overflowY: 'auto', position: 'relative' },
  settingsTitle: { marginTop: 0, color: '#111827', fontSize: '1.35rem', fontWeight: 950 },
  settingGroup: { marginBottom: 22 },
  settingLabel: { display: 'block', fontWeight: 900, marginBottom: 10, color: '#333' },
  segment: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 4, background: '#f3f4f6', borderRadius: 16 },
  segmentBtn: { ...baseButton, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: 'transparent', color: '#4b5563', cursor: 'pointer', fontWeight: 850 },
  segmentActive: { background: '#3b82f6', color: '#fff', boxShadow: '0 8px 18px rgba(59,130,246,.22)' },
  stack: { display: 'flex', flexDirection: 'column', gap: 10 },
  switchLabel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#4b5563', fontWeight: 800, gap: 12 },
  switchDesc: { display: 'block', fontWeight: 600, color: '#94a3b8', marginTop: 2, lineHeight: 1.35 },
  hidden: { display: 'none' },
  switchTrack: { width: 48, height: 26, borderRadius: 999, padding: 2, transition: 'background .2s', display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' },
  switchThumb: { width: 22, height: 22, borderRadius: '50%', background: '#fff', display: 'block', boxShadow: '0 2px 6px rgba(0,0,0,.2)', transition: 'transform .2s' },
  rangeRow: { display: 'grid', gridTemplateColumns: '84px 1fr 46px', alignItems: 'center', gap: 10, marginTop: 12, color: '#4b5563', fontSize: '.9rem' },
  select: { width: '100%', padding: '11px 12px', borderRadius: 14, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 700 },
  settingBtns: { display: 'flex', gap: 10 },
  grayButton: { ...baseButton, background: '#f3f4f6', color: '#4b5563', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 800, flex: 1 },
  settingsFooter: { position: 'sticky', bottom: -24, margin: '6px -24px -24px', padding: '14px 24px max(14px, env(safe-area-inset-bottom))', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'rgba(255,255,255,.94)', borderTop: '1px solid #e5e7eb', backdropFilter: 'blur(10px)' },
  cancelButton: { ...baseButton, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, background: '#f1f5f9', color: '#475569', fontWeight: 900, cursor: 'pointer' },
  saveButton: { ...baseButton, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, background: '#2563eb', color: '#fff', fontWeight: 900, cursor: 'pointer' },
  jumpPanel: { background: '#fff', padding: 25, borderRadius: 18, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.2)' },
  jumpInput: { width: 110, padding: 10, fontSize: '1.2rem', textAlign: 'center', border: '2px solid #d1d5db', borderRadius: 10, marginBottom: 15 },
  jumpButton: { ...baseButton, width: '100%', padding: 12, borderRadius: 12, background: '#4299e1', color: '#fff', fontSize: '1rem', fontWeight: 850, cursor: 'pointer' },

  strokePanel: { width: '100%', maxWidth: 650, maxHeight: '88vh', overflowY: 'auto', background: 'rgba(255,255,255,.98)', borderRadius: 26, padding: '26px 20px 24px', boxShadow: '0 24px 60px rgba(0,0,0,.26)', textAlign: 'center' },
  strokeTitle: { fontSize: '1.35rem', color: '#111827', fontWeight: 950, marginBottom: 8 },
  strokePinyin: { fontFamily: pinyinFont, fontSize: '1.35rem', color: '#8b5cf6', fontWeight: 950, lineHeight: 1.45, letterSpacing: '.02em', textRendering: 'geometricPrecision', fontVariantLigatures: 'none' },
  strokeOptions: { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10, margin: '16px 0 12px' },
  smallPill: { ...baseButton, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', borderRadius: 999, padding: '9px 14px', fontWeight: 850, cursor: 'pointer' },
  smallPillActive: { background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' },
  strokeSpeedRow: { display: 'grid', gridTemplateColumns: '48px 1fr 48px', alignItems: 'center', gap: 10, maxWidth: 410, margin: '0 auto 20px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: 16, color: '#334155' },
  strokeError: { color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: 10, borderRadius: 14, marginBottom: 12, fontWeight: 700 },
  strokeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', justifyItems: 'center', gap: 14, marginBottom: 22 },
  strokeCell: { width: 142, height: 142, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, border: '1px solid #e5e7eb', background: '#fff', boxShadow: '0 8px 22px rgba(15,23,42,.06)' },
  strokeWriterBox: { width: 132, height: 132, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  strokeFallbackChar: { fontSize: '5rem', fontWeight: 500, color: '#525252', lineHeight: 1 },
  strokeActions: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 },
  strokeActionButton: { ...baseButton, background: '#eef2ff', color: '#1e293b', padding: '14px 10px', borderRadius: 16, fontSize: '1rem', fontWeight: 950, cursor: 'pointer' },
  primaryButton: { background: '#2563eb', color: '#fff' },
  strokeCloseButton: { ...baseButton, background: '#eef2ff', color: '#1e293b', padding: '13px 28px', borderRadius: 16, fontSize: '1rem', fontWeight: 950, cursor: 'pointer' },
};

export default WordCard;
