import React, { useState, useMemo, useCallback } from 'react';
import { PktLoader } from '@oslokommune/punkt-react';
import { getDisplayBuildingTypeName } from '../../config/badgeConfig';
import { capitalizeAdresse } from '../../utils/adresseFormat';
import { gruppenavn as gruppenavnFmt } from '../../utils/eiendomsgruppeFormat';
import { AddressLookupResponse } from '../../services/buildingApi';
import { calculateAnnualEnergyConsumption, determineBuildingType, calculateEnergyRating, calculateEnergyRatingWithFjernvarme, calculateTEK } from '../../utils/tekEnergyCalculations';
import { resolveBuildingTypeCodeString } from '../../utils/buildingTypeCode';
import { type TekPeriodInput } from '../../utils/energySavingsData';
import { formatCurrency, formatNumberWithSpaces } from '../../utils/energy';
import { getOsloMapExportUrl } from '../../utils/coordinateUtils';
import { MobileSheetCloseButton } from './MobileSheet';
import { ENERGY_RATING_COLORS, ratingTextColor } from './mobileFormat';
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
  /** Ferdig beregnet kr fra sentral util (anvender bl.a. sol-faktor). */
  totalEnergySavingsNok: number;
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
  /** 'enkelt' = bolig, 'gruppe' = borettslag/sameie */
  viewMode?: 'enkelt' | 'gruppe';
  /** Aggregert borettslag/sameie-info. Brukes i viewMode='gruppe'. */
  eiendomsgruppeVisning?: {
    navn: string;
    type: 'borettslag' | 'sameie';
    antallEnheter: number;
    antallUnikeBygg: number;
    totalBruksarealM2: number;
    byggeaar: Array<number | null>;
    estimatedAnnualConsumptionKWh: number;
  };
  /** Navn på borettslaget/sameiet vi henter data for (brukes i loader-tekst). */
  eiendomsgruppeLoaderNavn?: string;
  /** Callback når toggle-knappen klikkes (tar inn ny viewMode). */
  onToggleViewMode?: (next: 'enkelt' | 'gruppe') => void;
  /** Vis toggle-knappen. Default skjult. */
  showViewModeToggle?: boolean;
  /** Slår fjernvarme av/på (påvirker energikarakteren) */
  onToggleFjernvarme?: () => void;
  /** Åpner «Hvordan fungerer Energinøkkelen?» */
  onShowHowItWorks?: () => void;
  /** Tall for sammenligning med bydelen, i kWh per kvadratmeter og år */
  comparison?: {
    current: number;
    /** Null når ingen nye tiltak er valgt */
    withTiltak: number | null;
    districtAverage: number;
    /** F.eks. «småhus» eller «boligblokker» */
    buildingTypeLabel: string;
  };
}

const roundToNearestThousandValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value / 1000) * 1000;
};

const ENERGY_RATING_SCALE = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

