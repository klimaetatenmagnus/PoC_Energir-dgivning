import React from 'react';
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
}: GlossaryRenderOptions): React.ReactNode[] {
  if (!glossary.length) {
    return [paragraph];
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
        } else {
          nextNodes.push(part);
        }
      });
    });

    nodes = nextNodes;
  });

  return nodes;
}

type GlossaryTooltipParams = {
  key: string;
  term: string;
  entry: GlossaryEntry;
  hoveredTerm: string | null;
  setHoveredTerm: (term: string | null) => void;
};

function renderGlossaryTooltip({
  key,
  term,
  entry,
  hoveredTerm,
  setHoveredTerm
}: GlossaryTooltipParams): React.ReactElement {
  const termKey = entry.term.toLowerCase();
  const isHovered = hoveredTerm === termKey;

  return (
    <span
      key={key}
      style={{
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        textUnderlineOffset: '4px',
        cursor: 'pointer',
        position: 'relative'
      }}
      onMouseEnter={() => setHoveredTerm(termKey)}
      onMouseLeave={() => setHoveredTerm(null)}
    >
      {term}
      {isHovered && (
        <div
          onMouseEnter={() => setHoveredTerm(termKey)}
          onMouseLeave={() => setHoveredTerm(null)}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            width: '368px',
            backgroundColor: '#D1F9FF',
            padding: '12px',
            marginBottom: 0,
            zIndex: 1000
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
            Ordforklaring
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
      )}
    </span>
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&');
}
