import React, { useEffect, useState } from 'react';
import './RollingNumber.css';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Hvert siffer starter litt etter sifferet til høyre for seg, som på et telleverk
const STAGGER_MS = 35;

interface RollingDigitProps {
  digit: number;
  /** Plass regnet fra høyre (0 = enerplassen) */
  place: number;
}

const RollingDigit: React.FC<RollingDigitProps> = ({ digit, place }) => {
  // Nye sifre starter på 0 og ruller opp til verdien sin
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(digit));
    return () => cancelAnimationFrame(frame);
  }, [digit]);

  return (
    <span className="rolling-number__digit">
      <span
        className="rolling-number__strip"
        style={{
          transform: `translateY(-${shown * 10}%)`,
          transitionDelay: `${place * STAGGER_MS}ms`,
        }}
      >
        {DIGITS.map((value) => (
          <span key={value} className="rolling-number__cell">
            {value}
          </span>
        ))}
      </span>
    </span>
  );
};

interface RollingNumberProps {
  /** Ferdig formatert tekst, f.eks. «~93 000 kr/år». Sifrene ruller, resten står stille. */
  text: string;
}

/**
 * Viser et beløp der sifrene ruller til ny verdi, som på et kassaapparat.
 * Skjermlesere får den ferdige teksten, ikke de enkelte sifrene.
 */
export const RollingNumber: React.FC<RollingNumberProps> = ({ text }) => {
  const chars = Array.from(text);
  let digitPlace = chars.filter((char) => char >= '0' && char <= '9').length;

  return (
    <span className="rolling-number">
      <span className="rolling-number__sr">{text}</span>
      <span className="rolling-number__visual" aria-hidden="true">
        {chars.map((char, index) => {
          // Nøkkel regnet fra høyre, så enerplassen er samme element når tallet får flere sifre
          const key = chars.length - index;
          if (char >= '0' && char <= '9') {
            digitPlace -= 1;
            return <RollingDigit key={key} digit={Number(char)} place={digitPlace} />;
          }
          return (
            <span key={key} className="rolling-number__static">
              {char}
            </span>
          );
        })}
      </span>
    </span>
  );
};
