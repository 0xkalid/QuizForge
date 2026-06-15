// Answer shape/color/label pairing for color-blind accessibility (spec §7).
// Color is ALWAYS paired with a distinct shape and label — never color alone.

export interface AnswerStyle {
  color: string;
  shape: 'triangle' | 'diamond' | 'circle' | 'square';
  label: string;
}

export const ANSWER_STYLES: AnswerStyle[] = [
  { color: '#ff4d6d', shape: 'triangle', label: 'Triangle' },
  { color: '#2b8bff', shape: 'diamond', label: 'Diamond' },
  { color: '#f6a609', shape: 'circle', label: 'Circle' },
  { color: '#19c37d', shape: 'square', label: 'Square' },
];

export function answerStyle(index: number): AnswerStyle {
  return ANSWER_STYLES[index % ANSWER_STYLES.length];
}
