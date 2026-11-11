import React from 'react';
import { TiltakIcon } from './TiltakIcon';
import type { TileStatus } from './tiltakSelection';

interface MobileTiltakTileProps {
  tiltakId: string;
  /** Tittel slik den vises på flisa (kan inneholde valgt type) */
  title: string;
  /** Tiltakets navn uten type, brukt i tilgjengelige navn */
  baseTitle: string;
  status: TileStatus;
  /** Besparelse eller «Gjort fra før» */
  subLabel: string;
  /** True når «gjort fra før» kan angres (også når to-lags vinduer er gjort) */
  canUndoDone: boolean;
  /** «Tilskudd» når det finnes ordninger for tiltaket, ellers «Les mer» */
  infoLabel: string;
  onToggle: () => void;
  onToggleDone: () => void;
  onOpenInfo: () => void;
}

/**
 * Flis for ett tiltak. Hele øvre del velger tiltaket som nytt, mens
 * «Gjort fra før» og «Tilskudd» ligger som egne knapper i bunnen.
 */
export const MobileTiltakTile: React.FC<MobileTiltakTileProps> = ({
  tiltakId,
  title,
  baseTitle,
  status,
  subLabel,
  canUndoDone,
  infoLabel,
  onToggle,
  onToggleDone,
  onOpenInfo,
}) => {
  const lowerTitle = baseTitle.toLowerCase();
  return (
    <li className={`mobile-tile mobile-tile--${status}`}>
      <button
        type="button"
        className="mobile-tile__main"
        aria-pressed={status === 'selected'}
        onClick={onToggle}
      >
        <span className="mobile-tile__top">
          <TiltakIcon tiltakId={tiltakId} />
          <span className="mobile-tile__state" aria-hidden="true">
            {status !== 'available' && (
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path d="M5 12.5 L10 17.5 L19 7" />
              </svg>
            )}
          </span>
        </span>
        <span className="mobile-tile__text">
          <span className="mobile-tile__title">{title}</span>
          <span className="mobile-tile__sub">{subLabel}</span>
        </span>
      </button>
      <div className="mobile-tile__footer">
        <button
          type="button"
          className="mobile-tile__link"
          aria-pressed={canUndoDone}
          aria-label={`${canUndoDone ? 'Angre gjort fra før' : 'Marker som gjort fra før'}: ${lowerTitle}`}
          onClick={onToggleDone}
        >
          {canUndoDone ? (
            'Angre'
          ) : (
            <>
              <span className="mobile-tile__label-long">Gjort fra før</span>
              <span className="mobile-tile__label-short">Gjort før</span>
            </>
          )}
        </button>
        <button
          type="button"
          className="mobile-tile__link mobile-tile__link--info"
          aria-label={`Tilskudd og informasjon om ${lowerTitle}`}
          onClick={onOpenInfo}
        >
          {infoLabel}
        </button>
      </div>
    </li>
  );
};
