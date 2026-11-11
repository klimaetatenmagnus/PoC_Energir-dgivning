import { describe, it, expect } from 'vitest';
import {
  applyTiltakAction,
  defaultVinduerTypeNye,
  diffSelection,
  getTileStatus,
  isVinduerPartial,
  needsTypePicker,
  type TiltakSelection,
  type VinduerType,
} from '../../../src/components/mobile/tiltakSelection.ts';

const BEGGE: VinduerType[] = ['tolags', 'trelags'];
const KUN_TRELAGS: VinduerType[] = ['trelags'];
const KUN_TOLAGS: VinduerType[] = ['tolags']; // gul liste

const tom = (overrides: Partial<TiltakSelection> = {}): TiltakSelection => ({
  checked: new Set(),
  completed: new Set(),
  varmepumpeType: 'luft-luft',
  vinduerTypeNye: 'trelags',
  completedVinduerType: 'tolags',
  ...overrides,
});

describe('tiltakSelection', () => {
  describe('vanlige tiltak', () => {
    it('velg som nytt fjerner «gjort fra før»', () => {
      const start = tom({ completed: new Set(['tetting']) });
      const neste = applyTiltakAction(start, { type: 'select', id: 'tetting' }, BEGGE);
      expect([...neste.checked]).toEqual(['tetting']);
      expect(neste.completed.has('tetting')).toBe(false);
      expect(getTileStatus('tetting', neste, BEGGE)).toBe('selected');
    });

    it('gjort fra før fjerner tiltaket fra valgte', () => {
      const start = tom({ checked: new Set(['tetting', 'solenergi']) });
      const neste = applyTiltakAction(start, { type: 'markDone', id: 'tetting' }, BEGGE);
      expect([...neste.checked]).toEqual(['solenergi']);
      expect(getTileStatus('tetting', neste, BEGGE)).toBe('done');
    });

    it('angre gjør tiltaket tilgjengelig igjen', () => {
      const start = tom({ completed: new Set(['tetting']) });
      const neste = applyTiltakAction(start, { type: 'undoDone', id: 'tetting' }, BEGGE);
      expect(getTileStatus('tetting', neste, BEGGE)).toBe('available');
    });

    it('endrer ikke utgangstilstanden', () => {
      const start = tom();
      applyTiltakAction(start, { type: 'select', id: 'tetting' }, BEGGE);
      expect(start.checked.size).toBe(0);
    });
  });

  describe('varmepumpe', () => {
    it('krever alltid typevalg', () => {
      expect(needsTypePicker('varmepumpe', 'ny', tom(), KUN_TRELAGS)).toBe(true);
      expect(needsTypePicker('varmepumpe', 'gjort', tom(), KUN_TRELAGS)).toBe(true);
    });

    it('lagrer valgt type som nytt tiltak', () => {
      const neste = applyTiltakAction(
        tom(),
        { type: 'select', id: 'varmepumpe', varmepumpeType: 'vaeske-vann' },
        BEGGE,
      );
      expect(neste.varmepumpeType).toBe('vaeske-vann');
      expect(neste.checked.has('varmepumpe')).toBe(true);
    });

    it('gjort fra før med type tar den ut av valgte', () => {
      const start = tom({ checked: new Set(['varmepumpe']) });
      const neste = applyTiltakAction(
        start,
        { type: 'markDone', id: 'varmepumpe', varmepumpeType: 'luft-vann' },
        BEGGE,
      );
      expect(neste.varmepumpeType).toBe('luft-vann');
      expect(neste.checked.has('varmepumpe')).toBe(false);
      expect(getTileStatus('varmepumpe', neste, BEGGE)).toBe('done');
    });
  });

  describe('vinduer der både to-lags og tre-lags er aktuelt', () => {
    it('krever typevalg som nytt og som gjort fra før', () => {
      expect(needsTypePicker('vinduer', 'ny', tom(), BEGGE)).toBe(true);
      expect(needsTypePicker('vinduer', 'gjort', tom(), BEGGE)).toBe(true);
    });

    it('to-lags fra før lar flisa stå som nytt tiltak til tre-lags', () => {
      const neste = applyTiltakAction(
        tom(),
        { type: 'markDone', id: 'vinduer', vinduerType: 'tolags' },
        BEGGE,
      );
      expect(isVinduerPartial(neste, BEGGE)).toBe(true);
      expect(getTileStatus('vinduer', neste, BEGGE)).toBe('available');
      expect(needsTypePicker('vinduer', 'ny', neste, BEGGE)).toBe(false);

      const valgt = applyTiltakAction(neste, { type: 'select', id: 'vinduer' }, BEGGE);
      expect(valgt.checked.has('vinduer')).toBe(true);
      expect(valgt.completed.has('vinduer')).toBe(true);
      expect(valgt.vinduerTypeNye).toBe('trelags');
    });

    it('to-lags fra før tvinger et eksisterende nytt valg over på tre-lags', () => {
      const start = tom({ checked: new Set(['vinduer']), vinduerTypeNye: 'tolags' });
      const neste = applyTiltakAction(
        start,
        { type: 'markDone', id: 'vinduer', vinduerType: 'tolags' },
        BEGGE,
      );
      expect(neste.checked.has('vinduer')).toBe(true);
      expect(neste.vinduerTypeNye).toBe('trelags');
    });

    it('tre-lags fra før tar vinduer ut av nye tiltak', () => {
      const start = tom({ checked: new Set(['vinduer']) });
      const neste = applyTiltakAction(
        start,
        { type: 'markDone', id: 'vinduer', vinduerType: 'trelags' },
        BEGGE,
      );
      expect(neste.checked.has('vinduer')).toBe(false);
      expect(getTileStatus('vinduer', neste, BEGGE)).toBe('done');
    });

    it('valg som nytt uten to-lags fra før bruker valgt type', () => {
      const neste = applyTiltakAction(
        tom(),
        { type: 'select', id: 'vinduer', vinduerType: 'tolags' },
        BEGGE,
      );
      expect(neste.vinduerTypeNye).toBe('tolags');
    });
  });

  describe('vinduer med bare én aktuell type', () => {
    it('trenger ikke typevalg', () => {
      expect(needsTypePicker('vinduer', 'ny', tom(), KUN_TRELAGS)).toBe(false);
      expect(needsTypePicker('vinduer', 'gjort', tom(), KUN_TOLAGS)).toBe(false);
    });

    it('gul liste: nytt valg blir to-lags, og gjort fra før tar flisa ut', () => {
      expect(defaultVinduerTypeNye(KUN_TOLAGS)).toBe('tolags');

      const valgt = applyTiltakAction(tom(), { type: 'select', id: 'vinduer' }, KUN_TOLAGS);
      expect(valgt.vinduerTypeNye).toBe('tolags');

      const gjort = applyTiltakAction(valgt, { type: 'markDone', id: 'vinduer' }, KUN_TOLAGS);
      expect(gjort.completedVinduerType).toBe('tolags');
      expect(gjort.checked.has('vinduer')).toBe(false);
      expect(getTileStatus('vinduer', gjort, KUN_TOLAGS)).toBe('done');
    });

    it('nyere bygg: gjort fra før regnes som tre-lags', () => {
      const gjort = applyTiltakAction(tom(), { type: 'markDone', id: 'vinduer' }, KUN_TRELAGS);
      expect(gjort.completedVinduerType).toBe('trelags');
      expect(getTileStatus('vinduer', gjort, KUN_TRELAGS)).toBe('done');
    });
  });

  describe('diffSelection', () => {
    it('finner hva som ble valgt og fjernet', () => {
      const start = tom({ checked: new Set(['tetting']) });
      const neste = applyTiltakAction(start, { type: 'markDone', id: 'tetting' }, BEGGE);
      expect(diffSelection(start, neste)).toEqual({
        checked: [['tetting', false]],
        completed: [['tetting', true]],
      });
    });
  });
});
