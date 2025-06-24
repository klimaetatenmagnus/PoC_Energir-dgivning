import React, { useState, useEffect } from 'react';
import '../styles/components.css';

interface ErrorDisplayProps {
  error: Error | string;
  type?: 'error' | 'warning';
  onRetry?: () => void;
  context?: Record<string, any>;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
  error, 
  type = 'error',
  onRetry,
  context 
}) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Logger feilen med kontekst
  useEffect(() => {
    const logLevel = type === 'error' ? 'error' : 'warn';
    console[logLevel]('[ErrorDisplay]', {
      message: errorMessage,
      stack: errorStack,
      context,
      timestamp: new Date().toISOString()
    });
  }, [errorMessage, errorStack, context, type]);

  // Brukervenlig feilmelding basert på type
  const getUserFriendlyMessage = () => {
    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      return 'Kunne ikke koble til serveren. Sjekk internettforbindelsen din.';
    }
    if (errorMessage.includes('timeout')) {
      return 'Forespørselen tok for lang tid. Prøv igjen.';
    }
    if (errorMessage.includes('404')) {
      return 'Fant ingen bygningsdata for denne adressen.';
    }
    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      return 'Du har ikke tilgang til denne tjenesten.';
    }
    if (errorMessage.includes('500')) {
      return 'Det oppstod en feil på serveren. Prøv igjen senere.';
    }
    return errorMessage;
  };

  return (
    <div className={`error-display error-display--${type}`} role="alert">
      <div className="error-display__header">
        <h3 className="error-display__title">
          {type === 'error' ? '❌ Feil' : '⚠️ Advarsel'}
        </h3>
        {(errorStack || context) && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="error-display__toggle"
            aria-expanded={showDetails}
          >
            {showDetails ? 'Skjul detaljer' : 'Vis detaljer'}
          </button>
        )}
      </div>
      
      <p className="error-display__message">
        {getUserFriendlyMessage()}
      </p>
      
      {showDetails && (
        <div className="error-display__details">
          <strong>Tekniske detaljer:</strong>
          <pre>
            {JSON.stringify({
              message: errorMessage,
              stack: errorStack,
              context,
              timestamp: new Date().toISOString()
            }, null, 2)}
          </pre>
        </div>
      )}
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="error-display__retry"
        >
          Prøv på nytt
        </button>
      )}
    </div>
  );
};