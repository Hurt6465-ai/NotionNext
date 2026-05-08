// components/WordCard.js

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  memo,
} from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import {
  FaMicrophone,
  FaPenFancy,
  FaCog,
  FaTimes,
  FaRandom,
  FaSortAmountDown,
  FaHeart,
  FaRegHeart,
  FaPlayCircle,
  FaStop,
  FaVolumeUp,
  FaRedo,
  FaHome,
  FaChevronUp,
  FaChevronDown,
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// =================================================================================
// IndexedDB: favorites
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';
const STYLE_ID = 'word-card-runtime-styles';
const SETTINGS_KEY = 'learningWordCardSettings';
const PROGRESS_PREFIX = 'word_progress_';

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
};

const TTS_VOICES = [
  { value: 'zh-CN-XiaoxiaoNeural', label: 'တရုတ် (အမျိုးသမီး)' },
  { value: 'zh-CN-XiaoyouNeural', label: 'တရုတ် (အမျိုးသမီး - ကလေး)' },
  { value: 'my-MM-NilarNeural', label: 'ဗမာ (အမျိုးသမီး)' },
  { value: 'my-MM-ThihaNeural', label: 'ဗမာ (အမျိုးသား)' },
];

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available'));
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

function waitForTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Transaction error'));
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

async function toggleFavorite(word) {
  if (!word?.id) return false;

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const existing = await new Promise((resolve) => {
      const getReq = store.get(word.id);
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => resolve(null);
    });

    if (existing) {
      store.delete(word.id);
      await waitForTransaction(tx);
      db.close();
      return false;
    }

    store.put({ ...word, favoritedAt: Date.now() });
    await waitForTransaction(tx);
    db.close();
    return true;
  } catch (error) {
    console.warn('toggleFavorite failed:', error);
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
      const getReq = store.get(id);
      getReq.onsuccess = () => resolve(!!getReq.result);
      getReq.onerror = () => resolve(false);
    });

    db.close();
    return result;
  } catch (error) {
    return false;
  }
}

// =================================================================================
// Audio manager: one active audio source, safe cleanup, spell-read interruption token
// =================================================================================
let soundEffects = null;
let activeHowl = null;
let activeObjectUrl = null;
let spellSequenceId = 0;
let audioPlayId = 0;

function revokeActiveObjectUrl() {
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
    } catch (error) {
      // Howler may throw when an audio node is already torn down on some mobile browsers.
    }
    activeHowl = null;
  }
  revokeActiveObjectUrl();
}

const stopAllAudio = ({ cancelSpell = true, stopEffects = false } = {}) => {
  audioPlayId += 1;
  if (cancelSpell) spellSequenceId += 1;

  unloadActiveHowl();

  if (stopEffects && soundEffects) {
    Object.values(soundEffects).forEach((sound) => sound.stop());
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

const initSounds = () => {
  if (!soundEffects && typeof window !== 'undefined') {
    soundEffects = {
      switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.45, html5: true }),
    };
  }
};

function normalizeSpeechRate(rate) {
  const safeRate = Number.isFinite(Number(rate)) ? Number(rate) : -60;
  if (safeRate >= 0) return Math.min(1.8, 1 + safeRate / 100);
  return Math.max(0.55, 1 + safeRate / 200);
}

function finishOnce(callback) {
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    if (typeof callback === 'function') callback();
  };
}

const playTTS = async (
  text,
  voice,
  rate,
  onEndCallback,
  event,
  { cancelSpell = true, stopBeforePlay = true } = {},
) => {
  if (event?.stopPropagation) event.stopPropagation();

  const done = finishOnce(onEndCallback);

  if (stopBeforePlay) {
    stopAllAudio({ cancelSpell });
  }

  if (!text || !voice) {
    done();
    return;
  }

  const currentPlayId = audioPlayId;
  const apiUrl = 'https://libretts.is-an.org/api/tts';
  const rateValue = Math.round((Number(rate) || 0) / 2);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate: rateValue, pitch: 0 }),
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const audioBlob = await response.blob();
    if (currentPlayId !== audioPlayId) {
      done();
      return;
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    activeObjectUrl = audioUrl;

    activeHowl = new Howl({
      src: [audioUrl],
      format: ['mpeg', 'mp3'],
      html5: true,
      onend: () => {
        revokeActiveObjectUrl();
        done();
      },
      onloaderror: () => {
        revokeActiveObjectUrl();
        done();
      },
      onplayerror: () => {
        revokeActiveObjectUrl();
        done();
      },
    });

    activeHowl.play();
  } catch (error) {
    console.warn('API TTS failed, falling back to system TTS:', error);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice.includes('my') ? 'my-MM' : 'zh-CN';
      utterance.rate = normalizeSpeechRate(rate);
      utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    } else {
      done();
    }
  }
};

const playR2Audio = (
  word,
  onEndCallback,
  settings,
  defaultLevel,
  { cancelSpell = true } = {},
) => {
  const done = finishOnce(onEndCallback);
  const targetLevel = word?.hsk_level || defaultLevel;
  const textToRead = word?.audioText || word?.chinese;

  if (!word?.id || !targetLevel) {
    playTTS(textToRead, settings.voiceChinese, settings.speechRateChinese, done, null, { cancelSpell });
    return;
  }

  stopAllAudio({ cancelSpell });
  const formattedId = String(word.id).padStart(4, '0');
  const audioSrc = `https://audio.886.best/chinese-vocab-audio/hsk${targetLevel}/${formattedId}.mp3`;

  activeHowl = new Howl({
    src: [audioSrc],
    html5: true,
    onend: done,
    onloaderror: () => {
      playTTS(textToRead, settings.voiceChinese, settings.speechRateChinese, done, null, {
        cancelSpell,
      });
    },
    onplayerror: done,
  });

  activeHowl.play();
};

