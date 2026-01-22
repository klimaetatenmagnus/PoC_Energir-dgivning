/**
 * DistrictComparisonModal
 * Modal-visning for bydelssammenligning.
 * Åpnes fra en knapp nederst på kartet og vises sentrert over siden.
 * Bruker React Portal for å sikre at modalen rendres utenfor parent-containere
 * med overflow/clip-path begrensninger.
 * Bruker Punkt designsystem-komponenter.
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PktIcon } from '@oslokommune/punkt-react';
import type { DistrictStats, EnergyGrade, BuildingTypeCategory } from '../../../../types/districtStatistics';
import { DistrictComparisonCarousel } from './index';
import './DistrictComparisonModal.css';

interface DistrictComparisonModalProps {
  /** Om modalen er åpen */
  isOpen: boolean;
  /** Callback for å lukke modalen */
  onClose: () => void;
  /** Nåværende energiforbruk (kWh/m²/år) */
  currentKwhPerM2: number;
  /** Totale energibesparelser fra valgte tiltak (kWh/år) */
  totalEnergySavings: number;
  /** Bruksareal (m²) */
  bruksareal: number;
  /** Navn på bydelen */
  districtName: string;
  /** Statistikk for bydelen */
  districtStats: DistrictStats;
  /** Navn på delbydelen (valgfri) */
  subdistrictName?: string;
  /** Statistikk for delbydelen (valgfri) */
  subdistrictStats?: DistrictStats;
  /** Brukerens energikarakter (fra Enova eller beregnet) */
  userEnergyGrade?: EnergyGrade | null;
  /** Boligtype-kategori for riktig sammenligningstekst */
  buildingTypeCategory?: BuildingTypeCategory;
  /** Om brukerens energiforbruk er basert på Enova bulk-data (true) eller TEK-estimering (false) */
  isUsingEnovaBulkData?: boolean;
}

export const DistrictComparisonModal: React.FC<DistrictComparisonModalProps> = ({
  isOpen,
  onClose,
  currentKwhPerM2,
  totalEnergySavings,
  bruksareal,
  districtName,
  districtStats,
  subdistrictName,
  subdistrictStats,
  userEnergyGrade,
  buildingTypeCategory,
  isUsingEnovaBulkData,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Fokushåndtering - sett fokus til lukkeknapp når modal åpnes
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // Lukk modal ved Escape-tast
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Forhindre scroll på body når modal er åpen
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Lukk ved klikk på backdrop
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  // Bruk React Portal for å rendre modalen direkte til body
  // Dette sikrer at modalen vises sentrert på skjermen, uavhengig av
  // parent-containere med overflow:hidden eller clip-path
  const modalContent = (
    <div
      className="district-modal__backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="district-modal-title"
    >
      <div
        ref={modalRef}
        className="district-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header med tittel og lukkeknapp */}
        <div className="district-modal__header">
          <h2 id="district-modal-title" className="district-modal__title">
            Sammenlign deg med naboene dine
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="district-modal__close-btn"
            onClick={onClose}
            aria-label="Lukk sammenligning"
          >
            <PktIcon name="close" className="district-modal__close-icon" />
          </button>
        </div>

        {/* Innhold - Karusell med kort */}
        <div className="district-modal__content">
          <DistrictComparisonCarousel
            isExpanded={true}
            onToggle={() => {}}
            currentKwhPerM2={currentKwhPerM2}
            totalEnergySavings={totalEnergySavings}
            bruksareal={bruksareal}
            districtName={districtName}
            districtStats={districtStats}
            subdistrictName={subdistrictName}
            subdistrictStats={subdistrictStats}
            userEnergyGrade={userEnergyGrade}
            buildingTypeCategory={buildingTypeCategory}
            isUsingEnovaBulkData={isUsingEnovaBulkData}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default DistrictComparisonModal;
