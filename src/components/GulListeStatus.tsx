/**
 * React-komponent for å vise Gul Liste status
 */

import React, { useState, useEffect } from 'react';

interface GulListeStatusProps {
  adresse?: string;
  gnr?: number;
  bnr?: number;
  onStatusChange?: (erPaaGulListe: boolean) => void;
}

interface GulListeResult {
  erPaaGulListe: boolean;
  teigid?: string;
  gnr?: number;
  bnr?: number;
  navn?: string;
  kategori?: string;
  vernestatus?: string;
  adresse?: string;
  error?: string;
}

export const GulListeStatus: React.FC<GulListeStatusProps> = ({
  adresse,
  gnr,
  bnr,
  onStatusChange
}) => {
  const [status, setStatus] = useState<GulListeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (adresse || (gnr && bnr)) {
      sjekkGulListe();
    }
  }, [adresse, gnr, bnr]);

  const sjekkGulListe = async () => {
    setLoading(true);
    setError(null);

    try {
      let response;
      
      if (adresse) {
        // Sjekk med adresse
        response = await fetch('/api/gul-liste/sjekk-adresse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adresse })
        });
      } else if (gnr && bnr) {
        // Sjekk med GNR/BNR
        response = await fetch('/api/gul-liste/sjekk-gnr-bnr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gnr, bnr })
        });
      } else {
        throw new Error('Enten adresse eller GNR/BNR må oppgis');
      }

      if (!response.ok) {
        throw new Error('Feil ved henting av gul liste-status');
      }

      const result: GulListeResult = await response.json();
      setStatus(result);
      
      if (onStatusChange) {
        onStatusChange(result.erPaaGulListe);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjent feil');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="gul-liste-status loading">
        <span className="spinner">⏳</span> Sjekker gul liste-status...
      </div>
    );
  }

  if (error) {
    return (
      <div className="gul-liste-status error">
        <span className="icon">⚠️</span> {error}
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className={`gul-liste-status ${status.erPaaGulListe ? 'paa-liste' : 'ikke-paa-liste'}`}>
      {status.erPaaGulListe ? (
        <div className="gul-liste-info">
          <div className="status-header">
            <span className="icon">🏛️</span>
            <strong>Bygningen er på gul liste</strong>
          </div>
          {status.navn && (
            <div className="detail">
              <span className="label">Navn:</span> {status.navn}
            </div>
          )}
          {status.kategori && (
            <div className="detail">
              <span className="label">Kategori:</span> {status.kategori}
            </div>
          )}
          {status.vernestatus && (
            <div className="detail">
              <span className="label">Vernestatus:</span> {status.vernestatus}
            </div>
          )}
          {status.teigid && (
            <div className="detail small">
              <span className="label">Teigid:</span> {status.teigid}
            </div>
          )}
        </div>
      ) : (
        <div className="gul-liste-info">
          <div className="status-header">
            <span className="icon">✓</span>
            <span>Bygningen er ikke på gul liste</span>
          </div>
        </div>
      )}
    </div>
  );
};

// CSS som kan legges til i din stilfil
const styles = `
.gul-liste-status {
  padding: 12px;
  border-radius: 8px;
  margin: 10px 0;
  background: #f5f5f5;
  border: 1px solid #ddd;
}

.gul-liste-status.paa-liste {
  background: #fff3cd;
  border-color: #ffc107;
}

.gul-liste-status.ikke-paa-liste {
  background: #d4edda;
  border-color: #28a745;
}

.gul-liste-status.error {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.gul-liste-status.loading {
  background: #e9ecef;
  border-color: #6c757d;
  color: #495057;
  text-align: center;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 16px;
}

.gul-liste-info .detail {
  margin: 4px 0;
  padding-left: 28px;
}

.gul-liste-info .label {
  font-weight: 600;
  margin-right: 4px;
}

.gul-liste-info .small {
  font-size: 12px;
  color: #666;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;