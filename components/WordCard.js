// components/WordCard.js

import React, {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { animated, useTransition } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import {
  FaCog,
  FaHeart,
  FaHome,
  FaMicrophone,
  FaPenFancy,
  FaPlayCircle,
  FaRandom,
  FaRedo,
  FaRegHeart,
  FaSortAmountDown,
  FaStop,
  FaTimes,
  FaVolumeUp,
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// =================================================================================
// Constants
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';
const SETTINGS_KEY = 'learningWordCardSettings';
const STYLE_ID = 'word-card-runtime-styles-v5';
const PROGRESS_PREFIX = 'word_progress_';
const HINT_SEEN_KEY = 'wordcard_swipe_hint_seen_v5';

const DEFAULT_SETTINGS = {
  order: 'sequential',
  autoPlayChinese: true,
  autoPlayBurmese: true,
  autoPlayExample: true,
  autoBrowse: false,
  autoBrowseDelay: 7000,
  showChinese: true,
  showPinyin: true,
  showBurmese: true,
  showExample: true,
  voiceChinese: 'zh-CN-XiaoxiaoNeural',
  voiceBurmese: 'my-MM-NilarNeural',
  speechRateChinese: -50,
  speechRateBurmese: -50,
  backgroundImage: '',
  uiLanguage: 'zh-my',
};

const CHINESE_VOICES = [
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 · 女声 · 普通话' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓伊 · 女声 · 普通话' },
  { value: 'zh-CN-XiaoyouNeural', label: '晓悠 · 儿童女声' },
  { value: 'zh-CN-YunjianNeural', label: '云健 · 男声' },
  { value: 'zh-CN-YunxiNeural', label: '云希 · 男声' },
  { value: 'zh-CN-YunxiaNeural', label: '云夏 · 男声' },
  { value: 'zh-CN-YunyangNeural', label: '云扬 · 男声' },
  { value: 'zh-CN-XiaochenNeural', label: '晓辰 · 女声' },
  { value: 'zh-CN-XiaochenMultilingualNeural', label: '晓辰 · 多语女声' },
  { value: 'zh-CN-XiaohanNeural', label: '晓涵 · 女声' },
  { value: 'zh-CN-XiaomengNeural', label: '晓梦 · 女声' },
  { value: 'zh-CN-XiaomoNeural', label: '晓墨 · 女声' },
  { value: 'zh-CN-XiaoqiuNeural', label: '晓秋 · 女声' },
  { value: 'zh-CN-XiaorouNeural', label: '晓柔 · 女声' },
  { value: 'zh-CN-XiaoruiNeural', label: '晓睿 · 女声' },
  { value: 'zh-CN-XiaoshuangNeural', label: '晓双 · 女声' },
  { value: 'zh-CN-XiaoxuanNeural', label: '晓萱 · 女声' },
  { value: 'zh-CN-XiaoyanNeural', label: '晓颜 · 女声' },
  { value: 'zh-CN-XiaozhenNeural', label: '晓甄 · 女声' },
  { value: 'zh-CN-YunfengNeural', label: '云枫 · 男声' },
  { value: 'zh-CN-YunhaoNeural', label: '云皓 · 男声' },
  { value: 'zh-CN-YunqianNeural', label: '云谦 · 男声' },
  { value: 'zh-CN-YunzeNeural', label: '云泽 · 男声' },
  { value: 'zh-CN-liaoning-XiaobeiNeural', label: '晓北 · 辽宁女声' },
  { value: 'zh-CN-shaanxi-XiaoniNeural', label: '晓妮 · 陕西女声' },
  { value: 'zh-HK-HiuMaanNeural', label: '香港 · 晓曼' },
  { value: 'zh-HK-HiuGaaiNeural', label: '香港 · 晓佳' },
  { value: 'zh-TW-HsiaoChenNeural', label: '台湾 · 晓臻' },
  { value: 'zh-TW-YunJheNeural', label: '台湾 · 云哲' },
];

const BURMESE_VOICES = [
  { value: 'my-MM-NilarNeural', label: 'Nilar · 女声' },
  { value: 'my-MM-ThihaNeural', label: 'Thiha · 男声' },
];

const UI_LANGUAGES = [
  { value: 'zh-my', label: '中文 + မြန်မာ' },
  { value: 'zh', label: '中文' },
  { value: 'my', label: 'မြန်မာ' },
];

const UI_TEXT_ZH = {
  swipeHint: '上滑下一张 · 下滑上一张 · 左右滑关闭',
  frontTip: '点击翻到背面',
  backTip: '点击空白处翻回正面',
  know: '知道',
  dontKnow: '不知道',
  settings: '设置',
  spelling: '拼读音频',
  recording: '录音跟读',
  stroke: '笔顺',
  favorite: '收藏',
  meaning: '缅文释义',
  explanation: '补充说明',
  mnemonic: '记忆提示',
  example1: '例句 1',
  example2: '例句 2',
  done: '完成',
  close: '关闭',
  language: '界面语言',
  display: '显示内容',
  chinese: '中文',
  pinyin: '拼音',
  burmese: '缅文',
  example: '例句',
  order: '单词顺序',
  sequential: '顺序',
  random: '随机',
  autoplay: '自动播放',
  chineseAudio: '中文音频',
  burmeseTts: '缅文 TTS',
  exampleTts: '例句 TTS',
  autoBrowse: '自动切卡',
  delay: '自动切卡延迟',
  chineseVoice: '中文发音人',
  burmeseVoice: '缅文发音人',
  chineseRate: '中文语速',
  burmeseRate: '缅文语速',
  background: '背景图',
  upload: '上传图片',
  resetGradient: '恢复渐变',
  saveHint: '点击底部“保存”后生效',
  cancel: '取消',
  save: '保存',
  jumpTo: '跳转到',
  confirm: '确定',
  finished: '恭喜，已学完本组单词',
};

const UI_TEXT_MY = {
  swipeHint: 'အပေါ်ဆွဲ နောက်တစ်ခု · အောက်ဆွဲ အရင်တစ်ခု · ဘေးဆွဲ ပိတ်',
  frontTip: 'နောက်ဘက်ကြည့်ရန် နှိပ်ပါ',
  backTip: 'အလွတ်နေရာကို နှိပ်၍ ရှေ့ဘက်ပြန်ကြည့်ပါ',
  know: 'သိတယ်',
  dontKnow: 'မသိဘူး',
  settings: 'ဆက်တင်',
  spelling: 'အသံ拼读',
  recording: 'အသံသွင်းလေ့ကျင့်',
  stroke: 'ရေးနည်း',
  favorite: 'သိမ်းရန်',
  meaning: 'မြန်မာအဓိပ္ပါယ်',
  explanation: 'ရှင်းလင်းချက်',
  mnemonic: 'မှတ်သားရန်',
  example1: 'ဥပမာ ၁',
  example2: 'ဥပမာ ၂',
  done: 'ပြီးပြီ',
  close: 'ပိတ်မည်',
  language: 'ဘာသာစကား',
  display: 'ပြသမည့်အရာ',
  chinese: 'တရုတ်စာ',
  pinyin: 'ပင်ယင်',
  burmese: 'မြန်မာစာ',
  example: 'ဥပမာ',
  order: 'အစဉ်လိုက်',
  sequential: 'စဉ်လိုက်',
  random: 'ကျပန်း',
  autoplay: 'အလိုအလျောက်ဖွင့်',
  chineseAudio: 'တရုတ်အသံ',
  burmeseTts: 'မြန်မာ TTS',
  exampleTts: 'ဥပမာ TTS',
  autoBrowse: 'အလိုအလျောက်ပြောင်း',
  delay: 'ပြောင်းမည့်အချိန်',
  chineseVoice: 'တရုတ်အသံရွေးရန်',
  burmeseVoice: 'မြန်မာအသံရွေးရန်',
  chineseRate: 'တရုတ်အမြန်နှုန်း',
  burmeseRate: 'မြန်မာအမြန်နှုန်း',
  background: 'နောက်ခံပုံ',
  upload: 'ပုံတင်ရန်',
  resetGradient: 'Gradient ပြန်ထားရန်',
  saveHint: 'အောက်ခြေ Save ကိုနှိပ်မှ သက်ရောက်မည်',
  cancel: 'မလုပ်တော့ပါ',
  save: 'သိမ်းမည်',
  jumpTo: 'သွားရန်',
  confirm: 'အတည်ပြု',
  finished: 'ဂုဏ်ယူပါတယ်၊ ဒီအုပ်စု ပြီးပါပြီ',
};

function createUiText(language = 'zh-my') {
  return (key) => {
    const zh = UI_TEXT_ZH[key] || key;
    const my = UI_TEXT_MY[key] || key;
    if (language === 'zh') return zh;
    if (language === 'my') return my;
    return `${zh} / ${my}`;
  };
}

// =================================================================================
// IndexedDB favorites
// =================================================================================
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error || new Error('Database error'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

function waitTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('tx error'));
    tx.onabort = () => reject(tx.error || new Error('tx abort'));
  });
}

