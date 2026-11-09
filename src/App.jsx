import React, { useState, useEffect, useRef } from 'react';
import { translations } from './data/translations';
import { supabase, isSupabaseConfigured, getLocalWishes, saveLocalWish } from './lib/supabase';
import {
  Heart,
  Volume2,
  VolumeX,
  Languages,
  Calendar,
  Clock,
  MapPin,
  X,
  Send,
  CheckCircle2,
  ChevronDown,
  ExternalLink
} from 'lucide-react';

const formatTimeAgo = (createdAt, lang) => {
  const timestamp = new Date(createdAt).getTime();
  if (Number.isNaN(timestamp)) return '';

  const differenceInSeconds = (timestamp - Date.now()) / 1000;
  const absoluteSeconds = Math.abs(differenceInSeconds);
  let value;
  let unit;

  if (absoluteSeconds < 60) {
    value = Math.round(differenceInSeconds);
    unit = 'second';
  } else if (absoluteSeconds < 60 * 60) {
    value = Math.round(differenceInSeconds / 60);
    unit = 'minute';
  } else if (absoluteSeconds < 60 * 60 * 24) {
    value = Math.round(differenceInSeconds / (60 * 60));
    unit = 'hour';
  } else if (absoluteSeconds < 60 * 60 * 24 * 30) {
    value = Math.round(differenceInSeconds / (60 * 60 * 24));
    unit = 'day';
  } else if (absoluteSeconds < 60 * 60 * 24 * 365) {
    value = Math.round(differenceInSeconds / (60 * 60 * 24 * 30));
    unit = 'month';
  } else {
    value = Math.round(differenceInSeconds / (60 * 60 * 24 * 365));
    unit = 'year';
  }

  return new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    numeric: 'always',
  }).format(value, unit);
};

