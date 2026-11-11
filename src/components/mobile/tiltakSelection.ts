/**
 * Valgregler for tiltaksflisene på mobil.
 *
 * Ren logikk uten React, slik at reglene for «velg som nytt» og «gjort fra før»
 * kan testes for seg. Selve besparelsesberegningen ligger fortsatt i
 * MobileEnergySolutions og leser de samme feltene som før.
 */

// Varmepumpe-typer med energibesparelsesdata (fra CSV)
export const VARMEPUMPE_TYPES = [
  { id: 'luft-luft', label: 'Luft-luft', description: 'Rimeligst, enkel installasjon' },
  { id: 'luft-vann', label: 'Luft-vann', description: 'Varmer også tappevann' },
  { id: 'vaeske-vann', label: 'Væske-vann', description: 'Høyest besparelse' },
] as const;

export type VarmepumpeType = (typeof VARMEPUMPE_TYPES)[number]['id'];

// Vinduer-typer for tolags/trelags-valg
export const VINDUER_TYPES = [
  { id: 'tolags', label: 'To-lags glass', description: 'Enklere oppgradering' },
  { id: 'trelags', label: 'Tre-lags glass', description: 'Best isolasjon' },
] as const;

export type VinduerType = (typeof VINDUER_TYPES)[number]['id'];

export interface TiltakSelection {
  /** Tiltak valgt som nye */
  checked: ReadonlySet<string>;
  /** Tiltak merket som gjort fra før */
  completed: ReadonlySet<string>;
  /** Varmepumpetype – deles mellom nytt og gjort fra før (de utelukker hverandre) */
  varmepumpeType: VarmepumpeType;
  /** Vindustype for vinduer valgt som nytt tiltak */
  vinduerTypeNye: VinduerType;
  /** Vindustype for vinduer merket som gjort fra før */
  completedVinduerType: VinduerType;
}

export type TiltakAction =
  | { type: 'select'; id: string; varmepumpeType?: VarmepumpeType; vinduerType?: VinduerType }
  | { type: 'unselect'; id: string }
  | { type: 'markDone'; id: string; varmepumpeType?: VarmepumpeType; vinduerType?: VinduerType }
  | { type: 'undoDone'; id: string };

export type TileStatus = 'available' | 'selected' | 'done';

export type PickerMode = 'ny' | 'gjort';

type AvailableVinduerTypes = ReadonlyArray<VinduerType>;

/**
 * To-lags vinduer er gjort fra før, og tre-lags er fortsatt en mulig oppgradering.
 * Da står vindusflisa igjen som nytt tiltak (to-lags til tre-lags).
 */
export function isVinduerPartial(
  selection: TiltakSelection,
  availableVinduerTypes: AvailableVinduerTypes,
): boolean {
  return (
    selection.completed.has('vinduer') &&
    selection.completedVinduerType === 'tolags' &&
    availableVinduerTypes.includes('trelags')
  );
}

export function getTileStatus(
  id: string,
  selection: TiltakSelection,
  availableVinduerTypes: AvailableVinduerTypes,
): TileStatus {
  if (selection.checked.has(id)) {
    return 'selected';
  }
  if (selection.completed.has(id)) {
    if (id === 'vinduer' && isVinduerPartial(selection, availableVinduerTypes)) {
      return 'available';
    }
    return 'done';
  }
  return 'available';
}

/**
 * Om brukeren må velge type i et eget ark før tiltaket kan velges eller merkes som gjort.
 */
export function needsTypePicker(
  id: string,
  mode: PickerMode,
  selection: TiltakSelection,
  availableVinduerTypes: AvailableVinduerTypes,
): boolean {
  if (id === 'varmepumpe') {
    return true;
  }
  if (id === 'vinduer') {
    if (availableVinduerTypes.length < 2) {
      return false;
    }
    // Har du to-lags fra før, er tre-lags eneste nye valg.
    return mode === 'gjort' || !isVinduerPartial(selection, availableVinduerTypes);
  }
  return false;
}

/**
 * Vindustypen som foreslås når brukeren ikke har valgt selv.
 * Tre-lags foretrekkes der det er tilgjengelig (gul liste har bare to-lags).
 */
export function defaultVinduerTypeNye(availableVinduerTypes: AvailableVinduerTypes): VinduerType {
  if (availableVinduerTypes.includes('trelags')) {
    return 'trelags';
  }
  return availableVinduerTypes[0] ?? 'trelags';
}

export function applyTiltakAction(
  selection: TiltakSelection,
  action: TiltakAction,
  availableVinduerTypes: AvailableVinduerTypes,
): TiltakSelection {
  const checked = new Set(selection.checked);
  const completed = new Set(selection.completed);
  let { varmepumpeType, vinduerTypeNye, completedVinduerType } = selection;
  const { id } = action;

  switch (action.type) {
    case 'select': {
      checked.add(id);
      if (id === 'vinduer') {
        if (isVinduerPartial(selection, availableVinduerTypes)) {
          // To-lags fra før kan stå sammen med nye tre-lags.
          vinduerTypeNye = 'trelags';
        } else {
          vinduerTypeNye =
            action.vinduerType && availableVinduerTypes.includes(action.vinduerType)
              ? action.vinduerType
              : defaultVinduerTypeNye(availableVinduerTypes);
          completed.delete(id);
        }
      } else {
        if (id === 'varmepumpe' && action.varmepumpeType) {
          varmepumpeType = action.varmepumpeType;
        }
        completed.delete(id);
      }
      break;
    }
    case 'unselect': {
      checked.delete(id);
      break;
    }
    case 'markDone': {
      completed.add(id);
      if (id === 'vinduer') {
        const single = availableVinduerTypes.length === 1 ? availableVinduerTypes[0] : null;
        completedVinduerType = single ?? action.vinduerType ?? 'tolags';
        if (completedVinduerType === 'tolags' && availableVinduerTypes.includes('trelags')) {
          // Vinduer står igjen som nytt tiltak, men da bare til tre-lags.
          vinduerTypeNye = 'trelags';
        } else {
          checked.delete(id);
        }
      } else {
        if (id === 'varmepumpe' && action.varmepumpeType) {
          varmepumpeType = action.varmepumpeType;
        }
        checked.delete(id);
      }
      break;
    }
    case 'undoDone': {
      completed.delete(id);
      break;
    }
  }

  return { checked, completed, varmepumpeType, vinduerTypeNye, completedVinduerType };
}

/**
 * Hvilke tiltak som endret status mellom to valgtilstander. Brukes til sporing.
 */
export function diffSelection(
  before: TiltakSelection,
  after: TiltakSelection,
): { checked: Array<[string, boolean]>; completed: Array<[string, boolean]> } {
  const diff = (a: ReadonlySet<string>, b: ReadonlySet<string>): Array<[string, boolean]> => {
    const changes: Array<[string, boolean]> = [];
    b.forEach((id) => {
      if (!a.has(id)) changes.push([id, true]);
    });
    a.forEach((id) => {
      if (!b.has(id)) changes.push([id, false]);
    });
    return changes;
  };
  return {
    checked: diff(before.checked, after.checked),
    completed: diff(before.completed, after.completed),
  };
}
