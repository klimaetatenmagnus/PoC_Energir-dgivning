import React, { useState, useMemo, useCallback } from 'react';
import {
  PktButton,
  PktAccordion,
  PktAccordionItem,
  PktTag,
  PktAlert,
  PktIcon,
} from '@oslokommune/punkt-react';
import { AddressLookupResponse } from '../../services/buildingApi';
import { calculateAnnualEnergyConsumption, determineBuildingType } from '../../utils/tekEnergyCalculations';
import { convertKwhToNok, formatCurrency, formatNumberWithSpaces } from '../../utils/energy';
import './MobileInfoBox.css';

interface MobileInfoBoxProps {
  addressOnly: string;
  districtName: string;
  buildingTypeName: string;
  buildingData: AddressLookupResponse;
  mapCoordinates: { lat: number; lng: number } | null;
  showYellowBox?: boolean;
  totalEnergySavings?: number;
  energyPricePerKwh?: number;
  onUpdateBuildingData?: (byggeaar: string, areal: string, arealLeilighet: string, energiforbruk: string) => void;
  onCollapse?: () => void;
}

const roundToNearestThousandValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value / 1000) * 1000;
};

export const MobileInfoBox: React.FC<MobileInfoBoxProps> = ({
  addressOnly,
  districtName,
  buildingTypeName,
  buildingData,
  mapCoordinates,
  showYellowBox = false,
  totalEnergySavings = 0,
  energyPricePerKwh = 1.1,
  onUpdateBuildingData,
  onCollapse,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isGulListeInfoOpen, setIsGulListeInfoOpen] = useState(false);

  // Bygningstypevisning
  const displayBuildingTypeName = buildingTypeName === 'Store boligbygg' ? 'Blokk' : buildingTypeName;
  const isBlockBuilding = buildingTypeName.toLowerCase() === 'blokk' || buildingTypeName === 'Store boligbygg';

  // Bygningsdata
  const [savedByggeaar, setSavedByggeaar] = useState(String(buildingData?.byggeaar || ''));
  const [savedAreal, setSavedAreal] = useState(String(buildingData?.bruksarealM2 || ''));
  const [savedArealLeilighet, setSavedArealLeilighet] = useState(String(buildingData?.arealLeilighet || ''));

  // Beregn energiforbruk
  const estimatedConsumption = useMemo(() => {
    const rawByggeaar = savedByggeaar || buildingData?.byggeaar?.toString() || buildingData?.csvData?.byggeaar;
    const parsedByggeaar = rawByggeaar ? Number(rawByggeaar) : undefined;

    const rawBruksareal =
      savedAreal ||
      (typeof buildingData?.bruksarealM2 === 'number'
        ? buildingData.bruksarealM2.toString()
        : undefined) ||
      buildingData?.csvData?.bruksareal_totalt;

    const bruksareal = rawBruksareal ? Number(rawBruksareal) : undefined;
    const buildingType = determineBuildingType(
      buildingData?.bygningstypeKode,
      buildingTypeName
    );

    // For blokk med energikarakter, bruk estimat basert på karakter
    if ((buildingTypeName === 'Blokk' || buildingTypeName === 'Store boligbygg') &&
        buildingData?.energiattest?.energikarakter && bruksareal && bruksareal > 0) {
      const energikarakter = buildingData.energiattest.energikarakter;

      const thresholds: Record<string, number> = {
        'A': 85 + 600 / bruksareal,
        'B': 95 + 1000 / bruksareal,
        'C': 100 + 1500 / bruksareal,
        'D': 135 + 2200 / bruksareal,
        'E': 160 + 3000 / bruksareal,
        'F': 200 + 4000 / bruksareal,
        'G': 250 + 5000 / bruksareal,
      };

      const estimatedIntensity = thresholds[energikarakter] || thresholds['E'];
      return Math.round(estimatedIntensity * bruksareal);
    }

    return calculateAnnualEnergyConsumption(parsedByggeaar, bruksareal, buildingType);
  }, [savedByggeaar, savedAreal, buildingData, buildingTypeName]);

  const [savedEnergiforbruk, setSavedEnergiforbruk] = useState(
    String(buildingData?.energiattest?.registering?.beregnetLevertEnergiTotaltkWh || estimatedConsumption)
  );
  const [editedByggeaar, setEditedByggeaar] = useState(savedByggeaar);
  const [editedAreal, setEditedAreal] = useState(savedAreal);
  const [editedArealLeilighet, setEditedArealLeilighet] = useState(savedArealLeilighet);
  const [editedEnergiforbruk, setEditedEnergiforbruk] = useState(savedEnergiforbruk);
  const [_hasUserEditedEnergy, setHasUserEditedEnergy] = useState(false);

  // Formatert energiforbruk
  const formattedEnergyConsumption = useMemo(() => {
    const numeric = Number(savedEnergiforbruk || '0');
    if (!Number.isFinite(numeric)) return '0';
    return formatNumberWithSpaces(Math.round(numeric));
  }, [savedEnergiforbruk]);

  // Besparelser
  const _shouldShowSavings = totalEnergySavings > 0;
  const roundedSavingsKwh = useMemo(() => roundToNearestThousandValue(totalEnergySavings), [totalEnergySavings]);
  const roundedSavingsNok = useMemo(
    () => roundToNearestThousandValue(convertKwhToNok(totalEnergySavings, energyPricePerKwh)),
    [totalEnergySavings, energyPricePerKwh]
  );
  const _formattedSavingsKwh = useMemo(() => formatNumberWithSpaces(roundedSavingsKwh), [roundedSavingsKwh]);
  const _formattedSavingsCurrency = useMemo(() => formatCurrency(roundedSavingsNok), [roundedSavingsNok]);

  // Håndter lagring
  const handleSave = useCallback(() => {
    setSavedByggeaar(editedByggeaar);
    setSavedAreal(editedAreal);
    setSavedArealLeilighet(editedArealLeilighet);
    setSavedEnergiforbruk(editedEnergiforbruk);
    setIsEditMode(false);
    onUpdateBuildingData?.(editedByggeaar, editedAreal, editedArealLeilighet, editedEnergiforbruk);
  }, [editedByggeaar, editedAreal, editedArealLeilighet, editedEnergiforbruk, onUpdateBuildingData]);

  // Håndter avbryt
  const handleCancel = useCallback(() => {
    setEditedByggeaar(savedByggeaar);
    setEditedAreal(savedAreal);
    setEditedArealLeilighet(savedArealLeilighet);
    setEditedEnergiforbruk(savedEnergiforbruk);
    setIsEditMode(false);
  }, [savedByggeaar, savedAreal, savedArealLeilighet, savedEnergiforbruk]);

  return (
    <div className="mobile-info-box">
      {/* Adresse og tags */}
      <div className="mobile-info-box__header">
        <h2 className="mobile-info-box__address">{addressOnly}</h2>
        <div className="mobile-info-box__tags">
          {districtName && (
            <PktTag skin="green">
              <span>{districtName}</span>
            </PktTag>
          )}
          {displayBuildingTypeName && (
            <PktTag skin="blue">
              <span>{displayBuildingTypeName}</span>
            </PktTag>
          )}
        </div>
      </div>

      {/* Besparelseskort er fjernet fra mobil - vises i MobileSavingsFooter i stedet */}

      {/* Gul liste varsling */}
      {showYellowBox && (
        <div className="mobile-info-box__gul-liste-alert">
          <PktAlert skin="warning" variant="default">
            <strong>Gul liste</strong>
            <p>Denne bygningen er registrert på Byantikvarens Gul liste.</p>
            <button
              className="mobile-info-box__gul-liste-link"
              onClick={() => setIsGulListeInfoOpen(true)}
            >
              Hva betyr dette?
            </button>
          </PktAlert>
        </div>
      )}

      {/* Chevron for å kollapse visningen */}
      {onCollapse && (
        <button
          className="mobile-info-box__collapse-button"
          onClick={onCollapse}
          aria-label="Lukk boliginformasjon"
        >
          <PktIcon name="chevron-thin-up" className="pkt-icon--medium" />
        </button>
      )}

      {/* Nøkkelinformasjon */}
      <PktAccordion skin="outlined">
        <PktAccordionItem
          title="Nøkkelinformasjon"
          id="nokkelinfo"
          isOpen
        >
          <div className="mobile-info-box__key-info">
            {!isEditMode ? (
              <>
                <PktButton
                  skin="tertiary"
                  size="small"
                  variant="icon-left"
                  iconName="edit"
                  onClick={() => {
                    setEditedByggeaar(savedByggeaar);
                    setEditedAreal(savedAreal);
                    setEditedArealLeilighet(savedArealLeilighet);
                    setEditedEnergiforbruk(savedEnergiforbruk);
                    setIsEditMode(true);
                    setHasUserEditedEnergy(false);
                  }}
                  className="mobile-info-box__edit-button"
                >
                  Rediger
                </PktButton>
                <div className="mobile-info-box__info-row">
                  <span className="mobile-info-box__info-label">Byggeår:</span>
                  <span className="mobile-info-box__info-value">{savedByggeaar || 'Ukjent'}</span>
                </div>
                <div className="mobile-info-box__info-row">
                  <span className="mobile-info-box__info-label">Bruksareal:</span>
                  <span className="mobile-info-box__info-value">{savedAreal || 'Ukjent'} m²</span>
                </div>
                {isBlockBuilding && (
                  <>
                    <div className="mobile-info-box__info-row">
                      <span className="mobile-info-box__info-label">Eiertype:</span>
                      <span className="mobile-info-box__info-value">Borettslag</span>
                    </div>
                    {savedArealLeilighet && (
                      <div className="mobile-info-box__info-row">
                        <span className="mobile-info-box__info-label">Areal leilighet:</span>
                        <span className="mobile-info-box__info-value">{savedArealLeilighet} m²</span>
                      </div>
                    )}
                  </>
                )}
                <div className="mobile-info-box__info-row">
                  <span className="mobile-info-box__info-label">Estimert energiforbruk:</span>
                  <span className="mobile-info-box__info-value">{formattedEnergyConsumption} kWh/år</span>
                </div>
              </>
            ) : (
              <>
                <div className="mobile-info-box__edit-row">
                  <label className="mobile-info-box__edit-label" htmlFor="edit-byggeaar">Byggeår:</label>
                  <input
                    id="edit-byggeaar"
                    type="text"
                    inputMode="numeric"
                    className="mobile-info-box__edit-input"
                    value={editedByggeaar}
                    onChange={(e) => setEditedByggeaar(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
                <div className="mobile-info-box__edit-row">
                  <label className="mobile-info-box__edit-label" htmlFor="edit-areal">Areal (m²):</label>
                  <input
                    id="edit-areal"
                    type="text"
                    inputMode="numeric"
                    className="mobile-info-box__edit-input"
                    value={editedAreal}
                    onChange={(e) => setEditedAreal(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
                {isBlockBuilding && (
                  <div className="mobile-info-box__edit-row">
                    <label className="mobile-info-box__edit-label" htmlFor="edit-areal-leilighet">Areal leilighet (m²):</label>
                    <input
                      id="edit-areal-leilighet"
                      type="text"
                      inputMode="numeric"
                      className="mobile-info-box__edit-input"
                      value={editedArealLeilighet}
                      onChange={(e) => setEditedArealLeilighet(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>
                )}
                <div className="mobile-info-box__edit-row">
                  <label className="mobile-info-box__edit-label" htmlFor="edit-energi">Energiforbruk (kWh/år):</label>
                  <input
                    id="edit-energi"
                    type="text"
                    inputMode="numeric"
                    className="mobile-info-box__edit-input"
                    value={editedEnergiforbruk}
                    onChange={(e) => {
                      setEditedEnergiforbruk(e.target.value.replace(/[^0-9]/g, ''));
                      setHasUserEditedEnergy(true);
                    }}
                  />
                </div>
                <div className="mobile-info-box__edit-actions">
                  <PktButton
                    skin="secondary"
                    size="small"
                    onClick={handleCancel}
                  >
                    Avbryt
                  </PktButton>
                  <PktButton
                    skin="primary"
                    size="small"
                    onClick={handleSave}
                  >
                    Lagre
                  </PktButton>
                </div>
              </>
            )}
          </div>
        </PktAccordionItem>
      </PktAccordion>

      {/* Kart - vises direkte under nøkkelinformasjon */}
      <div className="mobile-info-box__map-section">
        <h3 className="mobile-info-box__map-title">Kart</h3>
        <div className="mobile-info-box__map-container">
          {mapCoordinates ? (
            <iframe
              title={`Kart over ${addressOnly}`}
              className="mobile-info-box__map-iframe"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCoordinates.lng - 0.003}%2C${mapCoordinates.lat - 0.002}%2C${mapCoordinates.lng + 0.003}%2C${mapCoordinates.lat + 0.002}&layer=mapnik&marker=${mapCoordinates.lat}%2C${mapCoordinates.lng}`}
              loading="lazy"
            />
          ) : (
            <div className="mobile-info-box__map-loading">
              Kartkoordinater ikke tilgjengelig
            </div>
          )}
        </div>
        {mapCoordinates && (
          <a
            href={`https://www.openstreetmap.org/?mlat=${mapCoordinates.lat}&mlon=${mapCoordinates.lng}#map=17/${mapCoordinates.lat}/${mapCoordinates.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mobile-info-box__map-link"
          >
            Åpne i OpenStreetMap
          </a>
        )}
      </div>

      {/* Gul liste info modal */}
      {isGulListeInfoOpen && (
        <div
          className="mobile-info-box__modal-overlay"
          onClick={() => setIsGulListeInfoOpen(false)}
        >
          <div
            className="mobile-info-box__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="mobile-info-box__modal-close"
              onClick={() => setIsGulListeInfoOpen(false)}
              aria-label="Lukk"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <h2 className="mobile-info-box__modal-title">Hva er Gul liste?</h2>

            <div className="mobile-info-box__modal-content">
              <p>
                Gul liste er Byantikvarens oversikt over verneverdige bygninger og kulturmiljøer i Oslo.
                Den inneholder blant annet bolighus, hager, parker, broer og veier med kulturhistorisk verdi.
              </p>
              <p>
                Listen brukes som et verktøy i arbeidet med å ta vare på viktige deler av byens historie.
                Gul liste oppdateres jevnlig, men er ikke en fullstendig oversikt over alle kulturminner i Oslo.
              </p>

              <div className="mobile-info-box__gul-liste-info-box">
                <p>
                  <strong>Du kan absolutt gjøre tiltak for å energieffektivisere det verneverdige bygget ditt!</strong>
                </p>
              </div>

              <p>
                Kulturminnene på Gul liste er delt inn i tre grupper:
              </p>
              <ul>
                <li><strong>Kommunalt listeført</strong> – registrert i Gul liste og vurdert som verneverdig av Oslo kommune</li>
                <li><strong>Vernet etter plan- og bygningsloven</strong> – sikret gjennom kommuneplanen eller reguleringsplan</li>
                <li><strong>Fredet</strong> – vernet av Riksantikvaren eller fylkeskommunen</li>
              </ul>

              <a
                href="https://www.oslo.kommune.no/plan-bygg-og-eiendom/kulturminner-og-vern/gul-liste/"
                target="_blank"
                rel="noopener noreferrer"
                className="mobile-info-box__external-link"
              >
                Les mer om Gul liste her
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
