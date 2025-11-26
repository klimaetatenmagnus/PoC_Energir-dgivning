import { PktButton, PktSelect } from "@oslokommune/punkt-react";
import type { AdminPaginationState } from "../types";
import { PAGE_SIZE_OPTIONS } from "../types";
import "./CatalogPagination.css";

interface CatalogPaginationProps {
  pagination: AdminPaginationState;
  totalItems: number;
  onChange: (pagination: AdminPaginationState) => void;
}

export function CatalogPagination({
  pagination,
  totalItems,
  onChange,
}: CatalogPaginationProps) {
  const { page, pageSize } = pagination;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  const handlePageSizeChange = (newPageSize: number) => {
    // Beregn ny side slik at vi holder omtrent samme posisjon
    const currentFirstItem = (page - 1) * pageSize + 1;
    const newPage = Math.max(1, Math.ceil(currentFirstItem / newPageSize));
    onChange({ page: newPage, pageSize: newPageSize });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      onChange({ ...pagination, page: newPage });
    }
  };

  const handleFirst = () => handlePageChange(1);
  const handlePrevious = () => handlePageChange(page - 1);
  const handleNext = () => handlePageChange(page + 1);
  const handleLast = () => handlePageChange(totalPages);

  // Generer sidenumre å vise (maks 5 knapper)
  const getPageNumbers = (): number[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Sørg for at vi alltid har minst 5 sider synlig
    while (pages.length < 5 && pages[0] > 1) {
      pages.unshift(pages[0] - 1);
    }
    while (pages.length < 5 && pages[pages.length - 1] < totalPages) {
      pages.push(pages[pages.length - 1] + 1);
    }

    return pages;
  };

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="catalog-pagination">
      <div className="catalog-pagination__info">
        <span className="catalog-pagination__range">
          {startItem}–{endItem} av {totalItems}
        </span>

        <div className="catalog-pagination__page-size">
          <label htmlFor="page-size-select">Vis</label>
          <PktSelect
            id="page-size-select"
            value={String(pageSize)}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={String(size)}>
                {size}
              </option>
            ))}
          </PktSelect>
          <span>per side</span>
        </div>
      </div>

      <nav className="catalog-pagination__nav" aria-label="Paginering">
        <PktButton
          skin="tertiary"
          size="small"
          variant="icon-only"
          iconName="chevron-double-left"
          onClick={handleFirst}
          disabled={page === 1}
          aria-label="Første side"
        />
        <PktButton
          skin="tertiary"
          size="small"
          variant="icon-only"
          iconName="chevron-left"
          onClick={handlePrevious}
          disabled={page === 1}
          aria-label="Forrige side"
        />

        <div className="catalog-pagination__pages">
          {getPageNumbers().map((pageNum) => (
            <PktButton
              key={pageNum}
              skin={pageNum === page ? "primary" : "tertiary"}
              size="small"
              variant="label-only"
              onClick={() => handlePageChange(pageNum)}
              aria-current={pageNum === page ? "page" : undefined}
              aria-label={`Side ${pageNum}`}
            >
              {pageNum}
            </PktButton>
          ))}
        </div>

        <PktButton
          skin="tertiary"
          size="small"
          variant="icon-only"
          iconName="chevron-right"
          onClick={handleNext}
          disabled={page === totalPages}
          aria-label="Neste side"
        />
        <PktButton
          skin="tertiary"
          size="small"
          variant="icon-only"
          iconName="chevron-double-right"
          onClick={handleLast}
          disabled={page === totalPages}
          aria-label="Siste side"
        />
      </nav>
    </div>
  );
}
