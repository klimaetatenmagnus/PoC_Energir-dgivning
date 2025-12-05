import React, { useMemo, useState } from 'react';
import {
  getOverskriftColor,
  openExternalLink,
  TiltakComponentProps
} from './shared';
import type { Stotteordning } from '../../../../services/stotteordning-service';
import { useTiltakContent, useContentDictionary } from '../../../../hooks/contentHooks';
import { useGrantAwareStotteordninger } from './useGrantAwareStotteordninger';
import type {
  TiltakAccordionItem,
  TiltakContent
} from '../../../../../content/tiltak/schema';
import type { ContentAudience } from '../../../../../content/schema-helpers';
import { applyTiltakVariant, normaliseBuildingTypeKey } from '../../../../utils/tiltakContent';
import { renderParagraphWithGlossary, dictionaryTermsToGlossary } from './glossaryHelpers';

type TemperaturstyringProps = TiltakComponentProps;
type TemperaturstyringComponentProps = TiltakComponentProps & { audience?: ContentAudience };

type ReadMoreLink = {
  label: string;
  url: string;
};

type TemperaturstyringContentView = {
  title: string;
  introParagraphs: string[];
  buildingTypeParagraphs: Record<string, string[]>;
  benefits: { title: string; description: string }[];
  readMore: ReadMoreLink[];
  accordion: TiltakAccordionItem[];
  grants: string[];
};

function mapTemperaturstyringContent(content?: TiltakContent): TemperaturstyringContentView | null {
  if (!content) {
    return null;
  }

  return {
    title: content.title,
    introParagraphs: content.introParagraphs,
    buildingTypeParagraphs: content.buildingTypeParagraphs,
    benefits: content.benefits.map(({ title, description }) => ({
      title,
      description: description ?? ''
    })),
    readMore: content.readMore.map(({ label, url }) => ({ label, url })),
    accordion: content.accordion,
    grants: content.grants
  };
}

