import React, { useMemo, useState } from 'react';
import {
  TiltakComponentProps,
  calculateTekPeriod,
  parseNumericValue,
  formatNumberWithSpaces,
  useProviderColors,
  getOverskriftLabel,
  openExternalLink,
  type Stotteordning
} from './shared';
import { useTiltakContent, useContentDictionary } from '../../../../hooks/contentHooks';
import { resolveTiltakBenefits } from '../../../../utils/benefitUtils';
import { BenefitChipSvg } from '../../../common/BenefitChip/BenefitChipSvg';
import type { TiltakContent, TiltakAccordionItem } from '../../../../../content/tiltak/schema';
import { useGrantAwareStotteordninger } from './useGrantAwareStotteordninger';
import type { ContentAudience } from '../../../../../content/schema-helpers';
import { applyTiltakVariant, normaliseBuildingTypeKey } from '../../../../utils/tiltakContent';
import { calculateAnnualEnergyConsumption, determineBuildingType } from '../../../../utils/tekEnergyCalculations';
import { getEnergySavingsRate, calculateSavingsFromRate } from '../../../../utils/energySavingsData';
import { GlossaryTerm, dictionaryTermsToGlossary } from './glossaryHelpers';

type IsoleringAvKjellerOgLoftProps = TiltakComponentProps;
type IsoleringAvKjellerOgLoftComponentProps = TiltakComponentProps & { audience?: ContentAudience };

type ReadMoreLink = {
  label: string;
  url: string;
};

type KjellerLoftContentView = {
  title: string;
  introParagraphs: string[];
  buildingTypeParagraphs: Record<string, string[]>;
  readMore: ReadMoreLink[];
  accordion: TiltakAccordionItem[];
  grants: string[];
};


function mapTiltakContentToKjellerLoft(
  content: TiltakContent | undefined
): KjellerLoftContentView | null {
  if (!content) {
    return null;
  }

  const buildingTypeParagraphs: Record<string, string[]> = {};
  for (const [key, paragraphs] of Object.entries(content.buildingTypeParagraphs)) {
    if (Array.isArray(paragraphs)) {
      buildingTypeParagraphs[key] = paragraphs;
    } else if (paragraphs) {
      buildingTypeParagraphs[key] = [String(paragraphs)];
    } else {
      buildingTypeParagraphs[key] = [];
    }
  }

  return {
    title: content.title,
    introParagraphs: content.introParagraphs,
    buildingTypeParagraphs,
    readMore: content.readMore.map(({ label, url }) => ({ label, url })),
    accordion: content.accordion,
    grants: content.grants
  };
}

