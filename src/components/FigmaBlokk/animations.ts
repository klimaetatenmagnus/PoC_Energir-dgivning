// Animation configurations for FigmaBlokk component

export const ANIMATION_TIMINGS = {
  fadeDelay: 500,
  transformDelay: 2000,  // Increased to ensure fade completes first
  headerDelay: 4000,
  fadeDuration: 1500,
  transformDuration: 2000,
} as const;

export const ANIMATION_TRANSFORMS = {
  initial: 'translate(0, 0) scale(1)',
  final: 'translate(215, -50) scale(3)',
} as const;

export const calculateBlockTransform = () => {
  // The block building in SVG is approximately 136 units wide and 204 units tall
  // Original right edge is at x=1186.71
  // Button is at x=1078 with width=151, so button right edge is at 1229
  // After scale(3) from origin 1100, the block right edge will be at:
  // 1100 + (1186.71 - 1100) * 3 = 1360.13
  // To align with button at 1229, we need to translate:
  // 1229 - 1360.13 = -131.13
  // But we also want some visual spacing, so let's use translate(-131, -50)
  // This aligns the block's right edge (1360.13) with button's right edge (1229)
  // 1229 - 1360.13 = -131.13
  // Adding extra offset to move everything to the right
  // Note: This is in SVG coordinates, not CSS pixels
  // Moving further right by increasing the translate X value
  return ANIMATION_TRANSFORMS.final;
};