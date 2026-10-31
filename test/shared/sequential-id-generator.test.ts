import { describe, expect, it } from 'vitest';
import { SequentialIdGenerator } from '../../src/shared/sequential-id-generator';

describe('SequentialIdGenerator', () => {
  it('starts at 1 and counts up by one', () => {
    const generator = new SequentialIdGenerator();

    expect([generator.next(), generator.next(), generator.next()]).toEqual([1, 2, 3]);
  });

  it('never repeats an id', () => {
    const generator = new SequentialIdGenerator();

    const ids = Array.from({ length: 1000 }, () => generator.next());

    expect(new Set(ids).size).toBe(1000);
  });

  it('keeps separate counters for separate generators', () => {
    const first = new SequentialIdGenerator();
    const second = new SequentialIdGenerator();
    first.next();
    first.next();

    expect(second.next()).toBe(1);
  });
});