const playSoundEffect = (type) => {
  if (typeof window === 'undefined') return;
  initSounds();
  stopAllAudio({ cancelSpell: true, stopEffects: false });
  soundEffects?.[type]?.play();
};

// =================================================================================
// Small utilities
// =================================================================================
const safeLocalStorage = {
  get(key) {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },
  set(key, value) {
    try {
      if (typeof window !== 'undefined') localStorage.setItem(key, value);
    } catch (error) {
      // Ignore private browsing / quota errors.
    }
  },
};

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

function getPinyinText(text) {
  if (!text) return '';
  try {
    return pinyinConverter(text, {
      toneType: 'symbol',
      separator: ' ',
      v: true,
    }).replace(/·/g, ' ');
  } catch (error) {
    return text;
  }
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function injectRuntimeStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.innerHTML = `
    @keyframes wordCardFadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes wordCardRipple {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    @keyframes wordCardWave {
      0%, 100% { height: 8px; }
      50% { height: 24px; }
    }
    .word-card-scroll::-webkit-scrollbar { width: 0; height: 0; }
    @media (prefers-reduced-motion: reduce) {
      .word-card-animated, .word-card-animated * {
        animation-duration: 0.001ms !important;
        transition-duration: 0.001ms !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function getRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

// =================================================================================
// Hook: settings
// =================================================================================
const useCardSettings = () => {
  const [settings, setSettings] = useState(() => {
    const savedSettings = safeLocalStorage.get(SETTINGS_KEY);
    if (!savedSettings) return DEFAULT_SETTINGS;

    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    } catch (error) {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    safeLocalStorage.set(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  return [settings, setSettings];
};

// =================================================================================
// Pronunciation comparison modal
// =================================================================================
const PronunciationComparison = memo(({ correctWord, pinyinText, settings, onClose }) => {
  const [status, setStatus] = useState('idle');
  const [userAudioUrl, setUserAudioUrl] = useState(null);
  const [isPlayingType, setIsPlayingType] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const localAudioRef = useRef(null);
  const userAudioUrlRef = useRef(null);
  const isMountedRef = useRef(true);

  const checkSupport = () =>
    !!(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (userAudioUrlRef.current) URL.revokeObjectURL(userAudioUrlRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      localAudioRef.current?.unload();
      stopAllAudio();
    };
  }, []);

  const startRecording = async () => {
    stopAllAudio();
    setErrorMessage('');

    if (!checkSupport()) {
      setErrorMessage('您的浏览器暂不支持录音功能，请换用 Chrome / Edge / Safari 新版本。');
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

        if (isMountedRef.current) {
          setUserAudioUrl(url);
          setStatus('review');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
    } catch (error) {
      setErrorMessage('无法访问麦克风，请检查浏览器权限设置。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const resetRecording = () => {
    localAudioRef.current?.stop();
    localAudioRef.current?.unload();
    localAudioRef.current = null;

    if (userAudioUrlRef.current) {
      URL.revokeObjectURL(userAudioUrlRef.current);
      userAudioUrlRef.current = null;
    }

    setUserAudioUrl(null);
    setIsPlayingType(null);
    setStatus('idle');
    setErrorMessage('');
  };

  const playStandard = () => {
    localAudioRef.current?.stop();
    setIsPlayingType('standard');
    playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese, () => setIsPlayingType(null));
  };

  const playUser = () => {
    if (!userAudioUrl) return;

    stopAllAudio();
    setIsPlayingType('user');
    localAudioRef.current?.unload();
    localAudioRef.current = new Howl({
      src: [userAudioUrl],
      html5: true,
      onend: () => setIsPlayingType(null),
      onloaderror: () => setIsPlayingType(null),
      onplayerror: () => setIsPlayingType(null),
    });
    localAudioRef.current.play();
  };

  return (
    <div style={styles.comparisonOverlay} onClick={onClose} role="presentation">
      <div style={styles.comparisonPanel} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div style={styles.recordHeader}>
          <h3 style={styles.recordTitle}>发音跟读对比</h3>
          <button style={styles.closeButtonSimple} onClick={onClose} aria-label="关闭">
            <FaTimes />
          </button>
        </div>

        <div style={styles.recordContent}>
          <div style={styles.recordWordDisplay}>
            <div style={styles.compPinyin}>{pinyinText}</div>
            <div style={styles.compChinese}>{correctWord}</div>
          </div>

          <div style={styles.actionArea}>
            {status === 'idle' && (
              <div style={styles.idleStateContainer}>
                <button style={styles.bigRecordBtn} onClick={startRecording} aria-label="开始录音">
                  <FaMicrophone size={32} />
                </button>
                <div style={styles.instructionText}>点击开始录音</div>
                {errorMessage && <div style={styles.errorText}>{errorMessage}</div>}
              </div>
            )}

            {status === 'recording' && (
              <div style={styles.idleStateContainer}>
                <div style={styles.waveformContainer} aria-hidden="true">
                  <div style={styles.waveBar} />
                  <div style={{ ...styles.waveBar, animationDelay: '0.2s' }} />
                  <div style={{ ...styles.waveBar, animationDelay: '0.4s' }} />
                  <div style={{ ...styles.waveBar, animationDelay: '0.1s' }} />
                </div>
                <button
                  style={{ ...styles.bigRecordBtn, ...styles.recordingPulse, background: '#ef4444' }}
                  onClick={stopRecording}
                  aria-label="停止录音"
                >
                  <FaStop size={32} />
                </button>
                <div style={{ ...styles.instructionText, color: '#ef4444' }}>录音中...点击停止</div>
              </div>
            )}

            {status === 'review' && (
              <div style={styles.reviewContainer}>
                <div style={styles.reviewRow}>
                  <button
                    type="button"
                    style={{
                      ...styles.reviewCard,
                      border: isPlayingType === 'standard' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    }}
                    onClick={playStandard}
                  >
                    <div
                      style={{
                        ...styles.iconCircle,
                        background: isPlayingType === 'standard' ? '#3b82f6' : '#f3f4f6',
                        color: isPlayingType === 'standard' ? '#fff' : '#6b7280',
                      }}
                    >
                      <FaVolumeUp size={20} />
                    </div>
                    <span style={styles.reviewCardText}>标准发音</span>
                  </button>

                  <button
                    type="button"
                    style={{
                      ...styles.reviewCard,
                      border: isPlayingType === 'user' ? '2px solid #10b981' : '1px solid #e5e7eb',
                    }}
                    onClick={playUser}
                  >
                    <div
                      style={{
                        ...styles.iconCircle,
                        background: isPlayingType === 'user' ? '#10b981' : '#f3f4f6',
                        color: isPlayingType === 'user' ? '#fff' : '#6b7280',
                      }}
                    >
                      <FaPlayCircle size={20} />
                    </div>
                    <span style={styles.reviewCardText}>我的发音</span>
                  </button>
                </div>
                <button type="button" style={styles.retryLink} onClick={resetRecording}>
                  <FaRedo size={14} /> 重新录音
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

PronunciationComparison.displayName = 'PronunciationComparison';

// =================================================================================
// Settings modal
// =================================================================================
const Toggle = memo(({ checked, onChange, label }) => (
  <label style={styles.switchLabel}>
    <span>{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      style={styles.hiddenCheckbox}
    />
    <span style={{ ...styles.switchTrack, background: checked ? '#3b82f6' : '#d1d5db' }}>
      <span style={{ ...styles.switchThumb, transform: checked ? 'translateX(22px)' : 'translateX(0)' }} />
    </span>
  </label>
));

Toggle.displayName = 'Toggle';

const SettingsPanel = memo(({ settings, setSettings, onClose }) => {
  const fileInputRef = useRef(null);

  const handleSettingChange = useCallback(
    (key, value) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [setSettings],
  );

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      handleSettingChange('backgroundImage', loadEvent.target.result || '');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={styles.settingsModal} onClick={onClose} role="presentation">
      <div style={styles.settingsContent} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button style={styles.closeButton} onClick={onClose} aria-label="关闭设置">
          <FaTimes />
        </button>

        <h2 style={styles.settingsTitle}>Settings</h2>

        <div style={styles.settingGroup}>
          <label style={styles.settingLabel}>Order</label>
          <div style={styles.segmentControl}>
            <button
              type="button"
              onClick={() => handleSettingChange('order', 'sequential')}
              style={{
                ...styles.segmentButton,
                ...(settings.order === 'sequential' ? styles.segmentButtonActive : {}),
              }}
            >
              <FaSortAmountDown /> Sequential
            </button>
            <button
              type="button"
              onClick={() => handleSettingChange('order', 'random')}
              style={{
                ...styles.segmentButton,
                ...(settings.order === 'random' ? styles.segmentButtonActive : {}),
              }}
            >
              <FaRandom /> Random
            </button>
          </div>
        </div>

        <div style={styles.settingGroup}>
          <label style={styles.settingLabel}>Auto Play</label>
          <div style={styles.settingStack}>
            <Toggle checked={settings.autoPlayChinese} onChange={(value) => handleSettingChange('autoPlayChinese', value)} label="Chinese" />
            <Toggle checked={settings.autoPlayBurmese} onChange={(value) => handleSettingChange('autoPlayBurmese', value)} label="Burmese" />
            <Toggle checked={settings.autoPlayExample} onChange={(value) => handleSettingChange('autoPlayExample', value)} label="Example" />
            <Toggle checked={settings.autoBrowse} onChange={(value) => handleSettingChange('autoBrowse', value)} label="Auto Browse" />
          </div>
          <div style={styles.rangeRow}>
            <span>Browse Delay</span>
            <input
              type="range"
              min="2500"
              max="15000"
              step="500"
              value={settings.autoBrowseDelay}
              onChange={(event) => handleSettingChange('autoBrowseDelay', Number(event.target.value))}
            />
            <strong>{Math.round(settings.autoBrowseDelay / 1000)}s</strong>
          </div>
        </div>

        <div style={styles.settingGroup}>
          <label style={styles.settingLabel}>Background</label>
          <div style={styles.settingControl}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageUpload}
            />
            <button style={styles.settingButton} onClick={() => fileInputRef.current?.click()} type="button">
              Upload
            </button>
            <button
              style={{ ...styles.settingButton, flex: '0 1 auto' }}
              onClick={() => handleSettingChange('backgroundImage', '')}
              type="button"
            >
              Reset
            </button>
          </div>
        </div>

        <div style={styles.settingGroup}>
          <label style={styles.settingLabel}>Chinese Voice</label>
          <select
            style={styles.settingSelect}
            value={settings.voiceChinese}
            onChange={(event) => handleSettingChange('voiceChinese', event.target.value)}
          >
            {TTS_VOICES.filter((voice) => voice.value.startsWith('zh')).map((voice) => (
              <option key={voice.value} value={voice.value}>
                {voice.label}
              </option>
            ))}
          </select>
          <div style={styles.rangeRow}>
            <span>Speed</span>
            <input
              type="range"
              min="-90"
              max="60"
              step="5"
              value={settings.speechRateChinese}
              onChange={(event) => handleSettingChange('speechRateChinese', Number(event.target.value))}
            />
            <strong>{settings.speechRateChinese}</strong>
          </div>
        </div>

        <div style={styles.settingGroup}>
          <label style={styles.settingLabel}>Burmese Voice</label>
          <select
            style={styles.settingSelect}
            value={settings.voiceBurmese}
            onChange={(event) => handleSettingChange('voiceBurmese', event.target.value)}
          >
            {TTS_VOICES.filter((voice) => voice.value.startsWith('my')).map((voice) => (
              <option key={voice.value} value={voice.value}>
                {voice.label}
              </option>
            ))}
          </select>
          <div style={styles.rangeRow}>
            <span>Speed</span>
            <input
              type="range"
              min="-90"
              max="60"
              step="5"
              value={settings.speechRateBurmese}
              onChange={(event) => handleSettingChange('speechRateBurmese', Number(event.target.value))}
            />
            <strong>{settings.speechRateBurmese}</strong>
          </div>
        </div>
      </div>
    </div>
  );
});

SettingsPanel.displayName = 'SettingsPanel';

// =================================================================================
// Jump modal
// =================================================================================
const JumpModal = memo(({ max, current, onJump, onClose }) => {
  const [inputValue, setInputValue] = useState(current + 1);
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  const handleJump = () => {
    const num = parseInt(inputValue, 10);
    if (num >= 1 && num <= max) onJump(num - 1);
  };

  return (
    <div style={styles.jumpModalOverlay} onClick={onClose} role="presentation">
      <div style={styles.jumpModalContent} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <h3 style={styles.jumpModalTitle}>Go to</h3>
        <input
          ref={inputRef}
          type="number"
          min="1"
          max={max}
          style={styles.jumpModalInput}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleJump();
            if (event.key === 'Escape') onClose();
          }}
        />
        <button style={styles.jumpModalButton} onClick={handleJump} type="button">
          Go
        </button>
      </div>
    </div>
  );
});

JumpModal.displayName = 'JumpModal';

// =================================================================================
// Main component
// =================================================================================
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

  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
    injectRuntimeStyles();
  }, []);

  const getPinyin = useCallback((wordObj) => {
    if (wordObj?.pinyin) return wordObj.pinyin;
    return getPinyinText(wordObj?.chinese);
  }, []);

  const processedCards = useMemo(() => {
    const mapped = (Array.isArray(words) ? words : [])
      .map((word, index) => ({
        id: getWordId(word, index),
        hsk_level: word.hsk_level,
        chinese: word.chinese || word.word || '',
        audioText: word.audioText || word.chinese || word.word || '',
        pinyin: word.pinyin || '',
        burmese: word.burmese || word.meaning || '',
        explanation: word.explanation || '',
        mnemonic: word.mnemonic || '',
        example: word.example || '',
        example2: word.example2 || '',
      }))
      .filter((word) => word.chinese);

    return settings.order === 'random' ? shuffleArray(mapped) : mapped;
  }, [words, settings.order]);

  const currentCard = activeCards.length > 0 ? activeCards[currentIndex] : null;

  const handleClose = useCallback(() => {
    stopAllAudio();
    setIsSettingsOpen(false);
    setIsRecordingOpen(false);
    setIsJumping(false);
    setWriterChar(null);
    onClose?.();
  }, [onClose]);

  const navigate = useCallback(
    (direction) => {
      if (activeCards.length === 0) return;
      lastDirection.current = direction;
      setCurrentIndex((prev) => (prev + direction + activeCards.length) % activeCards.length);
    },
    [activeCards.length],
  );

  const handleJumpToCard = useCallback(
    (index) => {
      if (index >= 0 && index < activeCards.length) {
        lastDirection.current = index > currentIndex ? 1 : -1;
        setCurrentIndex(index);
      }
      setIsJumping(false);
    },
    [activeCards.length, currentIndex],
  );

  useEffect(() => {
    if (!isOpen) {
      hasOpenedRef.current = false;
      stopAllAudio();
      return;
    }

    const initialCards = processedCards.length > 0 ? processedCards : [];
    setActiveCards(initialCards);

    if (progressKey && initialCards.length > 0) {
      const savedIndex = safeLocalStorage.get(`${PROGRESS_PREFIX}${progressKey}`);
      const parsed = parseInt(savedIndex, 10);
      setCurrentIndex(!Number.isNaN(parsed) && parsed >= 0 && parsed < initialCards.length ? parsed : 0);
    } else {
      setCurrentIndex(0);
    }

    hasOpenedRef.current = true;
  }, [isOpen, processedCards, progressKey]);

  useEffect(() => {
    if (!isOpen || !progressKey || activeCards.length === 0) return;
    safeLocalStorage.set(`${PROGRESS_PREFIX}${progressKey}`, String(currentIndex));
  }, [currentIndex, progressKey, activeCards.length, isOpen]);

  useEffect(() => {
    let isActive = true;

    if (currentCard?.id && currentCard.id !== 'fallback') {
      isFavorite(currentCard.id).then((result) => {
        if (isActive) setIsFavoriteCard(result);
      });
    } else {
      setIsFavoriteCard(false);
    }

    setIsRevealed(false);
    return () => {
      isActive = false;
    };
  }, [currentCard?.id]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') handleClose();
      if (event.key === 'ArrowUp') navigate(-1);
      if (event.key === 'ArrowDown') navigate(1);
      if (event.key === ' ') {
        event.preventDefault();
        setIsRevealed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose, navigate]);

  useEffect(() => {
    if (!isOpen || !currentCard) return undefined;

    clearTimeout(autoBrowseTimerRef.current);
    stopAllAudio();

    const startAutoBrowseTimer = () => {
      if (settings.autoBrowse && activeCards.length > 1) {
        autoBrowseTimerRef.current = setTimeout(() => navigate(1), clamp(settings.autoBrowseDelay, 2500, 15000));
      }
    };

    const playSequence = () => {
      const playAfterChinese = () => {
        if (settings.autoPlayBurmese && currentCard.burmese && isRevealed) {
          playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, () => {
            if (settings.autoPlayExample && currentCard.example && isRevealed) {
              playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, () => {
                if (settings.autoPlayExample && currentCard.example2 && isRevealed) {
                  playTTS(currentCard.example2, settings.voiceChinese, settings.speechRateChinese, startAutoBrowseTimer);
                } else {
                  startAutoBrowseTimer();
                }
              });
            } else {
              startAutoBrowseTimer();
            }
          });
        } else {
          startAutoBrowseTimer();
        }
      };

      if (settings.autoPlayChinese && currentCard.chinese) {
        playR2Audio(currentCard, playAfterChinese, settings, level);
      } else {
        playAfterChinese();
      }
    };

    const initialPlayTimer = setTimeout(playSequence, hasOpenedRef.current ? 450 : 700);
    return () => {
      clearTimeout(initialPlayTimer);
      clearTimeout(autoBrowseTimerRef.current);
    };
  }, [
    activeCards.length,
    currentCard,
    currentIndex,
    isOpen,
    isRevealed,
    level,
    navigate,
    settings.autoBrowse,
    settings.autoBrowseDelay,
    settings.autoPlayBurmese,
    settings.autoPlayChinese,
    settings.autoPlayExample,
    settings.speechRateBurmese,
    settings.speechRateChinese,
    settings.voiceBurmese,
    settings.voiceChinese,
  ]);

  const handleToggleFavorite = async (event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    if (!currentCard) return;

    const optimisticStatus = !isFavoriteCard;
    setIsFavoriteCard(optimisticStatus);
    const finalStatus = await toggleFavorite(currentCard);
    setIsFavoriteCard(finalStatus);
  };

  const handleGoHome = (event) => {
    event?.stopPropagation?.();
    stopAllAudio();
    if (typeof window !== 'undefined') window.location.assign('https://886.best');
  };

  const handleOpenRecorder = useCallback((event) => {
    event?.stopPropagation?.();
    stopAllAudio();
    setIsRecordingOpen(true);
  }, []);

  const handleSpellRead = async (event) => {
    event?.stopPropagation?.();
    stopAllAudio();

    const currentSpellId = ++spellSequenceId;
    if (!currentCard?.chinese) return;

    const chars = [...currentCard.chinese].filter((char) => char.trim());

    if (chars.length > 1) {
      for (const char of chars) {
        if (spellSequenceId !== currentSpellId) return;
        await new Promise((resolve) => {
          playTTS(char, settings.voiceChinese, settings.speechRateChinese, resolve, null, {
            cancelSpell: false,
          });
        });
        if (spellSequenceId !== currentSpellId) return;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    if (spellSequenceId === currentSpellId) {
      playR2Audio(currentCard, null, settings, level, { cancelSpell: false });
    }
  };

  const handleKnow = () => {
    stopAllAudio();
    if (!currentCard) return;

    const newActiveCards = activeCards.filter((card) => card.id !== currentCard.id);
    setActiveCards(newActiveCards);

    if (newActiveCards.length === 0) {
      setCurrentIndex(0);
      return;
    }

    setCurrentIndex((prev) => (prev >= newActiveCards.length ? 0 : prev));
  };

  const handleDontKnow = () => {
    stopAllAudio();
    if (isRevealed) navigate(1);
    else setIsRevealed(true);
  };

  const handleManualPlay = (cardData, event) => {
    event?.stopPropagation?.();
    playR2Audio(cardData, null, settings, level);
  };

  const handleToggleReveal = () => {
    if (!isSettingsOpen && !isRecordingOpen && !isJumping && !writerChar) {
      setIsRevealed((prev) => !prev);
    }
  };

  const pageTransitions = useTransition(isOpen, {
    from: { opacity: 0, transform: 'translateY(100%)' },
    enter: { opacity: 1, transform: 'translateY(0%)' },
    leave: { opacity: 0, transform: 'translateY(100%)' },
    config: { tension: 220, friction: 25 },
  });

  const cardTransitions = useTransition(currentIndex, {
    key: currentCard ? currentCard.id : currentIndex,
    from: {
      opacity: 0,
      transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'}) scale(0.98)`,
    },
    enter: { opacity: 1, transform: 'translateY(0%) scale(1)' },
    leave: {
      opacity: 0,
      transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'}) scale(0.98)`,
      position: 'absolute',
    },
    config: { mass: 1, tension: 280, friction: 30 },
    onStart: () => {
      if (currentCard && activeCards.length > 1) playSoundEffect('switch');
    },
  });

  const bind = useDrag(
    ({ down, movement: [mx, my], velocity: [vx, vy], direction: [, yDir], event }) => {
      if (event.target?.closest?.('[data-no-gesture]')) return;
      if (down) return;

      event.stopPropagation();
      const isHorizontal = Math.abs(mx) > Math.abs(my);
      const horizontalVelocity = Math.abs(vx);
      const verticalVelocity = Math.abs(vy);

      if (isHorizontal) {
        if (Math.abs(mx) > 90 || (horizontalVelocity > 0.45 && Math.abs(mx) > 45)) handleClose();
        return;
      }

      if (Math.abs(my) > 64 || (verticalVelocity > 0.35 && Math.abs(my) > 34)) {
        navigate(yDir < 0 ? 1 : -1);
      }
    },
    { filterTaps: true, preventDefault: true, threshold: 10 },
  );

  const cardContent = pageTransitions((style, item) => {
    if (!item) return null;

    const backgroundStyle = settings.backgroundImage
      ? { background: `linear-gradient(rgba(240,244,248,0.54), rgba(240,244,248,0.72)), url(${settings.backgroundImage}) center/cover no-repeat` }
      : {};

    return (
      <animated.div style={{ ...styles.fullScreen, ...backgroundStyle, ...style }} className="word-card-animated">
        <div style={styles.gestureArea} {...bind()} onClick={handleToggleReveal} aria-hidden="true" />

        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        {isRecordingOpen && currentCard && (
          <PronunciationComparison
            correctWord={currentCard.chinese}
            pinyinText={getPinyin(currentCard)}
            settings={settings}
            onClose={() => setIsRecordingOpen(false)}
          />
        )}
        {isJumping && (
          <JumpModal
            max={activeCards.length}
            current={currentIndex}
            onJump={handleJumpToCard}
            onClose={() => setIsJumping(false)}
          />
        )}

        {activeCards.length > 0 && currentCard ? (
          cardTransitions((cardStyle, index) => {
            const cardData = activeCards[index];
            if (!cardData) return null;

            return (
              <animated.div key={cardData.id} style={{ ...styles.animatedCardShell, ...cardStyle }}>
                <div style={styles.cardContainer} className="word-card-scroll" data-no-gesture="true">
                  <div style={styles.cardInner}>
                    <button
                      type="button"
                      style={styles.wordButton}
                      onClick={(event) => handleManualPlay(cardData, event)}
                      aria-label="播放中文发音"
                    >
                      <div style={styles.pinyin}>{getPinyin(cardData)}</div>
                      <div style={styles.textWordChinese}>{cardData.chinese}</div>
                    </button>

                    {isRevealed && (
                      <animated.div style={styles.revealedContent}>
                        {cardData.burmese && (
                          <button
                            type="button"
                            style={styles.definitionBox}
                            onClick={(event) =>
                              playTTS(
                                cardData.burmese,
                                settings.voiceBurmese,
                                settings.speechRateBurmese,
                                null,
                                event,
                              )
                            }
                          >
                            <div style={styles.textWordBurmese}>{cardData.burmese}</div>
                          </button>
                        )}

                        {cardData.explanation && (
                          <button
                            type="button"
                            style={styles.explanationBox}
                            onClick={(event) =>
                              playTTS(
                                cardData.explanation,
                                settings.voiceBurmese,
                                settings.speechRateBurmese,
                                null,
                                event,
                              )
                            }
                          >
                            <div style={styles.explanationText}>{cardData.explanation}</div>
                          </button>
                        )}

                        {cardData.mnemonic && <div style={styles.mnemonicBox}>{cardData.mnemonic}</div>}

                        {cardData.example && (
                          <button
                            type="button"
                            style={styles.exampleBox}
                            onClick={(event) =>
                              playTTS(cardData.example, settings.voiceChinese, settings.speechRateChinese, null, event)
                            }
                          >
                            <div style={styles.examplePinyin}>{getPinyinText(cardData.example)}</div>
                            <div style={styles.exampleText}>{cardData.example}</div>
                          </button>
                        )}

                        {cardData.example2 && (
                          <button
                            type="button"
                            style={styles.exampleBox}
                            onClick={(event) =>
                              playTTS(cardData.example2, settings.voiceChinese, settings.speechRateChinese, null, event)
                            }
                          >
                            <div style={styles.examplePinyin}>{getPinyinText(cardData.example2)}</div>
                            <div style={styles.exampleText}>{cardData.example2}</div>
                          </button>
                        )}
                      </animated.div>
                    )}
                  </div>
                </div>
              </animated.div>
            );
          })
        ) : (
          <div style={styles.completionContainer} data-no-gesture="true">
            <h2 style={styles.completionTitle}>🎉 ဂုဏ်ယူပါတယ်!</h2>
            <p style={styles.completionText}>သင် ဒီသင်ခန်းစာကို လေ့လာပြီးသွားပါပြီ။</p>
            <button style={{ ...styles.knowButton, ...styles.knowButtonBase }} onClick={handleClose} type="button">
              ပိတ်မည်
            </button>
          </div>
        )}

        {currentCard && (
          <div style={styles.rightControls} data-no-gesture="true">
            <button style={styles.rightIconButton} onPointerDown={(event) => event.stopPropagation()} onClick={handleGoHome} title="Home Page" type="button">
              <FaHome size={18} color="#4b5563" />
            </button>
            <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="ဆက်တင်များ" type="button">
              <FaCog size={18} />
            </button>
            <button style={styles.rightIconButton} onClick={handleSpellRead} title="逐字拼读" type="button">
              <FaVolumeUp size={18} color="#4b5563" />
            </button>
            <button style={styles.rightIconButton} onClick={handleOpenRecorder} title="အသံထွက်လေ့ကျင့်ရန်" type="button">
              <FaMicrophone size={18} color="#4b5563" />
            </button>
            {currentCard.chinese?.length > 0 && currentCard.chinese.length <= 5 && !currentCard.chinese.includes(' ') && (
              <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="ရေးနည်း" type="button">
                <FaPenFancy size={18} />
              </button>
            )}
            <button
              style={styles.rightIconButton}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={handleToggleFavorite}
              title={isFavoriteCard ? 'ပယ်ဖျက်' : 'သိမ်းဆည်း'}
              type="button"
            >
              {isFavoriteCard ? <FaHeart size={18} color="#f87171" /> : <FaRegHeart size={18} />}
            </button>
          </div>
        )}

        <div style={styles.navHints} aria-hidden="true">
          <FaChevronUp size={14} /> 上滑下一张 / 下滑上一张 <FaChevronDown size={14} />
        </div>

        <div style={styles.bottomControlsContainer} data-no-gesture="true">
          {activeCards.length > 0 && (
            <button style={styles.bottomCenterCounter} onClick={() => setIsJumping(true)} type="button">
              {currentIndex + 1} / {activeCards.length}
            </button>
          )}
          <div style={styles.knowButtonsWrapper}>
            <button style={{ ...styles.knowButtonBase, ...styles.dontKnowButton }} onClick={handleDontKnow} type="button">
              မသိဘူး
            </button>
            <button style={{ ...styles.knowButtonBase, ...styles.knowButton }} onClick={handleKnow} type="button">
              သိတယ်
            </button>
          </div>
        </div>
      </animated.div>
    );
  });

  if (isMounted) return createPortal(cardContent, document.body);
  return null;
};

