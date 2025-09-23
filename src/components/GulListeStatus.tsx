import React from 'react';
import { useGulListeStatus } from '../hooks/useGulListeStatus';

interface GulListeStatusProps {
  adresse?: string;
  gnr?: number;
  bnr?: number;
  onStatusChange?: (erPaaGulListe: boolean) => void;
}

export const GulListeStatus: React.FC<GulListeStatusProps> = ({
  adresse,
  gnr,
  bnr,
  onStatusChange,
}) => {
  const { status, loading, error } = useGulListeStatus({
    adresse,
    gnr,
    bnr,
    onStatusChange,
  });

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

