import React from 'react';
import '../styles/components.css';

interface LoadingSpinnerProps {
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  text = 'Laster...' 
}) => {
  return (
    <div className="loading-spinner" role="status" aria-live="polite">
      <div className="loading-spinner__animation" aria-hidden="true"></div>
      <div className="loading-spinner__text">{text}</div>
    </div>
  );
};