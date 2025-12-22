
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
  FLIPPER = 'FLIPPER',
  WRITING = 'WRITING',
  REPORT = 'REPORT',
  ABOUT = 'ABOUT'
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
