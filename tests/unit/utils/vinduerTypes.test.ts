import { describe, it, expect } from 'vitest';
import { getAvailableVinduerTypes } from '../../../src/utils/energySavingsData.ts';

describe('getAvailableVinduerTypes', () => {
  describe('gul liste-bygg', () => {
    it('TEK10 gul liste småhus → kun tolags (gul-liste-rater finnes)', () => {
      expect(getAvailableVinduerTypes('10', 'småhus', true)).toEqual(['tolags']);
    });

    it('TEK17 gul liste småhus → kun tolags', () => {
      expect(getAvailableVinduerTypes('17', 'småhus', true)).toEqual(['tolags']);
    });

    it('TEK69 gul liste småhus → kun tolags (aldri trelags på gul liste)', () => {
      expect(getAvailableVinduerTypes('69', 'småhus', true)).toEqual(['tolags']);
    });

    it('Eldre gul liste blokk → kun tolags', () => {
      expect(getAvailableVinduerTypes('eldre', 'blokk', true)).toEqual(['tolags']);
    });
  });

  describe('ikke gul liste-bygg', () => {
    it('TEK10 småhus uten gul liste → ingen (trelags er byggekrav)', () => {
      expect(getAvailableVinduerTypes('10', 'småhus', false)).toEqual([]);
    });

    it('TEK17 småhus uten gul liste → ingen', () => {
      expect(getAvailableVinduerTypes('17', 'småhus', false)).toEqual([]);
    });

    it('TEK97 småhus uten gul liste → begge typer', () => {
      expect(getAvailableVinduerTypes('97', 'småhus', false)).toEqual(['tolags', 'trelags']);
    });

    it('TEK69 småhus uten gul liste → begge typer', () => {
      expect(getAvailableVinduerTypes('69', 'småhus', false)).toEqual(['tolags', 'trelags']);
    });

    it('Eldre småhus uten gul liste → begge typer', () => {
      expect(getAvailableVinduerTypes('eldre', 'småhus', false)).toEqual(['tolags', 'trelags']);
    });
  });
});
