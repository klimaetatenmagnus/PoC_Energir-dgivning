import React, { useState } from 'react';
import { MobileSheet, MobileSheetCloseButton } from './MobileSheet';
import './MobileTypePickerSheet.css';

export interface TypePickerOption {
  id: string;
  label: string;
  description: string;
  /** F.eks. «~9 000 kr/år». Utelates når typen ikke har et beløp å vise. */
  amountLabel?: string;
}

interface MobileTypePickerSheetProps {
  heading: string;
  intro: string;
  options: TypePickerOption[];
  initialId: string;
  primaryLabel: string;
  onConfirm: (optionId: string) => void;
  onClose: () => void;
  /** Åpner infoarket for tiltaket */
  onShowInfo: () => void;
  /** Vises bare når tiltaket allerede er valgt */
  onRemove?: () => void;
}

/**
 * Lite ark for å velge type (varmepumpe eller vinduer) før tiltaket
 * legges til eller merkes som gjort fra før.
 */
export const MobileTypePickerSheet: React.FC<MobileTypePickerSheetProps> = ({
  heading,
  intro,
  options,
  initialId,
  primaryLabel,
  onConfirm,
  onClose,
  onShowInfo,
  onRemove,
}) => {
  const [picked, setPicked] = useState(
    options.some((option) => option.id === initialId) ? initialId : options[0]?.id ?? '',
  );

  return (
    <MobileSheet label={heading} onClose={onClose} className="mobile-type-picker">
      <div className="mobile-type-picker__header">
        <h2 className="mobile-type-picker__heading">{heading}</h2>
        <MobileSheetCloseButton onClick={onClose} />
      </div>
      <p className="mobile-type-picker__intro">{intro}</p>
      <div role="radiogroup" aria-label={heading} className="mobile-type-picker__options">
        {options.map((option) => {
          const checked = picked === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={checked}
              className={`mobile-type-picker__option${checked ? ' mobile-type-picker__option--checked' : ''}`}
              onClick={() => setPicked(option.id)}
            >
              <span className="mobile-type-picker__radio" aria-hidden="true">
                <span />
              </span>
              <span className="mobile-type-picker__option-text">
                <span className="mobile-type-picker__option-label">{option.label}</span>
                <span className="mobile-type-picker__option-desc">{option.description}</span>
              </span>
              {option.amountLabel && (
                <span className="mobile-type-picker__option-amount">{option.amountLabel}</span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="mobile-type-picker__primary"
        disabled={!picked}
        onClick={() => onConfirm(picked)}
      >
        {primaryLabel}
      </button>
      <div className="mobile-type-picker__links">
        <button type="button" className="mobile-type-picker__link" onClick={onShowInfo}>
          Tilskudd og mer om tiltaket
        </button>
        {onRemove && (
          <button type="button" className="mobile-type-picker__link" onClick={onRemove}>
            Fjern fra valgte
          </button>
        )}
      </div>
    </MobileSheet>
  );
};