async function toggleFavorite(word) {
  if (!word?.id) return false;

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const existing = await new Promise((resolve) => {
      const req = store.get(word.id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (existing) {
      store.delete(word.id);
      await waitTransaction(tx);
      db.close();
      return false;
    }

    store.put({ ...word, favoritedAt: Date.now() });
    await waitTransaction(tx);
    db.close();
    return true;
  } catch (error) {
    console.warn('toggleFavorite failed', error);
    return false;
  }
}

async function isFavorite(id) {
  if (!id) return false;

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result = await new Promise((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
    db.close();
    return result;
  } catch {
    return false;
  }
}

// =================================================================================
// Utilities
// =================================================================================
const safeStorage = {
  get(key) {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (typeof window !== 'undefined') localStorage.setItem(key, value);
    } catch {
      // ignore storage errors in private mode
    }
  },
};

function clamp(num, min, max) {
  const value = Number(num);
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function shuffleArray(arr) {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function getWordId(word, index) {
  return word?.id ?? `${word?.chinese || word?.word || 'word'}-${index}`;
}

function normalizePinyinText(text) {
  if (!text) return '';
  try {
    // NFC turns combining tone marks into precomposed characters when possible.
    // This fixes first-tone/macron drifting on some Android browsers when letter spacing is applied.
    return String(text).normalize('NFC');
  } catch {
    return String(text);
  }
}

function getPinyinText(text) {
  if (!text) return '';
  try {
    return normalizePinyinText(
      pinyinConverter(text, {
        toneType: 'symbol',
        separator: ' ',
        v: true,
      }).replace(/·/g, ' '),
    );
  } catch {
    return normalizePinyinText(text);
  }
}

function normalizeRate(rate) {
  const safeRate = Number(rate);
  if (!Number.isFinite(safeRate)) return 1;
  if (safeRate >= 0) return Math.min(1.8, 1 + safeRate / 100);
  return Math.max(0.55, 1 + safeRate / 200);
}

function finishOnce(callback) {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    if (typeof callback === 'function') callback();
  };
}

function stopEvent(event) {
  if (!event) return;
  event.stopPropagation?.();
}

function injectRuntimeStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.innerHTML = `
    .word-card-no-select,
    .word-card-no-select * {
      -webkit-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
      -webkit-tap-highlight-color: transparent;
    }

    .word-card-scroll::-webkit-scrollbar { width: 0; height: 0; }

    .word-card-flip-scene {
      perspective: 1800px;
      transform-style: preserve-3d;
    }

    .word-card-flip-inner {
      transform-style: preserve-3d;
      will-change: transform;
      transition: transform 420ms cubic-bezier(.2,.8,.2,1);
    }

    .word-card-face {
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }

    .word-card-face-back { transform: rotateY(180deg); }

    .word-card-pinyin,
    .word-card-pinyin * {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, "Noto Sans", sans-serif !important;
      font-variant-ligatures: none;
      letter-spacing: 0 !important;
      line-height: 1.42 !important;
      text-rendering: geometricPrecision;
      transform: translateZ(0);
    }

    .word-card-hanzi-scope [class*="pinyin"],
    .word-card-hanzi-scope .pinyin {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, "Noto Sans", sans-serif !important;
      font-variant-ligatures: none !important;
      letter-spacing: 0 !important;
      line-height: 1.45 !important;
      text-rendering: geometricPrecision !important;
    }

    @keyframes wordCardRecordWave {
      0%, 100% { height: 8px; }
      50% { height: 24px; }
    }

    @keyframes wordCardRecordRipple {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.35); }
      70% { box-shadow: 0 0 0 18px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }

    @keyframes wordCardHintFloat {
      0%, 100% { transform: translate(-50%, 0); opacity: .95; }
      50% { transform: translate(-50%, -5px); opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .word-card-flip-inner,
      .word-card-animated,
      .word-card-animated * {
        transition-duration: 0.001ms !important;
        animation-duration: 0.001ms !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// =================================================================================
// Audio manager
// =================================================================================
let fxSounds = null;
let activeHowl = null;
let activeObjectUrl = null;
let audioPlayToken = 0;
let spellSequenceId = 0;

function initFx() {
  if (!fxSounds && typeof window !== 'undefined') {
    fxSounds = {
      // Put your real file here later:
      // public/sounds/wordcard-switch.mp3
      switch: new Howl({
        src: ['/sounds/wordcard-switch.mp3', '/sounds/switch-card.mp3'],
        volume: 0.35,
        html5: true,
      }),
    };
  }
}

function cleanupObjectUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function unloadActiveHowl() {
  if (activeHowl) {
    try {
      activeHowl.stop();
      activeHowl.unload();
    } catch {
      // ignore teardown errors
    }
    activeHowl = null;
  }
  cleanupObjectUrl();
}

function stopAllAudio({ cancelSpell = true, stopEffects = false } = {}) {
  audioPlayToken += 1;
  if (cancelSpell) spellSequenceId += 1;
  unloadActiveHowl();
  if (stopEffects && fxSounds) {
    Object.values(fxSounds).forEach((sound) => sound.stop());
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function triggerSwitchFeedback() {
  try {
    initFx();
    fxSounds?.switch?.play();
  } catch {
    // sound placeholder can be missing during development
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  } catch {
    // ignore unsupported vibration
  }
}

async function playTTS(
  text,
  voice,
  rate,
  onEnd,
  event,
  { stopBeforePlay = true, cancelSpell = true } = {},
) {
  stopEvent(event);
  const done = finishOnce(onEnd);

  if (stopBeforePlay) stopAllAudio({ cancelSpell });

  if (!text || !voice) {
    done();
    return;
  }

  const localToken = audioPlayToken;
  const apiUrl = 'https://libretts.is-an.org/api/tts';
  const rateValue = Math.round((Number(rate) || 0) / 2);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate: rateValue, pitch: 0 }),
    });

    if (!response.ok) throw new Error(`TTS ${response.status}`);
    const blob = await response.blob();
    if (localToken !== audioPlayToken) {
      done();
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    activeObjectUrl = objectUrl;

    activeHowl = new Howl({
      src: [objectUrl],
      format: ['mpeg', 'mp3'],
      html5: true,
      onend: () => {
        cleanupObjectUrl();
        done();
      },
      onloaderror: () => {
        cleanupObjectUrl();
        done();
      },
      onplayerror: () => {
        cleanupObjectUrl();
        done();
      },
    });

    activeHowl.play();
  } catch (error) {
    // TTS is only fallback for normal reading, HanziModal speaking, Burmese/explanations/examples.
    // The spell button below intentionally does not use browser speech as its main path.
    console.warn('TTS api failed, fallback to speechSynthesis', error);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice.startsWith('my') ? 'my-MM' : 'zh-CN';
      utterance.rate = normalizeRate(rate);
      utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    } else {
      done();
    }
  }
}

function buildR2AudioSrc(word, defaultLevel) {
  const targetLevel = word?.hsk_level || defaultLevel;
  if (!word?.id || !targetLevel) return '';
  const formattedId = String(word.id).padStart(4, '0');
  return `https://audio.886.best/chinese-vocab-audio/hsk${targetLevel}/${formattedId}.mp3`;
}

function playAudioCandidates(candidates, onEnd, { cancelSpell = true } = {}) {
  const done = finishOnce(onEnd);
  const srcList = candidates.filter(Boolean);

  if (srcList.length === 0) {
    done();
    return;
  }

  let index = 0;
  const playNext = () => {
    if (index >= srcList.length) {
      done();
      return;
    }

    const src = srcList[index];
    index += 1;
    stopAllAudio({ cancelSpell });

    activeHowl = new Howl({
      src: [src],
      html5: true,
      onend: done,
      onloaderror: playNext,
      onplayerror: playNext,
    });

    activeHowl.play();
  };

  playNext();
}

function playR2Audio(word, onEnd, settings, defaultLevel, { cancelSpell = true } = {}) {
  const src = buildR2AudioSrc(word, defaultLevel);
  const textToRead = word?.audioText || word?.chinese;

  if (!src) {
    playTTS(textToRead, settings.voiceChinese, settings.speechRateChinese, onEnd, null, { cancelSpell });
    return;
  }

  playAudioCandidates([src], onEnd, { cancelSpell });
}

function buildSpellAudioCandidates(word, defaultLevel) {
  if (!word) return [];

  const targetLevel = word.hsk_level || defaultLevel;
  const formattedId = word.id ? String(word.id).padStart(4, '0') : '';
  const direct = [
    word.spellAudio,
    word.spell_audio,
    word.spellingAudio,
    word.pinyinAudio,
    word.pinyin_audio,
  ];

  if (!formattedId || !targetLevel) return direct.filter(Boolean);

  return [
    ...direct,
    // Dedicated spelling-audio placeholders. If you add the real files later, no code change is needed.
    `https://audio.886.best/chinese-vocab-spell-audio/hsk${targetLevel}/${formattedId}.mp3`,
    `https://audio.886.best/chinese-vocab-audio/spell/hsk${targetLevel}/${formattedId}.mp3`,
    `https://audio.886.best/chinese-vocab-audio/hsk${targetLevel}/spell/${formattedId}.mp3`,
    // Last fallback is the original R2 word audio, not逐字 TTS.
    buildR2AudioSrc(word, defaultLevel),
  ].filter(Boolean);
}

function playSpellAudio(word, onEnd, defaultLevel) {
  playAudioCandidates(buildSpellAudioCandidates(word, defaultLevel), onEnd, { cancelSpell: true });
}

// =================================================================================
// Settings hook
// =================================================================================
function useCardSettings() {
  const [settings, setSettings] = useState(() => {
    const raw = safeStorage.get(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    safeStorage.set(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  return [settings, setSettings];
}

// =================================================================================
// Page lock: no browser pull-to-refresh, no text select while open
// =================================================================================
function useLockPageInteractions(enabled) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;

    const { body, documentElement } = document;
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyTouchAction: body.style.touchAction,
      bodyUserSelect: body.style.userSelect,
      bodyWebkitUserSelect: body.style.webkitUserSelect,
      htmlOverscroll: documentElement.style.overscrollBehavior,
      htmlTouchAction: documentElement.style.touchAction,
    };

    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    body.style.touchAction = 'none';
    body.style.userSelect = 'none';
    body.style.webkitUserSelect = 'none';
    documentElement.style.overscrollBehavior = 'none';
    documentElement.style.touchAction = 'none';

    const preventTouchMove = (event) => {
      if (!event.target?.closest?.('[data-allow-native-scroll="true"]')) {
        event.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventTouchMove);
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      body.style.touchAction = prev.bodyTouchAction;
      body.style.userSelect = prev.bodyUserSelect;
      body.style.webkitUserSelect = prev.bodyWebkitUserSelect;
      documentElement.style.overscrollBehavior = prev.htmlOverscroll;
      documentElement.style.touchAction = prev.htmlTouchAction;
    };
  }, [enabled]);
}


function useAutoFullscreen(enabled) {
  const enteredRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;

    const doc = document;
    const el = doc.documentElement;
    const fullscreenElement = doc.fullscreenElement || doc.webkitFullscreenElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen;

    if (!fullscreenElement && request) {
      Promise.resolve(request.call(el))
        .then(() => { enteredRef.current = true; })
        .catch(() => {
          // Mobile browsers often require a user gesture. CSS 100dvh still keeps the card fullscreen-like.
        });
    }

    return () => {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      const current = doc.fullscreenElement || doc.webkitFullscreenElement;
      if (enteredRef.current && current && exit) {
        Promise.resolve(exit.call(doc)).catch(() => {});
        enteredRef.current = false;
      }
    };
  }, [enabled]);
}

