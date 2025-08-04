import React from 'react';
import { Pil } from './Ikoner';

interface CircleWithHoverProps {
  number: number;
  text: string;
  hoverText?: React.ReactNode;
  icon?: React.ReactNode;
  iconStyle?: React.CSSProperties;
  growFullCircle?: boolean; // New prop to control growth behavior
  onHoverChange?: (isHovered: boolean) => void; // Callback for hover state changes
  extraLarge?: boolean; // For circles with extra long text
  expandUpwards?: boolean; // Expand upwards for bottom circles
}

export const CircleWithHover: React.FC<CircleWithHoverProps> = ({ 
  number, 
  text,
  hoverText,
  icon,
  iconStyle,
  growFullCircle = false,
  onHoverChange,
  extraLarge = false,
  expandUpwards = false
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  
  React.useEffect(() => {
    if (onHoverChange) {
      onHoverChange(isHovered);
    }
  }, [isHovered, onHoverChange]);
  
  // Calculate dimensions based on hover text length and growth type
  const expandedHeight = hoverText && typeof hoverText === 'string' && hoverText.length > 200 ? '350px' : '300px';
  // All circles expand to same size (400px)
  const expandedSize = growFullCircle ? '400px' : '230px'; // Width for full circle growth
  
  return (
    <div style={{
      width: '230px',
      height: '230px',
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      {/* Icon behind circle if provided */}
      {icon && (
        <div style={{
          position: 'absolute',
          ...iconStyle,
          zIndex: 1
        }}>
          {icon}
        </div>
      )}
      
      {/* Circle */}
      <div 
        style={{
          width: growFullCircle && isHovered ? expandedSize : '230px',
          height: growFullCircle && isHovered ? expandedSize : (isHovered && !growFullCircle ? expandedHeight : '230px'),
          borderRadius: growFullCircle ? '50%' : (isHovered ? '115px' : '50%'),
          backgroundColor: '#C7F6C9',
          position: 'absolute',
          top: expandUpwards ? 'auto' : '50%',
          bottom: expandUpwards ? '0' : 'auto',
          left: '50%',
          transform: expandUpwards ? 'translateX(-50%)' : 'translate(-50%, -50%)',
          zIndex: 2,
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Text box */}
        <div style={{
          position: 'absolute',
          top: '48px',
          left: growFullCircle && isHovered ? '30px' : '20px',
          right: growFullCircle && isHovered ? '30px' : '20px',
          width: growFullCircle && isHovered ? '340px' : '190px',
          height: isHovered ? 'calc(100% - 80px)' : '116px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isHovered ? 'center' : 'center',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            fontFamily: 'Oslo Sans, sans-serif',
            fontWeight: 500,
            fontStyle: 'normal',
            fontSize: '18px',
            lineHeight: '28px',
            letterSpacing: '-0.2px',
            textAlign: 'center',
            color: '#2A2859',
            position: 'relative',
            width: '100%',
            height: '100%'
          }}>
            {/* Default state text */}
            <div style={{
              opacity: isHovered ? 0 : 1,
              transition: 'opacity 0.3s ease',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%'
            }}>
              <div>{number}.</div>
              <div>{text}</div>
            </div>
            
            {/* Hover state text */}
            {hoverText && (
              <div style={{
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.3s ease',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <div style={{
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '18px',
                  lineHeight: '28px',
                  letterSpacing: '-0.2px',
                  textAlign: 'center',
                  color: '#2A2859',
                  marginBottom: '10px'
                }}>
                  {number}. {text}
                </div>
                <div style={{
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontWeight: 300,
                  fontStyle: 'normal',
                  fontSize: '14px',
                  lineHeight: '22px',
                  letterSpacing: '0px',
                  textAlign: 'center',
                  color: '#2A2859',
                  padding: '0 15px'
                }}>
                  {hoverText}
                </div>
              </div>
            )}
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
  );
};