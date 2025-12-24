
export interface WATFeedback {
  score: number;
  wordCount: number;
  wpm: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  positives: string[];
  negatives: string[];
  recommendations: string[];
  metrics: {
    vocabularyBreadth: number;
    transitionUsage: number;
    structureScore: number;
  };
}

export interface Topic {
  id: string;
  title: string;
  category: 'Economics' | 'Social' | 'Technology' | 'Ethics' | 'Politics' | 'Abstract';
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export enum AppState {
  WELCOME = 'WELCOME',
  PREPARING = 'PREPARING',
  FLIPPER = 'FLIPPER',
  WRITING = 'WRITING',
  REPORT = 'REPORT',
  ABOUT = 'ABOUT',
  FLASHBRIEFS = 'FLASHBRIEFS'
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface UserStats {
  points: number;
  totalWords: number;
  completedTests: number;
  highestScore: number;
  badges: string[]; // IDs of earned badges
}

export interface Flashcard {
  id: string;
  category: 'Economy & Business' | 'Technology & AI' | 'Public Policy & Governance' | 'Society, Ethics & Global Affairs';
  question: string;
  what: string;
  why: string;
  askedAs: string;
  tag?: 'Recent' | 'Trending' | 'Evergreen';
  date?: string;
}
