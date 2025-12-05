import React, { useMemo, useRef, useEffect, useState } from 'react';
import { convertKwhToNok, formatNumberWithSpaces } from '../../utils/energy';
import './MobileSavingsFooter.css';

interface MobileSavingsFooterProps {
  totalSavingsKwh: number;
  energyPricePerKwh?: number;
  isVisible: boolean;
}

/**
 * Avrund til nærmeste 1000
 */
const roundToNearestThousand = (value: number): number => {
  if (value < 500) return 0;
  return Math.round(value / 1000) * 1000;
};

/**
 * Formater tall for x-akse (kompakt format)
 * F.eks. 5000 → "5k", 10000 → "10k"
 */
const formatAxisValue = (value: number): string => {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return String(Math.round(value));
};

// Antall hakk i normal visning (41 hakk = 40 intervaller)
const TICK_COUNT = 40;

/**
 * MobileSavingsFooter - Sticky footer som viser estimert besparelse
 *
 * Designprinsipper:
 * - Overskrift øverst, graf under, verdier nederst
 * - Dynamisk skalering: Grafen "zoomer ut" når den nærmer seg maks
 * - Animert zoom-ut hvor hakk komprimeres og nye glir inn fra høyre
 * - Punkt designsystem farger
 * - Alltid synlig over andre modaler (z-index: 1100)
 */
