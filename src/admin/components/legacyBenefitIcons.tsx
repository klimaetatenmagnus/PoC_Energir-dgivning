import type { ReactNode } from "react";

const legacyGreenEnergyIcon = (
  <svg
    viewBox="0 0 16 16"
    width="32"
    height="32"
    role="img"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M4.5 0.5C4.5 0.5 4 1 4 1.5C4 2 4.5 2.5 4.5 2.5C4.5 2.5 5 2 5 1.5C5 1 4.5 0.5 4.5 0.5Z"
      fill="#2A2859"
    />
    <path
      d="M8 0.5C8 0.5 7.5 1 7.5 1.5C7.5 2 8 2.5 8 2.5C8 2.5 8.5 2 8.5 1.5C8.5 1 8 0.5 8 0.5Z"
      fill="#2A2859"
    />
    <path
      d="M11.5 0.5C11.5 0.5 11 1 11 1.5C11 2 11.5 2.5 11.5 2.5C11.5 2.5 12 2 12 1.5C12 1 11.5 0.5 11.5 0.5Z"
      fill="#2A2859"
    />
    <rect x="1" y="4" width="14" height="9" rx="2" fill="#2A2859" />
    <rect x="2" y="5" width="12" height="7" rx="1" fill="#C7F6C9" />
    <rect x="3.5" y="6" width="0.8" height="5" fill="#2A2859" />
    <rect x="5.5" y="6" width="0.8" height="5" fill="#2A2859" />
    <rect x="7.6" y="6" width="0.8" height="5" fill="#2A2859" />
    <rect x="9.7" y="6" width="0.8" height="5" fill="#2A2859" />
    <rect x="11.7" y="6" width="0.8" height="5" fill="#2A2859" />
    <rect x="3" y="13" width="1.5" height="2" fill="#2A2859" />
    <rect x="11.5" y="13" width="1.5" height="2" fill="#2A2859" />
  </svg>
);

const legacyBoltIcon = (
  <svg
    viewBox="0 0 16 16"
    width="32"
    height="32"
    role="img"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M9.5 1L3 9.25H7.5L6.5 15L13 6.75H8.5L9.5 1Z"
      fill="none"
      stroke="#2A2859"
      strokeWidth={1.3}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

export const LEGACY_BENEFIT_ICONS: Record<string, ReactNode> = {
  "egenprodusert-strom": legacyBoltIcon,
  energibehov: legacyGreenEnergyIcon,
  "lavere-energibehov": legacyGreenEnergyIcon,
  "reduert-energibehov": legacyGreenEnergyIcon,
  "redusert-energibehov": legacyGreenEnergyIcon,
};
