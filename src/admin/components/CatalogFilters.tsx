import {
  PktSelect,
  PktTextinput,
  PktButton,
  PktTag,
} from "@oslokommune/punkt-react";
import type { AdminCatalogFilters, AdminMode, AdminStatus } from "../types";
import { DEFAULT_CATALOG_FILTERS } from "../types";
import { useAdminDictionary } from "../context/AdminDictionaryContext";
import "./CatalogFilters.css";

interface CatalogFiltersProps {
  mode: AdminMode;
  filters: AdminCatalogFilters;
  onChange: (filters: AdminCatalogFilters) => void;
  resultCount: number;
  totalCount: number;
}

const STATUS_OPTIONS: Array<{ value: AdminStatus | "all"; label: string }> = [
  { value: "all", label: "Alle statuser" },
  { value: "published", label: "Publisert" },
  { value: "draft", label: "Kladd" },
  { value: "in-review", label: "Til gjennomgang" },
  { value: "archived", label: "Arkivert" },
];

const AUDIENCE_OPTIONS: Array<{
  value: "all" | "standard" | "gulliste";
  label: string;
}> = [
  { value: "all", label: "Alle målgrupper" },
  { value: "standard", label: "Standard" },
  { value: "gulliste", label: "Gul liste" },
];

export function CatalogFilters({
  mode,
  filters,
  onChange,
  resultCount,
  totalCount,
}: CatalogFiltersProps) {
  const { dictionary } = useAdminDictionary();

  const buildingTypeOptions = [
    { value: "all", label: "Alle byggtyper" },
    ...(dictionary?.buildingTypes ?? [])
      .filter((bt) => !bt.internalOnly)
      .map((bt) => ({
        value: bt.id,
        label: bt.label,
      })),
  ];

  const handleStatusChange = (value: string) => {
    onChange({
      ...filters,
      status: value as AdminStatus | "all",
    });
  };

  const handleAudienceChange = (value: string) => {
    onChange({
      ...filters,
      audience: value as "all" | "standard" | "gulliste",
    });
  };

  const handleBuildingTypeChange = (value: string) => {
    onChange({
      ...filters,
      buildingType: value,
    });
  };

  const handleSearchChange = (value: string) => {
    onChange({
      ...filters,
      search: value,
    });
  };

  const handleClearFilters = () => {
    onChange(DEFAULT_CATALOG_FILTERS);
  };

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.audience !== "all" ||
    filters.buildingType !== "all" ||
    filters.search.trim() !== "";

  const activeFilterCount = [
    filters.status !== "all",
    filters.audience !== "all",
    filters.buildingType !== "all",
    filters.search.trim() !== "",
  ].filter(Boolean).length;

  return (
    <div className="catalog-filters">
      <div className="catalog-filters__row">
        <div className="catalog-filters__search">
          <PktTextinput
            label="Søk"
            placeholder={`Søk i ${mode === "tiltak" ? "tiltak" : "tilskudd"}...`}
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="catalog-filters__dropdowns">
          <PktSelect
            label="Status"
            value={filters.status}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </PktSelect>

          <PktSelect
            label="Målgruppe"
            value={filters.audience}
            onChange={(e) => handleAudienceChange(e.target.value)}
          >
            {AUDIENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </PktSelect>

          <PktSelect
            label="Byggtype"
            value={filters.buildingType}
            onChange={(e) => handleBuildingTypeChange(e.target.value)}
          >
            {buildingTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </PktSelect>
        </div>
      </div>

      <div className="catalog-filters__summary">
        <span className="catalog-filters__count">
          Viser {resultCount} av {totalCount}{" "}
          {mode === "tiltak" ? "tiltak" : "tilskudd"}
        </span>

        {hasActiveFilters && (
          <div className="catalog-filters__active">
            <PktTag skin="blue" size="small">
              <span>{activeFilterCount} aktive filtre</span>
            </PktTag>
            <PktButton
              skin="tertiary"
              size="small"
              variant="label-only"
              onClick={handleClearFilters}
            >
              Nullstill filtre
            </PktButton>
          </div>
        )}
      </div>
    </div>
  );
}
