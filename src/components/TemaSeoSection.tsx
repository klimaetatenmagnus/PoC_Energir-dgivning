import React from 'react';
import {
  OM_ENERGINOKKELEN,
  TEMA_NAV,
  type TemaConfig,
  type TemaLink,
  type TemaSection,
} from '../tema';

interface TemaSeoSectionProps {
  /** Aktiv temavariant; null på forsiden (da vises bare bunnblokkene) */
  tema: TemaConfig | null;
  /** Følger landingssidens fade-animasjon ved overgang til tiltakssiden */
  opacity?: number;
}

interface LinkListProps {
  links: TemaLink[];
  className: string;
  /** Settes for navigasjonen: lenken til gjeldende side får aria-current */
  currentPath?: string;
}

const LinkList: React.FC<LinkListProps> = ({ links, className, currentPath }) => (
  <ul className={className}>
    {links.map((link) => (
      <li key={link.href}>
        <a
          href={link.href}
          aria-current={currentPath !== undefined && link.href === currentPath ? 'page' : undefined}
        >
          {link.label}
        </a>
      </li>
    ))}
  </ul>
);

const Section: React.FC<{ section: TemaSection }> = ({ section }) => (
  <>
    <h2 className="tema-seo__heading">{section.heading}</h2>
    {section.paragraphs.map((paragraph) => (
      <p key={paragraph} className="tema-seo__text">
        {paragraph}
      </p>
    ))}
    {section.links && <LinkList links={section.links} className="tema-seo__links" />}
  </>
);

/**
 * Tematisk innhold under adressesøket på annonse-landingssidene
 * (/solceller, /vinduer, /varmepumpe), pluss bunnblokker som også vises på
 * forsiden: navigasjon mellom temasidene og «Om Energinøkkelen». Ligger i
 * normal dokumentflyt etter den fixed-posisjonerte landingssiden og skyver seg
 * over den ved skrolling. Innholdet speiler den prerendrede HTML-en i
 * variantfilene (samme kilde: tema.ts).
 */
export const TemaSeoSection: React.FC<TemaSeoSectionProps> = ({ tema, opacity = 1 }) => (
  <section
    className="tema-seo"
    style={{ opacity }}
    aria-label={tema ? 'Om ' + tema.id : OM_ENERGINOKKELEN.heading}
  >
    <div className="tema-seo__inner">
      {tema?.sections.map((section) => (
        <Section key={section.heading} section={section} />
      ))}
      <nav className="tema-seo__nav" aria-label={TEMA_NAV.heading}>
        <h2 className="tema-seo__heading">{TEMA_NAV.heading}</h2>
        <LinkList
          links={TEMA_NAV.links}
          className="tema-seo__navlinks"
          currentPath={tema ? tema.path : '/'}
        />
      </nav>
      <Section section={OM_ENERGINOKKELEN} />
    </div>
  </section>
);