// =================================================================================
// Error boundary for HanziModal
// =================================================================================
class HanziErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('HanziModal crashed', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function HanziFallbackModal({ word, pinyinText, onClose, onSpeakWord }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose} data-no-gesture="true" role="presentation">
      <div style={styles.simpleModalPanel} onClick={stopEvent} role="dialog" aria-modal="true">
        <div style={styles.modalTitle}>笔顺暂时无法加载</div>
        <div style={styles.frontPinyin} className="word-card-pinyin">{pinyinText}</div>
        <div style={styles.fallbackHanzi}>{word}</div>
        <div style={styles.mutedInfo}>已阻止页面报错。请检查 HanziModal 或 hanzi-writer 资源。</div>
        <div style={styles.modalActionRow}>
          <button style={styles.secondaryPillButton} onClick={onClose}>关闭</button>
          <button style={styles.primaryPillButton} onClick={(e) => { stopEvent(e); onSpeakWord?.(); }}>播放发音</button>
        </div>
      </div>
    </div>
  );
}

function SafeHanziModal({ word, pinyinText, settings, onClose, onSpeakText, onSpeakWord }) {
  return (
    <div className="word-card-hanzi-scope" data-no-gesture="true">
      <HanziErrorBoundary
        fallback={(
          <HanziFallbackModal
            word={word}
            pinyinText={pinyinText}
            onClose={onClose}
            onSpeakWord={onSpeakWord}
          />
        )}
      >
        <HanziModal
          word={word}
          pinyinText={pinyinText}
          settings={settings}
          onClose={onClose}
          onSpeakText={onSpeakText}
          onSpeakWord={onSpeakWord}
          ttsVoice={settings.voiceChinese}
          speechRate={settings.speechRateChinese}
        />
      </HanziErrorBoundary>
    </div>
  );
}

// =================================================================================
// Recorder modal: record only, no SpeechRecognition
// =================================================================================
function getRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

