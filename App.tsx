
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Topic, WATFeedback, UserStats, Badge } from './types';
import { WAT_TOPICS } from './constants/topics';
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
  
  // WPM Tracking Refs
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
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('wat_dark_mode', isDarkMode.toString());
  }, [isDarkMode]);

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
    lastActivityTimeRef.current = 0;
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const now = Date.now();
    const newContent = e.target.value;
    
    if (!hasStartedTypingRef.current && newContent.length > 0) {
      hasStartedTypingRef.current = true;
      lastActivityTimeRef.current = now;
    } else if (hasStartedTypingRef.current) {
      const diff = (now - lastActivityTimeRef.current) / 1000;
      if (diff < 20) {
        activeWritingTimeRef.current += diff;
      }
      lastActivityTimeRef.current = now;
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

  const getWPMInterpretation = (wpm: number) => {
    if (wpm === 0) return "Insufficient data collected.";
    if (wpm < 20) return "A moderate typing speed indicates that planning before execution may improve overall output quality.";
    if (wpm < 35) return "Your average typing speed for this attempt was comfortable, allowing more focus on clarity and coherence.";
    return "High execution efficiency suggests you have ample time to review and polish your draft.";
  };

  const renderProgressBar = () => {
    if (state === AppState.WELCOME || state === AppState.ABOUT || isAnalyzing) return null;
    
    const steps = [
      { id: AppState.FLIPPER, label: 'Selection' },
      { id: AppState.WRITING, label: 'Execution' },
      { id: AppState.REPORT, label: 'Analysis' }
    ];
    
    const currentIndex = steps.findIndex(s => s.id === state);

    return (
      <div className="max-w-6xl mx-auto px-6 mt-1 mb-1">
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-indigo-900/30 p-2 md:p-3 rounded-lg shadow-sm relative overflow-hidden flex items-center justify-between">
          <div className="flex gap-4 md:gap-10 w-full">
            {steps.map((step, index) => {
              const isCompleted = index < currentIndex;
              const isActive = index === currentIndex;
              
              return (
                <div key={step.id} className="flex-1">
                  <div className={`h-1 rounded-full transition-all duration-700 ease-out mb-1
                    ${isCompleted ? 'bg-emerald-500' : 
                      isActive ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-200 dark:bg-slate-800'}
                  `} />
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] md:text-[11px] font-black uppercase transition-colors tracking-widest
                      ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}
                    `}>
                      PHASE 0{index + 1}
                    </span>
                    <span className={`text-[11px] md:text-[12px] font-extrabold tracking-tight transition-all
                      ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-600'}
                    `}>
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderWelcome = () => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="mb-10 group cursor-default">
        <div className="text-9xl mb-10 transform group-hover:rotate-12 group-hover:scale-110 transition-transform duration-500 drop-shadow-2xl">🏏</div>
        <h1 className="text-6xl md:text-8xl font-display text-slate-900 dark:text-white mb-8 max-w-5xl leading-tight tracking-tighter">
          First part of the exam <br/> is done. <span className="text-indigo-600 dark:text-indigo-400">Now crack this.</span>
        </h1>
        <p className="text-2xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto mb-14 leading-relaxed font-medium tracking-tight">
          Written Ability Test (WAT) is where critical thinking meets structure. <br className="hidden md:block" /> Practice with high-intensity topics and get instant professional audits.
        </p>
      </div>
      <button onClick={() => setState(AppState.FLIPPER)} className="group relative px-20 py-8 bg-indigo-900 dark:bg-indigo-600 text-white rounded-[40px] font-extrabold text-3xl hover:bg-black dark:hover:bg-indigo-700 transition-all shadow-xl transform hover:-translate-y-2 active:translate-y-0 active:scale-95">
        <span className="relative z-10 flex items-center gap-6">CRACK THE WAT <span className="text-4xl group-hover:translate-x-3 transition-transform">→</span></span>
      </button>
    </div>
  );

  const renderAbout = () => (
    <div className="max-w-4xl mx-auto px-6 py-20 animate-in fade-in slide-in-from-bottom-10 duration-1000">
      <div className="bg-white dark:bg-slate-900 p-12 md:p-20 rounded-[60px] shadow-3xl border-4 border-slate-50 dark:border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 text-8xl font-black pointer-events-none">ABOUT</div>
        <h2 className="text-5xl font-display text-slate-900 dark:text-white mb-10 tracking-tighter">Mission: Practice with Precision</h2>
        <div className="space-y-8">
          <p className="text-2xl text-slate-700 dark:text-slate-300 leading-relaxed font-medium tracking-tight">
            Hello, I’m Sahil an MBA aspirant just like you. I built <span className="text-indigo-600 dark:text-indigo-400 font-black">wat4mba</span> to help prepare for one of the most important stages of the Indian MBA selection process: the Written Ability Test.
          </p>
          <p className="text-2xl text-slate-700 dark:text-slate-300 leading-relaxed font-medium tracking-tight">
            After CAT, WAT plays a critical role in shortlisting and final conversion, yet focused practice platforms are rare. <span className="text-indigo-600 dark:text-indigo-400 font-black">wat4mba</span> bridges this gap with timed practice on high-frequency, MBA-relevant topics.
          </p>
        </div>
        <button 
          onClick={() => setState(AppState.WELCOME)} 
          className="mt-14 px-12 py-6 bg-indigo-900 dark:bg-indigo-600 text-white rounded-3xl font-black text-xl hover:bg-black dark:hover:bg-indigo-700 transition-all shadow-xl transform hover:-translate-y-1"
        >
          BACK TO HOME
        </button>
      </div>
    </div>
  );

  const renderAnalyzing = () => (
    <div className="fixed inset-0 bg-white dark:bg-dark-bg z-[100] flex flex-col items-center justify-center p-12 animate-in fade-in duration-500">
      <div className="max-w-3xl w-full text-center">
        <div className="w-20 h-20 border-4 border-indigo-100 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-16" />
        <h2 className="text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-[0.5em] mb-12">Analyzing Linguistic Patterns...</h2>
        <div className="bg-slate-50 dark:bg-dark-card p-12 md:p-16 rounded-[48px] border-2 border-slate-100 dark:border-dark-border relative">
          <p className="text-2xl md:text-3xl font-display text-slate-800 dark:text-slate-100 leading-relaxed italic mb-6">"{currentQuote.text}"</p>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">— {currentQuote.author}</p>
        </div>
      </div>
    </div>
  );

  const renderWritingArena = () => {
    const isCritical = timeLeft < 60;
    const wordCount = content.split(/\s+/).filter(x => x).length;

    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col items-center h-[calc(100vh-145px)] relative">
        <div className="w-full bg-[#0f172a] dark:bg-slate-900 rounded-xl shadow-lg px-4 py-2 mb-2 flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-800 dark:border-indigo-900/40 shrink-0 z-20">
          <div className="flex-1 min-w-0 w-full text-center md:text-left">
            <div className="mb-0.5"><span className="text-[9px] font-black text-indigo-400 dark:text-indigo-400 uppercase tracking-[0.2em] opacity-80">{selectedTopic?.category || 'GOVERNANCE'}</span></div>
            <h1 className="text-lg md:text-xl font-bold text-white leading-tight tracking-tight line-clamp-1">{selectedTopic?.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-slate-800/40 rounded-lg py-1 px-4 min-w-[70px] text-center border border-slate-700/50">
               <div className={`text-lg font-black tabular-nums tracking-tighter ${isCritical ? 'text-rose-500 animate-pulse' : 'text-white'}`}>{formatTime(timeLeft)}</div>
               <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">TIME</span>
            </div>
            <div className="bg-slate-800/40 rounded-lg py-1 px-4 min-w-[70px] text-center border border-slate-700/50">
               <div className="text-lg font-black text-white tracking-tighter">{wordCount}</div>
               <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">WORDS</span>
            </div>
          </div>
        </div>

        <div className="relative w-full flex-1 p-1 bg-[#0f172a] dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col min-h-0 z-10 overflow-hidden">
          <textarea
            value={content}
            onChange={handleContentChange}
            placeholder="Structure your analysis here..."
            className="w-full h-full p-6 md:p-10 bg-white dark:bg-slate-800 rounded-xl focus:outline-none text-lg md:text-xl leading-relaxed text-slate-700 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-medium border-none shadow-inner resize-none overflow-y-auto tracking-tight"
            autoFocus
          />
        </div>
        
        <div className="w-full mt-2 flex gap-4 shrink-0">
          <button 
            onClick={() => setIsPreviewOpen(true)} 
            className="flex-1 px-6 py-4 bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-400 border-2 border-slate-100 dark:border-indigo-900/30 rounded-xl font-black text-sm hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
          >
            VIEW PREVIEW
          </button>
          <button 
            onClick={handleSubmit} 
            className="flex-1 px-6 py-4 bg-indigo-900 dark:bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-black dark:hover:bg-indigo-700 transition-all shadow-lg active:scale-95 tracking-tight flex items-center justify-center"
          >
            SUBMIT FOR REVIEW
          </button>
        </div>

        {isPreviewOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white dark:bg-dark-card rounded-[32px] shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden transform animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Draft Preview</h3>
                <button onClick={() => setIsPreviewOpen(false)} className="text-3xl font-light text-slate-400 hover:text-slate-600 dark:hover:text-slate-100">×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-10">
                <div className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-medium text-lg tracking-tight">{content || "No content yet."}</div>
              </div>
              <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 text-center">
                <button onClick={() => setIsPreviewOpen(false)} className="px-10 py-3 bg-indigo-900 dark:bg-indigo-600 text-white rounded-xl font-black tracking-tight hover:bg-black dark:hover:bg-indigo-700">BACK TO EDITOR</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderReport = () => {
    if (!feedback || !selectedTopic) return null;

    const isLowContent = feedback.wordCount < 60;

    return (
      <div className="max-w-6xl mx-auto p-6 pb-40 animate-in fade-in slide-in-from-bottom-10 duration-1000">
        <div className="flex flex-col md:flex-row items-start justify-between mb-10 gap-10">
          <div className="flex-1">
            <h1 className="text-7xl font-display text-slate-900 dark:text-white tracking-tighter leading-none mb-4">Feedback</h1>
            <p className="text-indigo-600 dark:text-indigo-400 font-extrabold text-3xl flex items-center gap-4 tracking-tight"><span className="text-slate-200 dark:text-slate-800 text-4xl font-display">#</span> {selectedTopic?.title}</p>
          </div>
          <button onClick={() => { setState(AppState.WELCOME); setContent(''); setSelectedTopic(null); }} className="group px-12 py-7 bg-indigo-900 dark:bg-indigo-600 text-white rounded-3xl font-black text-xl hover:bg-black dark:hover:bg-indigo-700 transition-all shadow-xl flex items-center gap-6 transform hover:-translate-y-2 tracking-tight">START OVER <span className="group-hover:translate-x-3 transition-transform text-3xl">→</span></button>
        </div>

        {isLowContent && (
          <div className="mb-8 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-900/50 p-8 rounded-[32px] flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-top-6 duration-700 shadow-xl relative overflow-hidden">
             <div className="w-16 h-16 bg-amber-400 dark:bg-amber-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg text-3xl">🧩</div>
             <div>
                <p className="text-xl text-amber-900 dark:text-white font-black tracking-tight leading-snug">
                  Your response is shorter than 60 words, which is not enough to evaluate structure, clarity, and depth.
                  Please write a little more to receive full feedback.
                </p>
             </div>
          </div>
        )}

        <div className="mb-12 bg-white dark:bg-slate-900 p-10 rounded-[40px] border-2 border-slate-100 dark:border-slate-800 flex items-center gap-10 shadow-sm animate-in slide-in-from-left-6 duration-700">
          <div className="bg-indigo-900 dark:bg-indigo-600 w-24 h-24 rounded-[28px] flex flex-col items-center justify-center shrink-0 shadow-lg">
            <span className="text-3xl font-black text-white tracking-tighter">{feedback.wpm}</span>
            <span className="text-[9px] font-black text-indigo-300 dark:text-indigo-200 uppercase tracking-[0.2em]">WPM</span>
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] mb-2 block">Linguistic Velocity</span>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-200 italic tracking-tight leading-relaxed">“{getWPMInterpretation(feedback.wpm)}”</p>
          </div>
        </div>

        {!isLowContent && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-16">
            <FeedbackList title="Cognitive Strengths" items={feedback.positives} type="positive" />
            <FeedbackList title="Critical Weaknesses" items={feedback.negatives} type="negative" />
          </div>
        )}

        <div className="bg-indigo-950 dark:bg-slate-900 text-white p-14 rounded-[56px] shadow-3xl relative overflow-hidden group border border-slate-800 dark:border-indigo-900/30">
          <div className="absolute top-0 right-0 p-12 opacity-5 text-9xl font-black pointer-events-none tracking-tighter">MBA</div>
          <h3 className="text-3xl font-display mb-12 relative z-10 flex items-center gap-6 tracking-tight"><span className="w-12 h-12 rounded-xl bg-indigo-500/30 dark:bg-indigo-600/20 flex items-center justify-center text-xl border border-indigo-400/20">🎯</span>Strategic Action Plan</h3>
          <ul className="space-y-10 relative z-10">
            {feedback.recommendations.map((item, idx) => (
              <li key={idx} className="flex items-start gap-8 group/item">
                <span className="text-amber-400 dark:text-amber-500 font-black text-2xl shrink-0 mt-1">→</span>
                <span className="text-slate-200 dark:text-slate-100 text-xl leading-relaxed font-semibold tracking-tight">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Easy': return 'bg-emerald-500 dark:bg-emerald-600';
      case 'Medium': return 'bg-amber-500 dark:bg-amber-600';
      case 'Hard': return 'bg-rose-500 dark:bg-rose-600';
      default: return 'bg-slate-500';
    }
  };

  const renderFlipperScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 animate-in zoom-in-95 duration-700">
      <div className="bg-white dark:bg-dark-card p-8 md:p-16 rounded-[60px] shadow-2xl max-w-4xl w-full text-center border-4 border-slate-100 dark:border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/10 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-50 dark:bg-violet-900/10 rounded-full -ml-32 -mb-32 opacity-50 blur-3xl pointer-events-none"></div>
        <div className="px-4 relative z-10">
          <div className={`relative bg-slate-900 dark:bg-slate-950 rounded-[40px] p-10 mb-14 h-64 flex items-center justify-center shadow-2xl group border-[10px] border-slate-800 dark:border-indigo-900/20 transition-all duration-500 ${!isSpinning && selectedTopic ? 'ring-8 ring-indigo-500/30 scale-105 shadow-indigo-600/20 animate-pulse-subtle' : ''}`}>
            <div className={`flex flex-col items-center gap-6 transition-all duration-300 ${isSpinning ? 'opacity-30 blur-[4px] scale-90 translate-y-4' : 'opacity-100 blur-0 scale-100 translate-y-0'}`}>
              {!isSpinning && selectedTopic && (
                <div className="flex items-center gap-2 animate-in slide-in-from-top duration-500">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white ${getDifficultyColor(selectedTopic.difficulty)}`}>
                    {selectedTopic.difficulty} LEVEL
                  </span>
                </div>
              )}
              <p className="text-2xl md:text-3xl font-display text-white px-10 text-center leading-snug tracking-tighter">
                {WAT_TOPICS[flipperIndex].title}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-6 px-4 relative z-10">
          {!selectedTopic || isSpinning ? (
            <button onClick={startSpin} disabled={isSpinning} className="px-12 py-8 bg-amber-400 dark:bg-amber-600 text-indigo-950 dark:text-white rounded-[30px] font-black text-2xl hover:bg-amber-300 dark:hover:bg-amber-500 transition-all shadow-xl disabled:opacity-50 border-b-8 border-amber-600 dark:border-amber-800 active:border-b-2 tracking-tight">
              {isSpinning ? 'BROWSING...' : 'CHANGE TOPIC'}
            </button>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-10 duration-700">
              <div className="bg-slate-50/50 dark:bg-slate-800/40 backdrop-blur-sm p-8 rounded-[40px] mb-10 border-2 border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-6 block">Set Examination Time</span>
                <div className="flex gap-6 justify-center">
                  {[15, 30].map(m => (
                    <button key={m} onClick={() => setTimerDuration(m * 60)} className={`flex-1 py-5 rounded-2xl text-xl font-black transition-all border-b-[8px] tracking-tight ${timerDuration === m * 60 ? 'bg-indigo-900 dark:bg-indigo-600 text-white border-indigo-950 dark:border-indigo-800 scale-105' : 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800'}`}>{m} MINS</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-6">
                <button onClick={startSpin} className="px-8 py-5 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-4 border-slate-100 dark:border-slate-800 rounded-[24px] font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm tracking-tight">CHANGE TOPIC</button>
                <button onClick={handleChooseTopic} className="flex-1 px-12 py-6 bg-indigo-900 dark:bg-indigo-600 text-white rounded-[24px] font-black text-xl hover:bg-black dark:hover:bg-indigo-700 transition-all shadow-2xl transform hover:-translate-y-1 tracking-tight">ENTER ARENA</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
          50% { box-shadow: 0 0 20px 10px rgba(79, 70, 229, 0.2); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );

  return (
    <div className="min-h-screen selection:bg-indigo-600 selection:text-white pb-32 overflow-x-hidden bg-white dark:bg-dark-bg transition-colors duration-300">
      <nav className="px-8 py-4 flex flex-col items-center max-w-7xl mx-auto sticky top-0 z-50 bg-white/70 dark:bg-dark-bg/70 backdrop-blur-3xl border-b border-slate-100 dark:border-slate-800">
        <div className="w-full flex justify-between items-center">
          <div className="flex items-center cursor-pointer group" onClick={() => setState(AppState.WELCOME)}>
            <div className="flex items-center font-black tracking-tighter transition-all">
              <div className="bg-indigo-900 dark:bg-indigo-600 h-10 px-3 py-1 rounded-lg text-white text-lg shadow-lg group-hover:bg-black dark:group-hover:bg-indigo-700 mr-2 flex items-center justify-center">WAT</div>
              <span className="text-3xl font-display text-slate-900 dark:text-white leading-none h-10 flex items-center">4MBA</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setState(AppState.ABOUT)}
              className="px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors border border-slate-200 dark:border-slate-800 hover:border-indigo-600 dark:hover:border-indigo-400"
            >
              About
            </button>
            
            <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl shadow-inner border border-slate-200 dark:border-slate-800 flex items-center gap-1">
              <button 
                onClick={() => setIsDarkMode(false)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isDarkMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400'}`}
              >
                Light
              </button>
              <button 
                onClick={() => setIsDarkMode(true)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-400 dark:hover:text-slate-300'}`}
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
        {!isAnalyzing && state === AppState.FLIPPER && renderFlipperScreen()}
        {!isAnalyzing && state === AppState.WRITING && renderWritingArena()}
        {!isAnalyzing && state === AppState.REPORT && renderReport()}
        {!isAnalyzing && state === AppState.ABOUT && renderAbout()}
      </main>
    </div>
  );
};

const FeedbackList: React.FC<{ title: string; items: string[]; type: 'positive' | 'negative' }> = ({ title, items, type }) => (
  <div className={`bg-white dark:bg-slate-900/50 p-12 rounded-[56px] border-4 shadow-xl transition-all duration-700 hover:shadow-2xl ${type === 'positive' ? 'border-emerald-50 dark:border-emerald-900/20' : 'border-rose-50 dark:border-rose-900/20'}`}>
    <h3 className={`text-[11px] font-black mb-10 uppercase tracking-[0.4em] flex items-center gap-4 ${type === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
       <span className={`w-2.5 h-2.5 rounded-full ${type === 'positive' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
       {title}
    </h3>
    {items.length === 0 ? (
      <p className="text-slate-400 dark:text-slate-600 text-lg font-bold italic tracking-tight">Threshold met for standard evaluation criteria.</p>
    ) : (
      <ul className="space-y-8">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-6 text-xl text-slate-700 dark:text-slate-200 font-bold leading-relaxed group tracking-tight">
            <span className={`mt-2.5 w-2.5 h-2.5 rounded-full shrink-0 shadow-lg group-hover:scale-125 transition-transform duration-300 ${type === 'positive' ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-rose-400 dark:bg-rose-500'}`} />
            {item}
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default App;
