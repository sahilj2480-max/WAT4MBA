
import { WATFeedback } from '../types';

const TRANSITION_WORDS = [
  'however', 'therefore', 'consequently', 'nevertheless', 'furthermore', 
  'moreover', 'in contrast', 'additionally', 'similarly', 'on the other hand',
  'hence', 'thus', 'nonetheless', 'alternatively', 'as a result', 
  'specifically', 'to illustrate', 'subsequently', 'conversely', 'accordingly',
  'yet', 'paradoxically', 'notwithstanding'
];

const STRUCTURE_MARKERS = {
  intro: ['introduction', 'context', 'initially', 'believe', 'thesis', 'premise', 'topic', 'frame', 'stance'],
  conclusion: ['conclusion', 'summary', 'ultimately', 'finally', 'consequently', 'result', 'therefore', 'conclude', 'restatement'],
  argument: ['evidence', 'reason', 'example', 'illustration', 'factor', 'impact', 'significance', 'because', 'analysis', 'instance']
};

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'in', 'on', 'at', 'of', 'for', 'with', 'by', 'about', 'still', 'this', 'that']);

export const evaluateWAT = (text: string, topicTitle: string = "", timeSpentSeconds: number = 0): WATFeedback => {
  const trimmed = text.trim();
  const words = trimmed.toLowerCase().match(/\b\w+\b/g) || [];
  const wordCount = words.length;
  const paragraphs = trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const actionables: string[] = [];
  let scoreModifier = 0;

  // 1. LENGTH ANALYSIS
  if (wordCount < 120) {
    weaknesses.push(`Response (${wordCount} words) is underdeveloped. Standard WAT expectations range from 120-250 words.`);
    actionables.push("Aim for at least 120 words to cover the topic in depth.");
    scoreModifier -= 25;
  } else if (wordCount <= 250) {
    strengths.push("Excellent volume control; your response covers the topic thoroughly while remaining focused.");
    scoreModifier += 25;
  } else {
    weaknesses.push("Response exceeds the concise limit of 250 words, which may dilute your core message.");
    actionables.push("Focus on trimming repetitive ideas to stay within 250 words.");
    scoreModifier -= 5;
  }

  // 2. RELEVANCE
  const topicKeywords = topicTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
  const overlapCount = topicKeywords.filter(kw => text.toLowerCase().includes(kw)).length;
  const overlapPercent = (overlapCount / topicKeywords.length) * 100;

  if (overlapPercent < 50) {
    weaknesses.push("Content shows generic tendencies; it lacks specific keyword integration from the prompt.");
    actionables.push("Use keywords directly from the prompt to anchor your arguments.");
    scoreModifier -= 20;
  } else {
    strengths.push("Strong topical relevance. You've successfully anchored your arguments to the prompt's key terms.");
    scoreModifier += 15;
  }

  // 3. STRUCTURE
  const hasIntro = STRUCTURE_MARKERS.intro.some(m => sentences[0]?.toLowerCase().includes(m)) || wordCount > 150;
  const hasConclusion = STRUCTURE_MARKERS.conclusion.some(m => sentences[sentences.length - 1]?.toLowerCase().includes(m));
  const hasParaBreaks = paragraphs.length > 2;
  const transitionCount = TRANSITION_WORDS.filter(w => text.toLowerCase().includes(w)).length;

  if (hasIntro && hasConclusion) {
    strengths.push("Highly organized delivery. The transition from thesis statement to concluding summary is logical and effective.");
    scoreModifier += 20;
  } else {
    if (!hasIntro) {
      weaknesses.push("Missing clear thesis statement in the introduction to frame your stance.");
      actionables.push("Start with a clear introduction that defines the topic and states your thesis.");
    }
    if (!hasConclusion) {
      weaknesses.push("The essay ends abruptly without a synthesis of the discussed points.");
      actionables.push("Summarize your main argument succinctly in a final paragraph.");
    }
    scoreModifier -= 20;
  }

  if (hasParaBreaks) {
    strengths.push("Effective use of paragraphing to delineate separate arguments and enhance readability.");
    scoreModifier += 10;
  } else if (wordCount > 80) {
    weaknesses.push("The response is a single block of text, making it difficult for evaluators to track individual points.");
    actionables.push("Use separate paragraphs for different points (one idea per paragraph).");
    scoreModifier -= 15;
  }

  if (transitionCount >= 3) {
    strengths.push("Fluid coherence. Your use of transition markers ensures a seamless logical flow between ideas.");
    scoreModifier += 10;
  } else {
    weaknesses.push("Limited logical connectors between sentences, resulting in a somewhat choppy narrative.");
    actionables.push("Use linking words like 'however', 'consequently', or 'furthermore' to guide the reader.");
    scoreModifier -= 10;
  }

  // 4. EVIDENCE
  const hasReasoning = STRUCTURE_MARKERS.argument.some(m => text.toLowerCase().includes(m));

  if (hasReasoning) {
    strengths.push("Evidence-based approach. You consistently support your claims with logic or illustrative examples.");
  } else {
    weaknesses.push("Claims are presented as assertions without supporting data or reasoning.");
    actionables.push("For each claim, add a reason or example (answer 'why?' and 'how?').");
    scoreModifier -= 15;
  }

  // 5. TONE
  const hasExtremeTone = /\b(stupid|ridiculous|terrible|idiotic|worst|disaster|hate|incredible|shocking)\b/i.test(text);
  if (hasExtremeTone) {
    weaknesses.push("Tone issues detected. Overly emotional or extreme language reduces professional credibility.");
    actionables.push("Maintain a formal, neutral tone; avoid exaggerations and strong emotional adjectives.");
    scoreModifier -= 20;
  }

  // WPM Calculation
  const minutes = timeSpentSeconds / 60;
  const wpm = minutes > 0 ? Math.round(wordCount / minutes) : 0;

  let finalScore = 60 + scoreModifier;
  finalScore = Math.max(0, Math.min(100, finalScore));

  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (finalScore >= 85) grade = 'A';
  else if (finalScore >= 70) grade = 'B';
  else if (finalScore >= 50) grade = 'C';
  else if (finalScore >= 30) grade = 'D';

  return {
    score: Math.round(finalScore),
    wordCount,
    wpm,
    grade,
    positives: strengths.slice(0, 4),
    negatives: weaknesses.slice(0, 4),
    recommendations: [...actionables, "Adopt the P-E-E-L framework for every body paragraph: Point, Evidence, Explanation, Link."].slice(0, 5),
    metrics: {
      vocabularyBreadth: Math.min(Math.round((new Set(words).size / wordCount) * 150), 100),
      transitionUsage: Math.min(transitionCount * 20, 100),
      structureScore: Math.round(((hasIntro ? 33 : 0) + (hasConclusion ? 33 : 0) + (hasParaBreaks ? 34 : 0)))
    }
  };
};
