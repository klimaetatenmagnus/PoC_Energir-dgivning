import React, { useState, useMemo, useCallback } from 'react';
import {
  PktButton,
  PktAccordion,
  PktAccordionItem,
  PktTag,
  PktAlert,
  PktIcon,
} from '@oslokommune/punkt-react';
import {
  DISTRICT_BADGE,
  getBuildingTypeBadgeConfig,
  getDisplayBuildingTypeName,
} from '../../config/badgeConfig';
import { AddressLookupResponse } from '../../services/buildingApi';
import '../../config/badges.css';
import { calculateAnnualEnergyConsumption, determineBuildingType, calculateEnergyRating, calculateEnergyRatingWithFjernvarme, calculateTEK } from '../../utils/tekEnergyCalculations';
import { type TekPeriodInput } from '../../utils/energySavingsData';
import { convertKwhToNok, formatCurrency, formatNumberWithSpaces } from '../../utils/energy';
import { getOsloMapExportUrl } from '../../utils/coordinateUtils';
import './MobileInfoBox.css';

interface MobileInfoBoxProps {
  addressOnly: string;
  districtName: string;
  buildingTypeName: string;
  buildingData: AddressLookupResponse;
  /** Uendrede originaldata for tilbakestilling (nødvendig fordi MobileInfoBox remonteres) */
  originalBuildingData?: AddressLookupResponse;
  mapCoordinates: { lat: number; lng: number } | null;
  showYellowBox?: boolean;
  totalEnergySavings?: number;
  energyPricePerKwh?: number;
  onUpdateBuildingData?: (byggeaar: string, areal: string, arealLeilighet: string, energiforbruk: string) => void;
  onCollapse?: () => void;
  /** Vis "Sammenlign med naboer"-knappen */
  showCompareButton?: boolean;
  /** Callback når sammenlign-knappen klikkes */
  onCompareClick?: () => void;
  /** Besparelse fra gjennomførte tiltak (kWh) - brukes til å justere vist energiforbruk */
  completedSavings?: number;
  /** Om brukeren har fjernvarme */
  fjernvarme?: boolean;
}

const roundToNearestThousandValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value / 1000) * 1000;
};

const ENERGY_RATING_COLORS: Record<string, string> = {
  A: '#097E3E',
  B: '#32A548',
  C: '#96C133',
  D: '#F5D000',
  E: '#F0A500',
  F: '#E06000',
  G: '#C8001E',
};

