import type { ComponentType } from 'react';
import type { ContentAudience } from '../../../../../content/schema-helpers';
import type { TiltakComponentProps } from './shared';
import {
  EtterisoleringYttervegg,
  EtterisoleringYtterveggGul,
  IsoleringAvKjellerOgLoft,
  IsoleringAvKjellerOgLoftGul,
  Solenergi,
  SolenergiGul,
  Temperaturstyring,
  TemperaturstyringGul,
  Tetting,
  TettingGul,
  UtskiftningAvVindu,
  UtskiftningAvVinduGul,
  Varmepumpe,
  VarmepumpeGul,
  Ventilasjon,
  VentilasjonGul
} from '.';

type LegacyTiltakComponent = ComponentType<TiltakComponentProps & { audience?: ContentAudience }>;

type LegacyMapEntry = {
  standard: LegacyTiltakComponent;
  gulliste?: LegacyTiltakComponent;
};

const legacyComponentMap: Record<string, LegacyMapEntry> = {
  varmepumpe: { standard: Varmepumpe, gulliste: VarmepumpeGul },
  solenergi: { standard: Solenergi, gulliste: SolenergiGul },
  tetting: { standard: Tetting, gulliste: TettingGul },
  temperaturstyring: { standard: Temperaturstyring, gulliste: TemperaturstyringGul },
  vinduer: { standard: UtskiftningAvVindu, gulliste: UtskiftningAvVinduGul },
  'etterisolering-yttervegg': { standard: EtterisoleringYttervegg, gulliste: EtterisoleringYtterveggGul },
  'etterisolering-kjeller-loft': {
    standard: IsoleringAvKjellerOgLoft,
    gulliste: IsoleringAvKjellerOgLoftGul
  },
  ventilasjon: { standard: Ventilasjon, gulliste: VentilasjonGul }
};

export function getLegacyTiltakComponent(
  slug?: string,
  audience: ContentAudience = 'standard'
): LegacyTiltakComponent | undefined {
  if (!slug) {
    return undefined;
  }
  const entry = legacyComponentMap[slug];

  if (!entry) {
    return undefined;
  }

  if (audience === 'gulliste' && entry.gulliste) {
    return entry.gulliste;
  }

  return entry.standard;
}