const TemperaturstyringContentComponent: React.FC<TemperaturstyringComponentProps> = ({
  onBack,
  buildingType,
  audience = 'standard'
}) => {
  const [isPermitOpen, setIsPermitOpen] = useState(false);
  const [hoveredGlossaryTerm, setHoveredGlossaryTerm] = useState<string | null>(null);
  const [showSourceTooltip, setShowSourceTooltip] = useState(false);

  const { data: tiltakContent, isLoading } = useTiltakContent('temperaturstyring');
  const { data: dictionary } = useContentDictionary();
  const resolvedTiltakContent = useMemo(
    () => applyTiltakVariant(tiltakContent, audience),
    [tiltakContent, audience]
  );
  const content = useMemo(
    () => mapTemperaturstyringContent(resolvedTiltakContent),
    [resolvedTiltakContent]
  );

  const buildingTypeKey = normaliseBuildingTypeKey(buildingType);
  const glossaryEntries = useMemo(
    () => dictionaryTermsToGlossary(dictionary?.glossaryTerms ?? []),
    [dictionary?.glossaryTerms]
  );

  // Hooks for støtteordninger - må være før tidlig return (React rules of hooks)
  const grantIds = content?.grants ?? [];
  const {
    stotteordninger,
    intendedSource,
    isLoading: grantLoading
  } = useGrantAwareStotteordninger({
    grantIds,
    legacyTiltakSlug: 'smart_energistyring',
    buildingType
  });

  // Tidlig return etter alle hooks
  if (isLoading || !content) {
    return (
      <div style={{ padding: '60px', fontFamily: 'Oslo Sans', color: '#2A2859' }}>
        Laster innhold...
      </div>
    );
  }

  const introParagraphs = content.introParagraphs;
  const buildingParagraphs =
    content.buildingTypeParagraphs[buildingTypeKey] ??
    content.buildingTypeParagraphs.default ??
    [];

  const benefits = content.benefits.slice(0, 4).map((b) => ({
    title: b.title || 'Fordel',
    description: b.description
  }));

  const readMoreLinks = content.readMore.slice(0, 3);

  const accordionItem = content.accordion[0];
  const accordionBody = accordionItem?.body ?? [];
  const accordionLinks = accordionItem?.links ?? [];

  const displayedStotteordninger: Stotteordning[] = stotteordninger.length
    ? stotteordninger
    : intendedSource === 'grants' && grantLoading
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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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

        <g
          style={{
            cursor: 'pointer'
          }}
          transform="translate(738, -50)"
          onClick={() => onBack && onBack()}
        >
          <rect x="1" y="1" width="40" height="40" fill="#2A2859" />
          <rect x="1" y="1" width="40" height="40" stroke="#2A2859" strokeWidth="2" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M18.1 23.0539L16.5 24.7472L11 18.8207L16.5 13L18.1 14.6933L15.3 17.6566H28.4H30.6V19.9849V21.3961V25.5938V27.005V29.3333H28.4H18.8397V27.005H28.4V25.5938V21.3961V19.9849H15.2L18.1 23.0539Z"
            fill="white"
          />
        </g>

        <foreignObject x="60" y="20" width="465" height="338">
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
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
            }}
          >
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
              <p key={`intro-${index}`} style={{ marginBottom: index === introParagraphs.length - 1 ? '20px' : '16px' }}>
                {paragraph}
              </p>
            ))}
            {buildingParagraphs.map((paragraph, index) => (
              <p key={`building-${index}`} style={{ marginBottom: '20px' }}>
                {paragraph}
              </p>
            ))}
          </div>
        </foreignObject>

        <rect x="565" y="60" width="155" height="30" fill="#C7F6C9" />
        <svg x="573" y="67" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4.5 0.5C4.5 0.5 4 1 4 1.5C4 2 4.5 2.5 4.5 2.5C4.5 2.5 5 2 5 1.5C5 1 4.5 0.5 4.5 0.5Z" fill="#2A2859" />
          <path d="M8 0.5C8 0.5 7.5 1 7.5 1.5C7.5 2 8 2.5 8 2.5C8 2.5 8.5 2 8.5 1.5C8.5 1 8 0.5 8 0.5Z" fill="#2A2859" />
          <path d="M11.5 0.5C11.5 0.5 11 1 11 1.5C11 2 11.5 2.5 11.5 2.5C11.5 2.5 12 2 12 1.5C12 1 11.5 0.5 11.5 0.5Z" fill="#2A2859" />
          <rect x="1" y="4" width="14" height="9" rx="2" fill="#2A2859" />
          <rect x="2" y="5" width="12" height="7" rx="1" fill="#C7F6C9" />
          <rect x="3.5" y="6" width="0.8" height="5" fill="#2A2859" />
          <rect x="5.5" y="6" width="0.8" height="5" fill="#2A2859" />
          <rect x="7.6" y="6" width="0.8" height="5" fill="#2A2859" />
          <rect x="9.7" y="6" width="0.8" height="5" fill="#2A2859" />
          <rect x="11.7" y="6" width="0.8" height="5" fill="#2A2859" />
          <rect x="3" y="13" width="1.5" height="2" fill="#2A2859" />
          <rect x="11.5" y="13" width="1.5" height="2" fill="#2A2859" />
        </svg>
        <text
          x="597"
          y="75"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontSize="14"
          style={{ lineHeight: '22px' }}
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="middle"
        >
          {benefits[0]?.title ?? 'Fordel'}
        </text>

        <rect x="565" y="106" width="155" height="30" fill="#C7F6C9" />
        <svg x="573" y="113" width="17" height="16" viewBox="0 0 17 16" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M5.42501 7.092C6.21251 6.3035 7.49451 6.304 8.28301 7.092L8.33251 7.1425L8.38251 7.0925C9.17051 6.3045 10.453 6.3045 11.241 7.0925C12.0285 7.88 12.0285 9.1625 11.241 9.9505L8.33301 12.8585L5.42501 9.95C4.63701 9.162 4.63701 7.88 5.42501 7.092ZM10.5345 7.799C10.136 7.401 9.48851 7.401 9.09001 7.799L8.33301 8.556L7.57601 7.7995C7.37701 7.6005 7.11551 7.501 6.85401 7.501C6.59251 7.501 6.33101 7.6005 6.13201 7.7995C5.73401 8.1975 5.73401 8.845 6.13201 9.2435L8.33301 11.4445L10.5345 9.243C10.9325 8.845 10.9325 8.197 10.5345 7.799Z"
            fill="#2A2859"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M5.65601 2.7305L8.33301 0.5L14.333 5.5V16H2.33301V1H5.22351L5.65601 2.7305ZM4.44251 2H3.33301V4.6665L4.80301 3.4415L4.44251 2ZM3.33301 5.9685V15H13.333V5.9685L8.33301 1.802L3.33301 5.9685Z"
            fill="#2A2859"
          />
        </svg>
        <text
          x="598"
          y="121"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontSize="14"
          style={{ lineHeight: '22px' }}
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="middle"
        >
          {benefits[1]?.title ?? 'Fordel'}
        </text>

        <rect x="565" y="152" width="183" height="30" fill="#C7F6C9" />
        <svg x="573" y="159" width="17" height="16" viewBox="0 0 17 16" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M9.16699 2.25C9.16699 0.9885 10.814 0 12.917 0C15.02 0 16.667 0.9885 16.667 2.25V11C16.667 12.2615 15.02 13.25 12.917 13.25C10.814 13.25 9.16699 12.2615 9.16699 11V2.25ZM12.917 12.25C14.4905 12.25 15.667 11.59 15.667 11V10.791C14.987 11.2285 14.016 11.5 12.917 11.5C11.818 11.5 10.847 11.2285 10.167 10.791V11C10.167 11.59 11.3435 12.25 12.917 12.25ZM12.917 10.5C14.4905 10.5 15.667 9.84 15.667 9.25V9.041C14.987 9.4785 14.016 9.75 12.917 9.75C11.818 9.75 10.847 9.4785 10.167 9.041V9.25C10.167 9.84 11.3435 10.5 12.917 10.5ZM12.917 8.75C14.4905 8.75 15.667 8.09 15.667 7.5V7.291C14.987 7.7285 14.016 8 12.917 8C11.818 8 10.847 7.7285 10.167 7.291V7.5C10.167 8.09 11.3435 8.75 12.917 8.75ZM12.917 7C14.4905 7 15.667 6.34 15.667 5.75V5.541C14.987 5.9785 14.016 6.25 12.917 6.25C11.818 6.25 10.847 5.9785 10.167 5.541V5.75C10.167 6.34 11.3435 7 12.917 7ZM12.917 5.25C14.4905 5.25 15.667 4.59 15.667 4V3.791C14.987 4.2285 14.016 4.5 12.917 4.5C11.818 4.5 10.847 4.2285 10.167 3.791V4C10.167 4.59 11.3435 5.25 12.917 5.25ZM10.167 2.25C10.167 2.84 11.3435 3.5 12.917 3.5C14.4905 3.5 15.667 2.84 15.667 2.25C15.667 1.66 14.4905 1 12.917 1C11.3435 1 10.167 1.66 10.167 2.25Z"
            fill="#2A2859"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M0.666992 8.5C0.666992 7.2385 2.31399 6.25 4.41699 6.25C6.51999 6.25 8.16699 7.2385 8.16699 8.5V13.75C8.16699 15.0115 6.51999 16 4.41699 16C2.31399 16 0.666992 15.0115 0.666992 13.75V8.5ZM4.41699 15C5.99099 15 7.16699 14.34 7.16699 13.75V13.541C6.48699 13.9785 5.51549 14.25 4.41699 14.25C3.31849 14.25 2.34699 13.9785 1.66699 13.541V13.75C1.66699 14.34 2.84299 15 4.41699 15ZM4.41699 13.25C5.99099 13.25 7.16699 12.59 7.16699 12V11.791C6.48699 12.2285 5.51549 12.5 4.41699 12.5C3.31849 12.5 2.34699 12.2285 1.66699 11.791V12C1.66699 12.59 2.84299 13.25 4.41699 13.25ZM4.41699 11.5C5.99099 11.5 7.16699 10.84 7.16699 10.25V10.041C6.48699 10.4785 5.51549 10.75 4.41699 10.75C3.31849 10.75 2.34699 10.4785 1.66699 10.041V10.25C1.66699 10.84 2.84299 11.5 4.41699 11.5ZM1.66699 8.5C1.66699 9.09 2.84299 9.75 4.41699 9.75C5.99099 9.75 7.16699 9.09 7.16699 8.5C7.16699 7.91 5.99099 7.25 4.41699 7.25C2.84299 7.25 1.66699 7.91 1.66699 8.5Z"
            fill="#2A2859"
          />
        </svg>
        <text
          x="598"
          y="167"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontSize="14"
          style={{ lineHeight: '22px' }}
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="middle"
        >
          {benefits[2]?.title ?? 'Fordel'}
        </text>

        <rect x="565" y="198" width="172" height="30" fill="#C7F6C9" />
        <svg x="573" y="205" width="16" height="16" viewBox="0 0 32 32" fill="none">
          <path
            fill="#2A2859"
            fillRule="evenodd"
            d="M10.169 2.377C11.868 1.423 13.842 1 16.012 1s4.144.423 5.843 1.377c1.706.958 3.078 2.42 4.084 4.401 1.539 3.032 1.228 5.892.182 8.472-.908 2.24-2.402 4.336-3.725 6.193l-.324.455v7.439L16 31l-5.59-1.682v-7.393q-.168-.214-.342-.43c-1.452-1.827-3.08-3.875-4.08-6.101-1.155-2.575-1.506-5.458.097-8.616 1.006-1.981 2.378-3.443 4.084-4.4m.91 1.635c-1.35.758-2.476 1.93-3.332 3.616-1.29 2.544-1.035 4.819-.058 6.997.896 1.995 2.367 3.848 3.838 5.701l.267.337h3.831q.069-.072.15-.162c.243-.27.55-.645.82-1.08.572-.921.81-1.821.445-2.553a5 5 0 0 0-.161-.298 4 4 0 0 1-.259.37c-.292.371-.68.714-1.182.894-.521.187-1.075.166-1.623-.04-1.078-.405-1.908-1.138-1.924-2.186-.016-.985.71-1.704 1.444-2.053.763-.363 1.747-.455 2.722-.101.16-.715.262-1.437.325-2.014a22 22 0 0 0 .09-1.044l.003-.058v-.016l.933.041.932.042v.008l-.002.02-.004.07q-.004.09-.016.255a24 24 0 0 1-.081.887c-.08.724-.22 1.694-.46 2.64q-.034.137-.072.277a6 6 0 0 1 1.004 1.469c.821 1.649.125 3.324-.531 4.382q-.08.128-.162.25h2.642l.22-.31c1.34-1.882 2.695-3.788 3.515-5.81.9-2.22 1.114-4.49-.117-6.915-.855-1.686-1.98-2.858-3.332-3.616-1.358-.763-3.001-1.14-4.932-1.14s-3.574.377-4.932 1.14m1.198 20.396v-1.873h7.93v1.873zm0 1.873v1.644l3.747 1.127 4.182-1.145V26.28zm2.88-10.503q.172-.219.325-.54l-.03-.012c-.508-.194-.988-.136-1.318.021-.304.145-.363.296-.375.33.024.057.148.252.711.464.185.07.282.05.34.03.076-.027.196-.102.347-.293"
            clipRule="evenodd"
          />
        </svg>
        <text
          x="597"
          y="213"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontSize="14"
          style={{ lineHeight: '22px' }}
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="middle"
        >
          {benefits[3]?.title ?? 'Fordel'}
        </text>

        <rect x="565" y="260" width="211" height="124" fill="#034B45" />
        <text x="589" y="284" width="149" height="24" fontFamily="Oslo Sans" fill="#FFFFFF" dominantBaseline="hanging">
          Årlig besparelse
        </text>
        <g>
          <rect
            x="728"
            y="280"
            width="24"
            height="24"
            fill="transparent"
            onMouseEnter={() => setShowSourceTooltip(true)}
            onMouseLeave={() => setShowSourceTooltip(false)}
            style={{ cursor: 'pointer' }}
          />
          <svg x="728" y="280" width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ pointerEvents: 'none' }}>
            <path d="M15.93 7.6C17.1356 7.5897 18.3022 8.02698 19.204 8.82721C20.1058 9.62744 20.6787 10.7337 20.8118 11.932C20.945 13.1303 20.6289 14.3354 19.9247 15.314C19.2206 16.2927 18.1785 16.9754 17 17.23H16.94V18.91H14.94V15.35H15.94C16.479 15.3516 17.0077 15.2019 17.4658 14.9179C17.924 14.634 18.2932 14.2271 18.5316 13.7437C18.77 13.2602 18.8679 12.7196 18.8142 12.1832C18.7606 11.6469 18.5574 11.1364 18.228 10.7098C17.8986 10.2831 17.456 9.95754 16.9507 9.76998C16.4453 9.58243 15.8975 9.54045 15.3695 9.64883C14.8415 9.75721 14.3545 10.0116 13.9639 10.383C13.5733 10.7545 13.2948 11.2281 13.16 11.75V11.92L11.16 11.53C11.3793 10.425 11.9741 9.42996 12.8436 8.71364C13.713 7.99731 14.8035 7.60384 15.93 7.6ZM16 3C13.4288 3 10.9154 3.76244 8.77759 5.1909C6.63975 6.61935 4.97351 8.64968 3.98957 11.0251C3.00563 13.4006 2.74818 16.0144 3.24979 18.5362C3.7514 21.0579 4.98953 23.3743 6.80761 25.1924C8.62569 27.0105 10.9421 28.2486 13.4638 28.7502C15.9856 29.2518 18.5994 28.9944 20.9749 28.0104C23.3503 27.0265 25.3806 25.3603 26.8091 23.2224C28.2376 21.0846 29 18.5712 29 16C29 12.5522 27.6304 9.24558 25.1924 6.80761C22.7544 4.36964 19.4478 3 16 3ZM16 1C18.9667 1 21.8668 1.87973 24.3336 3.52796C26.8003 5.17618 28.7229 7.51886 29.8582 10.2597C30.9935 13.0006 31.2906 16.0166 30.7118 18.9264C30.133 21.8361 28.7044 24.5088 26.6066 26.6066C24.5088 28.7044 21.8361 30.133 18.9264 30.7118C16.0166 31.2906 13.0006 30.9935 10.2597 29.8582C7.51886 28.7229 5.17618 26.8003 3.52796 24.3336C1.87973 21.8668 1 18.9667 1 16C1 12.0218 2.58035 8.20644 5.3934 5.3934C8.20644 2.58035 12.0218 1 16 1Z" fill="#FFFFFF" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M17.65 22.38C17.648 22.7197 17.5455 23.0513 17.3553 23.3328C17.1651 23.6144 16.8958 23.8333 16.5813 23.9619C16.2669 24.0906 15.9213 24.1232 15.5884 24.0557C15.2554 23.9882 14.9498 23.8236 14.7103 23.5827C14.4707 23.3418 14.3079 23.0353 14.2424 22.7019C14.1768 22.3685 14.2114 22.0232 14.3419 21.7095C14.4724 21.3958 14.6928 21.1277 14.9755 20.9392C15.2581 20.7506 15.5902 20.65 15.93 20.65C16.1567 20.65 16.3812 20.6948 16.5905 20.7819C16.7999 20.8689 16.9899 20.9965 17.1498 21.1573C17.3096 21.3181 17.4361 21.5089 17.522 21.7187C17.6078 21.9285 17.6513 22.1533 17.65 22.38Z"
              fill="#FFFFFF"
            />
          </svg>
        </g>

        {showSourceTooltip && (
          <foreignObject x="565" y="190" width="211" height="90">
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                backgroundColor: '#D1F9FF',
                padding: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                width: '100%',
                boxSizing: 'border-box'
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
                Kilde
              </h4>
              <p
                style={{
                  fontFamily: 'Oslo Sans',
                  fontWeight: 300,
                  fontSize: '14px',
                  lineHeight: '22px',
                  letterSpacing: '0px',
                  color: '#000000',
                  margin: 0
                }}
              >
                Oppdateres når energiberegninger er tilgjengelige for tiltaket.
              </p>
            </div>
          </foreignObject>
        )}

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
          Mangler data kWh
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
          Mangler data kr
        </text>

        <circle cx="170" cy="490" r="110" fill="#2A2859" />
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
        {readMoreLinks.map((link, index) => (
          <text
            key={`${link.label}-${index}`}
            x="170"
            y={502 + index * 24}
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
        ))}

        <rect x="298" y="450" width="482" height="2" fill="#CCCCCC" />
        <foreignObject x="298" y="452" width="482" height={needsScroll ? '144' : `${displayedStotteordninger.length * 36}`}>
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              width: '100%',
              height: '100%',
              overflowY: needsScroll ? 'auto' : 'hidden',
              overflowX: 'hidden',
              scrollbarWidth: 'thin',
              scrollbarColor: '#CCCCCC #F5F5F5'
            }}
          >
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
                  <g key={`${ordning.ordning ?? 'ukjent'}-${index}`}>
                    <rect x="0" y={yPosition} width="474" height="36" fill={index % 2 === 0 ? '#F9F9F9' : '#FFFFFF'} />
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
                      <tspan>
                        {(ordning.ordning ?? '').length > 45
                          ? `${ordning.ordning?.substring(0, 42)}...`
                          : ordning.ordning ?? 'Tilskudd'}
                      </tspan>
                    </text>
                    <rect
                      x={ordning.overskrift === 'Enova' ? '353' : ordning.overskrift === 'Oslo kommune' ? '314' : '314'}
                      y={boxYPosition}
                      width={ordning.overskrift === 'Enova' ? '43' : ordning.overskrift === 'Oslo kommune' ? '82' : '82'}
                      height="23"
                      fill={getOverskriftColor(ordning.overskrift)}
                    />
                    <text
                      x={ordning.overskrift === 'Enova' ? '374.5' : ordning.overskrift === 'Oslo kommune' ? '355' : '355'}
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
                      {ordning.overskrift === 'Klima- og energifondet' ? 'Oslo kommune' : ordning.overskrift ?? 'Ukjent'}
                    </text>
                    {ordning.lenke ? (
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
                        
                        onClick={() => openExternalLink(ordning.lenke!)}
                      >
                        Lenke
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        </foreignObject>

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

        <foreignObject x="60" y="590" width="720" height="1000">
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%' }}>
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
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 14.56L4.7466 7.5L3.75 8.47002L12 16.5L20.25 8.47002L19.2534 7.5L12 14.56Z" fill="#2A2859" />
                </svg>
              </button>
              <div
                style={{
                  width: '100%',
                  maxHeight: isPermitOpen ? '1000px' : '0',
                  overflow: 'hidden',
                  transition: 'max-height 0.6s ease-in-out',
                  border: isPermitOpen ? '2px solid #2A285980' : 'none',
                  borderTop: 'none',
                  background: '#FFFFFF'
                }}
              >
                <div
                  style={{
                    padding: isPermitOpen ? '16px' : '0 16px',
                    fontFamily: 'Oslo Sans',
                    fontWeight: 300,
                    fontSize: '14px',
                    lineHeight: '22px',
                    letterSpacing: '0px',
                    color: '#000000',
                    opacity: isPermitOpen ? 1 : 0,
                    transition: `opacity ${isPermitOpen ? '0.4s' : '0.1s'} ease-in-out ${isPermitOpen ? '0.2s' : '0s'}, padding 0.6s ease-in-out`
                  }}
                >
                  {/* Søknadsplikt-tekst fra JSON */}
                  {accordionBody.map((paragraph, index) => (
                    <p key={`soknadsplikt-${index}`} style={{ margin: index === accordionBody.length - 1 ? 0 : '0 0 16px 0' }}>
                      {paragraph}
                    </p>
                  ))}

                  {/* Links section */}
                  <div
                    style={{
                      marginTop: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
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
                          <path d="M12.9546 11.8742V13.033H5.0459V5.16359H6.20465V4.03859H5.0459V4.03297H3.9209V14.158H14.0796V11.8742H12.9546Z" fill="#2A2859" />
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M10.1253 4.02734V5.15234H12.1615L8.07777 9.24734L8.85402 10.0292L12.9434 5.92859V7.97047H14.0796V4.02734H10.1253Z"
                            fill="#2A2859"
                          />
                        </svg>
                      </a>
                    ))}
                  </div>
                  {/* Rectangle with general permit information (same for all tiltak) */}
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '16px',
                      backgroundColor: '#2A2859',
                      borderRadius: '8px'
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: 'Oslo Sans',
                        fontWeight: 700,
                        fontSize: '16px',
                        lineHeight: '24px',
                        letterSpacing: '-0.2px',
                        color: '#FFFFFF',
                        margin: '0 0 12px 0'
                      }}
                    >
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
                      Er tiltaket ditt søknadspliktig betyr det at Plan- og bygningsetaten må godkjenne arbeidet før du setter i gang. Det handler ikke om å stoppe deg, men om å sikre at tiltaket planlegges og utføres med riktig kvalitet.
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
                      Søknadsplikten skal hjelpe deg som tiltakshaver med å få det resultatet du ønsker – trygt og effektivt. I mer komplekse prosjekter kan kommunen kreve ansvarlige foretak som tar faglig ansvar for prosjektering og utførelse.
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
      </svg>
    </div>
  );
};

export const Temperaturstyring: React.FC<TemperaturstyringProps> = (props) => (
  <TemperaturstyringContentComponent {...props} audience="standard" />
);

export { TemperaturstyringContentComponent };
