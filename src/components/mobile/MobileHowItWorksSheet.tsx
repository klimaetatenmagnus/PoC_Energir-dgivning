import React from 'react';
import { MobileSheet, MobileSheetCloseButton } from './MobileSheet';
import './MobileHowItWorksSheet.css';

interface MobileHowItWorksSheetProps {
  onClose: () => void;
}

/**
 * «Hvordan fungerer Energinøkkelen?» – forklarer datagrunnlag og beregninger.
 * Åpnes fra utregningen i bunnlinja og fra «Om boligen».
 */
export const MobileHowItWorksSheet: React.FC<MobileHowItWorksSheetProps> = ({ onClose }) => (
  <MobileSheet
    label="Hvordan fungerer Energinøkkelen?"
    onClose={onClose}
    size="full"
    className="mobile-how-it-works"
  >
    <div className="mobile-how-it-works__header">
      <MobileSheetCloseButton onClick={onClose} />
    </div>
    <div className="mobile-how-it-works__content">
      <h2>Hvordan fungerer Energinøkkelen?</h2>

      <h3>Innhenting av data</h3>
      <p>
        Informasjon om bygningen din hentes automatisk fra Matrikkelen (Norges offisielle eiendomsregister).
        Dette inkluderer bygningstype, byggeår, bruksareal (BRA) og om bygningen er på Gul liste.
      </p>
      <p>
        Energinøkkelen henter data for hele bygningen. For bygninger med flere boenheter, presenteres totalt areal og totalt estimert energibruk. Du kan redigere arealet for å få estimert energiforbruket for din leilighet.
      </p>

      <h3>Har du allerede gjennomført tiltak?</h3>
      <p>
        Energinøkkelen har ikke informasjon om hvilke tiltak som allerede er gjort på bygningen. Trykk gjerne «Gjort fra før» på oppgraderinger som er gjennomført, slik at Energinøkkelen kan ta høyde for dem.
      </p>

      <h3>Energikarakter</h3>
      <p>
        Energikarakteren viser hvor energieffektiv bygningen din er på en skala fra A til G, hvor A er best.
        Karakteren beregnes ut fra grenseverdier fra{' '}
        <a
          href="https://www.enova.no/energimerking/karakterskalaen"
          target="_blank"
          rel="noopener noreferrer"
        >
          Enova
        </a>
        {' '}for bygningens årlige energiforbruk per kvadratmeter (kWh/m²/år).
        Energiforbruket estimeres basert på byggeår og gjeldende teknisk forskrift (TEK) ved byggeåret.
      </p>
      <p>
        Estimert energikarakter kan avvike fra registrerte energiattester hos Enova for samme bygning.
      </p>

      <h3>Beregning av besparelser</h3>
      <p>
        Besparelsene beregnes fra datasett som gir estimert besparelse basert på bygningstype, bruksareal (BRA) og
        teknisk forskrift (TEK). Disse variablene hentes automatisk fra Matrikkelen, utenom TEK som estimeres ut fra byggeår. Dette er en forenkling som gjør at det ikke blir tatt hensyn til om bygget har tidligere blitt oppgradert.
      </p>
      <p>
        For solenergi hentes data fra Oslo kommunes{' '}
        <a
          href="https://od2.pbe.oslo.kommune.no/solkart/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Solkart
        </a>
        . Alle takflater med solpotensial over 800 kWh/m² summeres og multipliseres. Deretter antas det at 85% av takarealet kan utnyttes til solceller, og at solcellene har en virkningsgrad på 20%.
      </p>

      <p className="mobile-how-it-works__note">
        Merk: Alle beregninger er estimater. Faktiske besparelser varierer ut ifra flere ulike faktorer.
      </p>
    </div>
  </MobileSheet>
);
