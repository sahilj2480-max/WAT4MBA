import React, { useState, useEffect, useRef } from 'react';
import { AppState, Topic, WATFeedback, UserStats, Flashcard } from './types';
import { WAT_TOPICS } from './constants/topics';
import { FLASHCARDS } from './constants/flashcards';
import { evaluateWAT } from './services/evaluator';

const WRITING_QUOTES = [
  { text: "Writing is thinking on paper.", author: "William Zinsser" },
  { text: "Easy reading is damn hard writing.", author: "Nathaniel Hawthorne" },
  { text: "The scariest moment is always just before you start.", author: "Stephen King" },
  { text: "Writing is an exploration. You start from nothing and learn as you go.", author: "E.L. Doctorow" },
  { text: "Clear thinking becomes clear writing; one can't exist without the other.", author: "William Lutz" }
];

const INITIAL_STATS: UserStats = {
  points: 0,
  totalWords: 0,
  completedTests: 0,
  highestScore: 0,
  badges: []
};

const SymmetricalArrow = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const Logo = ({ onClick }: { onClick: () => void }) => (
  <div 
    className="relative flex items-center cursor-pointer group px-4 py-1.5 border-2 border-slate-900/10 dark:border-white/20 rounded-xl bg-white dark:bg-slate-950 transition-all duration-300 hover:shadow-[4px_4px_0px_0px_rgba(79,70,229,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(129,140,248,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none" 
    onClick={onClick}
  >
    <div className="flex items-baseline font-black tracking-tighter">
      <span className="text-2xl md:text-3xl text-slate-900 dark:text-white font-sans">WAT</span>
      <span className="text-4xl md:text-5xl text-indigo-600 dark:text-indigo-400 mx-0.5 transform group-hover:scale-110 transition-transform italic font-sans">4</span>
      <span className="text-2xl md:text-3xl text-slate-900 dark:text-white font-sans">MBA</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.WELCOME);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [timerDuration, setTimerDuration] = useState<number>(15 * 60);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [content, setContent] = useState<string>('');
  const [feedback, setFeedback] = useState<WATFeedback | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(WRITING_QUOTES[0]);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('wat_dark_mode') === 'true';
  });

  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeFlashCategory, setActiveFlashCategory] = useState<string>('All');
  const [savedCardIds, setSavedCardIds] = useState<Set<string>>(new Set());
  
  const lastActivityTimeRef = useRef<number>(0);
  const activeWritingTimeRef = useRef<number>(0);
  const hasStartedTypingRef = useRef<boolean>(false);

  const [userStats, setUserStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('wat_cracker_stats');
    return saved ? JSON.parse(saved) : INITIAL_STATS;
  });

  useEffect(() => {
    localStorage.setItem('wat_cracker_stats', JSON.stringify(userStats));
  }, [userStats]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('wat_dark_mode', isDarkMode.toString());
  }, [isDarkMode]);

  useEffect(() => {
    if (state === AppState.PREPARING) {
      const timer = setTimeout(() => {
        setState(AppState.FLIPPER);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const [isSpinning, setIsSpinning] = useState(false);
  const [flipperIndex, setFlipperIndex] = useState(0);

  const startSpin = () => {
    setIsSpinning(true);
    let speed = 50;
    const spinInterval = setInterval(() => {
      setFlipperIndex(prev => (prev + 1) % WAT_TOPICS.length);
    }, speed);

    setTimeout(() => {
      clearInterval(spinInterval);
      const randomIndex = Math.floor(Math.random() * WAT_TOPICS.length);
      setFlipperIndex(randomIndex);
      setSelectedTopic(WAT_TOPICS[randomIndex]);
      setIsSpinning(false);
    }, 1800);
  };

  const handleChooseTopic = () => {
    if (!selectedTopic) return;
    setState(AppState.WRITING);
    setTimeLeft(timerDuration);
    setIsTimerRunning(true);
    hasStartedTypingRef.current = false;
    activeWritingTimeRef.current = 0;
    lastActivityTimeRef.current = Date.now();
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const time = Date.now();
    const newContent = e.target.value;
    
    if (!hasStartedTypingRef.current && newContent.length > 0) {
      hasStartedTypingRef.current = true;
      lastActivityTimeRef.current = time;
    } else if (hasStartedTypingRef.current) {
      const diff = (time - lastActivityTimeRef.current) / 1000;
      if (diff < 20) {
        activeWritingTimeRef.current += diff;
      }
      lastActivityTimeRef.current = time;
    }
    
    setContent(newContent);
  };

  useEffect(() => {
    let interval: any;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      handleSubmit();
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const handleSubmit = () => {
    setIsTimerRunning(false);
    setIsAnalyzing(true);
    setCurrentQuote(WRITING_QUOTES[Math.floor(Math.random() * WRITING_QUOTES.length)]);
    const totalActiveSeconds = activeWritingTimeRef.current;
    const result = evaluateWAT(content, selectedTopic?.title || "", totalActiveSeconds);
    setFeedback(result);
    setTimeout(() => {
      setIsAnalyzing(false);
      setState(AppState.REPORT);
      updateStats(result);
    }, 2500);
  };

  const updateStats = (result: WATFeedback) => {
    setUserStats(prev => ({
      ...prev,
      totalWords: prev.totalWords + result.wordCount,
      completedTests: prev.completedTests + 1,
      highestScore: Math.max(prev.highestScore, result.score),
    }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredFlashBriefs = FLASHCARDS.filter(card => {
    const matchesCategory = activeFlashCategory === 'All' || card.category === activeFlashCategory;
    return matchesCategory;
  });

  const toggleSaveCard = (id: string) => {
    const newSaved = new Set(savedCardIds);
    if (newSaved.has(id)) newSaved.delete(id);
    else newSaved.add(id);
    setSavedCardIds(newSaved);
  };

  const renderProgressBar = () => {
    if (state === AppState.WELCOME || state === AppState.PREPARING || state === AppState.ABOUT || state === AppState.FLASHBRIEFS || isAnalyzing) return null;
    const steps = [
      { id: AppState.FLIPPER, label: 'Topic Selection', icon: '🎯' },
      { id: AppState.WRITING, label: 'Active Writing', icon: '✍️' },
      { id: AppState.REPORT, label: 'Performance Analysis', icon: '📊' }
    ];
    const currentIndex = steps.findIndex(s => s.id === state);
    return (
      <div className="w-full px-6 mt-2 mb-2">
        <div className="bg-white dark:bg-slate-900 p-1.5 rounded-[20px] border border-slate-300 dark:border-slate-700 shadow-lg flex items-center justify-between gap-2 overflow-hidden">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isActive = index === currentIndex;
            return (
              <React.Fragment key={step.id}>
                <div className={`relative flex-1 flex items-center gap-3 px-4 py-2 rounded-[16px] transition-all duration-500
                  ${isActive ? 'bg-indigo-600 shadow-md' : 
                    isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-transparent'}
                `}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all duration-500
                    ${isActive ? 'bg-white shadow-sm' : 
                      isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}
                  `}>
                    {isCompleted ? '✓' : step.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[9px] font-black uppercase tracking-wider transition-colors
                      ${isActive ? 'text-indigo-100' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}
                    `}>
                      0{index + 1}
                    </span>
                    <span className={`text-[12px] font-bold tracking-tight transition-colors whitespace-nowrap
                      ${isActive ? 'text-white' : isCompleted ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}
                    `}>
                      {step.label}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWelcome = () => (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] text-center p-6 animate-in fade-in slide-in-from-bottom-6 duration-1000 overflow-hidden">
      <div className="mb-2 group cursor-default max-w-5xl z-10 pointer-events-none">
        <div className="relative mb-6 md:mb-8 inline-block transform group-hover:scale-105 transition-transform duration-500 pointer-events-auto">
           <div className="text-8xl md:text-9xl animate-logo-float drop-shadow-[0_25px_35px_rgba(79,70,229,0.3)] select-none">
              🖋️
           </div>
        </div>

        <h1 className="text-4xl md:text-7xl font-display text-slate-900 dark:text-white mb-6 md:mb-8 leading-[1.1] tracking-tighter pointer-events-auto">
          Shortlisted? <br className="hidden md:block" /> 
          <span className="block mt-4 md:mt-6 text-indigo-600 dark:text-indigo-400 text-2xl md:text-5xl font-sans font-black tracking-tight leading-tight">
            Your thinking is evaluated before you speak.
          </span>
        </h1>
        
        <div className="mb-10 md:mb-12 pointer-events-auto">
          <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-300">
            Timed WATs. Relevant topics. Actionable feedback.
          </p>
        </div>
      </div>

      <button 
        onClick={() => setState(AppState.PREPARING)} 
        className="group relative px-12 py-6 md:px-16 md:py-8 bg-slate-950 dark:bg-white dark:text-slate-950 text-white rounded-2xl font-black text-xl md:text-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 flex items-center gap-6 mb-4 z-10 overflow-hidden"
      >
        <div className="absolute inset-0 rounded-[inherit] border-[1.5px] border-cyan-400 dark:border-indigo-600 animate-minimal-shine pointer-events-none" />
        <span className="relative z-10 tracking-widest uppercase">Start Practice</span>
        <div className="relative z-10 w-8 h-8 bg-white/10 dark:bg-slate-950/10 rounded-full flex items-center justify-center group-hover:translate-x-3 transition-transform duration-500">
          <SymmetricalArrow className="w-4 h-4" />
        </div>
      </button>
    </div>
  );

  const renderFlashBriefs = () => {
    const currentCard = filteredFlashBriefs[flashcardIndex];
    const total = filteredFlashBriefs.length;

    return (
      <div className="w-full px-6 py-1 animate-in fade-in slide-in-from-bottom-4 duration-700 relative overflow-hidden h-[calc(100vh-80px)]">
        <button 
          onClick={() => setState(AppState.WELCOME)}
          className="absolute left-6 top-1 md:top-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-dark-card border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm group z-20"
        >
          <div className="rotate-180 group-hover:-translate-x-1 transition-transform">
            <SymmetricalArrow className="w-3 h-3" />
          </div>
          <span>Home</span>
        </button>

        <div className="flex flex-col items-center text-center mb-2 pt-8 md:pt-2">
          <p className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-[10px] mb-0.5">MBA Preparation</p>
          <h1 className="text-xl md:text-2xl font-display text-slate-900 dark:text-white tracking-tight">FlashBriefs</h1>
        </div>

        <div className="flex justify-center flex-wrap gap-1.5 mb-3 no-scrollbar max-w-4xl mx-auto">
          {['All', 'Economy', 'Tech', 'Public Policy', 'Society'].map(catLabel => {
             const actualCat = catLabel === 'Economy' ? 'Economy & Business' : 
                               catLabel === 'Tech' ? 'Technology & AI' : 
                               catLabel === 'Public Policy' ? 'Public Policy & Governance' : 
                               catLabel === 'Society' ? 'Society, Ethics & Global Affairs' : 'All';
             return (
              <button
                key={catLabel}
                onClick={() => { setActiveFlashCategory(actualCat); setFlashcardIndex(0); setIsFlipped(false); }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border whitespace-nowrap ${activeFlashCategory === actualCat ? 'bg-indigo-600 text-white border-transparent shadow-sm' : 'bg-white dark:bg-dark-card text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                {catLabel}
              </button>
             );
          })}
        </div>

        {total > 0 ? (
          <div className="flex flex-col items-center">
            <div className={`w-full max-w-2xl h-[320px] md:h-[360px] relative card-perspective group ${isFlipped ? 'is-flipped' : ''}`}>
              <div 
                onClick={() => setIsFlipped(!isFlipped)}
                className={`relative w-full h-full transform-style-3d cursor-pointer flip-transition rounded-[32px] ${isFlipped ? 'rotate-y-180 shadow-[0_30px_60px_-15px_rgba(79,70,229,0.4)]' : 'shadow-2xl'}`}
              >
                <div className="card-shimmer" />
                
                {/* FRONT */}
                <div className="absolute inset-0 backface-hidden bg-white dark:bg-dark-card border-[3px] border-slate-900 dark:border-indigo-400 rounded-[32px] p-6 md:p-8 flex flex-col items-center justify-center text-center overflow-hidden transition-colors">
                  <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/10 dark:bg-indigo-500/20" />
                  <div className="mb-3 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-200 text-[10px] font-bold uppercase tracking-widest border border-indigo-100 dark:border-indigo-500/30">
                    {currentCard.category}
                  </div>
                  <h3 className="text-lg md:text-2xl font-display text-slate-900 dark:text-white leading-tight tracking-tight px-4">
                    {currentCard.question}
                  </h3>
                  <div className="mt-6 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest animate-pulse">
                    Tap to Flip
                  </div>
                </div>

                {/* BACK */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-950 dark:bg-slate-950 border-[3px] border-slate-900 dark:border-indigo-400 rounded-[32px] p-6 md:p-8 flex flex-col overflow-hidden transition-colors">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500/40" />
                  
                  <div className="flex-1 flex flex-col justify-center space-y-3 md:space-y-4">
                    <div className="space-y-0.5">
                      <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest opacity-80">What it means</div>
                      <p className="text-sm md:text-base text-white font-medium leading-tight tracking-tight line-clamp-2">
                        {currentCard.what}
                      </p>
                    </div>
                    
                    <div className="space-y-0.5">
                      <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest opacity-80">Why it matters</div>
                      <p className="text-xs md:text-sm text-slate-300 font-medium leading-tight line-clamp-2">
                        {currentCard.why}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-[9px] font-bold text-amber-400 uppercase tracking-widest opacity-80">How it can be asked</div>
                      <p className="text-xs md:text-sm text-indigo-100 italic font-semibold leading-tight border-l-2 border-indigo-500/40 pl-3 line-clamp-2">
                        {currentCard.askedAs}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[9px] font-bold text-white/40 uppercase tracking-widest border-t border-white/5 pt-3 shrink-0">
                    <div className="flex gap-4">
                      {currentCard.tag && <span className="text-indigo-400/80">{currentCard.tag}</span>}
                    </div>
                    <div className="text-indigo-400/80 flex items-center gap-1">
                      <span className="text-lg">↺</span> BACK
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 md:mt-6 flex items-center gap-6">
              <button 
                disabled={flashcardIndex === 0}
                onClick={() => { setFlashcardIndex(prev => prev - 1); setIsFlipped(false); }}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-20 rotate-180"
              >
                <SymmetricalArrow className="w-4 h-4" />
              </button>

              <div className="px-5 py-1.5 md:px-6 md:py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-indigo-500/20 rounded-[16px] shadow-sm text-center min-w-[100px] md:min-w-[120px]">
                <div className="text-xl md:text-2xl font-display text-slate-900 dark:text-white tracking-tighter flex items-center justify-center">
                  {flashcardIndex + 1} 
                  <span className="mx-1.5 text-slate-900 dark:text-white opacity-40">/</span> 
                  {total}
                </div>
                <div className="text-[9px] font-bold text-slate-400 dark:text-indigo-400/80 uppercase tracking-widest">BRIEFS</div>
              </div>

              <button 
                disabled={flashcardIndex === total - 1}
                onClick={() => { setFlashcardIndex(prev => prev + 1); setIsFlipped(false); }}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-950 dark:bg-white dark:text-slate-950 flex items-center justify-center text-white dark:text-slate-950 shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-20"
              >
                <SymmetricalArrow className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-50 dark:bg-dark-card rounded-[24px] border-2 border-dashed border-slate-200 dark:border-white/5 mx-auto max-w-2xl">
            <h3 className="text-lg font-display text-slate-400 dark:text-slate-500">No briefs in this category yet.</h3>
          </div>
        )}
      </div>
    );
  };

  const renderPreparing = () => (
    <div className="fixed inset-0 bg-white dark:bg-dark-bg z-[150] flex flex-col items-center justify-center p-12 animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-8 max-w-md w-full">
        <div className="relative">
          <div className="w-24 h-24 border-2 border-slate-100 dark:border-slate-800 rounded-full" />
          <div className="absolute inset-0 w-24 h-24 border-2 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Syncing Arena…</h2>
          <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Optimizing environment</p>
        </div>
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="w-full px-6 py-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 relative">
      <button 
        onClick={() => setState(AppState.WELCOME)}
        className="absolute left-6 top-4 md:top-8 flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-[12px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm group z-20"
      >
        <div className="rotate-180 group-hover:-translate-x-1 transition-transform">
          <SymmetricalArrow className="w-4 h-4" />
        </div>
        <span>Back to Home</span>
      </button>

      <div className="bg-white dark:bg-slate-900 p-10 md:p-16 rounded-[40px] shadow-3xl border border-slate-300 dark:border-slate-700 relative overflow-hidden mt-28 md:mt-32 max-w-4xl mx-auto">
        <h2 className="text-4xl font-display text-slate-900 dark:text-white mb-8 tracking-tighter">Mission: Precision Practice</h2>
        <div className="space-y-6">
          <p className="text-xl text-slate-700 dark:text-slate-300 leading-relaxed font-medium tracking-tight">
            Hello, I’m Sahil an MBA aspirant just like you. I built <span className="text-indigo-600 dark:text-indigo-400 font-bold">WAT4MBA</span> to simplify Written Ability Test preparation.
          </p>
          <p className="text-xl text-slate-700 dark:text-slate-300 leading-relaxed font-medium tracking-tight">
            WAT is often the gatekeeper for final conversion. This tool provides a focused, timed environment with immediate, structured feedback to help you iterate faster.
          </p>
        </div>
      </div>
    </div>
  );

  const renderAnalyzing = () => (
    <div className="fixed inset-0 bg-white dark:bg-dark-bg z-[100] flex flex-col items-center justify-center p-12 animate-in fade-in duration-500">
      <div className="max-w-2xl w-full text-center">
        <div className="w-12 h-12 border-2 border-indigo-100 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-12" />
        <h2 className="text-[11px] font-bold text-indigo-400 dark:text-indigo-300 uppercase tracking-widest mb-10">Linguistic Analysis...</h2>
        <div className="bg-slate-50 dark:bg-dark-card p-10 rounded-[32px] border border-slate-200 dark:border-dark-border shadow-lg">
          <p className="text-2xl font-display text-slate-800 dark:text-slate-100 italic leading-snug mb-4">"{currentQuote.text}"</p>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">— {currentQuote.author}</p>
        </div>
      </div>
    </div>
  );

  const renderWritingArena = () => {
    const isCritical = timeLeft < 60;
    const wordCount = content.split(/\s+/).filter(x => x).length;
    return (
      <div className="w-full px-6 flex flex-col items-center h-[calc(100vh-180px)] relative">
        <div className="w-full bg-slate-900 rounded-xl shadow-lg px-6 py-3 mb-4 flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-800 shrink-0 z-20">
          <div className="flex-1 min-w-0 w-full text-center md:text-left">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest opacity-80">{selectedTopic?.category}</span>
            <h1 className="text-xl font-bold text-white tracking-tight line-clamp-1">{selectedTopic?.title}</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-800 rounded-lg py-2 px-5 min-w-[80px] text-center border border-slate-700/50">
               <div className={`text-xl font-black tabular-nums ${isCritical ? 'text-rose-500 animate-pulse' : 'text-white'}`}>{formatTime(timeLeft)}</div>
               <span className="text-[9px] font-bold uppercase text-slate-400 block">TIME</span>
            </div>
            <div className="bg-slate-800 rounded-lg py-2 px-5 min-w-[80px] text-center border border-slate-700/50">
               <div className="text-xl font-black text-white">{wordCount}</div>
               <span className="text-[9px] font-bold uppercase text-slate-400 block">WORDS</span>
            </div>
          </div>
        </div>
        <div className="relative w-full flex-1 p-1 bg-slate-900 rounded-[28px] shadow-2xl flex flex-col min-h-0 z-10">
          <textarea
            value={content}
            onChange={handleContentChange}
            placeholder="Construct your response here..."
            className="w-full h-full p-8 md:p-12 bg-white dark:bg-slate-800 rounded-[24px] focus:outline-none text-xl leading-relaxed text-slate-700 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-sans font-medium border-none shadow-inner resize-none overflow-y-auto"
            autoFocus
          />
        </div>
        <div className="w-full mt-4 flex gap-4 shrink-0 pb-6">
          <button onClick={() => setIsPreviewOpen(true)} className="flex-1 px-6 py-5 bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-400 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all active:scale-95">Preview Draft</button>
          <button onClick={handleSubmit} className="flex-1 px-6 py-5 bg-indigo-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-black dark:hover:bg-indigo-700 transition-all shadow-lg active:scale-95">Submit for Review</button>
        </div>
      </div>
    );
  };

  const renderReport = () => {
    if (!feedback || !selectedTopic) return null;
    return (
      <div className="w-full p-6 pb-32 animate-in fade-in slide-in-from-bottom-10 duration-1000">
        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-10">
          <div className="text-center md:text-left">
            <h1 className="text-6xl font-display text-slate-900 dark:text-white tracking-tighter mb-2">Performance</h1>
            <p className="text-indigo-600 dark:text-indigo-400 font-bold text-2xl tracking-tight">{selectedTopic?.title}</p>
          </div>
          <button onClick={() => { setState(AppState.WELCOME); setContent(''); setSelectedTopic(null); }} className="px-12 py-6 bg-slate-950 dark:bg-indigo-600 text-white rounded-[24px] font-black text-xl hover:scale-105 transition-all shadow-xl flex items-center gap-4">Start Over <SymmetricalArrow className="w-6 h-6" /></button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-300 dark:border-slate-700 flex flex-col items-center text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Final Score</span>
            <div className="text-6xl font-black text-indigo-600 dark:text-indigo-400 mb-2">{feedback.score}</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">Grade {feedback.grade}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-300 dark:border-slate-700 flex flex-col items-center text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Linguistic Velocity</span>
            <div className="text-6xl font-black text-indigo-600 dark:text-indigo-400 mb-2">{feedback.wpm}</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">Words/Minute</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-300 dark:border-slate-700 flex flex-col items-center text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Word Count</span>
            <div className="text-6xl font-black text-indigo-600 dark:text-indigo-400 mb-2">{feedback.wordCount}</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">Total Lexicon</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-10 rounded-[32px] border border-emerald-300 dark:border-emerald-900/30">
            <h3 className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-8">Structural Strengths</h3>
            <ul className="space-y-6">
              {feedback.positives.map((p, i) => (
                <li key={i} className="flex gap-4 text-lg font-bold text-slate-700 dark:text-slate-300 leading-snug">
                  <span className="text-emerald-500 mt-1">✓</span> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-rose-50/50 dark:bg-rose-950/10 p-10 rounded-[32px] border border-rose-300 dark:border-rose-900/30">
            <h3 className="text-[11px] font-bold text-rose-600 uppercase tracking-widest mb-8">Constructive Critique</h3>
            <ul className="space-y-6">
              {feedback.negatives.map((p, i) => (
                <li key={i} className="flex gap-4 text-lg font-bold text-slate-700 dark:text-slate-300 leading-snug">
                  <span className="text-rose-500 mt-1">!</span> {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-slate-950 text-white p-12 rounded-[40px] shadow-2xl relative overflow-hidden border border-white/20">
          <h3 className="text-3xl font-display mb-10 relative z-10">Strategic Action Plan</h3>
          <ul className="space-y-8 relative z-10">
            {feedback.recommendations.map((item, idx) => (
              <li key={idx} className="flex items-start gap-6 group">
                <span className="text-indigo-400 font-bold text-2xl shrink-0 mt-0.5">→</span>
                <span className="text-slate-200 text-xl leading-relaxed font-bold">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const renderFlipperScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 animate-in zoom-in-95 duration-700 pb-20">
      <div className="bg-white dark:bg-dark-card p-10 md:p-16 rounded-[40px] shadow-2xl max-w-4xl w-full text-center border border-slate-300 dark:border-slate-700">
        <div className="relative mb-12 h-64 flex items-center justify-center">
          <div className={`relative w-full bg-slate-900 rounded-[28px] p-10 h-full flex flex-col items-center justify-center shadow-xl border-4 border-slate-800 transition-all duration-300 ${isSpinning ? 'opacity-40 blur-sm scale-95' : 'opacity-100 blur-0 scale-100'}`}>
            {!isSpinning && selectedTopic && (
              <span className={`absolute top-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white ${selectedTopic.difficulty === 'Hard' ? 'bg-rose-600' : selectedTopic.difficulty === 'Medium' ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                {selectedTopic.difficulty} LEVEL
              </span>
            )}
            <p className="text-2xl md:text-3xl font-display text-white px-8 text-center leading-snug">
              {WAT_TOPICS[flipperIndex].title}
            </p>
          </div>
        </div>
        
        {!selectedTopic || isSpinning ? (
          <button onClick={startSpin} disabled={isSpinning} className="w-full px-12 py-7 bg-indigo-600 text-white rounded-2xl font-black text-xl hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50 font-sans">
            {isSpinning ? 'Selecting Topic...' : 'Choose Random Topic'}
          </button>
        ) : (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <div className="flex justify-center gap-4">
              {[15, 30].map(m => (
                <button key={m} onClick={() => setTimerDuration(m * 60)} className={`flex-1 py-4 rounded-xl text-lg font-bold transition-all border-2 ${timerDuration === m * 60 ? 'bg-indigo-600 text-white border-transparent scale-105' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'} font-sans`}>{m} Mins</button>
              ))}
            </div>
            <button onClick={handleChooseTopic} className="w-full px-12 py-6 bg-indigo-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-2xl font-sans">Enter Writing Arena</button>
          </div>
        )}
      </div>
    </div>
  );

  const navItemClass = "h-10 md:h-12 flex items-center justify-center rounded-full font-bold text-[12px] md:text-[13px] transition-all duration-300 border-2 border-slate-900/10 dark:border-white/20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md hover:shadow-[3px_3px_0px_0px_rgba(79,70,229,1)] dark:hover:shadow-[3px_3px_0px_0px_rgba(129,140,248,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none";

  return (
    <div className="min-h-screen pb-4 bg-[#fcfdff] dark:bg-dark-bg transition-colors duration-500 font-sans">
      <nav className="w-full bg-white/70 dark:bg-dark-bg/70 backdrop-blur-3xl sticky top-0 z-50 border-b-2 border-slate-400 dark:border-slate-600">
        <div className="w-full px-6 h-16 md:h-20 flex justify-between items-center">
          <div className="flex justify-start">
            <Logo onClick={() => setState(AppState.WELCOME)} />
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setState(AppState.FLASHBRIEFS)}
              className={`${navItemClass} px-5 md:px-6 gap-2 animate-tilt-briefs ${state === AppState.FLASHBRIEFS ? 'ring-2 ring-indigo-500/30' : ''}`}
            >
              <span>🎴</span> <span className="text-slate-900 dark:text-white">FlashBriefs</span>
            </button>

            <button 
              onClick={() => setState(AppState.ABOUT)}
              className={`${navItemClass} px-5 md:px-7 ${state === AppState.ABOUT ? 'ring-2 ring-indigo-500/30' : ''}`}
            >
              <span className="text-slate-900 dark:text-white">About</span>
            </button>

            <div className={`${navItemClass} p-1 gap-1`}>
              <button 
                onClick={() => setIsDarkMode(false)}
                className={`h-full px-4 md:px-6 flex items-center justify-center rounded-full text-[10px] md:text-[11px] font-bold tracking-tight transition-all ${!isDarkMode ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
              >
                Light
              </button>
              <button 
                onClick={() => setIsDarkMode(true)}
                className={`h-full px-4 md:px-6 flex items-center justify-center rounded-full text-[10px] md:text-[11px] font-bold tracking-tight transition-all ${isDarkMode ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Dark
              </button>
            </div>
          </div>
        </div>
      </nav>

      {renderProgressBar()}

      <main className="mt-2">
        {isAnalyzing && renderAnalyzing()}
        {!isAnalyzing && state === AppState.WELCOME && renderWelcome()}
        {!isAnalyzing && state === AppState.PREPARING && renderPreparing()}
        {!isAnalyzing && state === AppState.FLIPPER && renderFlipperScreen()}
        {!isAnalyzing && state === AppState.WRITING && renderWritingArena()}
        {!isAnalyzing && state === AppState.REPORT && renderReport()}
        {!isAnalyzing && state === AppState.ABOUT && renderAbout()}
        {!isAnalyzing && state === AppState.FLASHBRIEFS && renderFlashBriefs()}
      </main>
    </div>
  );
};

export default App;