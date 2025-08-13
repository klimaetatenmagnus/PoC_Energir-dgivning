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
  const [showOriginalText, setShowOriginalText] = React.useState(true);
  const [showHoverText, setShowHoverText] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const timeoutRefs = React.useRef<NodeJS.Timeout[]>([]);
  
  React.useEffect(() => {
    if (onHoverChange) {
      onHoverChange(isHovered);
    }
  }, [isHovered, onHoverChange]);

  React.useEffect(() => {
    // Clear all existing timeouts
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current = [];

    if (isHovered) {
      // Start animation sequence
      // 1. Fade out original text
      setShowOriginalText(false);
      
      // 2. Start expanding after text fades out
      const expandTimeout = setTimeout(() => {
        setIsExpanded(true);
      }, 200);
      timeoutRefs.current.push(expandTimeout);
      
      // 3. Fade in hover text after expansion starts
      const textTimeout = setTimeout(() => {
        if (isHovered) { // Double check we're still hovered
          setShowHoverText(true);
        }
      }, 400);
      timeoutRefs.current.push(textTimeout);
    } else {
      // Reverse animation sequence
      // 1. Immediately fade out hover text
      setShowHoverText(false);
      
      // 2. Start shrinking after text fades out
      const shrinkTimeout = setTimeout(() => {
        setIsExpanded(false);
      }, 200);
      timeoutRefs.current.push(shrinkTimeout);
      
      // 3. Fade in original text after shrinking starts
      const originalTextTimeout = setTimeout(() => {
        setShowOriginalText(true);
      }, 400);
      timeoutRefs.current.push(originalTextTimeout);
    }

    // Cleanup function
    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current = [];
    };
  }, [isHovered]);
  
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
          width: growFullCircle && isExpanded ? expandedSize : '230px',
          height: growFullCircle && isExpanded ? expandedSize : (isExpanded && !growFullCircle ? expandedHeight : '230px'),
          borderRadius: growFullCircle ? '50%' : (isExpanded ? '115px' : '50%'),
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
          left: growFullCircle && isExpanded ? '30px' : '20px',
          right: growFullCircle && isExpanded ? '30px' : '20px',
          width: growFullCircle && isExpanded ? '340px' : '190px',
          height: isExpanded ? 'calc(100% - 80px)' : '116px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isExpanded ? 'center' : 'center',
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
              opacity: showOriginalText ? 1 : 0,
              transition: 'opacity 0.2s ease',
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
                opacity: showHoverText ? 1 : 0,
                transition: 'opacity 0.2s ease',
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