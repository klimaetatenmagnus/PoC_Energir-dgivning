import React from 'react';
import '../styles/components.css';

interface BuildingData {
  adresse?: string;
  gnr: number;
  bnr: number;
  seksjonsnummer?: number;
  bruksarealM2?: number;
  totalBygningsareal?: number;
  byggeaar?: number;
  bygningstype?: string;
  bygningstypeKode?: string;
  bygningstypeKodeId?: number;
  energiattest?: {
    energikarakter?: string;
    oppvarmingskarakter?: string;
    utstedelsesdato?: string;
    attestnummer?: string;
    attestUrl?: string;
  };
  representasjonspunkt?: {
    east: number;
    north: number;
    epsg: string;
  };
  rapporteringsNivaa?: string;
  bygningsnummer?: string;
}

interface ResultsTableProps {
  data: BuildingData;
  searchAddress: string;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ data, searchAddress }) => {
  const formatNumber = (num?: number): string => {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString('nb-NO');
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('nb-NO');
    } catch {
      return dateStr;
    }
  };

  const getEnergyBadgeClass = (karakter?: string): string => {
    if (!karakter) return '';
    return `results-table__energy-badge results-table__energy-badge--${karakter.toUpperCase()}`;
  };

  return (
    <div className="results-table">
      <table className="results-table__table">
        <thead className="results-table__header">
          <tr>
            <th className="results-table__header-cell">Egenskap</th>
            <th className="results-table__header-cell">Verdi</th>
          </tr>
        </thead>
        <tbody>
          <tr className="results-table__row">
            <td className="results-table__cell"><strong>Adresse</strong></td>
            <td className="results-table__cell">{searchAddress}</td>
          </tr>
          
          <tr className="results-table__row">
            <td className="results-table__cell"><strong>Matrikkel</strong></td>
            <td className="results-table__cell">
              GNR: {data.gnr}, BNR: {data.bnr}
              {data.seksjonsnummer && `, SNR: ${data.seksjonsnummer}`}
            </td>
          </tr>

          <tr className="results-table__row">
            <td className="results-table__cell"><strong>Byggeår</strong></td>
            <td className="results-table__cell">{data.byggeaar || '-'}</td>
          </tr>

          <tr className="results-table__row">
            <td className="results-table__cell"><strong>Bruksareal</strong></td>
            <td className="results-table__cell">
              {data.rapporteringsNivaa === 'seksjon' && data.totalBygningsareal && 
               data.bruksarealM2 !== data.totalBygningsareal ? (
                <>
                  Seksjon: {formatNumber(data.bruksarealM2)} m²<br />
                  Totalt bygg: {formatNumber(data.totalBygningsareal)} m²
                </>
              ) : data.totalBygningsareal && data.bruksarealM2 === data.totalBygningsareal ? (
                <>
                  {formatNumber(data.bruksarealM2)} m²<br />
                  <small>(Kun totalareal tilgjengelig)</small>
                </>
              ) : (
                `${formatNumber(data.bruksarealM2)} m²`
              )}
            </td>
          </tr>

          <tr className="results-table__row">
            <td className="results-table__cell"><strong>Bygningstype</strong></td>
            <td className="results-table__cell">
              {data.bygningstype || '-'}
              {data.bygningstypeKode && ` (${data.bygningstypeKode})`}
            </td>
          </tr>

          {data.bygningsnummer && (
            <tr className="results-table__row">
              <td className="results-table__cell"><strong>Bygningsnummer</strong></td>
              <td className="results-table__cell">{data.bygningsnummer}</td>
            </tr>
          )}

          {data.energiattest && (
            <>
              <tr className="results-table__row">
                <td className="results-table__cell"><strong>Energikarakter</strong></td>
                <td className="results-table__cell">
                  {data.energiattest.energikarakter ? (
                    <span className={getEnergyBadgeClass(data.energiattest.energikarakter)}>
                      {data.energiattest.energikarakter}
                    </span>
                  ) : '-'}
                  {data.energiattest.oppvarmingskarakter && (
                    <>
                      {' / Oppvarming: '}
                      <span className={getEnergyBadgeClass(data.energiattest.oppvarmingskarakter)}>
                        {data.energiattest.oppvarmingskarakter}
                      </span>
                    </>
                  )}
                </td>
              </tr>
              
              {data.energiattest.utstedelsesdato && (
                <tr className="results-table__row">
                  <td className="results-table__cell"><strong>Energiattest utstedt</strong></td>
                  <td className="results-table__cell">
                    {formatDate(data.energiattest.utstedelsesdato)}
                    {data.energiattest.attestUrl && (
                      <>
                        {' '}
                        <a 
                          href={data.energiattest.attestUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ marginLeft: '8px' }}
                        >
                          Se attest →
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </>
          )}

          {data.representasjonspunkt && (
            <tr className="results-table__row">
              <td className="results-table__cell"><strong>Koordinater</strong></td>
              <td className="results-table__cell">
                Øst: {formatNumber(Math.round(data.representasjonspunkt.east))}, 
                Nord: {formatNumber(Math.round(data.representasjonspunkt.north))}
                <br />
                <small>({data.representasjonspunkt.epsg})</small>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};