// src/components/DebugDataTable.tsx
import { House } from "../types/House";

/** suppler med feltene vi kan få fra StoreClient */
type Etasje = { etasjenummer: number; bruksarealTotalt: number | null };
type DebugData = Partial<House> & {
  /* nye varianter som kan dukke opp */
  bruksareal?: number | null;
  antEtasjer?: number | null;
  etasjer?: Etasje[];
  bruksarealEtasjer?: Record<number | string, number | null>;
  _diag?: Record<string, any>;
};

export default function DebugDataTable({ data }: { data: DebugData | null }) {
  if (!data) return <p className="p-4">Henter data…</p>;

  /* --- se hva som faktisk sendes inn --- */
  // eslint-disable-next-line no-console
  console.log("[DebugDataTable] data =", data);

  /* ---------- normaliser etasjer ---------- */
  let etasjeListe: Etasje[] = [];

  if (Array.isArray(data.etasjer) && data.etasjer.length) {
    etasjeListe = data.etasjer;
  } else if (
    data.bruksarealEtasjer &&
    Object.keys(data.bruksarealEtasjer).length
  ) {
    etasjeListe = Object.entries(data.bruksarealEtasjer).map(([nr, areal]) => ({
      etasjenummer: Number(nr),
      bruksarealTotalt: areal ?? null,
    }));
  }

  etasjeListe.sort((a, b) => a.etasjenummer - b.etasjenummer);

  const antEtasjer =
    data.antEtasjer != null ? data.antEtasjer : etasjeListe.length || null;

  /* ---------- areal-summer ---------- */
  const sumEtasjer = etasjeListe.reduce(
    (s, e) => s + (e.bruksarealTotalt ?? 0),
    0
  );
  const bruksTot =
    data.bruksareal ?? data.bra_m2 ?? (sumEtasjer ? sumEtasjer : null);

  /* ---------- helpers ---------- */
  const fmt = (v: number | null | undefined) =>
    v != null ? v.toFixed(1) : null;

  const Row = (label: string, value: any) => (
    <tr key={label} className="border-t">
      <td className="px-3 py-1 font-medium bg-gray-50">{label}</td>
      <td className="px-3 py-1">
        {value != null ? value : <span className="text-red-500">mangler</span>}
      </td>
    </tr>
  );

  /* ---------- hovedrader ---------- */
  const rows = [
    Row(
      "G/B/S",
      `${data.gardsnummer ?? "—"}/${data.bruksnummer ?? "—"}/${
        data.seksjonsnummer ?? "—"
      }`
    ),
    Row("Byggeår", data.byggår),
    Row("BRA totalt (m²)", fmt(bruksTot)),
    Row("Antall etasjer", antEtasjer),
    Row("E-merke", data.energikarakter),
    Row("Oppv.karakter", data.oppvarmingskarakter),
    Row(
      "Kulturminne",
      data.isProtected != null ? (data.isProtected ? "Ja" : "Nei") : null
    ),
    Row("Tak-areal (m²)", fmt(data.takAreal_m2)),
    Row("Irr. kWh/m²·år", data.sol_kwh_m2_yr),
    Row("Potensial kWh/år", data.sol_kwh_bygg_tot),
    Row("Sol-kategori", data.solKategori),
  ];

  /* ---------- etasje-rader (kun dersom >1) ---------- */
  if (etasjeListe.length > 1) {
    etasjeListe.forEach((e) =>
      rows.push(
        Row(`Areal ${e.etasjenummer}. etasje (m²)`, fmt(e.bruksarealTotalt))
      )
    );
  }

  /* ---------- diagnostikk-rader ---------- */
  const diagRows = Object.entries(data._diag ?? {}).map(([k, v]) => {
    const ok = (v as any)?.ok === true;
    const { ok: _ignored, ...rest } = (v as any) ?? {};
    const details =
      Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 0) : "—";
    return (
      <tr key={k} className={`border-t ${ok ? "" : "bg-red-50 text-red-700"}`}>
        <td className="px-3 py-1 font-medium">{k}</td>
        <td className="px-3 py-1">{ok ? "✔︎" : "✖︎"}</td>
        <td className="px-3 py-1 break-all">{details}</td>
      </tr>
    );
  });

  /* ---------- render ---------- */
  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-4">Diagnostikk</h1>
        <table className="border text-sm w-full">
          <tbody>{rows}</tbody>
        </table>
      </div>

      {diagRows.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2">Tjeneste-diagnostikk</h2>
          <table className="border text-sm w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-1 text-left">Tjeneste</th>
                <th className="px-3 py-1 text-left">OK?</th>
                <th className="px-3 py-1 text-left">Detaljer / Feilmelding</th>
              </tr>
            </thead>
            <tbody>{diagRows}</tbody>
          </table>
        </div>
      )}

      {data.takflater?.length ? (
        <div>
          <h2 className="font-semibold mt-4">Takflater</h2>
          <table className="border text-sm mt-2 w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1">ID</th>
                <th className="px-2 py-1">Areal (m²)</th>
                <th className="px-2 py-1">kWh/m²·år</th>
                <th className="px-2 py-1">kWh/år</th>
              </tr>
            </thead>
            <tbody>
              {data.takflater.map((t) => (
                <tr key={t.tak_id} className="border-t">
                  <td className="px-2 py-1">{t.tak_id}</td>
                  <td className="px-2 py-1">{t.area_m2.toFixed(1)}</td>
                  <td className="px-2 py-1">{t.irr_kwh_m2_yr.toFixed(0)}</td>
                  <td className="px-2 py-1">{Math.round(t.kWh_tot)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
