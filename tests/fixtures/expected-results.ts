// Forventede resultater fra residential-building-cache
// Reeksporterer og strukturerer data for bruk i tester

import { residentialBuildingCache, getExpectedBuildingNumber, getAllTestAddresses } from "../../src/data/residential-building-cache.ts";

export { residentialBuildingCache, getExpectedBuildingNumber, getAllTestAddresses };

// Grupperte testdata etter bygningstype
export const BUILDING_TYPES = {
  enebolig: Object.entries(residentialBuildingCache)
    .filter(([, entry]) => entry.buildingType.startsWith("11"))
    .map(([, entry]) => entry),

  tomannsbolig: Object.entries(residentialBuildingCache)
    .filter(([, entry]) => entry.buildingType.startsWith("12"))
    .map(([, entry]) => entry),

  rekkehus: Object.entries(residentialBuildingCache)
    .filter(([, entry]) => entry.buildingType.startsWith("13"))
    .map(([, entry]) => entry),

  storeBoligbygg: Object.entries(residentialBuildingCache)
    .filter(([, entry]) => entry.buildingType.startsWith("14"))
    .map(([, entry]) => entry),

  fritidsbolig: Object.entries(residentialBuildingCache)
    .filter(([, entry]) => entry.buildingType.startsWith("16"))
    .map(([, entry]) => entry),
};

// Strømsborgveien-adresser (spesialhåndtering)
export const STROMSBORGVEIEN_ADDRESSES = Object.entries(residentialBuildingCache)
  .filter(([address]) => address.toLowerCase().includes("stromsborgveien"))
  .map(([, entry]) => entry);

// Adresser med bokstav-suffiks (A, B, C, K, etc.)
export const ADDRESSES_WITH_LETTER_SUFFIX = Object.entries(residentialBuildingCache)
  .filter(([address]) => /\d+[A-Za-z]$/.test(address.replace(/,.*$/, "").trim()))
  .map(([, entry]) => entry);