const IsoleringAvKjellerOgLoftContentComponent: React.FC<IsoleringAvKjellerOgLoftComponentProps> = ({
  onBack,
  buildingType,
  buildingData,
  audience = 'standard'
}) => {
  const [isPermitOpen, setIsPermitOpen] = useState(false);
  const [showSourceTooltip, setShowSourceTooltip] = useState(false);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);

  // Provider-farger fra dictionary
  const getProviderColor = useProviderColors();

  const { data: tiltakContent } = useTiltakContent('etterisolering-kjeller-loft');
  const { data: dictionary } = useContentDictionary();
  const resolvedTiltakContent = useMemo(
    () => applyTiltakVariant(tiltakContent, audience),
    [tiltakContent, audience]
  );

  // Berik fordeler fra dictionary via felles utility
  const enrichedBenefits = useMemo(
    () => resolveTiltakBenefits(resolvedTiltakContent, dictionary, 4),
    [resolvedTiltakContent, dictionary]
  );

  // Ordforklaringer fra sentral ordliste
  const glossary = useMemo(
    () => dictionaryTermsToGlossary(dictionary?.glossaryTerms ?? []),
    [dictionary]
  );

  const content = useMemo(
    () => mapTiltakContentToKjellerLoft(resolvedTiltakContent),
    [resolvedTiltakContent]
  );

  const buildingTypeKey = normaliseBuildingTypeKey(buildingType);

  // Derive values from content (use empty defaults when loading)
  const introParagraphs = content?.introParagraphs ?? [];
  const buildingParagraphs =
    content?.buildingTypeParagraphs[buildingTypeKey] ??
    content?.buildingTypeParagraphs.default ??
    [];
  const readMoreLinks = (content?.readMore ?? []).slice(0, 4);
  const grantIds = content?.grants ?? [];
  const accordionItem = content?.accordion[0];
  const accordionBody = accordionItem?.body ?? [];
  const accordionLinks = accordionItem?.links ?? [];

  // All hooks must be called before any early return
  const {
    stotteordninger,
    isLoading: grantsLoading
  } = useGrantAwareStotteordninger({
    grantIds
  });

  // Show loading state after all hooks have been called
  if (!content) {
    return (
      <div style={{ padding: '60px', fontFamily: 'Oslo Sans', color: '#2A2859' }}>
        Laster innhold...
      </div>
    );
  }

  const displayedStotteordninger: Stotteordning[] = stotteordninger.length
    ? stotteordninger
    : grantsLoading
      ? [
          {
            ordning: 'Henter støtteordninger …',
            lenke: null,
            belop: null,
            overskrift: null
          }
        ]
      : [
          {
            ordning: 'Ingen registrerte støtteordninger ennå',
            lenke: null,
            belop: null,
            overskrift: null
          }
        ];

  const needsScroll = displayedStotteordninger.length > 4;

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%'
    }}>
      {/* SVG Background and decorative elements */}
      <svg
        width="840"
        height="1400"
        viewBox="0 -90 840 1400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0,
          transition: `transform 0.6s ease-in-out ${isPermitOpen ? '0.1s' : '0s'}`,
          transform: isPermitOpen ? 'translateY(-465px)' : 'translateY(0)'
        }}
      >
        <text
          x="60"
          y="-30"
          fontFamily="Oslo Sans, sans-serif"
          fontWeight="700"
          fontStyle="normal"
          fontSize="24"
          style={{ lineHeight: '36px' }}
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="hanging"
        >
          {content.title}
        </text>
        
        {/* Main text content with scroll if needed */}
        <foreignObject x="60" y="20" width="465" height="338">
          <div xmlns="http://www.w3.org/1999/xhtml" style={{
            fontFamily: 'Oslo Sans',
            fontWeight: 300,
            fontStyle: 'normal',
            fontSize: '14px',
            lineHeight: '22px',
            letterSpacing: '0px',
            color: '#000000',
            textAlign: 'left',
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: '10px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#CCCCCC #F5F5F5'
          }}>
            <style>{`
              div::-webkit-scrollbar {
                width: 6px;
              }
              div::-webkit-scrollbar-track {
                background: #F5F5F5;
              }
              div::-webkit-scrollbar-thumb {
                background: #CCCCCC;
                border-radius: 3px;
              }
              div::-webkit-scrollbar-thumb:hover {
                background: #AAAAAA;
              }
            `}</style>
            {introParagraphs.map((paragraph, index) => (
              <p
                key={`intro-${index}`}
                style={{ marginBottom: index === introParagraphs.length - 1 && buildingParagraphs.length === 0 ? 0 : '16px' }}
              >
                {paragraph}
              </p>
            ))}

            {buildingParagraphs.map((paragraph, index) => (
              <p
                key={`building-${index}`}
                style={{ marginBottom: index === buildingParagraphs.length - 1 ? '20px' : '16px' }}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </foreignObject>
        
        {/* Fordeler - bruker felles BenefitChipSvg-komponent */}
        <BenefitChipSvg
          benefits={enrichedBenefits}
          x={565}
          y={60}
          width={220}
          maxItems={4}
        />
        
        {/* Dark green box below the list */}
        <rect
          x="565"
          y="260"
          width="211"
          height="124"
          fill="#034B45"
        />
        
        {/* Årlig besparelse text */}
        <text
          x="589"
          y="284"
          width="149"
          height="24"
          fontFamily="Oslo Sans"
          fill="#FFFFFF"
          dominantBaseline="hanging"
        >
          Årlig besparelse
        </text>
        
        {/* Question mark icon with hover area */}
        <g>
          {/* Invisible hover area that covers the entire icon */}
          <rect
            x="728"
            y="278"
            width="24"
            height="24"
            fill="transparent"
            onMouseEnter={() => setShowSourceTooltip(true)}
            onMouseLeave={() => setShowSourceTooltip(false)}
            style={{ cursor: 'pointer' }}
          />
          
          {/* The actual icon */}
          <svg x="728" y="278" width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ pointerEvents: 'none' }}>
            <path d="M15.93 7.6C17.1356 7.5897 18.3022 8.02698 19.204 8.82721C20.1058 9.62744 20.6787 10.7337 20.8118 11.932C20.945 13.1303 20.6289 14.3354 19.9247 15.314C19.2206 16.2927 18.1785 16.9754 17 17.23H16.94V18.91H14.94V15.35H15.94C16.479 15.3516 17.0077 15.2019 17.4658 14.9179C17.924 14.634 18.2932 14.2271 18.5316 13.7437C18.77 13.2602 18.8679 12.7196 18.8142 12.1832C18.7606 11.6469 18.5574 11.1364 18.228 10.7098C17.8986 10.2831 17.456 9.95754 16.9507 9.76998C16.4453 9.58243 15.8975 9.54045 15.3695 9.64883C14.8415 9.75721 14.3545 10.0116 13.9639 10.383C13.5733 10.7545 13.2948 11.2281 13.16 11.75V11.92L11.16 11.53C11.3793 10.425 11.9741 9.42996 12.8436 8.71364C13.713 7.99731 14.8035 7.60384 15.93 7.6ZM16 3C13.4288 3 10.9154 3.76244 8.77759 5.1909C6.63975 6.61935 4.97351 8.64968 3.98957 11.0251C3.00563 13.4006 2.74818 16.0144 3.24979 18.5362C3.7514 21.0579 4.98953 23.3743 6.80761 25.1924C8.62569 27.0105 10.9421 28.2486 13.4638 28.7502C15.9856 29.2518 18.5994 28.9944 20.9749 28.0104C23.3503 27.0265 25.3806 25.3603 26.8091 23.2224C28.2376 21.0846 29 18.5712 29 16C29 12.5522 27.6304 9.24558 25.1924 6.80761C22.7544 4.36964 19.4478 3 16 3ZM16 1C18.9667 1 21.8668 1.87973 24.3336 3.52796C26.8003 5.17618 28.7229 7.51886 29.8582 10.2597C30.9935 13.0006 31.2906 16.0166 30.7118 18.9264C30.133 21.8361 28.7044 24.5088 26.6066 26.6066C24.5088 28.7044 21.8361 30.133 18.9264 30.7118C16.0166 31.2906 13.0006 30.9935 10.2597 29.8582C7.51886 28.7229 5.17618 26.8003 3.52796 24.3336C1.87973 21.8668 1 18.9667 1 16C1 12.0218 2.58035 8.20644 5.3934 5.3934C8.20644 2.58035 12.0218 1 16 1Z" fill="#FFFFFF"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M17.65 22.38C17.648 22.7197 17.5455 23.0513 17.3553 23.3328C17.1651 23.6144 16.8958 23.8333 16.5813 23.9619C16.2669 24.0906 15.9213 24.1232 15.5884 24.0557C15.2554 23.9882 14.9498 23.8236 14.7103 23.5827C14.4707 23.3418 14.3079 23.0353 14.2424 22.7019C14.1768 22.3685 14.2114 22.0232 14.3419 21.7095C14.4724 21.3958 14.6928 21.1277 14.9755 20.9392C15.2581 20.7506 15.5902 20.65 15.93 20.65C16.1567 20.65 16.3812 20.6948 16.5905 20.7819C16.7999 20.8689 16.9899 20.9965 17.1498 21.1573C17.3096 21.3181 17.4361 21.5089 17.522 21.7187C17.6078 21.9285 17.6513 22.1533 17.65 22.38Z" fill="#FFFFFF"/>
          </svg>
        </g>
        
        
        
        {/* Isolering kjeller/loft savings text */}
        {(() => {
          const bruksareal = parseNumericValue(
            buildingData?.bruksarealM2 ?? buildingData?.csvData?.bruksareal_totalt
          );
          const byggeaar = Math.trunc(
            parseNumericValue(buildingData?.byggeaar ?? buildingData?.csvData?.byggeaar)
          );
          const buildingCategory = determineBuildingType(buildingData?.bygningstypeKode, buildingType);

          if (!buildingCategory || byggeaar <= 0) {
            return (
              <text
                x="589"
                y="327"
                fontFamily="Oslo Sans"
                fontWeight="100"
                fontStyle="normal"
                fontSize="14"
                style={{ lineHeight: '22px' }}
                letterSpacing="0"
                fill="#FFFFFF"
                dominantBaseline="hanging"
              >
                Kunne ikke beregne besparelse
              </text>
            );
          }

          const tekPeriod = calculateTekPeriod(byggeaar);
          const originalEnergy = calculateAnnualEnergyConsumption(byggeaar, bruksareal, buildingCategory);
          const savingsRates = getEnergySavingsRate('etterisolering_kjeller_loft', tekPeriod, buildingCategory);

          if (savingsRates === null) {
            return (
              <text
                x="589"
                y="327"
                fontFamily="Oslo Sans"
                fontWeight="100"
                fontStyle="normal"
                fontSize="14"
                style={{ lineHeight: '22px' }}
                letterSpacing="0"
                fill="#FFFFFF"
                dominantBaseline="hanging"
              >
                Kunne ikke beregne besparelse
              </text>
            );
          }

          // Bruk romoppvarming rate for etterisolering (påvirker kun romoppvarming)
          const totalSavings = calculateSavingsFromRate(originalEnergy, savingsRates.romoppvarming);

          if (totalSavings <= 0) {
            return (
              <text
                x="589"
                y="327"
                fontFamily="Oslo Sans"
                fontWeight="100"
                fontStyle="normal"
                fontSize="14"
                style={{ lineHeight: '22px' }}
                letterSpacing="0"
                fill="#FFFFFF"
                dominantBaseline="hanging"
              >
                Kunne ikke beregne besparelse
              </text>
            );
          }

          const roundedSavings = Math.round(totalSavings / 1000) * 1000;
          const norgespris = 1.1; // kr/kWh
          const roundedKr = Math.round((roundedSavings * norgespris) / 1000) * 1000;

          return (
            <>
              <text
                x="589"
                y="316"
                  fontFamily="Oslo Sans"
                  fontWeight="100"
                  fontStyle="normal"
                  fontSize="14"
                  style={{ lineHeight: '22px' }}
                  letterSpacing="0"
                  fill="#FFFFFF"
                  dominantBaseline="hanging"
                >
                  {`${formatNumberWithSpaces(roundedSavings)} kWh`}
                </text>

                <text
                  x="589"
                  y="338"
                  fontFamily="Oslo Sans"
                  fontWeight="100"
                  fontStyle="normal"
                  fontSize="14"
                  style={{ lineHeight: '22px' }}
                  letterSpacing="0"
                  fill="#FFFFFF"
                  dominantBaseline="hanging"
                >
                  {`${formatNumberWithSpaces(roundedKr)} kr`}
                </text>
              </>
            );
        })()}
        
        {/* Circle below main text */}
        <circle
          cx="170"
          cy="490"
          r="110"
          fill="#2A2859"
        />
        
        {/* "Les mer" title in circle */}
        <text
          x="170"
          y="466"
          fontFamily="Oslo Sans"
          fontWeight="700"
          fontStyle="normal"
          fontSize="18"
          style={{ lineHeight: '28px' }}
          letterSpacing="-0.2"
          fill="#FFFFFF"
          textAnchor="middle"
        >
          Les mer
        </text>
        
        {/* Lenker under "Les mer" */}
        {readMoreLinks.map((link, index) => {
          if (!link?.url) {
            return null;
          }
          const lineY = 502 + index * 24;
          return (
            <text
              key={`${link.label}-${index}`}
              x="170"
              y={lineY}
              fontFamily="Oslo Sans"
              fontWeight="300"
              fontStyle="normal"
              fontSize="14"
              style={{ lineHeight: '22px', cursor: 'pointer' }}
              fill="#FFFFFF"
              textAnchor="middle"
              textDecoration="underline"
              
              onClick={() => openExternalLink(link.url)}
            >
              {link.label}
            </text>
          );
        })}
        
        {/* Dynamic table with scrollbar */}
        {/* Top border */}
        <rect
          x="298"
          y="450"
          width="482"
          height="2"
          fill="#CCCCCC"
        />
        
        {/* Table container with scrolling via foreignObject */}
        <foreignObject x="298" y="452" width="482" height={needsScroll ? "144" : `${displayedStotteordninger.length * 36}`}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{
            width: '100%',
            height: '100%',
            overflowY: needsScroll ? 'auto' : 'hidden',
            overflowX: 'hidden',
            scrollbarWidth: 'thin',
            scrollbarColor: '#CCCCCC #F5F5F5'
          }}>
            <style>{`
              div::-webkit-scrollbar {
                width: 8px;
              }
              div::-webkit-scrollbar-track {
                background: #F5F5F5;
              }
              div::-webkit-scrollbar-thumb {
                background: #CCCCCC;
                border-radius: 4px;
              }
              div::-webkit-scrollbar-thumb:hover {
                background: #AAAAAA;
              }
            `}</style>
            <svg width="474" height={displayedStotteordninger.length * 36} viewBox={`0 0 474 ${displayedStotteordninger.length * 36}`}>
              {displayedStotteordninger.map((ordning, index) => {
                const yPosition = index * 36;
                const textYPosition = yPosition + 18;
                const boxYPosition = yPosition + 6.5;
                
                return (
                  <g key={index}>
                    {/* Row background */}
                    <rect
                      x="0"
                      y={yPosition}
                      width="474"
                      height="36"
                      fill={index % 2 === 0 ? '#F9F9F9' : '#FFFFFF'}
                    />
                    
                    {/* Ordning text */}
                    <text
                      x="10"
                      y={textYPosition}
                      fontFamily="Oslo Sans"
                      fontWeight="300"
                      fontStyle="normal"
                      fontSize="12"
                      style={{ lineHeight: '20px' }}
                      letterSpacing="-0.2"
                      fill="#000000"
                      dominantBaseline="middle"
                    >
                      <tspan>{ordning.ordning.length > 45 ? ordning.ordning.substring(0, 42) + '...' : ordning.ordning}</tspan>
                    </text>
                    
                    {/* Overskrift box */}
                    <rect
                      x={ordning.overskrift === 'Enova' ? "353" : ordning.overskrift === 'Oslo kommune' ? "314" : "314"}
                      y={boxYPosition}
                      width={ordning.overskrift === 'Enova' ? "43" : ordning.overskrift === 'Oslo kommune' ? "82" : "82"}
                      height="23"
                      fill={getProviderColor(ordning.overskrift)}
                    />
                    
                    {/* Overskrift text */}
                    <text
                      x={ordning.overskrift === 'Enova' ? "374.5" : ordning.overskrift === 'Oslo kommune' ? "355" : "355"}
                      y={textYPosition}
                      fontFamily="Oslo Sans"
                      fontWeight="300"
                      fontStyle="normal"
                      fontSize="10"
                      style={{ lineHeight: '22px' }}
                      letterSpacing="-0.2"
                      fill="#000000"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {getOverskriftLabel(ordning.overskrift)}
                    </text>
                    
                    {/* Lenke text with click handler - moved left to avoid scrollbar */}
                    <text
                      x="425"
                      y={textYPosition}
                      fontFamily="Oslo Sans"
                      fontWeight="300"
                      fontStyle="normal"
                      fontSize="12"
                      style={{ lineHeight: '18.67px', cursor: 'pointer' }}
                      letterSpacing="-0.13"
                      fill="#000000"
                      textDecoration="underline"
                      dominantBaseline="middle"
                      
                      onClick={() => openExternalLink(ordning.lenke)}
                    >
                      Lenke
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </foreignObject>
        
        {/* "Relevante støtteordninger" text */}
        <text
          x="308"
          y="443"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontStyle="normal"
          fontSize="16"
          style={{ lineHeight: '24px' }}
          letterSpacing="-0.2"
          fill="#000000"
        >
          Relevante støtteordninger
        </text>
        
        {/* "Søk til" text */}
        <text
          x="640"
          y="443"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontStyle="normal"
          fontSize="16"
          style={{ lineHeight: '24px' }}
          letterSpacing="-0.2"
          fill="#000000"
        >
          Søk til
        </text>
        
        {/* "Les mer" text */}
        <text
          x="710"
          y="443"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontStyle="normal"
          fontSize="16"
          style={{ lineHeight: '24px' }}
          letterSpacing="-0.2"
          fill="#000000"
        >
          Les mer
        </text>
        
        {/* Fordeler heading */}
        {!showSourceTooltip && (
          <text
            x="565"
            y="20"
            fontFamily="Oslo Sans"
            fontWeight="700"
            fontStyle="normal"
            fontSize="18"
            style={{ lineHeight: '28px' }}
            letterSpacing="-0.2"
            fill="#000000"
            dominantBaseline="hanging"
          >
            Fordeler
          </text>
        )}
        
        {/* Back button positioned at same y as Tetting heading */}
        <g
          style={{ 
            cursor: 'pointer'
          }}
          transform="translate(738, -50)"
          onClick={() => onBack && onBack()}
        >
          <rect x="1" y="1" width="40" height="40" fill="#2A2859"/>
          <rect x="1" y="1" width="40" height="40" stroke="#2A2859" strokeWidth="2"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M18.1 23.0539L16.5 24.7472L11 18.8207L16.5 13L18.1 14.6933L15.3 17.6566H28.4H30.6V19.9849V21.3961V25.5938V27.005V29.3333H28.4H18.8397V27.005H28.4V25.5938V21.3961V19.9849H15.2L18.1 23.0539Z" fill="white"/>
        </g>
        
        {/* HTML Dropdown elements inside SVG with foreignObject */}
        <foreignObject x="60" y="625" width="720" height="1000">
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%' }}>
            {/* Permit Check Dropdown */}
            <div>
          <button
            onClick={() => setIsPermitOpen(!isPermitOpen)}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 16px',
              border: '2px solid #2A285980',
              borderRadius: '0',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'Oslo Sans',
              fontWeight: 500,
              fontSize: '14px',
              lineHeight: '22px',
              letterSpacing: '-0.2px',
              color: '#2A2859'
            }}
          >
            Sjekk om du må søke for å gjennomføre tiltaket
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none"
              style={{
                transform: isPermitOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.5s ease'
              }}
            >
              <path fillRule="evenodd" clipRule="evenodd" d="M12 14.56L4.7466 7.5L3.75 8.47002L12 16.5L20.25 8.47002L19.2534 7.5L12 14.56Z" fill="#2A2859"/>
            </svg>
          </button>
          <div style={{
              width: '100%',
              maxHeight: isPermitOpen ? '1000px' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.6s ease-in-out',
              border: isPermitOpen ? '2px solid #2A285980' : 'none',
              borderTop: 'none',
              background: 'white'
            }}>
            <div style={{
              padding: isPermitOpen ? '16px' : '0 16px',
              fontFamily: 'Oslo Sans',
              fontWeight: 300,
              fontSize: '14px',
              lineHeight: '22px',
              letterSpacing: '0px',
              color: '#000000',
              opacity: isPermitOpen ? 1 : 0,
              transition: `opacity ${isPermitOpen ? '0.4s' : '0.1s'} ease-in-out ${isPermitOpen ? '0.2s' : '0s'}, padding 0.6s ease-in-out`
            }}>
              {/* Søknadsplikt-tekst fra JSON */}
              {accordionBody.map((paragraph, index) => (
                <p key={`soknadsplikt-${index}`} style={{ margin: index === accordionBody.length - 1 ? 0 : '0 0 16px 0' }}>
                  {paragraph}
                </p>
              ))}

              {/* Links section */}
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {accordionLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontFamily: 'Oslo Sans',
                      fontWeight: 300,
                      fontSize: '14px',
                      lineHeight: '22px',
                      letterSpacing: '0px',
                      color: '#2A2859',
                      textDecoration: 'underline'
                    }}
                  >
                    {link.label}
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginLeft: '8px', flexShrink: 0 }}>
                      <path d="M12.9546 11.8742V13.033H5.0459V5.16359H6.20465V4.03859H5.0459V4.03297H3.9209V14.158H14.0796V11.8742H12.9546Z" fill="#2A2859"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M10.1253 4.02734V5.15234H12.1615L8.07777 9.24734L8.85402 10.0292L12.9434 5.92859V7.97047H14.0796V4.02734H10.1253Z" fill="#2A2859"/>
                    </svg>
                  </a>
                ))}
              </div>

              {/* Rectangle with general permit information (same for all tiltak) */}
              <div style={{
                marginTop: '16px',
                padding: '16px',
                backgroundColor: '#2A2859'
              }}>
                <h3 style={{
                  fontFamily: 'Oslo Sans',
                  fontWeight: 700,
                  fontSize: '16px',
                  lineHeight: '24px',
                  letterSpacing: '-0.2px',
                  color: '#FFFFFF',
                  margin: '0 0 12px 0'
                }}>
                  Søknadsplikt er ikke en stopper, men en støtte
                </h3>
                <p style={{
                  fontFamily: 'Oslo Sans',
                  fontWeight: 300,
                  fontSize: '14px',
                  lineHeight: '22px',
                  letterSpacing: '0px',
                  color: '#FFFFFF',
                  margin: 0
                }}>
                  Er tiltaket ditt <GlossaryTerm term="søknadspliktig" glossary={glossary} hoveredTerm={hoveredWord} setHoveredTerm={setHoveredWord}>søknadspliktig</GlossaryTerm> betyr det at Plan- og bygningsetaten må godkjenne arbeidet før du setter i gang. Det handler ikke om å stoppe deg, men om å sikre at tiltaket planlegges og utføres med riktig kvalitet.
                </p>
                <p style={{
                  fontFamily: 'Oslo Sans',
                  fontWeight: 300,
                  fontSize: '14px',
                  lineHeight: '22px',
                  letterSpacing: '0px',
                  color: '#FFFFFF',
                  margin: '16px 0 0 0'
                }}>
                  Søknadsplikten skal hjelpe deg som <GlossaryTerm term="tiltakshaver" glossary={glossary} hoveredTerm={hoveredWord} setHoveredTerm={setHoveredWord}>tiltakshaver</GlossaryTerm> med å få det resultatet du ønsker – trygt og effektivt. I mer komplekse prosjekter kan kommunen kreve <GlossaryTerm term="ansvarlig foretak" glossary={glossary} hoveredTerm={hoveredWord} setHoveredTerm={setHoveredWord}>ansvarlige foretak</GlossaryTerm> som tar faglig ansvar for prosjektering og utførelse.
                </p>
                <p style={{
                  fontFamily: 'Oslo Sans',
                  fontWeight: 300,
                  fontSize: '14px',
                  lineHeight: '22px',
                  letterSpacing: '0px',
                  color: '#FFFFFF',
                  margin: '16px 0 0 0'
                }}>
                  Selv om du må søke, kan selve tiltaket fortsatt være enkelt å gjennomføre. Ta dialogen tidlig og bruk veiledningstilbudene dersom du er usikker.
                </p>
              </div>
                </div>
              </div>
            </div>
          </div>
        </foreignObject>
        
        {/* Source tooltip - moved to end for proper z-order */}
        {showSourceTooltip && (
          <foreignObject x="565" y="30" width="211" height="430"
            onMouseEnter={() => setShowSourceTooltip(true)}
            onMouseLeave={() => setShowSourceTooltip(false)}
          >
            <div 
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                backgroundColor: '#034B45',
                padding: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                width: '100%',
                boxSizing: 'border-box',
                height: '354px'
              }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}>
                <h4 style={{
                  fontFamily: 'Oslo Sans',
                  fontWeight: 700,
                  fontStyle: 'normal',
                  fontSize: '16px',
                  lineHeight: '24px',
                  letterSpacing: '-0.2px',
                  color: '#FFFFFF',
                  margin: 0
                }}>
                  Kilde
                </h4>
                <button
                  onClick={() => setShowSourceTooltip(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginTop: '-4px',
                    marginRight: '-4px'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6L18 18" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <p style={{
                fontFamily: 'Oslo Sans',
                fontWeight: 300,
                fontSize: '14px',
                lineHeight: '22px',
                letterSpacing: '0px',
                color: '#FFFFFF',
                margin: 0
              }}>
                {resolvedTiltakContent?.energySourceDescription ?? 'Besparelsene estimeres fra datasett basert på bygningstype, bruksareal og teknisk forskrift. Disse variablene hentes automatisk fra Matrikkelen, utenom TEK som estimeres ut fra byggeår. Dette er en forenkling som ikke tar hensyn til tidligere oppgraderinger av bygget. Strømprisen er satt til 1.1kr/kWh.'}
              </p>
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
};

export const IsoleringAvKjellerOgLoft: React.FC<IsoleringAvKjellerOgLoftProps> = (props) => (
  <IsoleringAvKjellerOgLoftContentComponent {...props} audience={props.audience ?? 'standard'} />
);

export { IsoleringAvKjellerOgLoftContentComponent };