export const MobileInfoBox: React.FC<MobileInfoBoxProps> = ({
  addressOnly,
  districtName,
  buildingTypeName,
  buildingData,
  originalBuildingData,
  mapCoordinates,
  showYellowBox = false,
  totalEnergySavings = 0,
  totalEnergySavingsNok,
  onUpdateBuildingData,
  onCollapse,
  showCompareButton = false,
  onCompareClick,
  completedSavings = 0,
  fjernvarme,
  viewMode = 'enkelt',
  eiendomsgruppeVisning,
  onToggleViewMode,
  showViewModeToggle = false,
  eiendomsgruppeLoaderNavn,
  onToggleFjernvarme,
  onShowHowItWorks,
  comparison,
}) => {
  const isGroupMode = viewMode === 'gruppe' && Boolean(eiendomsgruppeVisning);
  const displayAddress = isGroupMode
    ? eiendomsgruppeVisning!.navn
    : capitalizeAdresse(addressOnly);
  const displayBuildingTypeLabel = isGroupMode
    ? (eiendomsgruppeVisning!.type === 'borettslag' ? 'Borettslag' : 'Sameie')
    : getDisplayBuildingTypeName(buildingTypeName);
  const toggleLabel = isGroupMode
    ? 'Vis din bolig'
    : (eiendomsgruppeVisning
        ? `Vis for ${gruppenavnFmt(eiendomsgruppeVisning.type, eiendomsgruppeVisning.navn, addressOnly)}`
        : 'Vis gruppe');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isGulListeInfoOpen, setIsGulListeInfoOpen] = useState(false);

  const isBlockBuilding = buildingTypeName.toLowerCase() === 'blokk' || buildingTypeName === 'Store boligbygg';
  // 3-sifret bygningstypekode via felles oppslag (oppslått kode → CSV → ID-tabell)
  const buildingTypeCode = resolveBuildingTypeCodeString(buildingData);

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
      buildingTypeCode,
      buildingTypeName
    );

    // Bruker alltid TEK-basert estimering, ikke Enova-attest
    return calculateAnnualEnergyConsumption(parsedByggeaar, bruksareal, buildingType);
  }, [savedByggeaar, savedAreal, buildingData, buildingTypeCode, buildingTypeName]);

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
        buildingTypeCode,
        buildingTypeName
      );
      const newEstimate = calculateAnnualEnergyConsumption(
        editedByggeaar ? Number(editedByggeaar) : undefined,
        editedAreal ? Number(editedAreal) : undefined,
        buildingType
      );
      setEditedEnergiforbruk(String(newEstimate));
    }
  }, [editedByggeaar, editedAreal, isEditMode, buildingTypeCode, buildingTypeName, hasUserEditedEnergy]);

  // Justert energiforbruk basert på gjennomførte tiltak
  // Avrundes til nærmeste 1000 for konsistent visning
  const adjustedEnergyConsumption = useMemo(() => {
    const base = isGroupMode && eiendomsgruppeVisning
      ? eiendomsgruppeVisning.estimatedAnnualConsumptionKWh
      : Number(savedEnergiforbruk || '0');
    if (!Number.isFinite(base) || base <= 0 || !completedSavings || completedSavings <= 0) return base;
    return roundToNearestThousandValue(Math.max(0, base - completedSavings));
  }, [savedEnergiforbruk, completedSavings, isGroupMode, eiendomsgruppeVisning]);

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

    const buildingType = determineBuildingType(buildingTypeCode, buildingTypeName);

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
    buildingTypeCode,
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
    () => roundToNearestThousandValue(totalEnergySavingsNok),
    [totalEnergySavingsNok]
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

  // Sammenligning med bydelen: søyler i kWh per kvadratmeter
  const comparisonBars = comparison
    ? [
        { key: 'current', label: 'Din bolig (estimert)', value: comparison.current, color: '#2A2859' },
        ...(comparison.withTiltak !== null
          ? [{ key: 'tiltak', label: 'Med valgte tiltak', value: comparison.withTiltak, color: '#43F8B6' }]
          : []),
        {
          key: 'district',
          label: `Snitt for ${comparison.buildingTypeLabel} i bydelen`,
          value: comparison.districtAverage,
          color: '#9A8C7A',
        },
      ]
    : [];
  const comparisonMax = Math.max(1, ...comparisonBars.map((bar) => bar.value)) * 1.05;

  const startEdit = () => {
    setEditedByggeaar(savedByggeaar);
    setEditedAreal(savedAreal);
    setEditedArealLeilighet(savedArealLeilighet);
    setEditedEnergiforbruk(savedEnergiforbruk);
    setIsEditMode(true);
    setHasUserEditedEnergy(false);
  };

  // Tilbakestill til verdiene som ble hentet fra Matrikkelen
  const handleReset = () => {
    const origByggeaar = originalByggeaarRef.current;
    const origAreal = originalArealRef.current;
    const origArealLeilighet = originalArealLeilighetRef.current;
    const buildingType = determineBuildingType(buildingTypeCode, buildingTypeName);
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
  };

  const onlyDigits = (value: string) => value.replace(/[^0-9]/g, '');

  return (
    <div className="mobile-info-box">
      <div className="mobile-info-box__header">
        <div className="mobile-info-box__header-text">
          <h2 className="mobile-info-box__title">Om boligen</h2>
          <span className="mobile-info-box__subtitle">
            {[displayAddress, districtName].filter(Boolean).join(' · ')}
          </span>
        </div>
        {onCollapse && <MobileSheetCloseButton onClick={onCollapse} />}
      </div>

      <div className="mobile-info-box__scroll">
        {/* Bytt mellom egen bolig og hele borettslaget/sameiet */}
        {showViewModeToggle && !eiendomsgruppeVisning && (
          <div className="mobile-info-box__view-toggle mobile-info-box__view-toggle--loading">
            <PktLoader size="small" variant="rainbow" isLoading>
              <span />
            </PktLoader>
            <span>Henter data for {eiendomsgruppeLoaderNavn ?? 'borettslaget/sameiet'}</span>
          </div>
        )}
        {showViewModeToggle && eiendomsgruppeVisning && onToggleViewMode && (
          <button
            type="button"
            className="mobile-info-box__view-toggle mobile-info-box__button"
            onClick={() => onToggleViewMode(isGroupMode ? 'enkelt' : 'gruppe')}
          >
            {toggleLabel}
          </button>
        )}

        {/* Gul liste varsling */}
        {showYellowBox && (
          <div className="mobile-info-box__gul-liste-alert">
            <strong>Gul liste</strong>
            <span>
              Bygningen er registrert på Byantikvarens gule liste. Tiltak og tilskudd er tilpasset det.
            </span>
            <button
              type="button"
              className="mobile-info-box__link"
              onClick={() => setIsGulListeInfoOpen(true)}
            >
              Hva betyr gul liste?
            </button>
          </div>
        )}

        {/* Kart (Oslo kommunes karttjeneste) som bekreftelse på riktig bygg */}
        <figure className="mobile-info-box__map">
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
            <div className="mobile-info-box__map-missing">Kartkoordinater ikke tilgjengelig</div>
          )}
          <figcaption className="mobile-info-box__muted">Kart: Bymiljøetaten, Oslo kommune</figcaption>
        </figure>

        {/* Energi i dag */}
        <section className="mobile-info-box__section">
          <h3 className="mobile-info-box__section-title">Energi i dag</h3>
          {!isGroupMode && normalizedCurrentRating && (
            <div
              className="mobile-info-box__scale"
              role="img"
              aria-label={`Estimert energikarakter ${normalizedCurrentRating} på en skala fra A til G`}
            >
              {ENERGY_RATING_SCALE.map((letter) => (
                <span
                  key={letter}
                  className={`mobile-info-box__scale-step${letter === normalizedCurrentRating ? ' mobile-info-box__scale-step--current' : ''}`}
                  style={{ backgroundColor: ENERGY_RATING_COLORS[letter], color: ratingTextColor(letter) }}
                >
                  {letter}
                </span>
              ))}
            </div>
          )}
          <dl className="mobile-info-box__rows">
            {!isGroupMode && (
              <div>
                <dt>Estimert energikarakter</dt>
                <dd>{normalizedCurrentRating ?? 'Ukjent'}</dd>
              </div>
            )}
            <div>
              <dt>Estimert energiforbruk</dt>
              <dd>~{formattedEnergyConsumption} kWh/år</dd>
            </div>
          </dl>
          {onToggleFjernvarme && (
            <label className="mobile-info-box__checkbox" htmlFor="om-boligen-fjernvarme">
              <input
                id="om-boligen-fjernvarme"
                type="checkbox"
                checked={Boolean(fjernvarme)}
                onChange={onToggleFjernvarme}
              />
              <span>Boligen har fjernvarme</span>
            </label>
          )}
          <p className="mobile-info-box__muted">
            Anslaget bygger på byggeår, areal og bygningstype.
            {onToggleFjernvarme ? ' Fjernvarme gir bedre energikarakter.' : ''}
          </p>
        </section>

        {/* Opplysninger om boligen */}
        <section className="mobile-info-box__section mobile-info-box__section--tight">
          <div className="mobile-info-box__section-head">
            <h3 className="mobile-info-box__section-title">
              {isGroupMode ? 'Opplysninger om eiendommen' : 'Opplysninger om boligen'}
            </h3>
            {!isEditMode && !isGroupMode && (
              <button type="button" className="mobile-info-box__link" onClick={startEdit}>
                Rediger
              </button>
            )}
          </div>

          {!isEditMode ? (
            <>
              <dl className="mobile-info-box__rows">
                {displayBuildingTypeLabel && (
                  <div>
                    <dt>{isGroupMode ? 'Eierform' : 'Bygningstype'}</dt>
                    <dd>{displayBuildingTypeLabel}</dd>
                  </div>
                )}
                {isGroupMode ? (
                  <div>
                    <dt>Antall boenheter</dt>
                    <dd>{eiendomsgruppeVisning!.antallEnheter.toLocaleString('nb-NO')}</dd>
                  </div>
                ) : (
                  <div>
                    <dt>Byggeår</dt>
                    <dd>{savedByggeaar || 'Ukjent'}</dd>
                  </div>
                )}
                <div>
                  <dt>{isGroupMode ? 'Samlet areal' : 'Bruksareal'}</dt>
                  <dd>
                    {isGroupMode
                      ? `${eiendomsgruppeVisning!.totalBruksarealM2.toLocaleString('nb-NO')} m²`
                      : `${savedAreal || 'Ukjent'} m²`}
                  </dd>
                </div>
                {isBlockBuilding && savedArealLeilighet && (
                  <div>
                    <dt>Areal leilighet</dt>
                    <dd>{savedArealLeilighet} m²</dd>
                  </div>
                )}
              </dl>
              {!isGroupMode && (
                <p className="mobile-info-box__muted">
                  Hentet fra Matrikkelen. Stemmer det ikke, kan du rette tallene og få et nytt anslag.
                </p>
              )}
            </>
          ) : (
            <div className="mobile-info-box__form">
              <div className="mobile-info-box__field">
                <label htmlFor="edit-byggeaar">Byggeår</label>
                <input
                  id="edit-byggeaar"
                  type="text"
                  inputMode="numeric"
                  value={editedByggeaar}
                  onChange={(e) => setEditedByggeaar(onlyDigits(e.target.value))}
                />
              </div>
              <div className="mobile-info-box__field">
                <label htmlFor="edit-areal">Bruksareal (m²)</label>
                <input
                  id="edit-areal"
                  type="text"
                  inputMode="numeric"
                  value={editedAreal}
                  onChange={(e) => setEditedAreal(onlyDigits(e.target.value))}
                />
              </div>
              {isBlockBuilding && (
                <div className="mobile-info-box__field">
                  <label htmlFor="edit-areal-leilighet">Areal leilighet (m²)</label>
                  <input
                    id="edit-areal-leilighet"
                    type="text"
                    inputMode="numeric"
                    value={editedArealLeilighet}
                    onChange={(e) => setEditedArealLeilighet(onlyDigits(e.target.value))}
                  />
                </div>
              )}
              <div className="mobile-info-box__field">
                <label htmlFor="edit-energi">Energiforbruk (kWh/år)</label>
                <input
                  id="edit-energi"
                  type="text"
                  inputMode="numeric"
                  value={editedEnergiforbruk}
                  onChange={(e) => {
                    setEditedEnergiforbruk(onlyDigits(e.target.value));
                    setHasUserEditedEnergy(true);
                  }}
                />
                <span className="mobile-info-box__muted">
                  Har du strømregningen, kan du legge inn det faktiske forbruket.
                </span>
              </div>
              <div className="mobile-info-box__form-actions">
                <button type="button" className="mobile-info-box__link" onClick={handleReset}>
                  Tilbakestill
                </button>
                <div className="mobile-info-box__form-buttons">
                  <button type="button" className="mobile-info-box__button" onClick={handleCancel}>
                    Avbryt
                  </button>
                  <button
                    type="button"
                    className="mobile-info-box__button mobile-info-box__button--primary"
                    onClick={handleSave}
                  >
                    Lagre
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Sammenligning med bydelen */}
        {comparison && (
          <section className="mobile-info-box__section">
            <div className="mobile-info-box__section-intro">
              <h3 className="mobile-info-box__section-title">
                Sammenlignet med {districtName || 'bydelen'}
              </h3>
              <span className="mobile-info-box__muted">Energiforbruk per kvadratmeter i året</span>
            </div>
            <ul className="mobile-info-box__bars">
              {comparisonBars.map((bar) => (
                <li key={bar.key}>
                  <span className="mobile-info-box__bar-label">
                    <span>{bar.label}</span>
                    <span className="mobile-info-box__bar-value">
                      {Math.round(bar.value).toLocaleString('nb-NO')} kWh/m²
                    </span>
                  </span>
                  <span className="mobile-info-box__bar-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.round((bar.value / comparisonMax) * 100)}%`,
                        backgroundColor: bar.color,
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
            {showCompareButton && onCompareClick && (
              <button type="button" className="mobile-info-box__link" onClick={onCompareClick}>
                Se hele sammenligningen
              </button>
            )}
          </section>
        )}

        {onShowHowItWorks && (
          <button type="button" className="mobile-info-box__link" onClick={onShowHowItWorks}>
            Hvordan fungerer Energinøkkelen?
          </button>
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