export const MobileSavingsFooter: React.FC<MobileSavingsFooterProps> = ({
  totalSavingsKwh,
  energyPricePerKwh = 1.1,
  isVisible,
}) => {
  const prevSavingsRef = useRef(totalSavingsKwh);
  const [isGrowing, setIsGrowing] = useState(false);

  // Dynamisk skala - settes basert på første tiltak, utvides ved behov
  const [currentScale, setCurrentScale] = useState<number | null>(null);

  // For zoom-ut animasjon av hakk
  const [zoomAnimation, setZoomAnimation] = useState<{
    progress: number; // 0 til 1
    oldScale: number;
    newScale: number;
  } | null>(null);

  // Beregn besparelse i NOK
  const totalSavingsNok = useMemo(
    () => convertKwhToNok(totalSavingsKwh, energyPricePerKwh),
    [totalSavingsKwh, energyPricePerKwh]
  );

  // Avrund verdier for visning
  const roundedKwh = useMemo(
    () => roundToNearestThousand(totalSavingsKwh),
    [totalSavingsKwh]
  );
  const roundedNok = useMemo(
    () => roundToNearestThousand(totalSavingsNok),
    [totalSavingsNok]
  );

  // Formater tall med mellomrom
  const formattedKwh = useMemo(
    () => formatNumberWithSpaces(roundedKwh),
    [roundedKwh]
  );
  const formattedNok = useMemo(
    () => formatNumberWithSpaces(roundedNok),
    [roundedNok]
  );

  // Beregn skala-verdier for x-aksen (i NOK)
  // Under animasjon interpolerer vi mellom gammel og ny skala
  const displayScale = useMemo(() => {
    if (zoomAnimation) {
      const { oldScale, newScale, progress } = zoomAnimation;
      return oldScale + (newScale - oldScale) * progress;
    }
    return currentScale;
  }, [currentScale, zoomAnimation]);

  const scaleMaxNok = useMemo(() => {
    if (displayScale === null) return 0;
    return convertKwhToNok(displayScale, energyPricePerKwh);
  }, [displayScale, energyPricePerKwh]);

  const scaleValues = useMemo(() => [
    0,
    Math.round(scaleMaxNok * 0.25),
    Math.round(scaleMaxNok * 0.5),
    Math.round(scaleMaxNok * 0.75),
    Math.round(scaleMaxNok),
  ], [scaleMaxNok]);

  // Initialiser skalaen basert på første tiltak
  useEffect(() => {
    if (totalSavingsKwh > 0 && currentScale === null) {
      const initialScale = Math.ceil(totalSavingsKwh * 2);
      setCurrentScale(initialScale);
    }
  }, [totalSavingsKwh, currentScale]);

  // Dynamisk zoom-out: Når vi passerer 90% av skalaen, utvider vi
  useEffect(() => {
    if (currentScale === null || zoomAnimation) return;

    const percentOfScale = (totalSavingsKwh / currentScale) * 100;

    if (percentOfScale >= 90) {
      // Vent på vekst-animasjonen først
      const growthDelay = setTimeout(() => {
        const oldScale = currentScale;
        const newScale = Math.ceil(totalSavingsKwh * 1.7);

        // Start hakk-animasjonen
        const animationDuration = 600;
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const rawProgress = Math.min(elapsed / animationDuration, 1);
          // Ease-out cubic
          const progress = 1 - Math.pow(1 - rawProgress, 3);

          setZoomAnimation({ progress, oldScale, newScale });

          if (rawProgress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Animasjon ferdig - oppdater til ny skala
            setCurrentScale(newScale);
            setZoomAnimation(null);
          }
        };
        requestAnimationFrame(animate);
      }, 500);

      return () => clearTimeout(growthDelay);
    }
  }, [totalSavingsKwh, currentScale, zoomAnimation]);

  // Beregn søylebredde basert på displayScale (synkronisert med aksen under animasjon)
  const barWidthPercent = useMemo(() => {
    if (totalSavingsKwh <= 0 || displayScale === null) return 0;
    const percent = (totalSavingsKwh / displayScale) * 100;
    return Math.min(Math.max(percent, 15), 100);
  }, [totalSavingsKwh, displayScale]);

  // Resett skalaen når alle tiltak fjernes
  useEffect(() => {
    if (totalSavingsKwh === 0) {
      setCurrentScale(null);
      setZoomAnimation(null);
      prevSavingsRef.current = 0;
    }
  }, [totalSavingsKwh]);

  // Detekter når søylen vokser for bounce-animasjon
  useEffect(() => {
    if (totalSavingsKwh > prevSavingsRef.current) {
      setIsGrowing(true);
      const timer = setTimeout(() => setIsGrowing(false), 400);
      prevSavingsRef.current = totalSavingsKwh;
      return () => clearTimeout(timer);
    }
    prevSavingsRef.current = totalSavingsKwh;
  }, [totalSavingsKwh]);

  /**
   * Beregn hakk-posisjoner under zoom-ut animasjon.
   *
   * Konseptet:
   * - Ved progress=0: Vi har TICK_COUNT hakk jevnt fordelt (0-100%)
   * - Ved progress=1: Skalaen er utvidet, gamle hakk er komprimert til venstre,
   *   nye hakk har glidd inn fra høyre, og vi har fortsatt TICK_COUNT hakk
   *
   * Formel for hvert hakk:
   * - Gamle hakk (representerer gammel skala) komprimeres:
   *   posisjon = originalPos * (oldScale/newScale)
   * - Ved animasjonsslutt plasseres alle hakk på nye jevne posisjoner
   */
  const tickPositions = useMemo(() => {
    if (!zoomAnimation) {
      // Normal visning: jevnt fordelte hakk
      return Array.from({ length: TICK_COUNT + 1 }, (_, i) => ({
        position: (i / TICK_COUNT) * 100,
        isMajor: i % 10 === 0,
        opacity: 1,
      }));
    }

    const { oldScale, newScale, progress } = zoomAnimation;
    const compressionRatio = oldScale / newScale; // < 1, f.eks. 0.59

    // Vi trenger flere hakk under animasjonen for å vise effekten
    // Gamle hakk + nye hakk som kommer inn
    const ticks: Array<{ position: number; isMajor: boolean; opacity: number }> = [];

    // Antall hakk vi skal ende opp med
    const finalTickCount = TICK_COUNT + 1;

    for (let i = 0; i < finalTickCount; i++) {
      const finalPosition = (i / TICK_COUNT) * 100;

      // Startposisjon for dette hakket:
      // - Hakk som eksisterte i gammel skala starter på sin gamle posisjon
      // - Hakk som er "nye" (utenfor gammel skala) starter utenfor skjermen (>100%)

      // Hvilken posisjon på gammel skala tilsvarer dette hakket på ny skala?
      const valueOnNewScale = finalPosition / 100; // 0 til 1
      const valueOnOldScale = valueOnNewScale / compressionRatio; // Kan være > 1

      let startPosition: number;
      let startOpacity: number;

      if (valueOnOldScale <= 1) {
        // Dette hakket eksisterte i gammel skala
        startPosition = valueOnOldScale * 100;
        startOpacity = 1;
      } else {
        // Dette er et "nytt" hakk som kommer inn fra høyre
        // Start utenfor skjermen, proporsjonalt med hvor langt utenfor det er
        startPosition = 100 + (valueOnOldScale - 1) * 100;
        startOpacity = 0;
      }

      // Interpoler mellom start og slutt basert på progress
      const currentPosition = startPosition + (finalPosition - startPosition) * progress;
      const currentOpacity = startOpacity + (1 - startOpacity) * progress;

      ticks.push({
        position: currentPosition,
        isMajor: i % 10 === 0,
        opacity: currentOpacity,
      });
    }

    return ticks;
  }, [zoomAnimation]);

  if (!isVisible) {
    return null;
  }

  const isAnimating = zoomAnimation !== null;

  return (
    <div className={`mobile-savings-footer ${isGrowing ? 'mobile-savings-footer--highlight' : ''}`}>
      <div className="mobile-savings-footer__content">
        {/* Overskrift øverst */}
        <h3 className="mobile-savings-footer__heading">Estimert besparelse</h3>

        {/* Graf/søyle under overskriften */}
        <div className="mobile-savings-footer__graph">
          <div className="mobile-savings-footer__bar-container">
            <div
              className={`mobile-savings-footer__bar ${isGrowing ? 'mobile-savings-footer__bar--growing' : ''} ${isAnimating ? 'mobile-savings-footer__bar--synced' : ''}`}
              style={{ width: `${barWidthPercent}%` }}
              role="progressbar"
              aria-valuenow={barWidthPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Besparelse: ${barWidthPercent.toFixed(0)}% av skala`}
            />
          </div>
          {/* X-akse med hakk og dynamiske verdier */}
          <div className="mobile-savings-footer__axis">
            {/* Hakk-linje med dynamiske posisjoner */}
            <div className="mobile-savings-footer__ticks">
              {tickPositions.map((tick, i) => (
                <div
                  key={i}
                  className={`mobile-savings-footer__tick ${tick.isMajor ? 'mobile-savings-footer__tick--major' : ''}`}
                  style={{
                    left: `${tick.position}%`,
                    opacity: tick.opacity,
                    position: 'absolute',
                    transform: 'translateX(-50%)',
                  }}
                />
              ))}
            </div>
            {/* Kroneverdier */}
            <div className={`mobile-savings-footer__labels ${isAnimating ? 'mobile-savings-footer__labels--animating' : ''}`}>
              {scaleValues.map((value, i) => (
                <span key={i} className="mobile-savings-footer__axis-value">
                  {formatAxisValue(value)} kr
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Verdier nederst */}
        <div className="mobile-savings-footer__values">
          <div className="mobile-savings-footer__amount">
            <span className="mobile-savings-footer__amount-prefix">~</span>
            <span className="mobile-savings-footer__amount-value">{formattedNok}</span>
            <span className="mobile-savings-footer__amount-suffix">kr/år</span>
          </div>
          <div className="mobile-savings-footer__kwh">
            ≈ {formattedKwh} kWh/år
          </div>
        </div>
      </div>
    </div>
  );
};
