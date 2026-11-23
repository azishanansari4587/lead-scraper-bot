import React, { useState, useEffect, useRef, useId } from 'react';
import {
  Mic,
  MicOff,
  CheckCircle2,
  Shield,
  Lock,
  Unlock,
  Sparkles,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Edit3,
  Globe,
  Keyboard,
  Info
} from 'lucide-react';
import { api } from '../api';
import { speechService } from '../services/speechService';
import { matchQuoteText, normalizeText, tokenize } from '@utils/speechMatcher.js';

export default function MindsetGateScreen({ initialStatus, onUnlock, userId }) {
  const isSetupNeeded = Boolean(
    initialStatus?.setupRequired ||
    !initialStatus?.quotes ||
    initialStatus.quotes.length < 5
  );
  const [step, setStep] = useState(isSetupNeeded ? 'setup' : 'recite'); // 'setup' | 'recite' | 'unlocked'
  const [quotes, setQuotes] = useState(initialStatus?.quotes || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logId, setLogId] = useState(initialStatus?.logId || null);

  // Recital speech & typed states
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [typedInput, setTypedInput] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [quotesTypedCount, setQuotesTypedCount] = useState(0);
  const [speechError, setSpeechError] = useState(null);
  const [isSecure, setIsSecure] = useState(true);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [forceTypedMode, setForceTypedMode] = useState(false);
  const [currentMatch, setCurrentMatch] = useState({ isMatch: false, coverage: 0, matchedIndices: [] });
  const [quoteSuccess, setQuoteSuccess] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [gateNotice, setGateNotice] = useState('');

  // Setup form state (5 quotes) initialized with any existing quotes or 5 blank slots
  const [setupQuotes, setSetupQuotes] = useState(() => {
    const existing = initialStatus?.quotes || [];
    return [0, 1, 2, 3, 4].map((i) => ({
      text: existing[i]?.text || '',
      author: existing[i]?.author || '',
      language: existing[i]?.language || initialStatus?.gateLanguage || 'en-IN'
    }));
  });
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState('');

  const threshold = initialStatus?.threshold || 0.8;
  const fallbackAfter = initialStatus?.fallbackAfterAttempts || 3;
  const liveRegionId = useId();

  // Guard: if in recite mode but quotes are missing, switch to setup
  useEffect(() => {
    if (step === 'recite' && (!quotes || quotes.length < 5 || !quotes[currentIndex])) {
      setStep('setup');
    }
  }, [step, quotes, currentIndex]);

  // Initialize checks
  useEffect(() => {
    const secure = speechService.isSecure();
    const supported = speechService.isSupported();
    setIsSecure(secure);
    setIsSpeechSupported(supported);

    if (!secure || !supported) {
      setForceTypedMode(true);
      if (!secure) {
        setSpeechError('Microphone requires HTTPS or localhost. Typed recital mode has been automatically activated.');
      } else {
        setSpeechError('Web Speech API is not supported in this browser. Typed recital mode has been activated.');
      }
    }
  }, []);

  // Initialize or start gate log when entering recite step
  useEffect(() => {
    if (step === 'recite' && !logId) {
      api.startGate()
        .then((res) => {
          if (res.log?.id) {
            setLogId(res.log.id);
          }
        })
        .catch((err) => {
          console.warn('Could not start gate log session:', err);
        });
    }
  }, [step, logId]);

  // Current active quote
  const currentQuote = quotes[currentIndex] || null;
  const currentLanguage = currentQuote?.language || initialStatus?.gateLanguage || 'en-IN';

  // Words of current quote for highlighting
  const quoteTokens = currentQuote ? tokenize(currentQuote.text) : [];

  // Reset transcript and speech when moving to a new quote
  const resetQuoteState = () => {
    speechService.stop();
    setIsListening(false);
    setTranscript('');
    setInterimTranscript('');
    setTypedInput('');
    setCurrentMatch({ isMatch: false, coverage: 0, matchedIndices: [] });
    setQuoteSuccess(false);
    setFailedAttempts(0);
    setSpeechError(null);
  };

  // Keyboard shortcut: Space toggles microphone in voice mode
  useEffect(() => {
    if (step !== 'recite' || quoteSuccess || forceTypedMode) return;

    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        toggleListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, quoteSuccess, forceTypedMode, isListening, currentLanguage]);

  // Clean up speech service on unmount
  useEffect(() => {
    return () => {
      speechService.stop();
    };
  }, []);

  // Handle Speech Recognition Callback
  const handleTranscript = ({ interim, final, combined }) => {
    setInterimTranscript(interim);
    setTranscript(combined);

    if (!currentQuote) return;

    // Check match against current quote
    const match = matchQuoteText(currentQuote.text, combined, threshold);
    setCurrentMatch(match);

    if (match.isMatch && !quoteSuccess) {
      handleQuotePassed(false);
    }
  };

  const handleSpeechError = (type, message) => {
    setSpeechError(message);
    setIsListening(false);
    if (type === 'permission_denied' || type === 'insecure_context' || type === 'unsupported') {
      setForceTypedMode(true);
    }
  };

  const toggleListening = () => {
    if (quoteSuccess || isCompleting) return;

    if (isListening) {
      speechService.stop();
      setIsListening(false);

      // Check if attempt failed
      if (transcript && !currentMatch.isMatch) {
        setFailedAttempts((prev) => {
          const next = prev + 1;
          setTotalAttempts((t) => t + 1);
          if (next >= fallbackAfter) {
            setGateNotice(`You have made ${next} attempts. You may continue speaking or switch to typed mode below.`);
          }
          return next;
        });
      }
    } else {
      setSpeechError(null);
      setGateNotice('');
      const started = speechService.start({
        language: currentLanguage,
        onTranscript: handleTranscript,
        onError: handleSpeechError,
        onStateChange: (state) => setIsListening(state === 'listening')
      });
      if (started) {
        setIsListening(true);
      }
    }
  };

  // Handle Typed Input with Anti-Cheat (paste/drop blocked)
  const handleTypedChange = (e) => {
    const val = e.target.value;
    setTypedInput(val);

    if (!currentQuote) return;

    const match = matchQuoteText(currentQuote.text, val, threshold);
    setCurrentMatch(match);

    if (match.isMatch && !quoteSuccess) {
      handleQuotePassed(true);
    }
  };

  // Anti-Cheat: Block Paste
  const handleBlockPaste = (e) => {
    e.preventDefault();
    setGateNotice('Direct pasting is disabled on the Mindset Gate. Type your mantra out manually to internalize it.');
  };

  // Anti-Cheat: Block Drag & Drop
  const handleBlockDrop = (e) => {
    e.preventDefault();
  };

  // Quote Successfully Passed (either voice or typed)
  const handleQuotePassed = (isTyped) => {
    setQuoteSuccess(true);
    speechService.stop();
    setIsListening(false);

    if (isTyped) {
      setQuotesTypedCount((prev) => prev + 1);
    }

    // Auto-advance after 800ms celebratory pause
    setTimeout(() => {
      if (currentIndex + 1 < quotes.length) {
        setCurrentIndex((prev) => prev + 1);
        resetQuoteState();
      } else {
        // All 5 quotes completed! Complete the gate
        finishGate(isTyped);
      }
    }, 800);
  };

  // Complete Gate in backend and trigger unlock
  const finishGate = async (finalQuoteWasTyped) => {
    setIsCompleting(true);
    setStep('unlocked');

    const totalTyped = quotesTypedCount + (finalQuoteWasTyped ? 1 : 0);
    let method = 'voice';
    if (totalTyped >= quotes.length) {
      method = 'typed_fallback';
    } else if (totalTyped > 0) {
      method = 'mixed';
    }

    try {
      if (logId) {
        await api.completeGate({
          logId,
          method,
          attemptsTotal: Math.max(quotes.length, totalAttempts + 1),
          quotesCompleted: quotes.length,
          quotesTyped: totalTyped
        });
      }

      // Store unlock token in sessionStorage keyed strictly by userId
      if (userId) {
        sessionStorage.setItem(`knotiq_mindset_gate_unlocked_${userId}`, 'true');
      }

      // Delay briefly to allow unlock animation to play
      setTimeout(() => {
        onUnlock();
      }, 1200);
    } catch (err) {
      console.error('Failed to finalize gate completion:', err);
      // Even if logging network request failed, unlock session for user
      if (userId) {
        sessionStorage.setItem(`knotiq_mindset_gate_unlocked_${userId}`, 'true');
      }
      setTimeout(() => {
        onUnlock();
      }, 1000);
    }
  };

  // Handle Setup Form Submission (5 quotes)
  const handleSaveSetup = async (e) => {
    e.preventDefault();
    setSetupError('');

    // Validate 5 non-empty quotes
    for (let i = 0; i < 5; i++) {
      if (!setupQuotes[i].text.trim()) {
        setSetupError(`Quote #${i + 1} cannot be empty. Please enter all 5 quotes.`);
        return;
      }
      if (setupQuotes[i].text.trim().length > 300) {
        setSetupError(`Quote #${i + 1} is too long (max 300 characters).`);
        return;
      }
    }

    setSavingSetup(true);
    try {
      const res = await api.replaceGateQuotes(
        setupQuotes.map((q, idx) => ({
          text: q.text.trim(),
          author: q.author.trim() || null,
          language: q.language || 'en-IN',
          sortOrder: idx,
          isActive: true
        }))
      );

      const saved = res.quotes || [];
      setQuotes(saved);
      setStep('recite');
      setCurrentIndex(0);
      resetQuoteState();
    } catch (err) {
      setSetupError(err.message || 'Failed to save founder quotes. Please try again.');
    } finally {
      setSavingSetup(false);
    }
  };

  const handleSetupQuoteChange = (index, field, value) => {
    setSetupQuotes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Knotiq Mindset Gate"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#090D16',
        color: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: '36px 16px 80px 16px',
        overflowY: 'auto',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
      }}
    >
      {/* Background Decorative Gold Aura */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, rgba(9, 13, 22, 0) 70%)',
          pointerEvents: 'none',
          borderRadius: '50%'
        }}
      />

      {/* Screen Reader Live Announcement Region */}
      <div
        id={liveRegionId}
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      >
        {quoteSuccess ? `Quote ${currentIndex + 1} completed.` : transcript || typedInput}
      </div>

      {/* Main Container */}
      <div
        style={{
          width: '100%',
          maxWidth: step === 'setup' ? '820px' : '760px',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {/* Knotiq Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: 'var(--gold-primary, #F59E0B)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '12px'
            }}
          >
            <Shield size={14} /> Knotiq Command Center &bull; Mindset Gate
          </div>

          <h1
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '28px',
              fontWeight: 700,
              color: '#FFFFFF',
              margin: '0 0 8px 0',
              letterSpacing: '-0.02em'
            }}
          >
            {step === 'setup'
              ? 'Define Your 5 Founder Mantras'
              : step === 'unlocked'
              ? 'Mindset Aligned. Dashboard Unlocked.'
              : 'Recite Your Daily Principles Out Loud'}
          </h1>

          <p
            style={{
              fontSize: '14px',
              color: '#94A3B8',
              margin: 0,
              maxWidth: '580px',
              lineHeight: 1.5
            }}
          >
            {step === 'setup'
              ? 'The Mindset Gate locks your dashboard each morning until you speak your 5 core principles aloud. Set your 5 personalized quotes to activate.'
              : step === 'unlocked'
              ? 'Your conviction has set the tone for today. Entering your workspace...'
              : 'Before analyzing leads, making calls, or reviewing metrics, reinforce your conviction by reciting each principle clearly.'}
          </p>
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: SETUP 5 QUOTES                                                    */}
        {/* ========================================================================= */}
        {step === 'setup' && (
          <form
            onSubmit={handleSaveSetup}
            style={{
              width: '100%',
              backgroundColor: '#0E1424',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
            }}
          >
            {setupError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  fontSize: '13px',
                  marginBottom: '20px'
                }}
              >
                <AlertCircle size={16} />
                <span>{setupError}</span>
              </div>
            )}

            {/* Quick Jump Bar for all 5 Mantras */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginBottom: '20px',
                padding: '10px 14px',
                backgroundColor: 'rgba(20, 29, 51, 0.9)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginRight: '4px' }}>
                All 5 Mantras:
              </span>
              {[1, 2, 3, 4, 5].map((num) => {
                const isFilled = Boolean(setupQuotes[num - 1]?.text?.trim());
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`setup-mantra-card-${num}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: num === 1
                        ? 'rgba(245, 158, 11, 0.25)'
                        : isFilled
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(255, 255, 255, 0.06)',
                      border: num === 1
                        ? '1px solid rgba(245, 158, 11, 0.6)'
                        : isFilled
                        ? '1px solid rgba(16, 185, 129, 0.3)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      color: num === 1 ? '#F59E0B' : isFilled ? '#10B981' : '#94A3B8',
                      cursor: 'pointer'
                    }}
                  >
                    <span>Mantra #{num}</span>
                    {isFilled ? <CheckCircle2 size={12} /> : null}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {setupQuotes.map((q, idx) => (
                <div
                  key={idx}
                  id={`setup-mantra-card-${idx + 1}`}
                  style={{
                    backgroundColor: '#141D33',
                    border: idx === 0
                      ? '2px solid rgba(245, 158, 11, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    boxShadow: idx === 0 ? '0 0 24px rgba(245, 158, 11, 0.12)' : 'none'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          backgroundColor: idx === 0 ? 'var(--gold-primary, #F59E0B)' : 'rgba(245, 158, 11, 0.15)',
                          color: idx === 0 ? '#090D16' : 'var(--gold-primary, #F59E0B)',
                          border: idx === 0 ? 'none' : '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        Mantra #{idx + 1}
                      </span>
                      {idx === 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--gold-primary, #F59E0B)', fontWeight: 700 }}>
                          ★ Foundation Principle
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Globe size={13} color="#94A3B8" />
                      <select
                        value={q.language}
                        onChange={(e) => handleSetupQuoteChange(idx, 'language', e.target.value)}
                        style={{
                          backgroundColor: '#090D16',
                          color: '#E2E8F0',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="en-IN">English (India)</option>
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="hi-IN">Hindi (India)</option>
                      </select>
                    </div>
                  </div>

                  <input
                    type="text"
                    required
                    maxLength={300}
                    placeholder={`Enter quote #${idx + 1} (e.g. Every luxury interior starts with an artisan loom foundation)`}
                    value={q.text}
                    onChange={(e) => handleSetupQuoteChange(idx, 'text', e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#090D16',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '13px',
                      marginBottom: '8px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />

                  <input
                    type="text"
                    placeholder="Author or source (optional, e.g. Founder Creed)"
                    value={q.author}
                    onChange={(e) => handleSetupQuoteChange(idx, 'author', e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#090D16',
                      color: '#94A3B8',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={savingSetup}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--gold-primary, #F59E0B)',
                  color: '#090D16',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 24px',
                  cursor: savingSetup ? 'not-allowed' : 'pointer',
                  opacity: savingSetup ? 0.7 : 1,
                  transition: 'background-color 0.2s ease',
                  minHeight: '44px'
                }}
              >
                <span>{savingSetup ? 'Saving Mantras...' : 'Lock In Mantras & Open Gate'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: RECITE QUOTES 1 BY 1                                              */}
        {/* ========================================================================= */}
        {step === 'recite' && currentQuote && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            {/* Step Progress Indicators */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px'
              }}
            >
              {quotes.map((_, idx) => {
                const isDone = idx < currentIndex || (idx === currentIndex && quoteSuccess);
                const isCurrent = idx === currentIndex;
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <div
                      style={{
                        width: isCurrent ? '28px' : '10px',
                        height: '10px',
                        borderRadius: '999px',
                        backgroundColor: isDone
                          ? 'var(--emerald-accent, #10B981)'
                          : isCurrent
                          ? 'var(--gold-primary, #F59E0B)'
                          : 'rgba(255, 255, 255, 0.15)',
                        transition: 'all 0.3s ease',
                        boxShadow: isCurrent ? '0 0 10px rgba(245, 158, 11, 0.4)' : 'none'
                      }}
                    />
                  </div>
                );
              })}
              <span
                style={{
                  fontSize: '12px',
                  color: '#94A3B8',
                  fontWeight: 600,
                  marginLeft: '8px'
                }}
              >
                Quote {currentIndex + 1} of {quotes.length}
              </span>
            </div>

            {/* Quote Recitation Card */}
            <div
              style={{
                width: '100%',
                backgroundColor: '#0E1424',
                border: quoteSuccess
                  ? '1px solid rgba(16, 185, 129, 0.5)'
                  : '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '20px',
                padding: '36px 32px',
                boxShadow: quoteSuccess
                  ? '0 20px 50px rgba(16, 185, 129, 0.15)'
                  : '0 20px 50px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
                transition: 'border 0.3s ease, box-shadow 0.3s ease'
              }}
            >
              {/* Quote Meta Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--gold-primary, #F59E0B)',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  padding: '5px 14px',
                  borderRadius: '999px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '18px'
                }}
              >
                <Sparkles size={13} />
                <span>Mantra #{currentIndex + 1}</span>
                {currentIndex === 0 && <span style={{ color: '#FCD34D' }}>&bull; Foundation Principle</span>}
                <span style={{ color: '#94A3B8', fontWeight: 500 }}>&bull; {currentQuote.language || 'en-IN'}</span>
                {currentQuote.author && (
                  <span style={{ color: '#94A3B8', fontWeight: 500 }}>&bull; {currentQuote.author}</span>
                )}
              </div>

              {/* Word-by-Word Highlight Quote Display */}
              <div
                style={{
                  fontSize: '22px',
                  lineHeight: 1.6,
                  fontWeight: 600,
                  fontFamily: "'Outfit', sans-serif",
                  color: '#CBD5E1',
                  marginBottom: '28px',
                  maxWidth: '680px',
                  userSelect: 'none'
                }}
              >
                <span style={{ color: 'var(--gold-primary, #F59E0B)', marginRight: '6px' }}>“</span>
                {quoteTokens.map((token, wordIdx) => {
                  const isWordMatched = currentMatch.matchedIndices.includes(wordIdx);
                  return (
                    <span
                      key={wordIdx}
                      style={{
                        margin: '0 3px',
                        display: 'inline-block',
                        color: isWordMatched ? 'var(--gold-primary, #F59E0B)' : '#94A3B8',
                        textShadow: isWordMatched
                          ? '0 0 14px rgba(245, 158, 11, 0.6)'
                          : 'none',
                        fontWeight: isWordMatched ? 700 : 500,
                        transform: isWordMatched ? 'scale(1.04)' : 'scale(1)',
                        transition: 'all 0.25s ease'
                      }}
                    >
                      {token}
                    </span>
                  );
                })}
                <span style={{ color: 'var(--gold-primary, #F59E0B)', marginLeft: '6px' }}>”</span>
              </div>

              {/* Success celebration state */}
              {quoteSuccess ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'var(--emerald-accent, #10B981)',
                    fontSize: '16px',
                    fontWeight: 700,
                    padding: '12px 24px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    animation: 'fadeIn 0.3s ease'
                  }}
                >
                  <CheckCircle2 size={20} />
                  <span>
                    {currentIndex + 1 < quotes.length ? 'Principle Confirmed! Advancing...' : 'All Principles Recited!'}
                  </span>
                </div>
              ) : (
                /* Interactive Input: Voice Recital or Typed Fallback */
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {!forceTypedMode ? (
                    <>
                      {/* Live Microphone Button */}
                      <button
                        type="button"
                        onClick={toggleListening}
                        aria-label={isListening ? 'Stop listening' : 'Start speaking mantra out loud'}
                        style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          backgroundColor: isListening ? '#EF4444' : 'var(--gold-primary, #F59E0B)',
                          color: isListening ? '#FFFFFF' : '#090D16',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isListening
                            ? '0 0 30px rgba(239, 68, 68, 0.6)'
                            : '0 0 24px rgba(245, 158, 11, 0.4)',
                          transition: 'all 0.2s ease',
                          marginBottom: '16px',
                          position: 'relative'
                        }}
                      >
                        {isListening ? <MicOff size={32} /> : <Mic size={32} />}
                      </button>

                      {/* Status / Spoken text display */}
                      <div style={{ minHeight: '44px', textAlign: 'center', marginBottom: '12px' }}>
                        {isListening ? (
                          <div style={{ fontSize: '14px', color: '#F59E0B', fontWeight: 600 }}>
                            Listening... Speak clearly into your microphone
                          </div>
                        ) : transcript ? (
                          <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                            Last heard: <span style={{ color: '#E2E8F0', fontStyle: 'italic' }}>"{transcript}"</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#64748B' }}>
                            Click the microphone or press <kbd style={{ padding: '2px 6px', background: '#1E293B', borderRadius: '4px', border: '1px solid #334155' }}>Space</kbd> to begin speaking
                          </div>
                        )}
                      </div>

                      {/* Switch to Typed Option */}
                      {(failedAttempts >= fallbackAfter || speechError) && (
                        <button
                          type="button"
                          onClick={() => {
                            speechService.stop();
                            setIsListening(false);
                            setForceTypedMode(true);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '8px',
                            color: '#94A3B8',
                            fontSize: '12px',
                            padding: '8px 14px',
                            cursor: 'pointer',
                            marginTop: '8px',
                            minHeight: '44px'
                          }}
                        >
                          <Keyboard size={14} /> Type this quote manually instead
                        </button>
                      )}
                    </>
                  ) : (
                    /* Strict Typed Fallback (Paste/Drop Blocked) */
                    <div style={{ width: '100%', maxWidth: '580px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px'
                        }}
                      >
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                          Type your mantra word-by-word (pasting is blocked):
                        </span>
                        {isSpeechSupported && isSecure && (
                          <button
                            type="button"
                            onClick={() => {
                              setForceTypedMode(false);
                              setTypedInput('');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--gold-primary, #F59E0B)',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Mic size={12} /> Switch back to voice
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        autoFocus
                        autoComplete="off"
                        spellCheck="false"
                        autoCorrect="off"
                        autoCapitalize="off"
                        data-lpignore="true"
                        placeholder="Type the full quote manually to verify conviction..."
                        value={typedInput}
                        onChange={handleTypedChange}
                        onPaste={handleBlockPaste}
                        onDrop={handleBlockDrop}
                        style={{
                          width: '100%',
                          backgroundColor: '#090D16',
                          color: '#FFFFFF',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          borderRadius: '10px',
                          padding: '12px 16px',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  )}

                  {/* Feedback / Notice Banner */}
                  {gateNotice && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        color: '#F59E0B',
                        fontSize: '12px',
                        textAlign: 'center',
                        maxWidth: '540px'
                      }}
                    >
                      {gateNotice}
                    </div>
                  )}

                  {speechError && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#F87171',
                        fontSize: '12px',
                        textAlign: 'center',
                        maxWidth: '540px'
                      }}
                    >
                      {speechError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: UNLOCKED CELEBRATION                                              */}
        {/* ========================================================================= */}
        {step === 'unlocked' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '40px 20px'
            }}
          >
            <div
              style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid var(--emerald-accent, #10B981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--emerald-accent, #10B981)',
                marginBottom: '20px',
                boxShadow: '0 0 40px rgba(16, 185, 129, 0.4)'
              }}
            >
              <Unlock size={44} />
            </div>

            <h2
              style={{
                fontSize: '24px',
                fontFamily: "'Outfit', sans-serif",
                color: '#FFFFFF',
                marginBottom: '8px'
              }}
            >
              Founder Mindset Locked In
            </h2>

            <p style={{ color: '#94A3B8', fontSize: '14px', maxWidth: '420px', margin: 0 }}>
              Consistency streak extended. Loading your daily command center...
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MANDATORY PRIVACY GUARANTEE (Amendment 1)                                  */}
        {/* ========================================================================= */}
        <div
          style={{
            marginTop: '32px',
            maxWidth: '680px',
            textAlign: 'center',
            fontSize: '11px',
            color: '#64748B',
            lineHeight: 1.6,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            paddingTop: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            justifyContent: 'center'
          }}
        >
          <Info size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Privacy Guarantee:</strong> Knotiq never records, uploads, or stores your voice audio. Voice audio recognition is processed directly through your browser engine (e.g. Google Chrome / Web Speech API), which handles speech data in accordance with the browser vendor's privacy policy.
          </span>
        </div>
      </div>
    </div>
  );
}
