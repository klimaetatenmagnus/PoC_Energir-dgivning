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
  csvData?: {
    bygningsNr: string;
    bruksarealTotalt: number;
    bygningstype3siffer: string;
    bygningstypeNavn: string;
    tattIBrukDato: string;
    gateAdresse: string;
    bydelsnavn: string;
    antallEtasjer: number;
    bygningsstatusNavn: string;
  };
  // Solenergi-data
  takAreal_m2?: number | null;
  sol_kwh_m2_yr?: number | null;
  sol_kwh_bygg_tot?: number | null;
  solKategori?: string | null;
  takflater?: Array<{
    tak_id: number;
    bygg_id?: number;
    area_m2: number;
    irr_kwh_m2_yr: number;
    kWh_tot: number;
  }> | null;
  filteredSolarEnergy?: number;
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

          {/* Solenergi-data */}
          {(data.takAreal_m2 || data.sol_kwh_m2_yr || data.sol_kwh_bygg_tot) && (
            <>
              <tr className="results-table__row">
                <td className="results-table__cell"><strong>Takareal</strong></td>
                <td className="results-table__cell">
                  {data.takAreal_m2 ? `${formatNumber(Math.round(data.takAreal_m2))} m²` : '-'}
                </td>
              </tr>
              
              <tr className="results-table__row">
                <td className="results-table__cell"><strong>Solinnstråling</strong></td>
                <td className="results-table__cell">
                  {data.sol_kwh_m2_yr ? `${formatNumber(Math.round(data.sol_kwh_m2_yr))} kWh/m²·år` : '-'}
                  {data.solKategori && ` (${data.solKategori})`}
                </td>
              </tr>
              
              <tr className="results-table__row">
                <td className="results-table__cell"><strong>Solenergi-potensial</strong></td>
                <td className="results-table__cell">
                  {data.sol_kwh_bygg_tot ? `${formatNumber(Math.round(data.sol_kwh_bygg_tot))} kWh/år` : '-'}
                </td>
              </tr>
              
              {data.filteredSolarEnergy !== undefined && (
                <tr className="results-table__row">
                  <td className="results-table__cell"><strong>Spart energi fra solceller</strong></td>
                  <td className="results-table__cell">
                    {formatNumber(Math.round(data.filteredSolarEnergy))} kWh/år
                    <br />
                    <small>(Takflater med &gt;800 kWh/m²·år, 20% virkningsgrad)</small>
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>

      {data.csvData && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ marginBottom: '10px' }}>Data fra Matrikkel 2023 CSV</h3>
          <table className="results-table__table">
            <tbody>
              <tr className="results-table__row">
                <td className="results-table__cell"><strong>Bygningsnummer (CSV)</strong></td>
                <td className="results-table__cell">{data.csvData.bygningsNr}</td>
              </tr>
              <tr className="results-table__row">
                <td className="results-table__cell"><strong>Bruksareal (CSV)</strong></td>
                <td className="results-table__cell">{formatNumber(data.csvData.bruksarealTotalt)} m²</td>
              </tr>
              <tr className="results-table__row">
                <td className="results-table__cell"><strong>Bygningstype (CSV)</strong></td>
                <td className="results-table__cell">
                  {data.csvData.bygningstypeNavn} ({data.csvData.bygningstype3siffer})
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};