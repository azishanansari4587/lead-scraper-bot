/**
 * Isolated Speech Recognition Service for Knotiq Mindset Gate
 *
 * Implements:
 * 1. Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * 2. Insecure context detection (requires HTTPS or localhost).
 * 3. Auto-restart with exponential backoff and max restart limits (prevents infinite loops).
 * 4. Visibilitychange handling (pauses when tab hidden).
 * 5. Error classification (not-allowed, no-speech, network, unsupported).
 * 6. Clean transcript resetting per quote/attempt.
 */

class SpeechService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.restartCount = 0;
    this.maxRestarts = 3;
    this.restartTimeout = null;
    this.language = 'en-IN';
    this.onTranscriptCallback = null;
    this.onErrorCallback = null;
    this.onStateChangeCallback = null;
    this.shouldListen = false; // Intended state

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  isSupported() {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  isSecure() {
    if (typeof window === 'undefined') return true;
    if (window.isSecureContext !== undefined) return window.isSecureContext;
    const proto = window.location.protocol;
    const host = window.location.hostname;
    return proto === 'https:' || host === 'localhost' || host === '127.0.0.1';
  }

  handleVisibilityChange() {
    if (typeof document === 'undefined') return;

    if (document.hidden) {
      // Tab hidden: pause recognition without resetting intent
      if (this.recognition && this.isListening) {
        try {
          this.recognition.stop();
        } catch {}
      }
    } else {
      // Tab visible again: resume if was supposed to be listening
      if (this.shouldListen && !this.isListening) {
        this.startInternal();
      }
    }
  }

  start({ language = 'en-IN', onTranscript, onError, onStateChange }) {
    this.language = language;
    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;
    this.onStateChangeCallback = onStateChange;
    this.shouldListen = true;
    this.restartCount = 0;

    if (!this.isSecure()) {
      if (this.onErrorCallback) {
        this.onErrorCallback('insecure_context', 'Microphone access requires a secure HTTPS connection or localhost.');
      }
      return false;
    }

    if (!this.isSupported()) {
      if (this.onErrorCallback) {
        this.onErrorCallback('unsupported', 'Web Speech API is not supported in this browser. Please use Google Chrome/Edge or type your quotes.');
      }
      return false;
    }

    this.startInternal();
    return true;
  }

  startInternal() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.language;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.restartCount = 0;
      if (this.onStateChangeCallback) this.onStateChangeCallback('listening');
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text + ' ';
        } else {
          interim += text + ' ';
        }
      }

      if (this.onTranscriptCallback) {
        this.onTranscriptCallback({
          interim: interim.trim(),
          final: final.trim(),
          combined: (final + ' ' + interim).trim()
        });
      }
    };

    this.recognition.onerror = (event) => {
      const err = event.error;

      // Handle expected transient or terminal errors
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        this.shouldListen = false;
        if (this.onErrorCallback) {
          this.onErrorCallback('permission_denied', 'Microphone permission was denied. Please allow microphone access in browser settings.');
        }
      } else if (err === 'no-speech') {
        // User paused or didn't speak yet; not fatal
        if (this.onErrorCallback) {
          this.onErrorCallback('no_speech', 'No speech detected. Please speak closer to your microphone.');
        }
      } else if (err === 'network') {
        if (this.onErrorCallback) {
          this.onErrorCallback('network', 'Browser speech recognition network error. You can type this quote instead.');
        }
      } else if (err !== 'aborted') {
        if (this.onErrorCallback) {
          this.onErrorCallback(err, `Speech recognition notice: ${err}`);
        }
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onStateChangeCallback) this.onStateChangeCallback('idle');

      // Controlled auto-restart with backoff (never infinite)
      if (this.shouldListen && this.restartCount < this.maxRestarts) {
        this.restartCount++;
        const delay = Math.min(1500, 300 * Math.pow(1.5, this.restartCount));
        this.restartTimeout = setTimeout(() => {
          if (this.shouldListen) {
            this.startInternal();
          }
        }, delay);
      }
    };

    try {
      this.recognition.start();
    } catch (err) {
      this.isListening = false;
      if (this.onErrorCallback) {
        this.onErrorCallback('start_failed', err.message);
      }
    }
  }

  stop() {
    this.shouldListen = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    this.isListening = false;
    if (this.onStateChangeCallback) this.onStateChangeCallback('idle');
  }

  destroy() {
    this.stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }
}

export const speechService = new SpeechService();
