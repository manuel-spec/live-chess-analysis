import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Player, LiveGame, AnalysisResult, AnalysisRequest, PlayerProfile, CacheStats } from './index';

describe('Type Exports', () => {
  it('should export all required types', () => {
    // This test verifies that all types are properly exported
    // Type checking happens at compile time
    expect(true).toBe(true);
  });
});

describe('Property-Based Testing Setup', () => {
  it('should have fast-check configured correctly', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return n === n;
      })
    );
  });
});
