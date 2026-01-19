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
