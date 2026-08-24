import { describe, it, expect } from 'vitest';
import { assertTransition, canTransition } from './transitions';

describe('job transitions', () => {
  it('queued -> running is legal', () => {
    expect(assertTransition('queued', 'running')).toBe('running');
  });
  it('queued -> failed is legal', () => {
    expect(canTransition('queued', 'failed')).toBe(true);
  });
  it('running -> done is legal', () => {
    expect(canTransition('running', 'done')).toBe(true);
  });
  it('running -> failed is legal', () => {
    expect(canTransition('running', 'failed')).toBe(true);
  });
  it('done is terminal', () => {
    expect(canTransition('done', 'running')).toBe(false);
    expect(canTransition('done', 'queued')).toBe(false);
  });
  it('failed is terminal', () => {
    expect(canTransition('failed', 'running')).toBe(false);
  });
  it('queued -> done skips running (illegal)', () => {
    expect(() => assertTransition('queued', 'done')).toThrow(/illegal job transition/);
  });
  it('unknown status throws', () => {
    expect(() => assertTransition('bogus' as never, 'done')).toThrow();
  });
});
