import React from 'react';
import type { TiltakTabsProps } from './types';

export const TiltakTabs: React.FC<TiltakTabsProps> = ({
  tabs,
  activeTab,
  onTabChange
}) => {
  // Legg til "Generelt" som første tab
  const allTabs = [
    { id: 'generelt', title: 'Generelt' },
    ...tabs.map(t => ({ id: t.id, title: t.title }))
  ];

  return (
    <nav className="desktop-tiltak-card__tabs" role="tablist" aria-label="Tiltaksvarianter">
      <ul className="desktop-tiltak-card__tabs-list">
        {allTabs.map((tab) => (
          <li key={tab.id}>
            <button
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              className={`desktop-tiltak-card__tab ${
                activeTab === tab.id ? 'desktop-tiltak-card__tab--active' : ''
              }`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
