/**
 * PAI Voice Widget - Persistent audio player for the companion portal.
 * Include this script on any portal page to enable background voice playback.
 *
 * Usage:
 *   <script src="/voice/voice-widget.js"></script>
 *
 * The widget auto-connects to the voice server and plays notifications in the background.
 * A small floating indicator shows connection status and speaking state.
 */
(function() {
  'use strict';

  // Configuration
  const RECONNECT_DELAY = 3000;
  const STORAGE_KEY = 'pai-voice-widget';

  // State
  let ws = null;
  let connected = false;
  let reconnectTimer = null;
  const audioQueue = [];
  let isPlaying = false;
  let volume = 0.8;
  let muted = false;

  // Load saved settings
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    volume = saved.volume ?? 0.8;
    muted = saved.muted ?? false;
  } catch {}

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume, muted }));
  }

  // Detect WebSocket URL (voice server runs on port 8888)
  function getWsUrl() {
    const host = window.location.hostname || 'localhost';
    return `ws://${host}:8888/stream`;
  }

  // Create floating widget
  function createWidget() {
    const widget = document.createElement('div');
    widget.id = 'pai-voice-widget';
    widget.innerHTML = `
      <style>
        #pai-voice-widget {
          position: fixed;
          bottom: 16px;
          right: 16px;
          z-index: 9999;
          font-family: 'Inter', -apple-system, sans-serif;
        }
        .pvw-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: #141c2c;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          cursor: pointer;
          user-select: none;
          transition: all 0.2s;
        }
        .pvw-pill:hover {
          background: #1c2638;
          border-color: rgba(18,194,233,0.3);
        }
        .pvw-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #8a919d;
          transition: background 0.3s, box-shadow 0.3s;
          flex-shrink: 0;
        }
        .pvw-dot.connected {
          background: #2dd4bf;
          box-shadow: 0 0 6px rgba(45,212,191,0.4);
        }
        .pvw-dot.connecting {
          background: #F39C12;
          animation: pvw-pulse 1.5s infinite;
        }
        .pvw-dot.error { background: #ff6b9d; }
        @keyframes pvw-pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .pvw-label {
          font-size: 0.75rem;
          color: #c0c8d4;
          white-space: nowrap;
        }
        .pvw-bars {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 16px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .pvw-bars.active { opacity: 1; }
        .pvw-bar {
          width: 3px;
          height: 4px;
          background: #12c2e9;
          border-radius: 1px;
        }
        .pvw-bars.active .pvw-bar {
          animation: pvw-bars 0.7s ease-in-out infinite;
        }
        .pvw-bar:nth-child(1) { animation-delay: 0s; }
        .pvw-bar:nth-child(2) { animation-delay: 0.08s; }
        .pvw-bar:nth-child(3) { animation-delay: 0.16s; }
        .pvw-bar:nth-child(4) { animation-delay: 0.08s; }
        .pvw-bar:nth-child(5) { animation-delay: 0s; }
        @keyframes pvw-bars {
          0%,100% { height: 4px; }
          50% { height: 14px; }
        }
        .pvw-mute {
          font-size: 0.85rem;
          color: #8a919d;
          cursor: pointer;
          padding: 2px;
          line-height: 1;
        }
        .pvw-mute:hover { color: #f0f2f5; }
      </style>
      <div class="pvw-pill" title="PAI Voice">
        <span class="pvw-dot" id="pvwDot"></span>
        <div class="pvw-bars" id="pvwBars">
          <div class="pvw-bar"></div>
          <div class="pvw-bar"></div>
          <div class="pvw-bar"></div>
          <div class="pvw-bar"></div>
          <div class="pvw-bar"></div>
        </div>
        <span class="pvw-label" id="pvwLabel">Voice</span>
        <span class="pvw-mute" id="pvwMute" title="Toggle mute">${muted ? '&#128263;' : '&#128264;'}</span>
      </div>
    `;
    document.body.appendChild(widget);

    // Toggle mute on click
    document.getElementById('pvwMute').addEventListener('click', (e) => {
      e.stopPropagation();
      muted = !muted;
      e.target.innerHTML = muted ? '&#128263;' : '&#128264;';
      saveSettings();
    });

    return widget;
  }

  function setWidgetStatus(state, label) {
    const dot = document.getElementById('pvwDot');
    const lbl = document.getElementById('pvwLabel');
    if (dot) dot.className = 'pvw-dot ' + state;
    if (lbl) lbl.textContent = label || 'Voice';
  }

  function setSpeaking(active) {
    const bars = document.getElementById('pvwBars');
    if (bars) {
      if (active) bars.classList.add('active');
      else bars.classList.remove('active');
    }
  }

  // WebSocket connection
  function connect() {
    const url = getWsUrl();
    setWidgetStatus('connecting', 'Connecting');

    try {
      ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        connected = true;
        setWidgetStatus('connected', 'Voice');
        clearReconnectTimer();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'notification') {
              // metadata received, audio frame follows
            }
          } catch {}
        } else if (event.data instanceof ArrayBuffer) {
          if (!muted) {
            audioQueue.push(event.data);
            if (!isPlaying) playNext();
          }
        }
      };

      ws.onclose = () => {
        connected = false;
        ws = null;
        setWidgetStatus('connecting', 'Reconnecting');
        scheduleReconnect();
      };

      ws.onerror = () => {
        setWidgetStatus('error', 'Error');
      };
    } catch {
      setWidgetStatus('error', 'Error');
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      if (!connected) connect();
    }, RECONNECT_DELAY);
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  async function playNext() {
    if (audioQueue.length === 0) {
      isPlaying = false;
      setSpeaking(false);
      return;
    }

    isPlaying = true;
    setSpeaking(true);
    const buffer = audioQueue.shift();

    try {
      const blob = new Blob([buffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = volume;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        playNext();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        playNext();
      };

      await audio.play();
    } catch (e) {
      console.error('PAI Voice: Audio playback failed:', e);
      playNext();
    }
  }

  // Unlock audio playback on first user interaction.
  // This persists across WebSocket reconnects, preventing silent autoplay blocks.
  function unlockAudio() {
    document.addEventListener('click', () => {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume();
    }, { once: true });
  }

  // Initialize when DOM is ready
  function init() {
    unlockAudio();
    createWidget();
    connect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
