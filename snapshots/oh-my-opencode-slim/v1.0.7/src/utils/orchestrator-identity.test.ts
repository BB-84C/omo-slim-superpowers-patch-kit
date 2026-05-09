import { describe, expect, test } from 'bun:test';
import {
  ANTHROPIC_PRIMARY_MODEL,
  ANTHROPIC_PRIMARY_ORCHESTRATOR,
  isAnthropicPrimaryOrchestrator,
  isPivotedRootAgent,
  PIVOT_TARGET_MODEL,
  PIVOT_TARGET_ORCHESTRATOR,
} from './orchestrator-identity';

describe('orchestrator-identity constants', () => {
  test('ANTHROPIC_PRIMARY_ORCHESTRATOR is "orchestrator"', () => {
    expect(ANTHROPIC_PRIMARY_ORCHESTRATOR).toBe('orchestrator');
  });

  test('PIVOT_TARGET_ORCHESTRATOR is "orchestrator-beta"', () => {
    expect(PIVOT_TARGET_ORCHESTRATOR).toBe('orchestrator-beta');
  });

  test('PIVOT_TARGET_MODEL is gauge-forge-openai/gpt-5.4', () => {
    expect(PIVOT_TARGET_MODEL).toEqual({
      providerID: 'gauge-forge-openai',
      modelID: 'gpt-5.4',
    });
  });

  test('ANTHROPIC_PRIMARY_MODEL is gauge-forge-anthropic/claude-opus-4-7', () => {
    expect(ANTHROPIC_PRIMARY_MODEL).toEqual({
      providerID: 'gauge-forge-anthropic',
      modelID: 'claude-opus-4-7',
    });
  });
});

describe('isAnthropicPrimaryOrchestrator', () => {
  test('returns true for literal "orchestrator"', () => {
    expect(isAnthropicPrimaryOrchestrator('orchestrator')).toBe(true);
  });

  test('returns false for "orchestrator-beta"', () => {
    expect(isAnthropicPrimaryOrchestrator('orchestrator-beta')).toBe(false);
  });


  test('returns false for "orchestrator-delta"', () => {
    expect(isAnthropicPrimaryOrchestrator('orchestrator-delta')).toBe(false);
    expect(isPivotedRootAgent('orchestrator-delta')).toBe(false);
  });

  test('returns false for unrelated agents', () => {
    expect(isAnthropicPrimaryOrchestrator('fixer')).toBe(false);
    expect(isAnthropicPrimaryOrchestrator('orchestrator-gamma')).toBe(false);
    expect(isAnthropicPrimaryOrchestrator('')).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isAnthropicPrimaryOrchestrator(undefined)).toBe(false);
  });
});

describe('isPivotedRootAgent', () => {
  test('returns true for literal "orchestrator-beta"', () => {
    expect(isPivotedRootAgent('orchestrator-beta')).toBe(true);
  });

  test('returns false for "orchestrator"', () => {
    expect(isPivotedRootAgent('orchestrator')).toBe(false);
  });

  test('returns false for unrelated agents', () => {
    expect(isPivotedRootAgent('fixer')).toBe(false);
    expect(isPivotedRootAgent('orchestrator-gamma')).toBe(false);
    expect(isPivotedRootAgent('')).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isPivotedRootAgent(undefined)).toBe(false);
  });
});
