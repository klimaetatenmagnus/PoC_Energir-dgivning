import { PktLinkCard } from "@oslokommune/punkt-react";
import { AdminMode } from "../types";
import "./ModeCards.css";

type CardId = AdminMode | "funfacts";

interface ModeCardsProps {
  onSelect: (mode: AdminMode) => void;
  onOpenFunFacts?: () => void;
}

const eyebrowLabels: Record<CardId, string> = {
  tiltak: "Tiltak",
  tilskudd: "Tilskudd",
  funfacts: "Lasteskjerm",
};

const modeCards: Array<{
  id: CardId;
  title: string;
  description: string;
  highlights: string[];
}> = [
  {
    id: "tiltak",
    title: "Tiltakskort",
    description:
      "Rediger innholdet i tiltakskortene som vises på energinøkkelen.no.",
    highlights: [
      "Tekster og fordeler",
      "Tilknyttede tilskuddsordninger",
      "Varianter for standard og gul liste",
    ],
  },
  {
    id: "tilskudd",
    title: "Tilskuddsordninger",
    description:
      "Rediger støtteordningene som vises i tiltakskortene.",
    highlights: [
      "Satser og beløp",
      "Målgrupper og byggtyper",
      "Lenker til søknadsskjema",
    ],
  },
  {
    id: "funfacts",
    title: "Fun facts",
    description:
      "Rediger tekstene som vises mens brukeren venter på boliginformasjon.",
    highlights: [
      "Tips om energitilskudd",
      "Motiverende fakta",
      "Lenker til klimatilskudd.no",
    ],
  },
];

export function ModeCards({ onSelect, onOpenFunFacts }: ModeCardsProps) {
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
            if (card.id === "funfacts") {
              onOpenFunFacts?.();
            } else {
              onSelect(card.id);
            }
          }}
        >
          <div className="mode-cards__content">
            <div>
              <p className="mode-cards__eyebrow">
                {eyebrowLabels[card.id]}
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
