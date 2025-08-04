import React from 'react';
import { Document, Blokk, PersonPresentingGraph, PersonPresentingQuestion, Shovel, Trees, Pil } from './Ikoner';

interface ProsessenVidereProps {
  showProcess: boolean;
  scaleFactor: number;
  onBack: () => void;
}

export const ProsessenVidere: React.FC<ProsessenVidereProps> = ({ 
  showProcess, 
  scaleFactor, 
  onBack 
}) => {
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: `translate(-50%, -50%) scale(${scaleFactor})`,
      transformOrigin: 'center',
      width: '1728px',
      height: '900px',
      zIndex: 10000,
      pointerEvents: 'none',
      opacity: showProcess ? 1 : 0,
      transition: 'opacity 0.5s ease-in-out 0.5s'
    }}>
      <div 
        style={{
          position: 'absolute',
          width: '100%',
          height: '85px',
          top: '30px',
          left: 0,
          pointerEvents: 'auto'
        }}
      >
        <div style={{
          position: 'absolute',
          left: 'calc(50% - 235.5px - 74px - 336px)',
          right: '40px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end'
        }}>
          <button
            className="back-button"
            onClick={onBack}
            style={{
              position: 'relative',
              background: 'transparent',
              border: '2px solid #F9F9F9',
              color: '#F9F9F9',
              padding: '11px 18px',
              fontFamily: 'Oslo Sans, sans-serif',
              fontWeight: 500,
              fontSize: '18px',
              lineHeight: '28px',
              letterSpacing: '-0.2px',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '0'
            }}
          >
            <span style={{ marginRight: 'auto' }}>Tilbake</span>
            <svg 
              width="24" 
              height="29" 
              viewBox="0 0 24 29" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              style={{ marginLeft: '18px', marginRight: '18px' }}
            >
              <path fillRule="evenodd" clipRule="evenodd" d="M9.09996 16.5539L7.49995 18.2472L2 12.3207L7.49995 6.5L9.09996 8.19329L6.29999 11.1566H19.4H21.6V13.4849V14.8961V19.0938V20.505V22.8333H19.4H9.8397V20.505H19.4V19.0938V14.8961V13.4849H6.19999L9.09996 16.5539Z" fill="white"/>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Blokk icon - adjusted to maintain spacing from 15px bottom */}
      <div style={{
        position: 'absolute',
        bottom: '631px',
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none'
      }}>
        <Blokk />
      </div>
      
      {/* Document icon - adjusted to maintain spacing from 15px bottom */}
      <div style={{
        position: 'absolute',
        bottom: '139px',
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none'
      }}>
        <Document />
      </div>
      
      {/* All circles positioned vertically, centered horizontally - 15px from bottom */}
      <div style={{
        position: 'absolute',
        bottom: '15px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '214px',
        alignItems: 'center',
        pointerEvents: 'none'
      }}>
        {/* First row of circles (bottom row) */}
        <div style={{
          display: 'flex',
          gap: '250px',
          alignItems: 'center'
        }}>
          {/* Left circle with PersonPresentingQuestion icon */}
          <div style={{
            width: '230px',
            height: '230px',
            position: 'relative'
          }}>
            {/* PersonPresentingQuestion icon - 141px above bottom of circle */}
            <div style={{
              position: 'absolute',
              bottom: '141px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1
            }}>
              <PersonPresentingQuestion />
            </div>
            {/* Circle */}
            <div style={{
              width: '230px',
              height: '230px',
              borderRadius: '50%',
              backgroundColor: '#C7F6C9',
              position: 'relative',
              zIndex: 2
            }}>
              {/* Text box */}
              <div style={{
                position: 'absolute',
                top: '48px',
                left: '35px',
                right: '35px',
                width: '160px',
                height: '116px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '18px',
                  lineHeight: '28px',
                  letterSpacing: '-0.2px',
                  textAlign: 'center',
                  color: '#2A2859'
                }}>
                  <div>4.</div>
                  <div>Sjekk om tiltaket er søknadspliktig</div>
                </div>
              </div>
              {/* Pil icon - 12px above bottom */}
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 3
              }}>
                <Pil />
              </div>
            </div>
          </div>
          
          {/* Center circle (original first circle) */}
          <div style={{
            width: '230px',
            height: '230px',
            borderRadius: '50%',
            backgroundColor: '#C7F6C9',
            position: 'relative'
          }}>
            {/* Text box */}
            <div style={{
              position: 'absolute',
              top: '48px',
              left: '35px',
              right: '35px',
              width: '160px',
              height: '116px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                fontFamily: 'Oslo Sans, sans-serif',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '18px',
                lineHeight: '28px',
                letterSpacing: '-0.2px',
                textAlign: 'center',
                color: '#2A2859'
              }}>
                <div>5.</div>
                <div>Undersøk støtteordninger</div>
              </div>
            </div>
            {/* Pil icon - 12px above bottom */}
            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 3
            }}>
              <Pil />
            </div>
          </div>
          
          {/* Right circle with Shovel icon */}
          <div style={{
            width: '230px',
            height: '230px',
            position: 'relative'
          }}>
            {/* Shovel icon - 174.5px from bottom, 53px from left */}
            <div style={{
              position: 'absolute',
              bottom: '174.5px',
              left: '53px',
              zIndex: 1
            }}>
              <Shovel />
            </div>
            {/* Circle */}
            <div style={{
              width: '230px',
              height: '230px',
              borderRadius: '50%',
              backgroundColor: '#C7F6C9',
              position: 'relative',
              zIndex: 2
            }}>
              {/* Text box */}
              <div style={{
                position: 'absolute',
                top: '48px',
                left: '35px',
                right: '35px',
                width: '160px',
                height: '116px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '18px',
                  lineHeight: '28px',
                  letterSpacing: '-0.2px',
                  textAlign: 'center',
                  color: '#2A2859'
                }}>
                  <div>6.</div>
                  <div>Gjennomfør arbeidene</div>
                </div>
              </div>
              {/* Pil icon - 12px above bottom */}
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 3
              }}>
                <Pil />
              </div>
            </div>
          </div>
        </div>
        
        {/* Second row of circles (top row) - 214px above the first */}
        <div style={{
          display: 'flex',
          gap: '250px',
          alignItems: 'center'
        }}>
          {/* Left circle with Trees icon */}
          <div style={{
            width: '230px',
            height: '230px',
            position: 'relative'
          }}>
            {/* Trees icon - 197px above bottom of circle */}
            <div style={{
              position: 'absolute',
              bottom: '192.5px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1
            }}>
              <Trees />
            </div>
            {/* Circle */}
            <div style={{
              width: '230px',
              height: '230px',
              borderRadius: '50%',
              backgroundColor: '#C7F6C9',
              position: 'relative',
              zIndex: 2
            }}>
              {/* Text box */}
              <div style={{
                position: 'absolute',
                top: '48px',
                left: '35px',
                right: '35px',
                width: '160px',
                height: '116px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '18px',
                  lineHeight: '28px',
                  letterSpacing: '-0.2px',
                  textAlign: 'center',
                  color: '#2A2859'
                }}>
                  <div>1.</div>
                  <div>Bruk det du har, oppgrader når det trengs</div>
                </div>
              </div>
              {/* Pil icon - 12px above bottom */}
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 3
              }}>
                <Pil />
              </div>
            </div>
          </div>
          
          {/* Center circle (original second circle) */}
          <div style={{
            width: '230px',
            height: '230px',
            borderRadius: '50%',
            backgroundColor: '#C7F6C9',
            position: 'relative'
          }}>
            {/* Text box */}
            <div style={{
              position: 'absolute',
              top: '48px',
              left: '35px',
              right: '35px',
              width: '160px',
              height: '116px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                fontFamily: 'Oslo Sans, sans-serif',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '18px',
                lineHeight: '28px',
                letterSpacing: '-0.2px',
                textAlign: 'center',
                color: '#2A2859'
              }}>
                <div>2.</div>
                <div>Skaff deg oversikt over boligen</div>
              </div>
            </div>
            {/* Pil icon - 12px above bottom */}
            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 3
            }}>
              <Pil />
            </div>
          </div>
          
          {/* Right circle with PersonPresentingGraph icon */}
          <div style={{
            width: '230px',
            height: '230px',
            position: 'relative'
          }}>
            {/* PersonPresentingGraph icon - 82px above bottom of circle */}
            <div style={{
              position: 'absolute',
              bottom: '82px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1
            }}>
              <PersonPresentingGraph />
            </div>
            {/* Circle in front of icon */}
            <div style={{
              width: '230px',
              height: '230px',
              borderRadius: '50%',
              backgroundColor: '#C7F6C9',
              position: 'relative',
              zIndex: 2
            }}>
              {/* Text box */}
              <div style={{
                position: 'absolute',
                top: '48px',
                left: '35px',
                right: '35px',
                width: '160px',
                height: '116px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '18px',
                  lineHeight: '28px',
                  letterSpacing: '-0.2px',
                  textAlign: 'center',
                  color: '#2A2859'
                }}>
                  <div>3.</div>
                  <div>Planlegg helhetlig</div>
                </div>
              </div>
              {/* Pil icon - 12px above bottom */}
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 3
              }}>
                <Pil />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Additional content for "Prosessen videre" can be added here later */}
      {/* For example: information cards, next steps, etc. */}
    </div>
  );
};