import React from 'react';
import { openExternalLink } from '../shared';

export interface TiltakReadMoreProps {
  links: Array<{
    id?: string;
    label: string;
    url: string;
  }>;
  maxLinks?: number;
}

export const TiltakReadMore: React.FC<TiltakReadMoreProps> = ({
  links,
  maxLinks = 3
}) => {
  const displayedLinks = links.slice(0, maxLinks);

  if (displayedLinks.length === 0) {
    return null;
  }

  return (
    <div className="desktop-tiltak-card__read-more">
      <h3 className="desktop-tiltak-card__read-more-title">Les mer</h3>
      <ul className="desktop-tiltak-card__read-more-links">
        {displayedLinks.map((link, index) => (
          <li key={link.id || `read-more-${index}`}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="desktop-tiltak-card__read-more-link"
              onClick={(e) => {
                e.preventDefault();
                openExternalLink(link.url);
              }}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