export const MobileInfoBox: React.FC<MobileInfoBoxProps> = ({
  addressOnly,
  districtName,
  buildingTypeName,
  buildingData,
  originalBuildingData,
  mapCoordinates,
  showYellowBox = false,
  totalEnergySavings = 0,
  energyPricePerKwh = 1.1,
  onUpdateBuildingData,
  onCollapse,
  showCompareButton = false,
  onCompareClick,
  completedSavings = 0,
  fjernvarme,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isGulListeInfoOpen, setIsGulListeInfoOpen] = useState(false);

  // Bygningstypevisning (bruker sentral badge-konfigurasjon)
  const displayBuildingTypeName = getDisplayBuildingTypeName(buildingTypeName);
  const buildingBadgeConfig = getBuildingTypeBadgeConfig(buildingTypeName);
  const isBlockBuilding = buildingTypeName.toLowerCase() === 'blokk' || buildingTypeName === 'Store boligbygg';

  // Store the original fetched values so "Tilbakestill" can always reset to them
  // Bruker originalBuildingData (uendrede verdier fra API) fordi MobileInfoBox remonteres
  // ved åpning/lukking, og buildingData kan allerede inneholde redigerte verdier
  const origData = originalBuildingData ?? buildingData;
  const originalByggeaarRef = React.useRef(String(origData?.byggeaar || ''));
  const originalArealRef = React.useRef(String(origData?.bruksarealM2 || ''));
  const originalArealLeilighetRef = React.useRef(String(origData?.arealLeilighet || ''));

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

    // Bruker alltid TEK-basert estimering, ikke Enova-attest
    return calculateAnnualEnergyConsumption(parsedByggeaar, bruksareal, buildingType);
  }, [savedByggeaar, savedAreal, buildingData, buildingTypeName]);

  const [savedEnergiforbruk, setSavedEnergiforbruk] = useState(
    String(buildingData?.energiattest?.registering?.beregnetLevertEnergiTotaltkWh || estimatedConsumption)
  );
  const [editedByggeaar, setEditedByggeaar] = useState(savedByggeaar);
  const [editedAreal, setEditedAreal] = useState(savedAreal);
  const [editedArealLeilighet, setEditedArealLeilighet] = useState(savedArealLeilighet);
  const [editedEnergiforbruk, setEditedEnergiforbruk] = useState(savedEnergiforbruk);
  const [hasUserEditedEnergy, setHasUserEditedEnergy] = useState(false);

  // Synk lagret energiforbruk med estimert når det endres (hvis bruker ikke har redigert manuelt)
  // Speiler desktop WhiteInfoBox-logikk
  React.useEffect(() => {
    if (!hasUserEditedEnergy) {
      setSavedEnergiforbruk(String(estimatedConsumption));
      setEditedEnergiforbruk(String(estimatedConsumption));
    }
  }, [estimatedConsumption, hasUserEditedEnergy]);

  // Auto-rekalkuler energiforbruk i redigermodus når byggeår/areal endres (speiler desktop)
  React.useEffect(() => {
    if (isEditMode && !hasUserEditedEnergy) {
      const buildingType = determineBuildingType(
        buildingData?.bygningstypeKode,
        buildingTypeName
      );
      const newEstimate = calculateAnnualEnergyConsumption(
        editedByggeaar ? Number(editedByggeaar) : undefined,
        editedAreal ? Number(editedAreal) : undefined,
        buildingType
      );
      setEditedEnergiforbruk(String(newEstimate));
    }
  }, [editedByggeaar, editedAreal, isEditMode, buildingData?.bygningstypeKode, buildingTypeName, hasUserEditedEnergy]);

  // Justert energiforbruk basert på gjennomførte tiltak
  // Avrundes til nærmeste 1000 for konsistent visning
  const adjustedEnergyConsumption = useMemo(() => {
    const base = Number(savedEnergiforbruk || '0');
    if (!Number.isFinite(base) || base <= 0 || !completedSavings || completedSavings <= 0) return base;
    return roundToNearestThousandValue(Math.max(0, base - completedSavings));
  }, [savedEnergiforbruk, completedSavings]);

  // Formatert energiforbruk (justert for gjennomførte tiltak)
  const formattedEnergyConsumption = useMemo(() => {
    const numeric = adjustedEnergyConsumption;
    if (!Number.isFinite(numeric)) return '0';
    return formatNumberWithSpaces(Math.round(numeric));
  }, [adjustedEnergyConsumption]);

  // Beregn energikarakter (identisk logikk som WhiteInfoBox)
  const computedEnergyRating = useMemo(() => {
    const consumptionNum = adjustedEnergyConsumption;
    const areaCandidate = savedAreal || (typeof buildingData?.bruksarealM2 === 'number'
      ? String(buildingData.bruksarealM2)
      : buildingData?.csvData?.bruksareal_totalt);
    const areaNum = Number(areaCandidate);

    if (!Number.isFinite(consumptionNum) || consumptionNum <= 0 || !Number.isFinite(areaNum) || areaNum <= 0) {
      return null;
    }

    const buildingType = determineBuildingType(buildingData?.bygningstypeKode, buildingTypeName);

    if (fjernvarme) {
      const rawByggeaarForTek = savedByggeaar || buildingData?.byggeaar?.toString() || buildingData?.csvData?.byggeaar;
      const byggeaarNum = rawByggeaarForTek ? Number(rawByggeaarForTek) : undefined;
      if (buildingType) {
        // calculateTEK håndterer ugyldig/manglende byggeår (gir TEK49)
        const tekPeriod = calculateTEK(byggeaarNum && !isNaN(byggeaarNum) ? byggeaarNum : 0);
        return calculateEnergyRatingWithFjernvarme(consumptionNum, areaNum, buildingType, tekPeriod as TekPeriodInput, buildingType);
      }
    }

    const intensity = consumptionNum / areaNum;
    return calculateEnergyRating(intensity, areaNum, buildingType);
  }, [
    adjustedEnergyConsumption,
    buildingData?.bruksarealM2,
    buildingData?.byggeaar,
    buildingData?.bygningstypeKode,
    buildingData?.csvData?.bruksareal_totalt,
    buildingData?.csvData?.byggeaar,
    buildingTypeName,
    fjernvarme,
    savedAreal,
    savedByggeaar,
  ]);

  const normalizedCurrentRating = computedEnergyRating?.toUpperCase() ?? null;

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
            <PktTag
              skin={DISTRICT_BADGE.skin}
              aria-label={`${DISTRICT_BADGE.ariaLabelPrefix}: ${districtName}`}
            >
              <PktIcon name={DISTRICT_BADGE.iconName} />
              <span>{districtName}</span>
            </PktTag>
          )}
          {displayBuildingTypeName && (
            <PktTag
              skin={buildingBadgeConfig.skin}
              aria-label={`${buildingBadgeConfig.ariaLabelPrefix}: ${displayBuildingTypeName}`}
            >
              <PktIcon name={buildingBadgeConfig.iconName} />
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
                <div className="mobile-info-box__info-row mobile-info-box__info-row--rating">
                  <span className="mobile-info-box__info-label">Estimert energikarakter:</span>
                  <div className="mobile-info-box__energy-rating-value">
                    {normalizedCurrentRating ? (
                      <span
                        className="mobile-info-box__rating-box"
                        style={{ backgroundColor: ENERGY_RATING_COLORS[normalizedCurrentRating] }}
                      >
                        {normalizedCurrentRating}
                      </span>
                    ) : (
                      <span className="mobile-info-box__energy-rating-empty">Ukjent</span>
                    )}
                  </div>
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
                    skin="tertiary"
                    size="small"
                    variant="icon-left"
                    iconName="arrow-circle"
                    onClick={() => {
                      const origByggeaar = originalByggeaarRef.current;
                      const origAreal = originalArealRef.current;
                      const origArealLeilighet = originalArealLeilighetRef.current;
                      const buildingType = determineBuildingType(buildingData?.bygningstypeKode, buildingTypeName);
                      const origEnergy = String(calculateAnnualEnergyConsumption(
                        origByggeaar ? Number(origByggeaar) : undefined,
                        origAreal ? Number(origAreal) : undefined,
                        buildingType
                      ));
                      setSavedByggeaar(origByggeaar);
                      setSavedAreal(origAreal);
                      setSavedArealLeilighet(origArealLeilighet);
                      setSavedEnergiforbruk(origEnergy);
                      setEditedByggeaar(origByggeaar);
                      setEditedAreal(origAreal);
                      setEditedArealLeilighet(origArealLeilighet);
                      setEditedEnergiforbruk(origEnergy);
                      setHasUserEditedEnergy(false);
                      setIsEditMode(false);
                      onUpdateBuildingData?.(origByggeaar, origAreal, origArealLeilighet, origEnergy);
                    }}
                  >
                    Tilbakestill
                  </PktButton>
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

      {/* Sammenlign med naboer - knapp mellom Nøkkelinfo og Kart */}
      {showCompareButton && onCompareClick && (
        <div className="mobile-info-box__compare-section">
          <PktButton
            skin="primary"
            size="medium"
            variant="icon-left"
            iconName="eye"
            onClick={onCompareClick}
          >
            <span>Sammenlign med naboer</span>
          </PktButton>
        </div>
      )}

      {/* Kart - vises direkte under nøkkelinformasjon (Oslo kommune karttjeneste) */}
      <div className="mobile-info-box__map-section">
        <h3 className="mobile-info-box__map-title">Kart</h3>
        <div className="mobile-info-box__map-container">
          {mapCoordinates ? (
            <div className="mobile-info-box__map-wrapper">
              <img
                src={getOsloMapExportUrl(mapCoordinates.lat, mapCoordinates.lng, 400, 250)}
                alt={`Kart over ${addressOnly}`}
                className="mobile-info-box__map-image"
                loading="lazy"
              />
              <div className="mobile-info-box__map-pin" aria-hidden="true">
                <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
                  <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0zm0 19a5 5 0 110-10 5 5 0 010 10z" fill="#2A2859"/>
                </svg>
              </div>
            </div>
          ) : (
            <div className="mobile-info-box__map-loading">
              Kartkoordinater ikke tilgjengelig
            </div>
          )}
        </div>
        <span className="mobile-info-box__map-attribution">
          Kart: Bymiljøetaten, Oslo kommune
        </span>
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