// =================================================================================
// Styles
// =================================================================================
const baseButtonReset = {
  appearance: 'none',
  border: 'none',
  fontFamily: 'inherit',
};

const styles = {
  fullScreen: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    touchAction: 'none',
    backgroundColor: '#f0f4f8',
    userSelect: 'none',
  },
  gestureArea: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  animatedCardShell: {
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    padding: '64px 15px 138px 15px',
    pointerEvents: 'none',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 520,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.34)',
    border: '1px solid rgba(255, 255, 255, 0.58)',
    borderRadius: 28,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '34px 14px',
    boxShadow: '0 24px 80px rgba(15, 23, 42, 0.10)',
    backdropFilter: 'blur(12px)',
    pointerEvents: 'auto',
  },
  cardInner: {
    textAlign: 'center',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  wordButton: {
    ...baseButtonReset,
    background: 'transparent',
    cursor: 'pointer',
    padding: '8px 12px',
    width: '100%',
    color: 'inherit',
    touchAction: 'manipulation',
  },
  pinyin: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: 'clamp(1.15rem, 4vw, 1.45rem)',
    color: '#d97706',
    textShadow: 'none',
    marginBottom: '0.8rem',
    letterSpacing: '0.05em',
    fontWeight: 800,
    lineHeight: 1.25,
  },
  textWordChinese: {
    fontSize: 'clamp(2.55rem, 13vw, 5.4rem)',
    fontWeight: 900,
    color: '#111827',
    lineHeight: 1.05,
    wordBreak: 'break-word',
    textShadow: '0 8px 34px rgba(17, 24, 39, 0.08)',
  },
  revealedContent: {
    marginTop: '0.8rem',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  definitionBox: {
    ...baseButtonReset,
    cursor: 'pointer',
    textAlign: 'center',
    background: 'rgba(255,255,255,0.4)',
    borderRadius: 18,
    padding: '8px 14px',
    color: 'inherit',
    maxWidth: '100%',
  },
  textWordBurmese: {
    fontSize: 'clamp(1.2rem, 4vw, 1.55rem)',
    color: '#374151',
    fontFamily: '"Padauk", "Myanmar Text", sans-serif',
    lineHeight: 1.55,
    wordBreak: 'break-word',
    textShadow: 'none',
  },
  explanationBox: {
    ...baseButtonReset,
    color: '#16a34a',
    textAlign: 'center',
    fontSize: '1.08rem',
    textShadow: 'none',
    background: 'transparent',
    padding: 6,
    maxWidth: '100%',
    cursor: 'pointer',
  },
  explanationText: {
    fontFamily: '"Padauk", "Myanmar Text", sans-serif',
    lineHeight: 1.45,
    fontWeight: 600,
  },
  mnemonicBox: {
    color: '#6b7280',
    display: 'inline-block',
    textAlign: 'center',
    fontSize: '1rem',
    textShadow: 'none',
    background: 'rgba(255,255,255,0.32)',
    padding: '6px 12px',
    borderRadius: 14,
    maxWidth: '100%',
    lineHeight: 1.45,
  },
  exampleBox: {
    ...baseButtonReset,
    color: '#374151',
    width: '100%',
    maxWidth: 430,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    textShadow: 'none',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.38)',
    padding: '10px 12px',
    borderRadius: 18,
    border: '1px solid rgba(229,231,235,0.9)',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.05)',
  },
  examplePinyin: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '0.95rem',
    color: '#d97706',
    opacity: 0.92,
    letterSpacing: '0.03em',
    fontWeight: 600,
    lineHeight: 1.25,
  },
  exampleText: {
    fontSize: '1.18rem',
    lineHeight: 1.4,
  },
  rightControls: {
    position: 'fixed',
    bottom: '40%',
    right: 10,
    zIndex: 1010,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
    transform: 'translateY(50%)',
  },
  rightIconButton: {
    ...baseButtonReset,
    background: 'rgba(255,255,255,0.92)',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: '50%',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    color: '#4b5563',
    touchAction: 'manipulation',
  },
  navHints: {
    position: 'fixed',
    top: 14,
    left: '50%',
    zIndex: 1005,
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'rgba(75, 85, 99, 0.72)',
    fontSize: '0.78rem',
    fontWeight: 700,
    background: 'rgba(255,255,255,0.5)',
    border: '1px solid rgba(229,231,235,0.75)',
    borderRadius: 999,
    padding: '7px 12px',
    backdropFilter: 'blur(8px)',
  },
  bottomControlsContainer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '15px 15px max(15px, env(safe-area-inset-bottom))',
    zIndex: 1010,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    pointerEvents: 'auto',
  },
  bottomCenterCounter: {
    ...baseButtonReset,
    background: 'rgba(255, 255, 255, 0.72)',
    color: '#374151',
    padding: '8px 18px',
    borderRadius: 20,
    fontSize: '1rem',
    fontWeight: 800,
    cursor: 'pointer',
    userSelect: 'none',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
  },
  knowButtonsWrapper: {
    display: 'flex',
    width: '100%',
    maxWidth: 430,
    gap: 14,
  },
  knowButtonBase: {
    ...baseButtonReset,
    flex: 1,
    padding: '16px',
    borderRadius: 18,
    fontSize: '1.2rem',
    fontWeight: 900,
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 12px 26px rgba(15, 23, 42, 0.14)',
    touchAction: 'manipulation',
  },
  dontKnowButton: { background: '#f59e0b' },
  knowButton: { background: '#10b981' },
  completionContainer: {
    textAlign: 'center',
    color: '#374151',
    textShadow: 'none',
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 24,
  },
  completionTitle: { margin: 0, fontSize: '1.9rem' },
  completionText: { fontSize: '1.1rem', marginBottom: 24 },

  comparisonOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.62)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: 20,
  },
  comparisonPanel: {
    width: '100%',
    maxWidth: 390,
    background: 'white',
    borderRadius: 24,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'wordCardFadeIn 0.3s ease-out',
    boxShadow: '0 24px 48px rgba(0,0,0,0.22)',
  },
  recordHeader: {
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  recordTitle: {
    margin: 0,
    color: '#374151',
    fontSize: '1.1rem',
  },
  closeButtonSimple: {
    ...baseButtonReset,
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '50%',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#64748b',
    fontSize: '1rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  recordContent: {
    padding: '30px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 28,
    minHeight: 292,
  },
  recordWordDisplay: { textAlign: 'center', width: '100%' },
  compPinyin: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '1.2rem',
    color: '#8b5cf6',
    fontWeight: 800,
    letterSpacing: 2,
    marginBottom: 8,
  },
  compChinese: { fontSize: '3rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 },
  actionArea: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  idleStateContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
  bigRecordBtn: {
    ...baseButtonReset,
    width: 88,
    height: 88,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)',
    transition: 'transform 0.2s',
    padding: 0,
  },
  instructionText: { color: '#64748b', fontSize: '1rem', fontWeight: 700, letterSpacing: 1 },
  errorText: { color: '#dc2626', fontSize: '0.86rem', textAlign: 'center', lineHeight: 1.45, maxWidth: 280 },
  waveformContainer: { display: 'flex', gap: 4, alignItems: 'center', height: 24, marginBottom: -10 },
  waveBar: {
    width: 4,
    height: '100%',
    background: '#ef4444',
    borderRadius: 2,
    animation: 'wordCardWave 1s ease-in-out infinite',
  },
  recordingPulse: {
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)',
    animation: 'wordCardRipple 1.5s infinite',
  },
  reviewContainer: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 },
  reviewRow: { display: 'flex', justifyContent: 'center', width: '100%', gap: 16 },
  reviewCard: {
    ...baseButtonReset,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '20px 10px',
    background: '#f8fafc',
    borderRadius: 20,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  reviewCardText: { fontSize: '0.9rem', fontWeight: 800, color: '#475569' },
  retryLink: {
    ...baseButtonReset,
    background: 'white',
    border: '1px solid #e2e8f0',
    color: '#64748b',
    padding: '10px 24px',
    borderRadius: 99,
    fontSize: '0.9rem',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    transition: 'background 0.2s',
  },

  settingsModal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10001,
    backdropFilter: 'blur(5px)',
    padding: 15,
  },
  settingsContent: {
    background: 'white',
    padding: 24,
    borderRadius: 20,
    width: '100%',
    maxWidth: 470,
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    maxHeight: '84vh',
    overflowY: 'auto',
    position: 'relative',
  },
  closeButton: {
    ...baseButtonReset,
    position: 'absolute',
    top: 15,
    right: 15,
    background: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    color: '#9ca3af',
    lineHeight: 1,
  },
  settingsTitle: { marginTop: 0, color: '#374151' },
  settingGroup: { marginBottom: 22 },
  settingLabel: { display: 'block', fontWeight: 800, marginBottom: 10, color: '#333' },
  settingControl: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  settingButton: {
    ...baseButtonReset,
    background: '#f3f4f6',
    color: '#4b5563',
    padding: '10px 14px',
    borderRadius: 14,
    cursor: 'pointer',
    fontWeight: 700,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 100,
  },
  settingSelect: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
  },
  segmentControl: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    padding: 4,
    background: '#f3f4f6',
    borderRadius: 16,
  },
  segmentButton: {
    ...baseButtonReset,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'transparent',
    color: '#4b5563',
    cursor: 'pointer',
    fontWeight: 800,
  },
  segmentButtonActive: {
    background: '#3b82f6',
    color: 'white',
    boxShadow: '0 8px 18px rgba(59, 130, 246, 0.22)',
  },
  settingStack: { display: 'flex', flexDirection: 'column', gap: 10 },
  switchLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#4b5563',
    fontWeight: 700,
  },
  hiddenCheckbox: { display: 'none' },
  switchTrack: {
    width: 48,
    height: 26,
    borderRadius: 999,
    padding: 2,
    transition: 'background 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#fff',
    display: 'block',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s',
  },
  rangeRow: {
    display: 'grid',
    gridTemplateColumns: '96px 1fr 42px',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    color: '#4b5563',
    fontSize: '0.9rem',
  },
  jumpModalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10002,
    padding: 20,
  },
  jumpModalContent: {
    background: 'white',
    padding: 25,
    borderRadius: 18,
    textAlign: 'center',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  },
  jumpModalTitle: { marginTop: 0, marginBottom: 15, color: '#333' },
  jumpModalInput: {
    width: 110,
    padding: 10,
    fontSize: '1.2rem',
    textAlign: 'center',
    border: '2px solid #d1d5db',
    borderRadius: 10,
    marginBottom: 15,
  },
  jumpModalButton: {
    ...baseButtonReset,
    width: '100%',
    padding: 12,
    borderRadius: 12,
    background: '#4299e1',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
};

export default WordCard;
