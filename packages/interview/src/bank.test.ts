import { describe, expect, it } from 'vitest';
import { coveredTopics, nextPrompts } from './bank.js';

describe('question bank', () => {
  it('asks in Telugu before any topic is covered', () => {
    const prompts = nextPrompts({ language: 'te', coveredTopics: [], usedPromptIds: [], limit: 8 });
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.every((prompt) => prompt.language === 'te')).toBe(true);
    expect(prompts.some((prompt) => prompt.text.includes('సంక్రాంతి'))).toBe(true);
  });

  it('follows up on food only after food has been talked about', () => {
    const before = nextPrompts({ language: 'en', coveredTopics: [], usedPromptIds: [] });
    expect(before.some((prompt) => prompt.topic === 'food-follow')).toBe(false);
    const after = nextPrompts({
      language: 'en',
      coveredTopics: ['food'],
      usedPromptIds: ['en-food'],
    });
    expect(after.some((prompt) => prompt.id === 'en-food-follow')).toBe(true);
    expect(after.some((prompt) => prompt.topic === 'food')).toBe(false);
  });

  it('reads covered topics from words the family already kept', () => {
    expect(coveredTopics(['We made pongal at Sankranti'])).toEqual(
      expect.arrayContaining(['food', 'festival']),
    );
  });

  it('stops when every known question has been used', () => {
    const used = nextPrompts({
      language: 'hi',
      coveredTopics: [],
      usedPromptIds: [],
      limit: 20,
    }).map((prompt) => prompt.id);
    expect(nextPrompts({ language: 'hi', coveredTopics: [], usedPromptIds: used })).toEqual([]);
  });
});
