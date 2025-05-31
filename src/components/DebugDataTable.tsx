// src/components/DebugDataTable.tsx
import { House } from "../types/House";

/** Tillat et _diag-felt i prop-typen */
type DebugData = Partial<House> & {
  _diag?: Record<string, any>;
};

export default function DebugDataTable({ data }: { data: DebugData | null }) {
  if (!data) return <p className="p-4">Henter data…</p>;

  const Row = (label: string, value: any) => (
    <tr key={label} className="border-t">
      <td className="px-3 py-1 font-medium bg-gray-50">{label}</td>
      <td className="px-3 py-1">
        {value != null ? value : <span className="text-red-500">mangler</span>}
      </td>
    </tr>
  );

  /* ---------- hovedverdier ---------- */
  const rows = [
    Row(
      "G/B/S",
      `${data.gardsnummer ?? "—"}/${data.bruksnummer ?? "—"}/${
        data.seksjonsnummer ?? "—"
      }`
    ),
    Row("Byggeår", data.byggår),
    Row("BRA m²", data.bra_m2),
    Row("E-merke", data.energikarakter),
    Row("Oppv.karakter", data.oppvarmingskarakter),
    Row(
      "Kulturminne",
      data.isProtected != null ? (data.isProtected ? "Ja" : "Nei") : null
    ),
    Row("Tak-areal (m²)", data.takAreal_m2),
    Row("Irr. kWh/m²·år", data.sol_kwh_m2_yr),
    Row("Potensial kWh/år", data.sol_kwh_bygg_tot),
    Row("Sol-kategori", data.solKategori),
  ];

  /* ---------- full diagnostikk ---------- */
  const diagRows = Object.entries(data._diag ?? {}).map(([key, info]) => {
    const ok = info?.ok === true;
    const details = (() => {
      // fjern ok-flagget fra utskriften
      const { ok: _ignored, ...rest } = info ?? {};
      if (Object.keys(rest).length === 0) return "—";
      return JSON.stringify(rest, null, 0);
    })();

    return (
      <tr
        key={key}
        className={`border-t ${ok ? "" : "bg-red-50 text-red-700"}`}
      >
        <td className="px-3 py-1 font-medium">{key}</td>
        <td className="px-3 py-1">{ok ? "✔︎" : "✖︎"}</td>
        <td className="px-3 py-1 break-all">{details}</td>
      </tr>
    );
  });

  return (
    <div className="p-4 space-y-6">
      {/* ---------------- main table ---------------- */}
      <div>
        <h1 className="text-xl font-semibold mb-4">Diagnostikk</h1>
        <table className="border text-sm w-full">
          <tbody>{rows}</tbody>
        </table>
      </div>

      {/* ---------------- diag table ---------------- */}
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

      {/* ---------------- takflater ---------------- */}
      {data.takflater?.length ? (
        <div>
          <h2 className="font-semibold mt-2">Takflater</h2>
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
