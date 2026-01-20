import React from 'react';
import { renderParagraphWithGlossary } from '../glossaryHelpers';
import type { TiltakContentProps } from './types';

export const TiltakContent: React.FC<TiltakContentProps> = ({
  introParagraphs,
  buildingTypeParagraphs = [],
  tabs = [],
  activeTab,
  glossary,
  hoveredTerm,
  setHoveredTerm
}) => {
  // Hent riktig innhold basert på aktiv tab
  const paragraphs = React.useMemo(() => {
    if (activeTab === 'generelt') {
      // Kombiner intro-paragrafer med byggtype-spesifikke
      return [...introParagraphs, ...buildingTypeParagraphs];
    }
    // Finn tab-innhold
    const tabContent = tabs.find(t => t.id === activeTab);
    return tabContent?.body ?? [];
  }, [activeTab, introParagraphs, buildingTypeParagraphs, tabs]);

  return (
    <div
      className="desktop-tiltak-card__content"
      role="tabpanel"
      id={`tabpanel-${activeTab}`}
      aria-labelledby={`tab-${activeTab}`}
    >
      {paragraphs.map((paragraph, index) => (
        <p key={`paragraph-${index}`}>
          {renderParagraphWithGlossary({
            paragraph,
            glossary,
            hoveredTerm,
            setHoveredTerm
          })}
        </p>
      ))}
    </div>
  );
};
