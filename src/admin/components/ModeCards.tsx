import { PktLinkCard } from "@oslokommune/punkt-react";
import { AdminMode } from "../types";
import "./ModeCards.css";

interface ModeCardsProps {
  onSelect: (mode: AdminMode) => void;
}

const modeCards: Array<{
  id: AdminMode;
  title: string;
  description: string;
  highlights: string[];
}> = [
  {
    id: "tiltak",
    title: "Rediger tiltak",
    description:
      "Oppdatér beskrivelser, fordeler, tabs og tilknyttede støtteordninger direkte i staging.",
    highlights: [
      "Variantstøtte (standard / gul liste)",
      "Bygningstype-tekster og ordlister",
      "Lenker, CTA-er og metadata",
    ],
  },
  {
    id: "tilskudd",
    title: "Rediger støtteordninger",
    description:
      "Endre satser, gyldighet, kriterier og hvilke tiltak ordningen vises på.",
    highlights: [
      "Satser og beregningsmetoder",
      "Krav til målgruppe og byggtype",
      "Publiseringslogg og versjonering",
    ],
  },
];

export function ModeCards({ onSelect }: ModeCardsProps) {
  return (
    <div className="mode-cards">
      {modeCards.map((card) => (
        <PktLinkCard
          key={card.id}
          className="mode-cards__card"
          skin="beige"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            onSelect(card.id);
          }}
        >
          <div className="mode-cards__content">
            <div>
              <p className="mode-cards__eyebrow">
                {card.id === "tiltak" ? "Tiltak" : "Tilskudd"}
              </p>
              <h3 className="mode-cards__title">{card.title}</h3>
              <p className="mode-cards__description">{card.description}</p>
            </div>
            <ul className="mode-cards__list">
              {card.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </div>
        </PktLinkCard>
      ))}
    </div>
  );
}