const PronunciationComparison = memo(function PronunciationComparison({
  correctWord,
  pinyinText,
  settings,
  onClose,
}) {
  const [status, setStatus] = useState('idle');
  const [isPlayingType, setIsPlayingType] = useState(null);
  const [userAudioUrl, setUserAudioUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const localHowlRef = useRef(null);
  const userAudioUrlRef = useRef(null);

  useEffect(() => () => {
    if (userAudioUrlRef.current) URL.revokeObjectURL(userAudioUrlRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    localHowlRef.current?.unload?.();
    stopAllAudio();
  }, []);

  const startRecording = async () => {
    stopAllAudio();
    setErrorMessage('');

    if (!(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined')) {
      setErrorMessage('当前浏览器不支持录音');
      return;
    }

    try {
      if (userAudioUrlRef.current) {
        URL.revokeObjectURL(userAudioUrlRef.current);
        userAudioUrlRef.current = null;
        setUserAudioUrl(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        userAudioUrlRef.current = url;
        stream.getTracks().forEach((track) => track.stop());
        setUserAudioUrl(url);
        setStatus('review');
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
    } catch {
      setErrorMessage('无法访问麦克风，请检查权限');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const resetRecording = () => {
    if (userAudioUrlRef.current) {
      URL.revokeObjectURL(userAudioUrlRef.current);
      userAudioUrlRef.current = null;
    }
    setUserAudioUrl(null);
    setErrorMessage('');
    setStatus('idle');
    setIsPlayingType(null);
  };

  const playStandard = () => {
    localHowlRef.current?.stop?.();
    setIsPlayingType('standard');
    playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese, () => setIsPlayingType(null));
  };

  const playUser = () => {
    if (!userAudioUrl) return;
    stopAllAudio();
    setIsPlayingType('user');
    localHowlRef.current?.unload?.();
    localHowlRef.current = new Howl({
      src: [userAudioUrl],
      html5: true,
      onend: () => setIsPlayingType(null),
      onloaderror: () => setIsPlayingType(null),
      onplayerror: () => setIsPlayingType(null),
    });
    localHowlRef.current.play();
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose} data-no-gesture="true" role="presentation">
      <div style={styles.recordPanel} onClick={stopEvent} role="dialog" aria-modal="true">
        <div style={styles.modalHeaderLine}>
          <h3 style={styles.recordTitle}>发音跟读对比</h3>
          <button style={styles.smallIconButton} onClick={onClose} aria-label="关闭"><FaTimes /></button>
        </div>

        <div style={styles.recordWordDisplay}>
          <div style={styles.compPinyin} className="word-card-pinyin">{pinyinText}</div>
          <div style={styles.compChinese}>{correctWord}</div>
        </div>

        {status === 'idle' && (
          <div style={styles.idleStateContainer}>
            <button style={styles.bigRecordBtn} onClick={startRecording}>
              <FaMicrophone size={30} />
            </button>
            <div style={styles.instructionText}>点击开始录音</div>
            <div style={styles.mutedInfo}>仅录音，不启用语音识别，避免浏览器冲突。</div>
            {errorMessage && <div style={styles.errorText}>{errorMessage}</div>}
          </div>
        )}

        {status === 'recording' && (
          <div style={styles.idleStateContainer}>
            <div style={styles.waveformContainer}>
              <div style={styles.waveBar} />
              <div style={{ ...styles.waveBar, animationDelay: '0.2s' }} />
              <div style={{ ...styles.waveBar, animationDelay: '0.4s' }} />
              <div style={{ ...styles.waveBar, animationDelay: '0.1s' }} />
            </div>
            <button style={{ ...styles.bigRecordBtn, ...styles.recordingPulse }} onClick={stopRecording}>
              <FaStop size={30} />
            </button>
            <div style={styles.instructionText}>录音中... 点击停止</div>
          </div>
        )}

        {status === 'review' && (
          <div style={styles.reviewContainer}>
            <div style={styles.reviewRow}>
              <button
                style={{
                  ...styles.reviewCard,
                  border: isPlayingType === 'standard' ? '2px solid #3b82f6' : '1px solid rgba(148,163,184,0.25)',
                }}
                onClick={playStandard}
              >
                <div style={{ ...styles.reviewCircle, background: isPlayingType === 'standard' ? '#3b82f6' : 'rgba(59,130,246,0.12)' }}>
                  <FaVolumeUp size={18} color={isPlayingType === 'standard' ? '#fff' : '#2563eb'} />
                </div>
                <div style={styles.reviewCardText}>标准发音</div>
              </button>

              <button
                style={{
                  ...styles.reviewCard,
                  border: isPlayingType === 'user' ? '2px solid #14b8a6' : '1px solid rgba(148,163,184,0.25)',
                }}
                onClick={playUser}
              >
                <div style={{ ...styles.reviewCircle, background: isPlayingType === 'user' ? '#14b8a6' : 'rgba(20,184,166,0.12)' }}>
                  <FaPlayCircle size={18} color={isPlayingType === 'user' ? '#fff' : '#0f766e'} />
                </div>
                <div style={styles.reviewCardText}>我的录音</div>
              </button>
            </div>

            <div style={styles.modalActionRow}>
              <button style={styles.secondaryPillButton} onClick={resetRecording}>
                <FaRedo size={14} /> 重新录音
              </button>
              <button style={styles.primaryPillButton} onClick={onClose}>完成</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// =================================================================================
// Settings panel: cancel/save at bottom, no top X
// =================================================================================
const SettingsPanel = memo(function SettingsPanel({ settings, onCancel, onSave }) {
  const [draft, setDraft] = useState(settings);
  const t = useMemo(() => createUiText(draft.uiLanguage), [draft.uiLanguage]);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const update = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => update('backgroundImage', loadEvent.target?.result || '');
    reader.readAsDataURL(file);
  };

  return (
    <div style={styles.settingsOverlay} onClick={onCancel} data-no-gesture="true" role="presentation">
      <div style={styles.settingsPanel} onClick={stopEvent} role="dialog" aria-modal="true">
        <div style={styles.settingsHeader}>
          <h3 style={styles.settingsTitle}>{t('settings')}</h3>
          <div style={styles.mutedInfo}>{t('saveHint')}</div>
        </div>

        <div style={styles.settingsBody} className="word-card-scroll" data-allow-native-scroll="true">
          <div style={styles.settingGroup}>
            <div style={styles.settingLabel}>{t('language')}</div>
            <select style={styles.select} value={draft.uiLanguage} onChange={(e) => update('uiLanguage', e.target.value)}>
              {UI_LANGUAGES.map((lang) => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
            </select>
          </div>

          <div style={styles.settingGroup}>
            <div style={styles.settingLabel}>{t('display')}</div>
            <label style={styles.checkboxRow}><input type="checkbox" checked={draft.showChinese} onChange={(e) => update('showChinese', e.target.checked)} /> {t('chinese')}</label>
            <label style={styles.checkboxRow}><input type="checkbox" checked={draft.showPinyin} onChange={(e) => update('showPinyin', e.target.checked)} /> {t('pinyin')}</label>
            <label style={styles.checkboxRow}><input type="checkbox" checked={draft.showBurmese} onChange={(e) => update('showBurmese', e.target.checked)} /> {t('burmese')}</label>
            <label style={styles.checkboxRow}><input type="checkbox" checked={draft.showExample} onChange={(e) => update('showExample', e.target.checked)} /> {t('example')}</label>
          </div>

          <div style={styles.settingGroup}>
            <div style={styles.settingLabel}>{t('order')}</div>
            <div style={styles.toggleRow}>
              <button
                type="button"
                style={{ ...styles.segmentButton, ...(draft.order === 'sequential' ? styles.segmentActive : {}) }}
                onClick={() => update('order', 'sequential')}
              >
                <FaSortAmountDown /> {t('sequential')}
              </button>
              <button
                type="button"
                style={{ ...styles.segmentButton, ...(draft.order === 'random' ? styles.segmentActive : {}) }}
                onClick={() => update('order', 'random')}
              >
                <FaRandom /> {t('random')}
              </button>
            </div>
          </div>

          <div style={styles.settingGroup}>
            <div style={styles.settingLabel}>{t('autoplay')}</div>
            <label style={styles.checkboxRow}><input type="checkbox" checked={draft.autoPlayChinese} onChange={(e) => update('autoPlayChinese', e.target.checked)} /> {t('chineseAudio')}</label>
            <label style={styles.checkboxRow}><input type="checkbox" checked={draft.autoPlayBurmese} onChange={(e) => update('autoPlayBurmese', e.target.checked)} /> {t('burmeseTts')}</label>
            <label style={styles.checkboxRow}><input type="checkbox" checked={draft.autoPlayExample} onChange={(e) => update('autoPlayExample', e.target.checked)} /> {t('exampleTts')}</label>
            <label style={styles.checkboxRow}><input type="checkbox" checked={draft.autoBrowse} onChange={(e) => update('autoBrowse', e.target.checked)} /> {t('autoBrowse')}</label>
            {draft.autoBrowse && (
              <div style={styles.sliderGroup}>
                <div style={styles.sliderLabelRow}>
                  <span>{t('delay')}</span>
                  <strong>{Math.round(clamp(draft.autoBrowseDelay, 3000, 20000) / 1000)}s</strong>
                </div>
                <input type="range" min="3000" max="20000" step="500" value={clamp(draft.autoBrowseDelay, 3000, 20000)} onChange={(e) => update('autoBrowseDelay', Number(e.target.value))} />
              </div>
            )}
          </div>

          <div style={styles.settingGroup}>
            <div style={styles.settingLabel}>{t('chineseVoice')}</div>
            <select style={styles.select} value={draft.voiceChinese} onChange={(e) => update('voiceChinese', e.target.value)}>
              {CHINESE_VOICES.map((voice) => <option key={voice.value} value={voice.value}>{voice.label}</option>)}
            </select>
            <div style={styles.sliderGroup}>
              <div style={styles.sliderLabelRow}><span>{t('chineseRate')}</span><strong>{normalizeRate(draft.speechRateChinese).toFixed(2)}x</strong></div>
              <input type="range" min="-80" max="50" step="5" value={draft.speechRateChinese} onChange={(e) => update('speechRateChinese', Number(e.target.value))} />
            </div>
          </div>

          <div style={styles.settingGroup}>
            <div style={styles.settingLabel}>{t('burmeseVoice')}</div>
            <select style={styles.select} value={draft.voiceBurmese} onChange={(e) => update('voiceBurmese', e.target.value)}>
              {BURMESE_VOICES.map((voice) => <option key={voice.value} value={voice.value}>{voice.label}</option>)}
            </select>
            <div style={styles.sliderGroup}>
              <div style={styles.sliderLabelRow}><span>{t('burmeseRate')}</span><strong>{normalizeRate(draft.speechRateBurmese).toFixed(2)}x</strong></div>
              <input type="range" min="-80" max="50" step="5" value={draft.speechRateBurmese} onChange={(e) => update('speechRateBurmese', Number(e.target.value))} />
            </div>
          </div>

          <div style={styles.settingGroup}>
            <div style={styles.settingLabel}>{t('background')}</div>
            <div style={styles.toggleRow}>
              <label style={styles.segmentButton}>
                {t('upload')}
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </label>
              <button type="button" style={styles.segmentButton} onClick={() => update('backgroundImage', '')}>{t('resetGradient')}</button>
            </div>
          </div>
        </div>

        <div style={styles.settingsFooter}>
          <button type="button" style={styles.settingsCancelBtn} onClick={onCancel}>{t('cancel')}</button>
          <button type="button" style={styles.settingsSaveBtn} onClick={() => onSave(draft)}>{t('save')}</button>
        </div>
      </div>
    </div>
  );
});

// =================================================================================
// Jump modal
// =================================================================================
function JumpModal({ max, current, onJump, onClose, language = 'zh-my' }) {
  const [value, setValue] = useState(current + 1);
  const t = useMemo(() => createUiText(language), [language]);
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  const confirm = () => {
    const num = parseInt(value, 10);
    if (num >= 1 && num <= max) onJump(num - 1);
  };

  return (
    <div style={styles.settingsOverlay} onClick={onClose} data-no-gesture="true" role="presentation">
      <div style={styles.jumpPanel} onClick={stopEvent} role="dialog" aria-modal="true">
        <div style={styles.settingsTitle}>{t('jumpTo')}</div>
        <input
          ref={inputRef}
          type="number"
          value={value}
          min="1"
          max={max}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') confirm(); }}
          style={styles.jumpInput}
        />
        <div style={styles.modalActionRow}>
          <button type="button" style={styles.secondaryPillButton} onClick={onClose}>{t('cancel')}</button>
          <button type="button" style={styles.primaryPillButton} onClick={confirm}>{t('confirm')}</button>
        </div>
      </div>
    </div>
  );
}

// =================================================================================
// Main component
// =================================================================================
export default function WordCard({ words = [], isOpen, onClose, progressKey = 'default', level }) {
  const [isMounted, setIsMounted] = useState(false);
  const [settings, setSettings] = useCardSettings();
  const [activeCards, setActiveCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecordingOpen, setIsRecordingOpen] = useState(false);
  const [writerWord, setWriterWord] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [isSpellPlaying, setIsSpellPlaying] = useState(false);

  const autoBrowseTimerRef = useRef(null);
  const lastDirectionRef = useRef(1);
  const t = useMemo(() => createUiText(settings.uiLanguage), [settings.uiLanguage]);

  useLockPageInteractions(isOpen);
  useAutoFullscreen(isOpen);

  useEffect(() => {
    injectRuntimeStyles();
    setIsMounted(true);
    return () => stopAllAudio({ stopEffects: true });
  }, []);

  const processedCards = useMemo(() => {
    const mapped = words
      .map((word, index) => ({
        id: getWordId(word, index),
        hsk_level: word.hsk_level,
        chinese: word.chinese || word.word,
        audioText: word.audioText || word.chinese || word.word,
        pinyin: normalizePinyinText(word.pinyin),
        burmese: word.burmese || word.meaning,
        explanation: word.explanation,
        mnemonic: word.mnemonic,
        example: word.example,
        example2: word.example2,
        spellAudio: word.spellAudio || word.spell_audio || word.spellingAudio || word.pinyinAudio || word.pinyin_audio,
      }))
      .filter((word) => word.chinese);

    return settings.order === 'random' ? shuffleArray(mapped) : mapped;
  }, [words, settings.order]);

  useEffect(() => {
    const initialCards = processedCards.length > 0 ? processedCards : [{ id: 'fallback', chinese: '...', burmese: '...' }];
    setActiveCards(initialCards);

    const savedIndex = parseInt(safeStorage.get(`${PROGRESS_PREFIX}${progressKey}`) || '0', 10);
    if (Number.isFinite(savedIndex) && savedIndex >= 0 && savedIndex < initialCards.length) setCurrentIndex(savedIndex);
    else setCurrentIndex(0);
  }, [processedCards, progressKey]);

  useEffect(() => {
    if (activeCards.length > 0) {
      safeStorage.set(`${PROGRESS_PREFIX}${progressKey}`, String(currentIndex));
    }
  }, [currentIndex, activeCards.length, progressKey]);

  useEffect(() => {
    if (!isOpen) return;
    const seen = safeStorage.get(HINT_SEEN_KEY) === '1';
    setShowSwipeHint(!seen);
  }, [isOpen]);

  const currentCard = activeCards[currentIndex] || null;

  useEffect(() => {
    let alive = true;
    setIsFlipped(false);
    setIsSpellPlaying(false);

    if (currentCard?.id && currentCard.id !== 'fallback') {
      isFavorite(currentCard.id).then((result) => { if (alive) setIsFavoriteCard(result); });
    } else {
      setIsFavoriteCard(false);
    }

    return () => { alive = false; };
  }, [currentCard]);

  const getPinyin = useCallback((card) => card?.pinyin || getPinyinText(card?.chinese), []);

  const markHintSeen = useCallback(() => {
    setShowSwipeHint(false);
    safeStorage.set(HINT_SEEN_KEY, '1');
  }, []);

  const navigate = useCallback((direction) => {
    if (activeCards.length === 0) return;
    lastDirectionRef.current = direction >= 0 ? 1 : -1;
    stopAllAudio();
    triggerSwitchFeedback();
    markHintSeen();
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + direction + activeCards.length) % activeCards.length);
  }, [activeCards.length, markHintSeen]);

  const jumpToCard = useCallback((index) => {
    if (index < 0 || index >= activeCards.length) return;
    lastDirectionRef.current = index >= currentIndex ? 1 : -1;
    stopAllAudio();
    triggerSwitchFeedback();
    markHintSeen();
    setIsFlipped(false);
    setCurrentIndex(index);
    setIsJumping(false);
  }, [activeCards.length, currentIndex, markHintSeen]);

  const handleSpellRead = useCallback((event) => {
    stopEvent(event);
    if (!currentCard?.chinese) return;

    setIsSpellPlaying(true);
    spellSequenceId += 1;
    playSpellAudio(currentCard, () => setIsSpellPlaying(false), level);
  }, [currentCard, level]);

  const handleGoHome = (event) => {
    stopEvent(event);
    window.location.href = 'https://886.best';
  };

  const handleToggleFavorite = async (event) => {
    stopEvent(event);
    if (!currentCard || currentCard.id === 'fallback') return;
    const optimistic = !isFavoriteCard;
    setIsFavoriteCard(optimistic);
    const result = await toggleFavorite(currentCard);
    if (result !== optimistic) setIsFavoriteCard(result);
  };

  const handleKnow = (event) => {
    stopEvent(event);
    stopAllAudio();
    if (!currentCard) return;

    const nextCards = activeCards.filter((card) => card.id !== currentCard.id);
    if (nextCards.length === 0) {
      setActiveCards([]);
      return;
    }

    triggerSwitchFeedback();
    setActiveCards(nextCards);
    setIsFlipped(false);
    if (currentIndex >= nextCards.length) setCurrentIndex(0);
  };

  const handleDontKnow = (event) => {
    stopEvent(event);
    stopAllAudio();
    if (isFlipped) navigate(1);
    else setIsFlipped(true);
  };

  const handleCardClick = (event) => {
    if (event.target?.closest?.('[data-no-flip="true"]')) return;
    markHintSeen();
    setIsFlipped((prev) => !prev);
  };

  const bind = useDrag(
    ({ down, movement: [mx, my], velocity, event }) => {
      if (event.target?.closest?.('[data-no-gesture="true"]')) return;
      if (down) return;

      event.stopPropagation();
      const absX = Math.abs(mx);
      const absY = Math.abs(my);

      if (absX > absY) {
        if (absX > 80 || (velocity[0] > 0.45 && absX > 35)) {
          markHintSeen();
          stopAllAudio();
          onClose();
        }
        return;
      }

      if (absY > 60 || (velocity[1] > 0.42 && absY > 28)) {
        navigate(my < 0 ? 1 : -1);
      }
    },
    {
      filterTaps: true,
      preventDefault: true,
      threshold: 8,
      pointer: { touch: true },
    },
  );

  useEffect(() => {
    if (!isOpen || !currentCard) return undefined;
    clearTimeout(autoBrowseTimerRef.current);
    stopAllAudio();

    const startAutoBrowse = () => {
      if (settings.autoBrowse) {
        autoBrowseTimerRef.current = setTimeout(() => navigate(1), clamp(settings.autoBrowseDelay, 3000, 20000));
      }
    };

    const playFront = () => {
      if (settings.autoPlayChinese && currentCard.chinese) {
        playR2Audio(currentCard, startAutoBrowse, settings, level);
      } else {
        startAutoBrowse();
      }
    };

    const playBack = () => {
      const playExamples = () => {
        if (settings.autoPlayExample && currentCard.example) {
          playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, () => {
            if (settings.autoPlayExample && currentCard.example2) {
              playTTS(currentCard.example2, settings.voiceChinese, settings.speechRateChinese, startAutoBrowse);
            } else {
              startAutoBrowse();
            }
          });
        } else {
          startAutoBrowse();
        }
      };

      if (settings.autoPlayBurmese && currentCard.burmese) {
        playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, playExamples);
      } else {
        playExamples();
      }
    };

    const timer = setTimeout(() => {
      if (isFlipped) playBack();
      else playFront();
    }, 280);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoBrowseTimerRef.current);
    };
  }, [currentIndex, currentCard, isFlipped, isOpen, settings, level, navigate]);

  const pageTransition = useTransition(isOpen, {
    from: { opacity: 0 },
    enter: { opacity: 1 },
    leave: { opacity: 0 },
    config: { tension: 260, friction: 30 },
  });

  const backgroundStyle = settings.backgroundImage
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(248,250,252,0.72), rgba(241,245,249,0.52)), url(${settings.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {};

  const renderPlainBack = (card) => {
    const blocks = [];
    const example1Pinyin = card.example ? getPinyinText(card.example) : '';
    const example2Pinyin = card.example2 ? getPinyinText(card.example2) : '';

    if (settings.showBurmese && card.burmese) {
      blocks.push(
        <button key="meaning" type="button" style={styles.backPlainButton} onClick={(e) => playTTS(card.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)} data-no-flip="true">
          <div style={styles.plainSectionLabel}>{t('meaning')}</div>
          <div style={styles.burmeseTextPlain}>{card.burmese}</div>
        </button>,
      );
    }

    if (card.explanation) {
      blocks.push(
        <button key="explanation" type="button" style={styles.backPlainButton} onClick={(e) => playTTS(card.explanation, settings.voiceBurmese, settings.speechRateBurmese, null, e)} data-no-flip="true">
          <div style={styles.plainSectionLabel}>{t('explanation')}</div>
          <div style={styles.explanationTextPlain}>{card.explanation}</div>
        </button>,
      );
    }

    if (card.mnemonic) {
      blocks.push(
        <div key="mnemonic" style={styles.backPlainBlock} data-no-flip="true">
          <div style={styles.plainSectionLabel}>{t('mnemonic')}</div>
          <div style={styles.memoTextPlain}>{card.mnemonic}</div>
        </div>,
      );
    }

    if (settings.showExample && card.example) {
      blocks.push(
        <button key="example1" type="button" style={styles.backPlainButton} onClick={(e) => playTTS(card.example, settings.voiceChinese, settings.speechRateChinese, null, e)} data-no-flip="true">
          <div style={styles.plainSectionLabel}>{t('example1')}</div>
          <div style={styles.examplePinyinPlain} className="word-card-pinyin">{example1Pinyin}</div>
          <div style={styles.exampleTextPlain}>{card.example}</div>
        </button>,
      );
    }

    if (settings.showExample && card.example2) {
      blocks.push(
        <button key="example2" type="button" style={styles.backPlainButton} onClick={(e) => playTTS(card.example2, settings.voiceChinese, settings.speechRateChinese, null, e)} data-no-flip="true">
          <div style={styles.plainSectionLabel}>{t('example2')}</div>
          <div style={styles.examplePinyinPlain} className="word-card-pinyin">{example2Pinyin}</div>
          <div style={styles.exampleTextPlain}>{card.example2}</div>
        </button>,
      );
    }

    return blocks;
  };

  const renderCard = (card = currentCard, cardIndex = currentIndex, isCurrent = true) => {
    if (!card || activeCards.length === 0) {
      return (
        <div style={styles.emptyState}>
          <div style={styles.emptyTitle}>{t('finished')}</div>
          <button type="button" style={styles.primaryPillButton} onClick={onClose}>{t('close')}</button>
        </div>
      );
    }

    const pinyinText = getPinyin(card);

    return (
      <div style={{ ...styles.cardCanvas, pointerEvents: isCurrent ? 'auto' : 'none' }} onClick={handleCardClick}>
        <div style={styles.topLeftControls} data-no-gesture="true" data-no-flip="true">
          <button type="button" style={styles.iconButton} onPointerDown={stopEvent} onClick={handleGoHome} title="Home"><FaHome size={18} /></button>
        </div>

        <div style={styles.rightControls} data-no-gesture="true" data-no-flip="true">
          <button type="button" style={styles.iconButton} onPointerDown={stopEvent} onClick={(e) => { stopEvent(e); setIsSettingsOpen(true); }} title={t('settings')}><FaCog size={18} /></button>
          <button
            type="button"
            style={{ ...styles.iconButton, ...(isSpellPlaying ? styles.iconButtonActive : {}) }}
            onPointerDown={stopEvent}
            onClick={handleSpellRead}
            title={t('spelling')}
          >
            <FaPlayCircle size={20} />
          </button>
          <button type="button" style={styles.iconButton} onPointerDown={stopEvent} onClick={(e) => { stopEvent(e); setIsRecordingOpen(true); }} title={t('recording')}><FaMicrophone size={18} /></button>
          {card.chinese && card.chinese.length <= 5 && !String(card.chinese).includes(' ') && (
            <button type="button" style={styles.iconButton} onPointerDown={stopEvent} onClick={(e) => { stopEvent(e); setWriterWord(card.chinese); }} title={t('stroke')}><FaPenFancy size={18} /></button>
          )}
          <button type="button" style={styles.iconButton} onPointerDown={stopEvent} onClick={handleToggleFavorite} title={t('favorite')}>
            {isFavoriteCard ? <FaHeart size={18} color="#ef4444" /> : <FaRegHeart size={18} />}
          </button>
        </div>

        <div style={styles.flipArea} className="word-card-flip-scene">
          <div
            className="word-card-flip-inner"
            style={{
              ...styles.flipInner,
              transform: `rotateY(${isFlipped && isCurrent ? 180 : 0}deg)`,
            }}
          >
            <div className="word-card-face" style={{ ...styles.face, ...styles.frontFace }}>
              <div style={styles.centerContent}>
                {settings.showPinyin && <div style={styles.frontPinyin} className="word-card-pinyin">{pinyinText}</div>}
                {settings.showChinese && <div style={styles.frontChinese}>{card.chinese}</div>}
                <div style={styles.frontTip}>{t('frontTip')}</div>
              </div>
            </div>

            <div className="word-card-face word-card-face-back" style={{ ...styles.face, ...styles.backFace }}>
              <div style={styles.backContentPlain}>
                <div style={styles.backHeaderPlain}>
                  {settings.showPinyin && <div style={styles.backPinyin} className="word-card-pinyin">{pinyinText}</div>}
                  {settings.showChinese && <div style={styles.backChinese}>{card.chinese}</div>}
                  <div style={styles.flipBackTip}>{t('backTip')}</div>
                </div>

                <div style={styles.backPlainScroll} className="word-card-scroll" data-allow-native-scroll="true">
                  {renderPlainBack(card)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.bottomOverlay} data-no-gesture="true" data-no-flip="true">
          <button type="button" style={styles.counterBadge} onPointerDown={stopEvent} onClick={(e) => { stopEvent(e); setIsJumping(true); }}>{cardIndex + 1} / {activeCards.length}</button>
          <div style={styles.bottomButtons}>
            <button type="button" style={styles.dontKnowButton} onPointerDown={stopEvent} onClick={handleDontKnow}>{t('dontKnow')}</button>
            <button type="button" style={styles.knowButton} onPointerDown={stopEvent} onClick={handleKnow}>{t('know')}</button>
          </div>
        </div>
      </div>
    );
  };

  const cardTransitions = useTransition(activeCards.length > 0 ? currentIndex : -1, {
    key: (item) => {
      const card = activeCards[item];
      return card ? `${card.id}-${item}` : 'empty';
    },
    from: () => ({ transform: `translate3d(0, ${lastDirectionRef.current > 0 ? '100%' : '-100%'}, 0)`, opacity: 1 }),
    enter: { transform: 'translate3d(0, 0%, 0)', opacity: 1 },
    leave: () => ({ transform: `translate3d(0, ${lastDirectionRef.current > 0 ? '-100%' : '100%'}, 0)`, opacity: 1 }),
    config: { tension: 340, friction: 36, clamp: true },
  });

  const content = pageTransition((pageStyle, visible) => {
    if (!visible) return null;

    return (
      <animated.div style={{ ...styles.fullScreen, ...backgroundStyle, ...pageStyle }} className="word-card-no-select word-card-animated">
        <div style={styles.softGradientLayer} />
        <div style={styles.blurBlobA} />
        <div style={styles.blurBlobB} />
        <div style={styles.blurBlobC} />

        <div style={styles.gestureLayer} {...bind()}>
          {showSwipeHint && (
            <div style={styles.swipeHintBubble} data-no-gesture="true">
              {t('swipeHint')}
            </div>
          )}

          {cardTransitions((cardStyle, item) => {
            const card = activeCards[item];
            return (
              <animated.div style={{ ...styles.cardTransitionLayer, ...cardStyle }}>
                {renderCard(card, item, item === currentIndex)}
              </animated.div>
            );
          })}

          {writerWord && currentCard && (
            <SafeHanziModal
              word={writerWord}
              pinyinText={getPinyin(currentCard)}
              settings={settings}
              onClose={() => setWriterWord(null)}
              onSpeakText={(text, done) => playTTS(text, settings.voiceChinese, settings.speechRateChinese, done, null, { cancelSpell: false })}
              onSpeakWord={(done) => playR2Audio(currentCard, done, settings, level, { cancelSpell: false })}
            />
          )}

          {isRecordingOpen && currentCard && (
            <PronunciationComparison
              correctWord={currentCard.chinese}
              pinyinText={getPinyin(currentCard)}
              settings={settings}
              onClose={() => setIsRecordingOpen(false)}
            />
          )}

          {isSettingsOpen && (
            <SettingsPanel
              settings={settings}
              onCancel={() => setIsSettingsOpen(false)}
              onSave={(next) => {
                setSettings({ ...DEFAULT_SETTINGS, ...next });
                setIsSettingsOpen(false);
              }}
            />
          )}

          {isJumping && (
            <JumpModal
              max={activeCards.length}
              current={currentIndex}
              onJump={jumpToCard}
              onClose={() => setIsJumping(false)}
              language={settings.uiLanguage}
            />
          )}
        </div>
      </animated.div>
    );
  });

  return isMounted ? createPortal(content, document.body) : null;
}

// =================================================================================
// Styles
// =================================================================================
const pinyinFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, "Noto Sans", sans-serif';
const burmeseFont = '"Padauk", "Myanmar Text", sans-serif';
const shadowSoft = '0 20px 60px rgba(51, 65, 85, 0.14)';
const glassWhite = 'rgba(255,255,255,0.56)';
const glassBorder = '1px solid rgba(255,255,255,0.65)';

const styles = {
  fullScreen: {
    position: 'fixed',
    inset: 0,
    width: '100vw',
    height: '100dvh',
    minHeight: '-webkit-fill-available',
    zIndex: 1000,
    overflow: 'hidden',
    touchAction: 'none',
    overscrollBehavior: 'none',
    background: 'linear-gradient(145deg, #eff8ff 0%, #f7fbff 42%, #f9f4ff 68%, #fff7f1 100%)',
  },
  softGradientLayer: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.2))',
    backdropFilter: 'blur(8px)',
  },
  blurBlobA: {
    position: 'absolute',
    top: '-10%',
    right: '-22%',
    width: '70vw',
    height: '70vw',
    borderRadius: '50%',
    background: 'rgba(125, 211, 252, 0.34)',
    filter: 'blur(28px)',
  },
  blurBlobB: {
    position: 'absolute',
    left: '-24%',
    bottom: '-16%',
    width: '76vw',
    height: '76vw',
    borderRadius: '50%',
    background: 'rgba(253, 186, 116, 0.22)',
    filter: 'blur(34px)',
  },
  blurBlobC: {
    position: 'absolute',
    right: '8%',
    bottom: '8%',
    width: '56vw',
    height: '56vw',
    borderRadius: '50%',
    background: 'rgba(196, 181, 253, 0.24)',
    filter: 'blur(32px)',
  },
  gestureLayer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    touchAction: 'none',
    overflow: 'hidden',
  },
  cardTransitionLayer: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    willChange: 'transform',
  },
  cardCanvas: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.38), rgba(255,255,255,0.18))',
    backdropFilter: 'blur(20px)',
  },
  swipeHintBubble: {
    position: 'absolute',
    top: 'max(14px, env(safe-area-inset-top))',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 16px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.68)',
    border: glassBorder,
    boxShadow: shadowSoft,
    backdropFilter: 'blur(16px)',
    color: '#475569',
    fontWeight: 800,
    fontSize: '0.9rem',
    zIndex: 20,
    whiteSpace: 'nowrap',
    animation: 'wordCardHintFloat 2.2s ease-in-out infinite',
  },
  topLeftControls: {
    position: 'absolute',
    top: 'calc(16px + env(safe-area-inset-top))',
    left: '16px',
    zIndex: 12,
  },
  rightControls: {
    position: 'absolute',
    right: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: '13px',
  },
  iconButton: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: glassBorder,
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(16px)',
    color: '#475569',
    boxShadow: '0 10px 28px rgba(71,85,105,0.14)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  iconButtonActive: {
    color: '#2563eb',
    background: 'rgba(219,234,254,0.88)',
    transform: 'scale(0.96)',
  },
  flipArea: {
    position: 'absolute',
    inset: '0 0 148px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'calc(58px + env(safe-area-inset-top)) 76px 18px 34px',
  },
  flipInner: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  face: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frontFace: {
    color: '#0f172a',
  },
  backFace: {
    color: '#0f172a',
  },
  centerContent: {
    textAlign: 'center',
    width: '100%',
    maxWidth: '640px',
    padding: '8px 4px',
  },
  frontPinyin: {
    fontFamily: pinyinFont,
    fontSize: 'clamp(2rem, 7vw, 3.1rem)',
    color: '#c76b00',
    fontWeight: 900,
    lineHeight: 1.42,
    marginBottom: '10px',
  },
  frontChinese: {
    fontSize: 'clamp(5.6rem, 24vw, 11rem)',
    fontWeight: 950,
    lineHeight: 1.03,
    letterSpacing: '-0.06em',
    color: '#111827',
    textShadow: '0 18px 38px rgba(15,23,42,0.10)',
    wordBreak: 'break-word',
  },
  frontTip: {
    marginTop: '28px',
    color: 'rgba(71,85,105,0.68)',
    fontWeight: 900,
    fontSize: 'clamp(1rem, 4vw, 1.25rem)',
  },
  backContent: {
    width: '100%',
    height: '100%',
    maxWidth: '680px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '2px 0',
  },
  backHeader: {
    textAlign: 'center',
    flex: '0 0 auto',
  },
  backPinyin: {
    fontFamily: pinyinFont,
    fontSize: '1.4rem',
    color: '#c76b00',
    fontWeight: 900,
    lineHeight: 1.45,
  },
  backChinese: {
    marginTop: '2px',
    fontSize: '2.1rem',
    fontWeight: 950,
    color: '#111827',
  },
  flipBackTip: {
    marginTop: '4px',
    color: 'rgba(100,116,139,0.72)',
    fontSize: '0.86rem',
    fontWeight: 700,
  },
  backScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    touchAction: 'pan-y',
    padding: '0 0 6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  meaningCard: {
    width: '100%',
    border: glassBorder,
    background: 'rgba(255,255,255,0.66)',
    backdropFilter: 'blur(16px)',
    borderRadius: '24px',
    padding: '18px 16px',
    boxShadow: '0 12px 30px rgba(71,85,105,0.10)',
    textAlign: 'center',
    cursor: 'pointer',
  },
  explainCard: {
    width: '100%',
    border: '1px solid rgba(167,243,208,0.75)',
    background: 'rgba(240,253,244,0.66)',
    backdropFilter: 'blur(16px)',
    borderRadius: '22px',
    padding: '14px 15px',
    textAlign: 'center',
    cursor: 'pointer',
  },
  memoCard: {
    width: '100%',
    border: '1px solid rgba(253,230,138,0.72)',
    background: 'rgba(255,251,235,0.62)',
    backdropFilter: 'blur(16px)',
    borderRadius: '22px',
    padding: '14px 15px',
    textAlign: 'center',
  },
  exampleCard: {
    width: '100%',
    border: '1px solid rgba(191,219,254,0.75)',
    background: 'rgba(239,246,255,0.64)',
    backdropFilter: 'blur(16px)',
    borderRadius: '22px',
    padding: '14px 15px',
    textAlign: 'center',
    cursor: 'pointer',
  },
  sectionLabel: {
    fontSize: '0.78rem',
    fontWeight: 900,
    letterSpacing: '0.04em',
    color: '#64748b',
    marginBottom: '6px',
  },
  burmeseText: {
    fontFamily: burmeseFont,
    fontSize: '1.55rem',
    fontWeight: 800,
    color: '#334155',
    lineHeight: 1.5,
  },
  explanationText: {
    fontFamily: burmeseFont,
    fontSize: '1.08rem',
    fontWeight: 700,
    color: '#15803d',
    lineHeight: 1.5,
  },
  memoText: {
    fontSize: '1rem',
    color: '#92400e',
    fontWeight: 700,
    lineHeight: 1.45,
  },
  examplePinyin: {
    fontFamily: pinyinFont,
    fontSize: '1rem',
    color: '#c76b00',
    fontWeight: 800,
    lineHeight: 1.45,
    marginBottom: '4px',
  },
  exampleText: {
    fontSize: '1.25rem',
    color: '#1e293b',
    fontWeight: 800,
    lineHeight: 1.42,
  },
  backContentPlain: {
    width: '100%',
    height: '100%',
    maxWidth: '760px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '22px',
    padding: '0 4px',
  },
  backHeaderPlain: {
    textAlign: 'center',
    flex: '0 0 auto',
  },
  backPlainScroll: {
    flex: '0 1 auto',
    maxHeight: '58vh',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    touchAction: 'pan-y',
    padding: '0 0 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    textAlign: 'center',
  },
  backPlainButton: {
    appearance: 'none',
    WebkitAppearance: 'none',
    border: 'none',
    background: 'transparent',
    padding: '0 8px',
    margin: 0,
    cursor: 'pointer',
    textAlign: 'center',
  },
  backPlainBlock: {
    padding: '0 8px',
    textAlign: 'center',
  },
  plainSectionLabel: {
    fontSize: '0.86rem',
    fontWeight: 950,
    letterSpacing: '0.04em',
    color: 'rgba(100,116,139,0.82)',
    marginBottom: '7px',
  },
  burmeseTextPlain: {
    fontFamily: burmeseFont,
    fontSize: 'clamp(1.6rem, 6vw, 2.4rem)',
    fontWeight: 900,
    color: '#273449',
    lineHeight: 1.45,
  },
  explanationTextPlain: {
    fontFamily: burmeseFont,
    fontSize: 'clamp(1.1rem, 4.6vw, 1.55rem)',
    fontWeight: 800,
    color: '#15803d',
    lineHeight: 1.5,
  },
  memoTextPlain: {
    fontSize: 'clamp(1rem, 4.2vw, 1.35rem)',
    color: '#92400e',
    fontWeight: 800,
    lineHeight: 1.48,
  },
  examplePinyinPlain: {
    fontFamily: pinyinFont,
    fontSize: 'clamp(1rem, 4vw, 1.25rem)',
    color: '#c76b00',
    fontWeight: 900,
    lineHeight: 1.48,
    marginBottom: '4px',
  },
  exampleTextPlain: {
    fontSize: 'clamp(1.25rem, 5.2vw, 1.8rem)',
    color: '#1e293b',
    fontWeight: 900,
    lineHeight: 1.42,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 'calc(14px + env(safe-area-inset-bottom))',
    zIndex: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    padding: '0 18px',
  },
  counterBadge: {
    border: glassBorder,
    background: glassWhite,
    backdropFilter: 'blur(18px)',
    boxShadow: shadowSoft,
    color: '#334155',
    padding: '12px 28px',
    borderRadius: '999px',
    fontSize: '1.22rem',
    fontWeight: 950,
    cursor: 'pointer',
  },
  bottomButtons: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  },
  dontKnowButton: {
    height: '74px',
    borderRadius: '24px',
    border: 'none',
    background: 'linear-gradient(135deg, #f59e0b, #b45309)',
    color: 'white',
    fontFamily: burmeseFont,
    fontSize: 'clamp(1.05rem, 4.5vw, 1.45rem)',
    fontWeight: 950,
    lineHeight: 1.15,
    cursor: 'pointer',
    boxShadow: '0 16px 32px rgba(180,83,9,0.24)',
  },
  knowButton: {
    height: '74px',
    borderRadius: '24px',
    border: 'none',
    background: 'linear-gradient(135deg, #10b981, #047857)',
    color: 'white',
    fontFamily: burmeseFont,
    fontSize: 'clamp(1.05rem, 4.5vw, 1.45rem)',
    fontWeight: 950,
    lineHeight: 1.15,
    cursor: 'pointer',
    boxShadow: '0 16px 32px rgba(4,120,87,0.24)',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10020,
    background: 'rgba(15,23,42,0.50)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  simpleModalPanel: {
    width: '100%',
    maxWidth: '420px',
    borderRadius: '28px',
    background: 'rgba(255,255,255,0.95)',
    boxShadow: '0 24px 70px rgba(15,23,42,0.24)',
    padding: '24px',
    textAlign: 'center',
  },
  recordPanel: {
    width: '100%',
    maxWidth: '410px',
    borderRadius: '28px',
    background: 'rgba(255,255,255,0.96)',
    boxShadow: '0 24px 70px rgba(15,23,42,0.24)',
    padding: '20px',
  },
  modalHeaderLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '18px',
  },
  recordTitle: {
    margin: 0,
    fontSize: '1.15rem',
    color: '#1e293b',
    fontWeight: 950,
  },
  smallIconButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordWordDisplay: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  compPinyin: {
    fontFamily: pinyinFont,
    fontSize: '1.2rem',
    color: '#7c3aed',
    fontWeight: 900,
    lineHeight: 1.45,
  },
  compChinese: {
    fontSize: '3rem',
    fontWeight: 950,
    color: '#0f172a',
    lineHeight: 1.1,
  },
  idleStateContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  bigRecordBtn: {
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 14px 32px rgba(37,99,235,0.32)',
    cursor: 'pointer',
  },
  recordingPulse: {
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    animation: 'wordCardRecordRipple 1.5s infinite',
  },
  instructionText: {
    color: '#475569',
    fontWeight: 850,
    fontSize: '1rem',
  },
  waveformContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    height: '28px',
  },
  waveBar: {
    width: '5px',
    height: '10px',
    borderRadius: '999px',
    background: '#ef4444',
    animation: 'wordCardRecordWave 1s ease-in-out infinite',
  },
  errorText: {
    color: '#dc2626',
    fontWeight: 800,
  },
  reviewContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  reviewRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  },
  reviewCard: {
    borderRadius: '22px',
    background: '#f8fafc',
    padding: '18px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  reviewCircle: {
    width: '54px',
    height: '54px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCardText: {
    color: '#475569',
    fontWeight: 900,
  },
  modalActionRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '10px',
  },
  secondaryPillButton: {
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#334155',
    borderRadius: '999px',
    padding: '12px 18px',
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
  },
  primaryPillButton: {
    border: 'none',
    background: '#2563eb',
    color: 'white',
    borderRadius: '999px',
    padding: '12px 22px',
    fontWeight: 950,
    cursor: 'pointer',
  },
  settingsOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10030,
    background: 'rgba(15,23,42,0.45)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '12px',
  },
  settingsPanel: {
    width: '100%',
    maxWidth: '520px',
    maxHeight: '84vh',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '30px',
    background: 'rgba(255,255,255,0.97)',
    boxShadow: '0 24px 70px rgba(15,23,42,0.26)',
    overflow: 'hidden',
  },
  settingsHeader: {
    padding: '22px 22px 14px',
    borderBottom: '1px solid #e2e8f0',
  },
  settingsTitle: {
    margin: 0,
    fontSize: '1.2rem',
    color: '#1e293b',
    fontWeight: 950,
  },
  mutedInfo: {
    color: '#64748b',
    fontSize: '0.86rem',
    fontWeight: 700,
    lineHeight: 1.4,
  },
  settingsBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px 22px',
    overscrollBehavior: 'contain',
    touchAction: 'pan-y',
  },
  settingGroup: {
    marginBottom: '22px',
  },
  settingLabel: {
    color: '#334155',
    fontWeight: 950,
    marginBottom: '10px',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    minHeight: '34px',
    color: '#334155',
    fontWeight: 800,
  },
  toggleRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  segmentButton: {
    minHeight: '46px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#334155',
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  segmentActive: {
    borderColor: '#93c5fd',
    background: '#dbeafe',
    color: '#1d4ed8',
  },
  sliderGroup: {
    marginTop: '12px',
  },
  sliderLabelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#475569',
    fontSize: '0.9rem',
    fontWeight: 800,
    marginBottom: '8px',
  },
  select: {
    width: '100%',
    height: '46px',
    borderRadius: '16px',
    border: '1px solid #cbd5e1',
    background: 'white',
    color: '#1e293b',
    fontWeight: 800,
    padding: '0 12px',
  },
  settingsFooter: {
    flex: '0 0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '16px 18px calc(16px + env(safe-area-inset-bottom))',
    borderTop: '1px solid #e2e8f0',
    background: 'rgba(255,255,255,0.96)',
  },
  settingsCancelBtn: {
    height: '52px',
    borderRadius: '18px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#334155',
    fontWeight: 950,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  settingsSaveBtn: {
    height: '52px',
    borderRadius: '18px',
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: 'white',
    fontWeight: 950,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  jumpPanel: {
    width: '100%',
    maxWidth: '320px',
    borderRadius: '26px',
    background: 'white',
    boxShadow: '0 24px 70px rgba(15,23,42,0.26)',
    padding: '22px',
    textAlign: 'center',
  },
  jumpInput: {
    width: '120px',
    height: '52px',
    textAlign: 'center',
    fontSize: '1.25rem',
    fontWeight: 900,
    borderRadius: '16px',
    border: '2px solid #cbd5e1',
    marginTop: '16px',
  },
  emptyState: {
    position: 'absolute',
    inset: 0,
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '18px',
    padding: '24px',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: '1.3rem',
    fontWeight: 950,
    color: '#1e293b',
  },
  modalTitle: {
    color: '#1e293b',
    fontWeight: 950,
    fontSize: '1.2rem',
    marginBottom: '12px',
  },
  fallbackHanzi: {
    fontSize: '4.8rem',
    fontWeight: 950,
    color: '#111827',
    lineHeight: 1.08,
    margin: '8px 0 12px',
  },
};
