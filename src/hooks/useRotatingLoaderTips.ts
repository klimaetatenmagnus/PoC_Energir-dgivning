import { useCallback, useEffect, useRef, useState } from 'react';
import { useContentDictionary } from './contentHooks';

const DEFAULT_TIPS = [
  'Visste du at Oslo kommune dekker inntil 20 % av kostnaden for nye vinduer og dører i borettslag og sameier?',
  'Visste du at Oslo kommune dekker inntil 30 % av kostnaden for solenergi i borettslag og sameier?',
  'Visste du at borettslag og sameier kan få inntil 10 millioner kroner i støtte til energitiltak fra Enova?',
  'Visste du at du kan få inntil 37 500 kr i Enova-støtte til solceller på privatboligen din?',
  'Visste du at du kan få inntil 20 000 kr i Enova-støtte til nye vinduer og dører i privatboligen din?',
  'Visste du at du kan få inntil 40 000 kr i Enova-støtte til varmepumpe i privatboligen din?',
  'Visste du at du kan få inntil 22 500 kr i Enova-støtte til etterisolering av taket i privatboligen din?',
  'Visste du at du kan få 5 000 kr i støtte til en energirådgiver for privatboligen din?',
  'Visste du at vinduer står for 40 % av varmetapet i en gjennomsnittsbolig?',
  'LED bruker kun en fjerdedel av energien til gamle lyspærer',
  'Senk temperaturen én grad – spar opptil 5 % på oppvarmingen',
  'Vask klær på 30 °C i stedet for 40 °C – det bruker nesten halve energien',
  'Visste du at en varmepumpe kan spare en enebolig for rundt 5 000–15 000 kr i året?',
  'Se alle energitilskudd du kan søke på: klimatilskudd.no',
  'Finn tips til å spare strøm på klimaoslo.no/sparstrøm',
];

const ROTATION_INTERVAL_MS = 3_000;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function useRotatingLoaderTips(isActive: boolean): string {
  const { data: dictionary } = useContentDictionary();

  const tips =
    dictionary?.funFacts && dictionary.funFacts.length > 0
      ? dictionary.funFacts.map((f) => f.text)
      : DEFAULT_TIPS;

  const shuffledRef = useRef<string[]>([]);
  const tipsKeyRef = useRef<string>('');

  const tipsKey = tips.join('|');
  if (tipsKeyRef.current !== tipsKey) {
    tipsKeyRef.current = tipsKey;
    shuffledRef.current = shuffleArray(tips);
  }

  const [index, setIndex] = useState(0);

  const advance = useCallback(() => {
    setIndex((prev) => {
      const next = prev + 1;
      if (next >= shuffledRef.current.length) {
        shuffledRef.current = shuffleArray(shuffledRef.current);
        return 0;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const timer = setInterval(advance, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isActive, advance]);

  useEffect(() => {
    if (isActive) {
      shuffledRef.current = shuffleArray(tips);
      setIndex(0);
    }
  // Only reshuffle when loading starts, not when tips change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return shuffledRef.current[index] ?? tips[0];
}
