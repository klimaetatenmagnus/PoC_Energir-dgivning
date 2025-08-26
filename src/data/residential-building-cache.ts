// Cache of building numbers from first-100-residential-addresses.csv
// Used for testing and validation of building selection logic

export interface BuildingCacheEntry {
  address: string;
  csvBuildingNumber: string;
  buildingType: string;
}

export const residentialBuildingCache: Record<string, BuildingCacheEntry> = {
  "Fredriksborgveien 42": { address: "Fredriksborgveien 42", csvBuildingNumber: "80010303", buildingType: "14 - Store boligbygg" },
  "Dammanns vei 13": { address: "Dammanns vei 13", csvBuildingNumber: "80010575", buildingType: "11 - Enebolig" },
  "Bygdøy terrasse 16": { address: "Bygdøy terrasse 16", csvBuildingNumber: "80010613", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Graahbakken 8": { address: "Graahbakken 8", csvBuildingNumber: "80010621", buildingType: "11 - Enebolig" },
  "Strømsborgveien 42": { address: "Strømsborgveien 42", csvBuildingNumber: "80010648", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Strømsborgveien 55B": { address: "Strømsborgveien 55B", csvBuildingNumber: "80010664", buildingType: "11 - Enebolig" },
  "Strømsborgveien 30": { address: "Strømsborgveien 30", csvBuildingNumber: "80010699", buildingType: "11 - Enebolig" },
  "Strømsborgveien 25": { address: "Strømsborgveien 25", csvBuildingNumber: "80010737", buildingType: "12 - Tomannsbolig" },
  "Dorthes vei 12": { address: "Dorthes vei 12", csvBuildingNumber: "80010788", buildingType: "12 - Tomannsbolig" },
  "Dorthes vei 14": { address: "Dorthes vei 14", csvBuildingNumber: "80010796", buildingType: "12 - Tomannsbolig" },
  "Christian Frederiks vei 6D": { address: "Christian Frederiks vei 6D", csvBuildingNumber: "80010850", buildingType: "11 - Enebolig" },
  "Strømsborgveien 47": { address: "Strømsborgveien 47", csvBuildingNumber: "80010885", buildingType: "11 - Enebolig" },
  "Strømsborgveien 47B": { address: "Strømsborgveien 47B", csvBuildingNumber: "80010923", buildingType: "11 - Enebolig" },
  "Huk aveny 5B": { address: "Huk aveny 5B", csvBuildingNumber: "80010931", buildingType: "11 - Enebolig" },
  "Mellbyedalen 12": { address: "Mellbyedalen 12", csvBuildingNumber: "80010966", buildingType: "11 - Enebolig" },
  "Strømsborgveien 29": { address: "Strømsborgveien 29", csvBuildingNumber: "80010982", buildingType: "11 - Enebolig" },
  "Strømsborgveien 39": { address: "Strømsborgveien 39", csvBuildingNumber: "80011024", buildingType: "11 - Enebolig" },
  "Strømsborgveien 40B": { address: "Strømsborgveien 40B", csvBuildingNumber: "80011040", buildingType: "12 - Tomannsbolig" },
  "Huk aveny 7": { address: "Huk aveny 7", csvBuildingNumber: "80011067", buildingType: "11 - Enebolig" },
  "Fredriksborgveien 12": { address: "Fredriksborgveien 12", csvBuildingNumber: "80011083", buildingType: "11 - Enebolig" },
  "Strømsborgveien 43A": { address: "Strømsborgveien 43A", csvBuildingNumber: "80011113", buildingType: "12 - Tomannsbolig" },
  "Fredriksborgveien 35C": { address: "Fredriksborgveien 35C", csvBuildingNumber: "80011156", buildingType: "12 - Tomannsbolig" },
  "Strømsborgveien 35C": { address: "Strømsborgveien 35C", csvBuildingNumber: "80011199", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Strømsborgveien 18": { address: "Strømsborgveien 18", csvBuildingNumber: "80011202", buildingType: "11 - Enebolig" },
  "Fredriksborgveien 8": { address: "Fredriksborgveien 8", csvBuildingNumber: "80011237", buildingType: "12 - Tomannsbolig" },
  "Christian Benneches vei 6": { address: "Christian Benneches vei 6", csvBuildingNumber: "80011296", buildingType: "11 - Enebolig" },
  "Fredriksborgveien 10B": { address: "Fredriksborgveien 10B", csvBuildingNumber: "80011334", buildingType: "11 - Enebolig" },
  "Dammanns vei 4": { address: "Dammanns vei 4", csvBuildingNumber: "80011350", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 4C": { address: "Christian Benneches vei 4C", csvBuildingNumber: "80011385", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 4B": { address: "Christian Benneches vei 4B", csvBuildingNumber: "80011407", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 4K": { address: "Christian Benneches vei 4K", csvBuildingNumber: "80011423", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 4J": { address: "Christian Benneches vei 4J", csvBuildingNumber: "80011458", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 2F": { address: "Christian Benneches vei 2F", csvBuildingNumber: "80011466", buildingType: "11 - Enebolig" },
  "Mellbyedalen 8B": { address: "Mellbyedalen 8B", csvBuildingNumber: "80011482", buildingType: "11 - Enebolig" },
  "Museumsveien 7B": { address: "Museumsveien 7B", csvBuildingNumber: "80011504", buildingType: "11 - Enebolig" },
  "Museumsveien 7": { address: "Museumsveien 7", csvBuildingNumber: "80011512", buildingType: "16 - Fritidsbolig" },
  "Huk aveny 5A": { address: "Huk aveny 5A", csvBuildingNumber: "80011520", buildingType: "11 - Enebolig" },
  "Huk aveny 8": { address: "Huk aveny 8", csvBuildingNumber: "80011539", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 1": { address: "Christian Benneches vei 1", csvBuildingNumber: "80011547", buildingType: "11 - Enebolig" },
  "Huk aveny 9B": { address: "Huk aveny 9B", csvBuildingNumber: "80011571", buildingType: "11 - Enebolig" },
  "P. T. Mallings vei 27A": { address: "P. T. Mallings vei 27A", csvBuildingNumber: "80011636", buildingType: "11 - Enebolig" },
  "P. T. Mallings vei 27B": { address: "P. T. Mallings vei 27B", csvBuildingNumber: "80011644", buildingType: "11 - Enebolig" },
  "Konsul Schjelderups vei 10": { address: "Konsul Schjelderups vei 10", csvBuildingNumber: "80011660", buildingType: "11 - Enebolig" },
  "Langviksveien 21A": { address: "Langviksveien 21A", csvBuildingNumber: "80011679", buildingType: "12 - Tomannsbolig" },
  "Løchenveien 26": { address: "Løchenveien 26", csvBuildingNumber: "80011733", buildingType: "11 - Enebolig" },
  "Bygdøylund 2": { address: "Bygdøylund 2", csvBuildingNumber: "80011784", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Bygdøylund 1": { address: "Bygdøylund 1", csvBuildingNumber: "80011792", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Bygdøylund 6": { address: "Bygdøylund 6", csvBuildingNumber: "80011806", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Bygdøylund 9": { address: "Bygdøylund 9", csvBuildingNumber: "80011814", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Bygdøylund 51": { address: "Bygdøylund 51", csvBuildingNumber: "80011822", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Bygdøylund 19": { address: "Bygdøylund 19", csvBuildingNumber: "80011830", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Bygdøylund 35": { address: "Bygdøylund 35", csvBuildingNumber: "80011849", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Bygdøynesveien 15": { address: "Bygdøynesveien 15", csvBuildingNumber: "80011962", buildingType: "11 - Enebolig" },
  "Harald Rømckes vei 11": { address: "Harald Rømckes vei 11", csvBuildingNumber: "80011997", buildingType: "12 - Tomannsbolig" },
  "Løchenveien 12": { address: "Løchenveien 12", csvBuildingNumber: "80012020", buildingType: "11 - Enebolig" },
  "Løchenveien 42": { address: "Løchenveien 42", csvBuildingNumber: "80012055", buildingType: "11 - Enebolig" },
  "Løchenveien 40A": { address: "Løchenveien 40A", csvBuildingNumber: "80012063", buildingType: "12 - Tomannsbolig" },
  "Løchenveien 40B": { address: "Løchenveien 40B", csvBuildingNumber: "80012071", buildingType: "12 - Tomannsbolig" },
  "Bygdøynesveien 35": { address: "Bygdøynesveien 35", csvBuildingNumber: "80012144", buildingType: "12 - Tomannsbolig" },
  "Løchenveien 38": { address: "Løchenveien 38", csvBuildingNumber: "80012160", buildingType: "11 - Enebolig" },
  "Harald Rømckes vei 29": { address: "Harald Rømckes vei 29", csvBuildingNumber: "80012225", buildingType: "11 - Enebolig" },
  "Hengsengveien 1": { address: "Hengsengveien 1", csvBuildingNumber: "80012241", buildingType: "11 - Enebolig" },
  "Hengsengveien 3B": { address: "Hengsengveien 3B", csvBuildingNumber: "80012292", buildingType: "11 - Enebolig" },
  "Huk terrasse 10": { address: "Huk terrasse 10", csvBuildingNumber: "80012357", buildingType: "11 - Enebolig" },
  "Strømsborgveien 32A": { address: "Strømsborgveien 32A", csvBuildingNumber: "80012373", buildingType: "12 - Tomannsbolig" },
  "Strømsborgveien 34": { address: "Strømsborgveien 34", csvBuildingNumber: "80012403", buildingType: "11 - Enebolig" },
  "Fredriksborgveien 20": { address: "Fredriksborgveien 20", csvBuildingNumber: "80012438", buildingType: "11 - Enebolig" },
  "Fredriksborgveien 20B": { address: "Fredriksborgveien 20B", csvBuildingNumber: "80012446", buildingType: "14 - Store boligbygg" },
  "Schiøtts vei 4": { address: "Schiøtts vei 4", csvBuildingNumber: "80012470", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 9": { address: "Christian Benneches vei 9", csvBuildingNumber: "80012519", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 7": { address: "Christian Benneches vei 7", csvBuildingNumber: "80012527", buildingType: "11 - Enebolig" },
  "Strømsborgveien 36": { address: "Strømsborgveien 36", csvBuildingNumber: "80012543", buildingType: "12 - Tomannsbolig" },
  "Schiøtts vei 2": { address: "Schiøtts vei 2", csvBuildingNumber: "80012691", buildingType: "12 - Tomannsbolig" },
  "Schiøtts vei 6A": { address: "Schiøtts vei 6A", csvBuildingNumber: "80012705", buildingType: "11 - Enebolig" },
  "Schiøtts vei 8": { address: "Schiøtts vei 8", csvBuildingNumber: "80012721", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 8": { address: "Christian Benneches vei 8", csvBuildingNumber: "80012772", buildingType: "12 - Tomannsbolig" },
  "Christian Benneches vei 5": { address: "Christian Benneches vei 5", csvBuildingNumber: "80012802", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 14": { address: "Christian Benneches vei 14", csvBuildingNumber: "80012845", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 11": { address: "Christian Benneches vei 11", csvBuildingNumber: "80012861", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 13": { address: "Christian Benneches vei 13", csvBuildingNumber: "80012896", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 15": { address: "Christian Benneches vei 15", csvBuildingNumber: "80012918", buildingType: "11 - Enebolig" },
  "Huk aveny 18B": { address: "Huk aveny 18B", csvBuildingNumber: "80012934", buildingType: "11 - Enebolig" },
  "Huk aveny 18A": { address: "Huk aveny 18A", csvBuildingNumber: "80012942", buildingType: "11 - Enebolig" },
  "Huk aveny 20B": { address: "Huk aveny 20B", csvBuildingNumber: "80012950", buildingType: "12 - Tomannsbolig" },
  "Huk aveny 15": { address: "Huk aveny 15", csvBuildingNumber: "80012969", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 3A": { address: "Christian Benneches vei 3A", csvBuildingNumber: "80012993", buildingType: "11 - Enebolig" },
  "Huk aveny 6": { address: "Huk aveny 6", csvBuildingNumber: "80013019", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Christian Benneches vei 12": { address: "Christian Benneches vei 12", csvBuildingNumber: "80013051", buildingType: "11 - Enebolig" },
  "Christian Benneches vei 16": { address: "Christian Benneches vei 16", csvBuildingNumber: "80013108", buildingType: "12 - Tomannsbolig" },
  "Fredriksborgveien 13A": { address: "Fredriksborgveien 13A", csvBuildingNumber: "80013124", buildingType: "13 - Rekkehus, kjedehus, andre småhus" },
  "Huk aveny 12A": { address: "Huk aveny 12A", csvBuildingNumber: "80013140", buildingType: "11 - Enebolig" },
  "Huk aveny 12B": { address: "Huk aveny 12B", csvBuildingNumber: "80013159", buildingType: "11 - Enebolig" },
  "Huk terrasse 4": { address: "Huk terrasse 4", csvBuildingNumber: "80013167", buildingType: "11 - Enebolig" },
  "Huk aveny 19": { address: "Huk aveny 19", csvBuildingNumber: "80013183", buildingType: "11 - Enebolig" },
  "Huk aveny 21": { address: "Huk aveny 21", csvBuildingNumber: "80013191", buildingType: "11 - Enebolig" },
  "Fredriksborgveien 7": { address: "Fredriksborgveien 7", csvBuildingNumber: "80013213", buildingType: "11 - Enebolig" },
  "Strømsborgveien 31B": { address: "Strømsborgveien 31B", csvBuildingNumber: "80013221", buildingType: "11 - Enebolig" },
  "Strømsborgveien 27": { address: "Strømsborgveien 27", csvBuildingNumber: "80013272", buildingType: "11 - Enebolig" }
};

// Helper function to get expected building number
export function getExpectedBuildingNumber(address: string): string | undefined {
  // Normalize address by removing trailing commas and extra spaces
  const normalizedAddress = address.replace(/,.*$/, '').trim();
  
  // Try exact match first
  if (residentialBuildingCache[normalizedAddress]) {
    return residentialBuildingCache[normalizedAddress].csvBuildingNumber;
  }
  
  // Try to find by partial match
  const entry = Object.values(residentialBuildingCache).find(e => 
    e.address.toLowerCase() === normalizedAddress.toLowerCase()
  );
  
  return entry?.csvBuildingNumber;
}

// Get all addresses for testing
export function getAllTestAddresses(): string[] {
  return Object.keys(residentialBuildingCache);
}