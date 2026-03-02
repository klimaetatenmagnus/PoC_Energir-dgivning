import React from 'react';

interface StepCardProps {
  number: number;
  text: string;
  hoverText?: React.ReactNode | null;
  icon?: React.ReactNode;
}

export const StepCard: React.FC<StepCardProps> = ({ number, text, hoverText, icon }) => {
  return (
    <div className="prosessen-videre__step">
      {icon && (
        <div className="prosessen-videre__step-icon">
          {icon}
        </div>
      )}

      {/* Layer 1: resting circle */}
      <div className="prosessen-videre__step-circle">
        <span className="pkt-txt-18-medium">{number}.</span>
        <span className="pkt-txt-18-medium">{text}</span>
      </div>

      {/* Layer 2: expanded card – always at final size, crossfades in on hover */}
      {hoverText && (
        <div className="prosessen-videre__step-card">
          <span className="prosessen-videre__step-card-title pkt-txt-18-medium">
            {number}. {text}
          </span>
          <span className="prosessen-videre__step-card-body pkt-txt-14-light">
            {hoverText}
          </span>
        </div>
      )}
    </div>
  );
};