export default function App() {
  const [lang, setLang] = useState('ar');
  const t = translations[lang];

  // Envelope state
  const [envelopeOpened, setEnvelopeOpened] = useState(false);
  const [envelopeRemoved, setEnvelopeRemoved] = useState(false);
  const [flapOpen, setFlapOpen] = useState(false);
  const [letterLift, setLetterLift] = useState(false);
  const [sealCracking, setSealCracking] = useState(false);

  // Audio state
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);
  const audioElementRef = useRef(null);

  // Lightbox state
  const [activeLightbox, setActiveLightbox] = useState(null);


  // Guestbook state
  const [wishes, setWishes] = useState([]);
  const [wisherName, setWisherName] = useState('');
  const [wisherMessage, setWisherMessage] = useState('');
  const [isSubmittingWish, setIsSubmittingWish] = useState(false);
  const [wishStatus, setWishStatus] = useState({ text: '', type: '' });
  const [fetchError, setFetchError] = useState('');

  // Gift Registry state
  const [showGiftDetails, setShowGiftDetails] = useState(false);

  // Countdown state
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Sync document direction and language tag
  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = t.lang;
  }, [lang, t]);

  // Live Countdown logic (December 22, 2026, 20:00 Cairo time)
  useEffect(() => {
    const targetDate = new Date('2026-12-22T17:00:00+02:00').getTime();

    const calculateTime = () => {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Play synthesized ambient harp sound as backup
  const playSyntheticChimes = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      const notes = [261.63, 329.63, 392.00, 440.00, 523.25, 659.25];
      let step = 0;

      const playChime = (freq) => {
        if (!audioCtxRef.current) return;
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);

        gain.gain.setValueAtTime(0.0001, audioCtxRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, audioCtxRef.current.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtxRef.current.currentTime + 2.2);

        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);

        osc.start();
        osc.stop(audioCtxRef.current.currentTime + 2.3);
      };

      setIsPlayingMusic(true);
      
      playChime(notes[0]);

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        step++;
        playChime(notes[step % notes.length]);
      }, 1100);
    } catch (e) {
      console.warn('Audio synthesis failed', e);
    }
  };

  const toggleMusic = () => {
    const audioEl = audioElementRef.current;
    if (isPlayingMusic) {
      setIsPlayingMusic(false);
      if (audioEl && !audioEl.paused) {
        audioEl.pause();
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      if (audioEl) {
        audioEl.volume = 0.75;
        audioEl.play().then(() => {
          setIsPlayingMusic(true);
        }).catch((e) => {
          console.info('Audio play fell back to synth chimes', e);
          playSyntheticChimes();
        });
      } else {
        playSyntheticChimes();
      }
    }
  };

  // Envelope Opening Sequence
  const handleOpenEnvelope = () => {
    setSealCracking(true);
    // Trigger audio immediately on user click to comply with browser autoplay security policies
    const audioEl = audioElementRef.current;
    if (audioEl && !isPlayingMusic) {
      audioEl.volume = 0.75;
      audioEl.play().then(() => {
        setIsPlayingMusic(true);
      }).catch((e) => {
        console.info('Autoplay deferred until further interaction', e);
      });
    }
    setTimeout(() => {
      setFlapOpen(true);
      setTimeout(() => {
        setLetterLift(true);
        setTimeout(() => {
          setEnvelopeOpened(true);
          if (!isPlayingMusic) toggleMusic();
          setTimeout(() => {
            setEnvelopeRemoved(true);
          }, 900);
        }, 600);
      }, 450);
    }, 350);
  };

  const handleSkipEnvelope = () => {
    setEnvelopeOpened(true);
    toggleMusic();
    setTimeout(() => {
      setEnvelopeRemoved(true);
    }, 500);
  };

  // Fetch wishes on mount
  useEffect(() => {
    const fetchWishes = async () => {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('bido_wedding_wishes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (error) {
            console.error('Supabase fetch failed:', {
              message: error?.message,
              code: error?.code,
              details: error?.details,
              hint: error?.hint,
            });
            setWishes([]);
            setFetchError(t.guestbook.fetchError || (lang === 'ar' ? 'تعذر تحميل التهاني حالياً. حاول تحديث الصفحة.' : 'Could not load wishes at this time. Please refresh the page.'));
            return;
          }

          setFetchError('');
          setWishes(data ?? []);
          return;
        } catch (err) {
          console.error('Supabase fetch failed:', err);
          setWishes([]);
          setFetchError(t.guestbook.fetchError || (lang === 'ar' ? 'تعذر تحميل التهاني حالياً. حاول تحديث الصفحة.' : 'Could not load wishes at this time. Please refresh the page.'));
          return;
        }
      }

      // Local fallback ONLY when Supabase is not configured
      setFetchError('');
      const local = getLocalWishes();
      if (local && local.length > 0) {
        setWishes(local);
      } else {
        setWishes(t.guestbook.initialWishes ?? []);
      }
    };

    fetchWishes();
  }, [lang, t.guestbook.initialWishes, t.guestbook.fetchError]);

  // Handle Guestbook Submission
  const handlePostWish = async (e) => {
    e.preventDefault();
    if (!wisherName.trim() || !wisherMessage.trim()) {
      setWishStatus({ text: t.guestbook.emptyError, type: 'error' });
      return;
    }

    setIsSubmittingWish(true);
    setWishStatus({ text: '', type: '' });

    const newWish = {
      name: wisherName.trim(),
      message: wisherMessage.trim(),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('bido_wedding_wishes')
          .insert([newWish])
          .select();

        if (error) {
          console.error('Supabase insert failed:', {
            message: error?.message,
            code: error?.code,
            details: error?.details,
            hint: error?.hint,
          });
          setWishStatus({
            text: t.guestbook.sendError || (lang === 'ar' ? 'تعذر إرسال التهنئة. حاول مرة أخرى.' : 'Could not send your wish. Please try again.'),
            type: 'error',
          });
          return;
        }

        const inserted = data?.[0] ?? newWish;
        setWishes((prev) => [inserted, ...prev]);
        setWishStatus({ text: t.guestbook.successMsg, type: 'success' });
        setWisherName('');
        setWisherMessage('');
      } catch (err) {
        console.error('Supabase insert failed:', err);
        setWishStatus({
          text: t.guestbook.sendError || (lang === 'ar' ? 'تعذر إرسال التهنئة. حاول مرة أخرى.' : 'Could not send your wish. Please try again.'),
          type: 'error',
        });
      } finally {
        setIsSubmittingWish(false);
      }
    } else {
      // Local preview simulation ONLY when Supabase is not configured
      setTimeout(() => {
        saveLocalWish(newWish);
        setWishes((prev) => [newWish, ...prev]);
        setWishStatus({ text: t.guestbook.fallbackMsg, type: 'success' });
        setWisherName('');
        setWisherMessage('');
        setIsSubmittingWish(false);
      }, 400);
    }
  };


  return (
    <div className={`min-h-screen bg-ivory text-ink selection:bg-gold-light selection:text-burgundy-deep ${lang === 'ar' ? 'font-naskh' : 'font-cormorant'}`}>
      
      {/* Background Wedding Song Audio */}
      <audio ref={audioElementRef} src="/audio/song.mp3" loop preload="auto" />

      {/* 3D Envelope Cinematic Overlay */}
      {!envelopeRemoved && (
        <aside
          className={`fixed inset-0 z-50 flex items-center justify-center bg-parchment/95 backdrop-blur-md p-4 select-none transition-all duration-1000 ${
            envelopeOpened ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* Top Controls: Language Switcher & Skip Button */}
          <div className="absolute top-6 inset-x-6 flex justify-between items-center z-40">
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="text-xs px-3 py-1.5 rounded-full border border-gold/50 bg-white/80 text-burgundy shadow-sm hover:bg-gold hover:text-white transition-all flex items-center gap-1.5 font-sans"
              type="button"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
            </button>

            <button
              onClick={handleSkipEnvelope}
              className="text-xs px-3.5 py-1.5 rounded-full border border-gold/50 bg-white/80 text-burgundy shadow-sm hover:bg-gold hover:text-white transition-all font-sans"
              type="button"
            >
              {t.envelope.skipBtn}
            </button>
          </div>

          {/* 3D Envelope Container */}
          <div className="relative w-full max-w-md perspective-1200 flex flex-col items-center">
            {/* Instruction Pill */}
            <div className={`mb-4 text-center gentle-bounce transition-opacity duration-300 ${flapOpen ? 'opacity-0' : 'opacity-100'}`}>
              <span className="inline-block text-xs md:text-sm tracking-widest text-burgundy font-amiri bg-white/90 px-4 py-1.5 rounded-full border border-gold/40 shadow-sm">
                {t.envelope.instruction}
              </span>
            </div>

            {/* Outer Envelope Body */}
            <div className="envelope-box relative w-[330px] sm:w-[380px] h-[240px] sm:h-[270px] bg-[#EFE9DE] rounded-xl shadow-2xl overflow-visible border border-gold/30">
              {/* Damask Lining */}
              <div className="absolute inset-0 rounded-xl bg-burgundy-deep overflow-hidden">
                <div className="w-full h-full opacity-20 bg-[radial-gradient(#C8AD78_1.5px,transparent_1.5px)] [background-size:16px_16px]"></div>
              </div>

              {/* Sliding Invitation Letter */}
              <div
                className={`letter-card absolute inset-x-3 top-3 h-[225px] sm:h-[250px] bg-white rounded-lg shadow-lg border border-gold/40 p-4 text-center flex flex-col justify-center items-center pointer-events-none ${
                  letterLift ? 'letter-lift' : ''
                }`}
              >
                <div className="w-9 h-9 mx-auto mb-1 rounded-full border border-gold/60 flex items-center justify-center text-gold-dark font-amiri text-base">
                  {t.envelope.monogram}
                </div>
                <p className="text-[10px] sm:text-xs text-burgundy tracking-widest uppercase font-cinzel">
                  {t.envelope.invitationSubtitle}
                </p>
                <h4 className="font-amiri text-lg sm:text-xl text-burgundy-deep mt-1 font-bold">
                  {t.envelope.names}
                </h4>
                <div className="w-16 h-px bg-gold/50 my-1.5"></div>
                <p className="text-[11px] text-muted font-sans">
                  {t.envelope.date}
                </p>
                <span className="mt-1 text-[9px] text-gold-dark tracking-wider">
                  {t.envelope.venue}
                </span>
              </div>

              {/* Envelope Wings (SVG Geometry) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" fill="none" preserveAspectRatio="none" viewBox="0 0 380 270">
                <polygon fill="#F7F3EA" points="0,0 190,135 0,270" stroke="#DFD7C7" strokeWidth="0.5"></polygon>
                <polygon fill="#F2ECE0" points="380,0 190,135 380,270" stroke="#DFD7C7" strokeWidth="0.5"></polygon>
                <polygon fill="#ECE5D7" points="0,270 190,130 380,270" stroke="#DFD7C7" strokeWidth="0.75"></polygon>
              </svg>

              {/* Top Flap */}
              <div className={`flap-top absolute top-0 inset-x-0 h-1/2 overflow-visible origin-top ${flapOpen ? 'flap-open' : ''}`}>
                <svg className="w-full h-[140px] drop-shadow-md" fill="none" preserveAspectRatio="none" viewBox="0 0 380 140">
                  <polygon fill="#F8F4EC" points="0,0 380,0 190,140" stroke="#DFD7C7" strokeWidth="0.7"></polygon>
                </svg>
              </div>

              {/* Wax Seal Button (Full circular fit) */}
              <div className="absolute left-1/2 top-[125px] sm:top-[140px] -translate-x-1/2 -translate-y-1/2 z-40">
                <button
                  onClick={handleOpenEnvelope}
                  className={`relative group focus:outline-none transition-transform active:scale-95 ${sealCracking ? 'wax-cracking pointer-events-none' : ''}`}
                  type="button"
                  aria-label="Open wedding invitation"
                >
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full seal-shadow transition-transform duration-300 group-hover:scale-105 overflow-hidden flex items-center justify-center border-2 border-gold/70 shadow-2xl bg-amber-50">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZquqsKH1CDdtp_7odESLJ7RaqvwwkM5diy6FTCgUnnISJxiY7kbBloWb1H6hGqRgRJbMkoWpXp7xPT9KiknlPBF6Bdr7_tAv9snq_QJOt8zL2Dj3a4JkrFDvCktQlqD-tbxu9p9QA8mfYKKf9b4lFSI7XOi_z6OO9KrLCyiuJe4Y4tZoTI4Iuu2lFEBnXlxkJLZJBAG-cGNHC723CNNQXqfAQol_Lm_kK3_0pZYK1uaJXwSbKUZR1xLnjZO0M2sgJNUM"
                      alt="Golden Wax Seal"
                      className="w-full h-full object-cover pointer-events-none drop-shadow-md select-none rounded-full scale-105"
                    />
                    <div className="absolute inset-0 rounded-full ring-2 ring-gold/70 ring-offset-2 ring-offset-parchment animate-pulse pointer-events-none"></div>
                  </div>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-amiri text-burgundy bg-white/95 px-2.5 py-0.5 rounded-full border border-gold/40 shadow-xs pointer-events-none">
                    {t.envelope.tapPrompt}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Floating Navigation & Controls */}
      <div className="fixed bottom-5 left-5 z-40 flex flex-col items-center gap-3">
        {/* Language Switcher Floating Button */}
        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          aria-label="Switch Language"
          className="w-12 h-12 rounded-full bg-white/95 border-2 border-gold shadow-lg flex items-center justify-center text-burgundy hover:bg-gold hover:text-white transition-all transform active:scale-95"
          title={lang === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
        >
          <span className="font-bold text-xs uppercase font-sans">{lang === 'ar' ? 'EN' : 'عربي'}</span>
        </button>

        {/* Ambient Sound Toggle */}
        <div className="relative group">
          <button
            onClick={toggleMusic}
            aria-label="Toggle Soundtrack"
            className="w-12 h-12 rounded-full bg-white/95 border-2 border-gold shadow-lg flex items-center justify-center text-burgundy hover:bg-gold hover:text-white transition-all"
          >
            {isPlayingMusic ? (
              <svg className="w-6 h-6 spin-slow" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="1.5"></circle>
                <circle cx="12" cy="12" fill="currentColor" r="3"></circle>
                <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"></path>
              </svg>
            ) : (
              <VolumeX className="w-5 h-5 text-muted" />
            )}
          </button>
          <span className="absolute right-14 top-1/2 -translate-y-1/2 bg-ink/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            {t.audio.label}
          </span>
        </div>

        {/* Floating Wishes Button */}
        <a
          href="#guestbook-section"
          aria-label="Scroll to Wishes & Guestbook"
          className="w-12 h-12 rounded-full bg-burgundy text-white border-2 border-gold/70 shadow-lg flex items-center justify-center hover:bg-burgundy-deep transition-all transform active:scale-95"
        >
          <Heart className="w-5 h-5 fill-current" />
        </a>
      </div>

      {/* Main Page Content */}
      <main className="min-h-screen relative overflow-hidden">
        {/* Subtle Background Damask Texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#C8AD78_0.7px,transparent_0.7px)] [background-size:24px_24px] opacity-15 pointer-events-none"></div>

        {/* Hero Header Section */}
        <header className="relative pt-12 pb-16 md:pt-20 md:pb-24 px-4 text-center max-w-4xl mx-auto">
          {/* Bismillah */}
          <div className="mb-4">
            <span className="font-amiri text-lg md:text-2xl text-burgundy/90 tracking-wide">
              {t.hero.bismillah}
            </span>
          </div>

          {/* Quranic Verse */}
          <div className="max-w-lg mx-auto mb-6 px-4">
            <p className="font-amiri text-muted text-sm md:text-base leading-relaxed">
              {t.hero.verse}
            </p>
          </div>

          {/* Enhanced Royal Monogram Emblem Crest */}
          <div className="my-8 inline-flex flex-col items-center justify-center relative group">
            {/* Ambient golden aura */}
            <div className="absolute -inset-3 bg-gradient-to-r from-gold/30 via-gold-light/40 to-gold/30 rounded-full blur-md opacity-75 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-b from-[#FFFDF9] via-[#FAF6EE] to-[#EFE6D5] p-1.5 shadow-xl border-2 border-gold flex items-center justify-center">
              {/* Inner Ornate Filigree Ring */}
              <div className="w-full h-full rounded-full border border-gold/60 border-double p-1 flex flex-col items-center justify-center relative overflow-hidden bg-[radial-gradient(#C8AD78_0.7px,transparent_0.7px)] [background-size:10px_10px]">
                <span className="text-[10px] sm:text-xs text-gold-dark tracking-widest uppercase select-none opacity-80 mb-0.5">✦</span>
                <span className={`text-2xl sm:text-4xl font-bold text-burgundy-deep tracking-wider drop-shadow-xs ${lang === 'ar' ? 'font-amiri' : 'font-cormorant italic'}`}>
                  {t.hero.monogram}
                </span>
                <span className="text-[9px] sm:text-[10px] text-gold-dark tracking-widest uppercase select-none opacity-80 mt-0.5">2026</span>
              </div>
            </div>
          </div>

          {/* Couple Names */}
          <div className="space-y-2 mt-2 mb-6">
            <h1 className={`text-4xl sm:text-6xl md:text-7xl font-bold text-burgundy-deep tracking-normal leading-tight ${lang === 'ar' ? 'font-amiri' : 'font-cormorant'}`}>
              {t.hero.groom} <span className={`text-gold ${lang === 'ar' ? 'font-amiri font-bold text-3xl sm:text-5xl mx-2' : 'font-alex font-normal text-4xl sm:text-6xl'}`}>{lang === 'ar' ? 'و' : '&amp;'}</span> {t.hero.bride}
            </h1>
            <p className={`text-base sm:text-xl text-gold-dark tracking-wide ${lang === 'ar' ? 'font-amiri' : 'font-cormorant italic text-xl sm:text-2xl'}`}>
              {t.hero.invitationTag}
            </p>
          </div>

          {/* Wedding Date & Venue Overview Ribbon */}
          <div className="inline-flex items-center justify-center flex-wrap gap-3 bg-white/80 border border-gold/50 px-6 py-2.5 rounded-full shadow-sm">
            <span className="text-xs sm:text-sm font-semibold text-burgundy">
              {t.hero.dateRibbon}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-gold"></span>
            <span className="text-xs sm:text-sm font-medium text-muted">
              {t.hero.locationRibbon}
            </span>
          </div>

          {/* Hero Portrait Card (main.jpeg) */}
          <div
            onClick={() => setActiveLightbox({ src: '/img/main.jpeg', caption: lang === 'ar' ? 'عبدالله و نورهان — ميثاق المحبة ونقاء البدايات' : 'Abdullah & Norhan — The Covenant of Love' })}
            className="mt-10 max-w-sm sm:max-w-md mx-auto relative group cursor-pointer"
          >
            <div className="absolute -inset-2 bg-gradient-to-tr from-gold/30 via-dusty-pink/20 to-burgundy/20 rounded-2xl blur-md"></div>
            <div className="relative paper-deckle rounded-2xl p-2.5 sm:p-3.5 border border-gold/40 overflow-hidden shadow-xl">
              <img
                src="/img/main.jpeg"
                alt="Abdullah & Norhan Portrait"
                className="w-full h-[400px] sm:h-[480px] object-cover object-top rounded-xl"
              />
              <div className="p-3 text-center">
                <p className="font-cinzel text-xs tracking-widest text-burgundy">
                  {t.hero.portraitTag}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Heartfelt Invitation Letter with Equal Height Companion Photo (photo-6) */}
        <section className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            {/* Companion Photo: Royal Invitation Suite & Wax Seal */}
            <div className="md:col-span-5 order-2 md:order-1 flex flex-col">
              <div
                onClick={() => setActiveLightbox({ src: '/img/photo-6.jpg', caption: lang === 'ar' ? 'تفاصيل بطاقة الدعوة الفاخرة والختم الشمعي الملكي' : 'Keepsake Invitation Suite with Gold Wax Seal' })}
                className="paper-deckle rounded-2xl overflow-hidden border border-gold/40 shadow-lg cursor-pointer group flex-1 h-full min-h-[380px] relative"
              >
                <img
                  src="/img/photo-6.jpg"
                  alt={lang === 'ar' ? 'تفاصيل بطاقة الدعوة الملكية' : 'Invitation Suite with Gold Wax Seal'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 absolute inset-0"
                />
              </div>
            </div>

            {/* Letter Card */}
            <div className="md:col-span-7 order-1 md:order-2 flex flex-col">
              <div className="paper-deckle gold-filigree-border rounded-2xl p-6 sm:p-10 text-center relative bg-[#FFFDF9] shadow-md flex-1 flex flex-col justify-center items-center">
                <span className="absolute top-3 right-3 text-gold text-lg select-none">¤</span>
                <span className="absolute top-3 left-3 text-gold text-lg select-none">¤</span>
                <span className="absolute bottom-3 right-3 text-gold text-lg select-none">¤</span>
                <span className="absolute bottom-3 left-3 text-gold text-lg select-none">¤</span>

                <div className="my-auto py-2 w-full max-w-lg flex flex-col items-center justify-center">
                  <h2 className={`text-2xl sm:text-3xl text-burgundy font-bold mb-3 ${lang === 'ar' ? 'font-amiri' : 'font-cormorant'}`}>
                    {t.letter.title}
                  </h2>
                  <div className="ornament-divider max-w-xs mx-auto my-3 text-gold text-sm">❅ ❅ ❅</div>
                  <p className="text-ink/90 text-sm sm:text-base leading-loose font-normal">
                    {t.letter.body}
                  </p>
                  <p className={`text-burgundy-soft leading-relaxed mt-5 font-semibold ${lang === 'ar' ? 'font-amiri text-lg sm:text-xl' : 'font-cormorant italic text-xl sm:text-2xl'}`}>
                    {t.letter.quote}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Countdown Timer Section with Companion Photo (photo-2) */}
        <section className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-white/95 rounded-3xl border border-gold/40 p-6 sm:p-8 shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              <div className="md:col-span-7 text-center flex flex-col justify-center">
                <h3 className={`text-2xl sm:text-3xl text-burgundy font-bold mb-2 ${lang === 'ar' ? 'font-amiri' : 'font-cormorant'}`}>
                  {t.countdown.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted mb-6">
                  {t.countdown.subtitle}
                </p>

                {/* 4 Units Grid */}
                <div className="grid grid-cols-4 gap-2.5 sm:gap-3 max-w-md mx-auto" dir="ltr">
                  <div className="bg-parchment/60 border border-gold/40 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col items-center">
                    <span className="font-cinzel text-xl sm:text-3xl font-bold text-burgundy">
                      {String(timeLeft.days).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted mt-1">{t.countdown.days}</span>
                  </div>
                  <div className="bg-parchment/60 border border-gold/40 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col items-center">
                    <span className="font-cinzel text-xl sm:text-3xl font-bold text-burgundy">
                      {String(timeLeft.hours).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted mt-1">{t.countdown.hours}</span>
                  </div>
                  <div className="bg-parchment/60 border border-gold/40 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col items-center">
                    <span className="font-cinzel text-xl sm:text-3xl font-bold text-burgundy">
                      {String(timeLeft.minutes).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted mt-1">{t.countdown.minutes}</span>
                  </div>
                  <div className="bg-parchment/60 border border-gold/40 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col items-center">
                    <span className="font-cinzel text-xl sm:text-3xl font-bold text-burgundy">
                      {String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted mt-1">{t.countdown.seconds}</span>
                  </div>
                </div>
              </div>

              {/* Companion Photo: Wedding rings & roses (photo-2) */}
              <div className="md:col-span-5 flex flex-col">
                <div
                  onClick={() => setActiveLightbox({ src: '/img/photo-2.jpg', caption: lang === 'ar' ? 'ميثاق المحبة وخاتما الزفاف وتفاصيل الورد الجوري' : 'Wedding Rings & Burgundy Velvet Roses' })}
                  className="rounded-2xl overflow-hidden border border-gold/40 shadow-sm cursor-pointer group flex-1 h-full min-h-[220px] relative"
                >
                  <img
                    src="/img/photo-2.jpg"
                    alt={lang === 'ar' ? 'ميثاق المحبة وخاتما الزفاف' : 'Wedding Rings & Roses'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 absolute inset-0"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Venue Location Full Width (with h-80 image - photo-4) */}
        <section className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-6">
            <h3 className="font-amiri text-2xl sm:text-3xl text-burgundy font-bold">
              {t.venue.hallTitle}
            </h3>
            <p className="text-xs sm:text-sm text-muted mt-1">
              {t.venue.subtitle}
            </p>
          </div>

          <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-gold/40 shadow-xl overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-gold shrink-0" />
                  <h4 className="font-amiri text-2xl sm:text-3xl font-bold text-burgundy">
                    {t.venue.hallName}
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-muted mt-1">
                  {t.venue.hallAddress} • {t.venue.hallTag}
                </p>
              </div>

              <a
                href={t.venue.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gold hover:bg-gold-dark text-white font-semibold text-sm transition-all shadow-md active:scale-95 shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{t.venue.mapsBtn}</span>
              </a>
            </div>

            {/* Full Width Image with h-80 (photo-4) */}
            <div
              onClick={() => setActiveLightbox({ src: '/img/photo-4.jpg', caption: lang === 'ar' ? 'مأدبة العشاء الفاخرة والقاعة الملكية' : 'Grand Banquet Ballroom Setting' })}
              className="w-full h-80 rounded-2xl overflow-hidden relative border border-gold/30 shadow-inner group cursor-pointer"
            >
              <img
                src="/img/photo-4.jpg"
                alt={t.venue.hallName}
                className="w-full h-80 object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 flex flex-col justify-between p-6">
                <div className="self-end">
                  <span className="text-white text-xs font-semibold bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20">
                    {t.venue.hallTag}
                  </span>
                </div>
                <div className="text-white">
                  <h5 className="font-amiri text-xl sm:text-2xl font-bold drop-shadow-md">
                    {t.venue.hallName}
                  </h5>
                  <p className="text-white/80 text-xs sm:text-sm font-sans drop-shadow-sm">
                    {t.venue.hallAddress}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Love Story Narrative Section with Companion Photo (photo-3) */}
        <section className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-[#FFFDF9] border border-gold/40 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              {/* Companion Photo: Henna Hands (photo-3) */}
              <div className="md:col-span-5 flex flex-col">
                <div
                  onClick={() => setActiveLightbox({ src: '/img/photo-3.jpg', caption: lang === 'ar' ? 'تلاقي الأيادي ونقش الحناء الملكي والتطريز العاجي' : 'Entwined Hands with Royal Henna & Embroidered Lace' })}
                  className="rounded-2xl overflow-hidden border border-gold/40 shadow-sm cursor-pointer group flex-1 h-full min-h-[260px] relative"
                >
                  <img
                    src="/img/photo-3.jpg"
                    alt={lang === 'ar' ? 'تلاقي الأيادي ونقش الحناء' : 'Entwined Hands & Henna'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 absolute inset-0"
                  />
                </div>
              </div>

              <div className="md:col-span-7 text-center md:text-start px-2 flex flex-col justify-center">
                <div className="w-10 h-10 mb-3 rounded-full bg-parchment flex items-center justify-center text-gold-dark mx-auto md:mx-0">
                  <Heart className="w-5 h-5 fill-current" />
                </div>
                <h3 className={`text-2xl sm:text-3xl text-burgundy font-bold mb-3 ${lang === 'ar' ? 'font-amiri' : 'font-cormorant'}`}>
                  {t.story.title}
                </h3>
                <p className="text-sm sm:text-base text-ink/80 leading-relaxed">
                  {t.story.text}
                </p>
                <div className={`mt-4 italic text-sm text-gold-dark ${lang === 'ar' ? 'font-amiri text-base font-semibold' : 'font-cormorant text-lg'}`}>
                  {t.story.quote}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Guestbook & Blessings Section (Only Form - with Equal Height photo-5) */}
        <section id="guestbook-section" className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h3 className={`text-2xl sm:text-3xl text-burgundy font-bold ${lang === 'ar' ? 'font-amiri' : 'font-cormorant'}`}>
              {t.guestbook.title}
            </h3>
            <p className="text-xs sm:text-sm text-muted mt-1">
              {t.guestbook.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch mb-8">
            {/* Companion Photo: Sunset Walk (form.jpeg) */}
            <div className="md:col-span-5 flex flex-col">
              <div
                onClick={() => setActiveLightbox({ src: '/img/form.jpeg', caption: lang === 'ar' ? 'جولة الغروب وبداية رحلة العمر' : 'Golden Hour Walk into Forever' })}
                className="rounded-2xl overflow-hidden border border-gold/40 shadow-sm cursor-pointer group flex-1 h-full min-h-[340px] relative"
              >
                <img
                  src="/img/form.jpeg"
                  alt={lang === 'ar' ? 'جولة الغروب' : 'Golden Hour Walk into Forever'}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700 absolute inset-0"
                />
              </div>
            </div>

            {/* Blessings Form */}
            <div className="md:col-span-7 flex flex-col">
              <form onSubmit={handlePostWish} className="bg-white/95 rounded-2xl p-5 sm:p-6 border border-gold/40 shadow-md flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-ink mb-1" htmlFor="wisher-name">
                      {lang === 'ar' ? 'الاسم الكريم' : 'Your Full Name'}
                    </label>
                    <input
                      id="wisher-name"
                      type="text"
                      required
                      value={wisherName}
                      onChange={(e) => setWisherName(e.target.value)}
                      placeholder={t.guestbook.namePlaceholder}
                      className="w-full rounded-xl border border-gold/40 text-xs sm:text-sm py-2.5 px-3.5 bg-parchment/30 focus:border-burgundy focus:ring-1 focus:ring-burgundy"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-ink mb-1" htmlFor="wisher-msg">
                      {lang === 'ar' ? 'الرسالة أو التهنئة للعروسين' : 'Your Blessings & Message'}
                    </label>
                    <textarea
                      id="wisher-msg"
                      required
                      rows="3"
                      value={wisherMessage}
                      onChange={(e) => setWisherMessage(e.target.value)}
                      placeholder={t.guestbook.msgPlaceholder}
                      className="w-full rounded-xl border border-gold/40 text-xs sm:text-sm py-2.5 px-3.5 bg-parchment/30 focus:border-burgundy focus:ring-1 focus:ring-burgundy"
                    ></textarea>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className={`text-xs font-medium ${wishStatus.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
                    {wishStatus.text}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingWish}
                    className="w-full sm:w-auto px-6 py-2.5 bg-gold hover:bg-gold-dark text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingWish ? t.guestbook.postingBtn : t.guestbook.postBtn}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Wishes Stream Box (Shows last 5 with smooth scroll for more) */}
          <div className="bg-[#FFFDF9]/95 rounded-2xl border border-gold/40 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gold/25">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
                <h4 className={`text-xs sm:text-sm font-bold text-burgundy ${lang === 'ar' ? 'font-amiri text-base' : 'font-cormorant text-base'}`}>
                  {lang === 'ar' ? 'سجل التهاني والمباركات' : 'Guestbook Wishes'}
                </h4>
              </div>
              <span className="text-[11px] text-muted font-sans bg-parchment/60 px-2.5 py-0.5 rounded-full border border-gold/30">
                {wishes.length} {lang === 'ar' ? 'تهنئة' : 'Wishes'}
              </span>
            </div>

            {fetchError ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center my-2">
                {fetchError}
              </div>
            ) : wishes.length === 0 ? (
              <div className="p-6 text-center text-xs sm:text-sm text-muted">
                {lang === 'ar' ? 'لا توجد تهاني مسجلة حتى الآن. كن أول من يبارك للعروسين!' : 'No wishes recorded yet. Be the first to congratulate the couple!'}
              </div>
            ) : (
              <div className="max-h-[460px] overflow-y-auto space-y-3 pr-1 sm:pr-2 luxury-scrollbar">
              {wishes.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-white rounded-xl p-3.5 sm:p-4 border border-gold/25 shadow-xs flex items-start gap-3 hover:border-gold/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-parchment border border-gold/30 text-burgundy shrink-0 flex items-center justify-center font-bold text-xs shadow-xs">
                    {(item.name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                      <h5 className="text-xs font-bold text-burgundy truncate">{item.name}</h5>
                      <span className="text-[10px] text-muted font-sans shrink-0">
                        {formatTimeAgo(item.created_at, lang)}
                      </span>
                    </div>
                    <p className="text-xs text-ink/90 mt-1 leading-relaxed break-words">
                      {item.message}
                    </p>
                  </div>
                </div>
              ))}
              </div>
            )}

            {wishes.length > 5 && (
              <div className="pt-2.5 mt-2 border-t border-gold/20 text-center">
                <p className="text-[11px] text-muted flex items-center justify-center gap-1.5">
                  <span className="text-gold">↓</span>
                  <span>{lang === 'ar' ? 'مرر للأسفل لرؤية باقي التهاني والمباركات' : 'Scroll down to read all wishes'}</span>
                  <span className="text-gold">↓</span>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Discreet Registry & Gift Note */}
        <section className="max-w-xl mx-auto px-4 py-8 text-center">
          <div className="p-6 rounded-2xl bg-white/70 border border-gold/30">
            <h4 className="font-amiri text-lg font-bold text-burgundy mb-2">
                {t.registry.title}
              </h4>
            <p className="text-xs sm:text-sm text-ink/80 leading-relaxed">
                {t.registry.quote}
              </p>
          </div>
        </section>

        {/* Lightbox Modal */}
        {activeLightbox && (
          <div
            onClick={() => setActiveLightbox(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 transition-all"
          >
            <button
              onClick={() => setActiveLightbox(null)}
              aria-label="Close Lightbox"
              className="absolute top-5 right-5 text-white/80 hover:text-white text-2xl font-bold bg-white/10 w-10 h-10 rounded-full flex items-center justify-center"
            >
              <X className="w-6 h-6" />
            </button>
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-w-3xl max-h-[85vh] flex flex-col items-center"
            >
              <img
                src={activeLightbox.src}
                alt={activeLightbox.caption}
                className="max-h-[75vh] w-auto max-w-full rounded-lg shadow-2xl object-contain"
              />
              <p className="text-white/90 text-center font-amiri mt-3 text-base">
                {activeLightbox.caption}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-12 px-4 border-t border-gold/30 bg-parchment/50 mt-12">
          <div className="font-amiri text-2xl text-gold-dark font-bold mb-1">
            {t.footer.monogram}
          </div>
          <p className="font-amiri text-base text-burgundy">
            {t.footer.tagline}
          </p>
          <div className="text-[11px] text-muted font-sans mt-3">
            {t.footer.dateVenue}
          </div>
          <div className="mt-6 text-[10px] text-muted/60">
            {t.footer.copyright}
          </div>
        </footer>
      </main>
    </div>
  );
}
