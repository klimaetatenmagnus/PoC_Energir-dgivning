import React from 'react';
import { createPortal } from 'react-dom';
import type { GlossaryTermDictionaryEntry } from '../../../../../content/dictionaries/schema';

export type GlossaryEntry = {
  term: string;
  definition: string[];
  links?: { label: string; url: string }[];
};

export type GlossaryRenderOptions = {
  paragraph: string;
  glossary: GlossaryEntry[];
  hoveredTerm: string | null;
  setHoveredTerm: (term: string | null) => void;
};

export function dictionaryTermsToGlossary(
  terms: GlossaryTermDictionaryEntry[]
): GlossaryEntry[] {
  return terms.map((entry) => ({
    term: entry.term,
    definition: entry.definition,
    links: entry.links
  }));
}

export function renderParagraphWithGlossary({
  paragraph,
  glossary,
  hoveredTerm,
  setHoveredTerm
}: GlossaryRenderOptions): React.ReactElement {
  if (!glossary.length) {
    return <>{paragraph}</>;
  }

  let nodes: React.ReactNode[] = [paragraph];

  glossary.forEach((entry, entryIndex) => {
    const nextNodes: React.ReactNode[] = [];

    nodes.forEach((node) => {
      if (typeof node !== 'string') {
        nextNodes.push(node);
        return;
      }

      const regex = new RegExp(`(${escapeRegExp(entry.term)})`, 'gi');
      const parts = node.split(regex);

      if (parts.length === 1) {
        // Keep as string so subsequent terms can still match
        nextNodes.push(node);
        return;
      }

      parts.forEach((part, partIndex) => {
        if (partIndex % 2 === 1) {
          nextNodes.push(
            renderGlossaryTooltip({
              key: `${entry.term}-${entryIndex}-${partIndex}`,
              term: part,
              entry,
              hoveredTerm,
              setHoveredTerm
            })
          );
        } else if (part) {
          // Keep as string so subsequent terms can still match against this text
          nextNodes.push(part);
        }
      });
    });

    nodes = nextNodes;
  });

  // Wrap all nodes in a single fragment to preserve whitespace between elements
  return <>{nodes}</>;
}

type GlossaryTooltipParams = {
  key: string;
  term: string;
  entry: GlossaryEntry;
  hoveredTerm: string | null;
  setHoveredTerm: (term: string | null) => void;
};

function GlossaryTooltipTerm({
  term,
  entry,
  hoveredTerm,
  setHoveredTerm
}: Omit<GlossaryTooltipParams, 'key'>): React.ReactElement {
  const termKey = entry.term.toLowerCase();
  const isHovered = hoveredTerm === termKey;
  const spanRef = React.useRef<HTMLSpanElement>(null);
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltipPosition, setTooltipPosition] = React.useState({ top: 0, left: 0 });

  const handleMouseEnter = React.useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setHoveredTerm(termKey);
  }, [setHoveredTerm, termKey]);

  const handleMouseLeave = React.useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredTerm(null);
    }, 150);
  }, [setHoveredTerm]);

  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (isHovered && spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.bottom + window.scrollY + 4,
        left: Math.max(16, Math.min(rect.left + window.scrollX, window.innerWidth - 280))
      });
    }
  }, [isHovered]);

  const tooltipContent = isHovered ? (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'absolute',
        top: tooltipPosition.top,
        left: tooltipPosition.left,
        width: '260px',
        backgroundColor: '#D1F9FF',
        padding: '12px',
        zIndex: 999999,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
        borderRadius: '4px',
        pointerEvents: 'auto'
      }}
    >
      <h4
        style={{
          fontFamily: 'Oslo Sans',
          fontWeight: 700,
          fontStyle: 'normal',
          fontSize: '16px',
          lineHeight: '24px',
          letterSpacing: '-0.2px',
          color: '#000000',
          margin: '0 0 8px 0'
        }}
      >
        {entry.term}
      </h4>
      {entry.definition.map((definitionParagraph, index) => (
        <p
          key={`glossary-definition-${entry.term}-${index}`}
          style={{
            fontFamily: 'Oslo Sans',
            fontWeight: 300,
            fontSize: '14px',
            lineHeight: '22px',
            letterSpacing: '0px',
            color: '#000000',
            margin: index === 0 ? 0 : '12px 0 0 0'
          }}
        >
          {definitionParagraph}
        </p>
      ))}
      {entry.links?.length ? (
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {entry.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#000000',
                textDecoration: 'underline',
                fontFamily: 'Oslo Sans',
                fontWeight: 300,
                fontSize: '14px'
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <span
      ref={spanRef}
      style={{
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        textUnderlineOffset: '4px',
        cursor: 'pointer'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {term}
      {tooltipContent && createPortal(tooltipContent, document.body)}
    </span>
  );
}

function renderGlossaryTooltip({
  key,
  term,
  entry,
  hoveredTerm,
  setHoveredTerm
}: GlossaryTooltipParams): React.ReactElement {
  return (
    <GlossaryTooltipTerm
      key={key}
      term={term}
      entry={entry}
      hoveredTerm={hoveredTerm}
      setHoveredTerm={setHoveredTerm}
    />
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Frittstående GlossaryTerm-komponent for inline-bruk.
 * Slår opp i den sentrale ordlisten og viser tooltip.
 */
type GlossaryTermProps = {
  /** Teksten som vises (kan være bøyd form av ordet) */
  children: string;
  /** Term-ID eller selve termen å slå opp i ordlisten */
  term: string;
  /** Ordliste-data (glossaryTerms fra dictionaries/index.json) */
  glossary: GlossaryEntry[];
  /** State for hvilken term som er hovered */
  hoveredTerm: string | null;
  /** Setter for hoveredTerm */
  setHoveredTerm: (term: string | null) => void;
};

export function GlossaryTerm({
  children,
  term,
  glossary,
  hoveredTerm,
  setHoveredTerm
}: GlossaryTermProps): React.ReactElement {
  // Finn entry i ordlisten (case-insensitive)
  const entry = glossary.find(
    (e) => e.term.toLowerCase() === term.toLowerCase()
  );

  if (!entry) {
    // Hvis termen ikke finnes i ordlisten, vis bare teksten
    return <>{children}</>;
  }

  return (
    <GlossaryTooltipTerm
      term={children}
      entry={entry}
      hoveredTerm={hoveredTerm}
      setHoveredTerm={setHoveredTerm}
    />
  );
}
