// Utility functions for FigmaBlokk component

export const calculateFontSize = (addressOnly: string): number => {
  const baseFontSize = 36;
  const maxWidth = 276; // Leave some padding (336px - 2*30px)
  const charWidth = baseFontSize * 0.6; // Approximate character width
  const addressWidth = addressOnly.length * charWidth;
  return addressWidth > maxWidth ? Math.floor((maxWidth / addressOnly.length) / 0.6) : baseFontSize;
};

export const calculateBoxWidth = (text: string, minWidth: number): number => {
  return Math.max(minWidth, text.length * 8.5 + 40); // 8.5px per char + padding
};

export const getTileUrl = (lat: number, lng: number, zoom: number = 16): string => {
  // Calculate tile coordinates for OpenStreetMap
  const n = Math.pow(2, zoom);
  const x = n * ((lng + 180) / 360);
  const y = n * (1 - (Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI)) / 2;
  
  // Calculate offset within the tile (0-1)
  // Adjust tile selection to better center the location
  // If the location is near the edge of a tile, we might want to show the adjacent tile
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  
  // If the location is in the right half of the tile and we're close to the edge,
  // we could adjust, but for now let's use the standard calculation
  
  // Use OpenStreetMap tile server
  return `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
};
