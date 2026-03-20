import { useEffect, useRef, useState } from 'react';
import { useContentDictionary } from './contentHooks';

const DEFAULT_TIPS = [
  'Visste du at Oslo kommune dekker inntil 20 % av kostnaden for nye vinduer og dører i borettslag og sameier?',
  'Visste du at Oslo kommune dekker inntil 30 % av kostnaden for solenergi i borettslag og sameier?',
  'Visste du at borettslag og sameier kan få inntil 10 millioner kroner i støtte til energitiltak fra Enova?',
  'Visste du at du kan få inntil 37 500 kr i Enova-støtte til solceller på privatboligen din?',
  'Visste du at du kan få inntil 20 000 kr i Enova-støtte til nye vinduer og dører i privatboligen din?',
  'Visste du at du kan få inntil 40 000 kr i Enova-støtte til varmepumpe i privatboligen din?',
  'Visste du at du kan få inntil 22 500 kr i støtte til etterisolering av taket i privatboligen?',
  'Visste du at du kan få 5 000 kr i støtte til en energirådgiver for privatboligen din?',
  'Visste du at vinduer står for 40 % av varmetapet i en gjennomsnittsbolig?',
  'LED bruker kun en fjerdedel av energien til gamle lyspærer',
  'Senk temperaturen én grad – spar opptil 5 % på oppvarmingen',
  'Vask klær på 30 °C i stedet for 40 °C – det bruker nesten halve energien',
  'Visste du at en varmepumpe kan spare en enebolig for rundt 5 000–15 000 kr i året?',
  'Se alle energitilskudd du kan søke på: klimatilskudd.no',
  'Finn tips til å spare strøm på klimaoslo.no/sparstrøm',
];

const FADE_OUT_MS = 600;

export type RotatingLoaderTipsResult = {
  tip: string;
  visible: boolean;
  fadingOut: boolean;
};

function pickRandom(tips: string[], previousTip: string | null): string {
  if (tips.length <= 1) return tips[0];
  const candidates = tips.filter((t) => t !== previousTip);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function useRotatingLoaderTips(isActive: boolean): RotatingLoaderTipsResult {
  const { data: dictionary } = useContentDictionary();

  const tips =
    dictionary?.funFacts && dictionary.funFacts.length > 0
      ? dictionary.funFacts.map((f) => f.text)
      : DEFAULT_TIPS;

  const [tip, setTip] = useState(() => pickRandom(tips, null));
  const previousTipRef = useRef<string | null>(null);

  // Pick a new random tip each time loading starts
  useEffect(() => {
    if (isActive) {
      const next = pickRandom(tips, previousTipRef.current);
      previousTipRef.current = next;
      setTip(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Fade-out when loading finishes
  const [fadingOut, setFadingOut] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setVisible(true);
      setFadingOut(false);
    } else if (visible) {
      setFadingOut(true);
      const timer = setTimeout(() => {
        setFadingOut(false);
        setVisible(false);
      }, FADE_OUT_MS);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return { tip, visible, fadingOut };
}
