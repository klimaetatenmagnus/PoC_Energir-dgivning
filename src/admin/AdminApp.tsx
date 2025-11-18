import { useEffect, useState } from "react";
import "./admin.css";
import { ModeCards } from "./components/ModeCards";
import { EnvironmentToggle } from "./components/EnvironmentToggle";
import { ContentList } from "./components/ContentList";
import { BenefitsPage } from "./components/BenefitsPage";
import { AdminDictionaryProvider } from "./context/AdminDictionaryContext";
import { ContentFetchProvider } from "../hooks/contentHooks";
import {
  AdminContentItem,
  AdminEnvironment,
  AdminMode,
} from "./types";
import { useAdminCatalog } from "./hooks/useAdminCatalog";
import { PktHeading } from "@oslokommune/punkt-react";

const DEFAULT_CONTENT_BASE = "/config/content";
const PROD_CONTENT_BASE =
  import.meta.env.VITE_ADMIN_PROD_CONTENT_BASE ?? DEFAULT_CONTENT_BASE;

const CONTENT_SOURCES: Record<
  AdminEnvironment,
  { includeDrafts: boolean; contentBaseUrl: string }
> = {
  staging: { includeDrafts: true, contentBaseUrl: DEFAULT_CONTENT_BASE },
  prod: { includeDrafts: false, contentBaseUrl: PROD_CONTENT_BASE },
};

export function AdminApp() {
  const [environment, setEnvironment] =
    useState<AdminEnvironment>("staging");
  const contentSource = CONTENT_SOURCES[environment];

  return (
    <ContentFetchProvider
      includeDrafts={contentSource.includeDrafts}
      baseUrl={contentSource.contentBaseUrl}
    >
      <AdminDictionaryProvider>
        <AdminShell
          environment={environment}
          onEnvironmentChange={setEnvironment}
        />
      </AdminDictionaryProvider>
    </ContentFetchProvider>
  );
}

function AdminShell({
  environment,
  onEnvironmentChange,
}: {
  environment: AdminEnvironment;
  onEnvironmentChange: (env: AdminEnvironment) => void;
}) {
  const [mode, setMode] = useState<AdminMode | null>(null);
  const [previewItem, setPreviewItem] = useState<AdminContentItem | null>(
    null
  );
  const [previewMode, setPreviewMode] = useState<AdminMode | null>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "benefits">(
    "dashboard"
  );
  const {
    items,
    status: catalogStatus,
    error: catalogError,
    metadata: catalogMetadata,
    reload: reloadCatalog,
  } = useAdminCatalog(mode);

  useEffect(() => {
    if (!mode) {
      setPreviewItem(null);
      setPreviewMode(null);
    }
    setActiveView("dashboard");
  }, [mode]);

  const handlePreview = (item: AdminContentItem) => {
    if (!mode) {
      return;
    }
    if (previewItem?.id === item.id) {
      setPreviewItem(null);
      setPreviewMode(null);
      return;
    }
    setPreviewMode(mode);
    setPreviewItem(item);
  };

  const handleClosePreview = () => {
    setPreviewItem(null);
    setPreviewMode(null);
  };

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <header className="admin-header">
          <div>
            <p className="admin-content__eyebrow">Energinøkkelen</p>
            <h1 className="admin-header__title">
              Innholdsredigering
            </h1>
            <p className="admin-subtitle">
              Administrer tiltakskort og støtteordninger uten redeploy. Velg
              miljø og modus for å komme i gang.
            </p>
          </div>
          <EnvironmentToggle
            environment={environment}
            onChange={onEnvironmentChange}
          />
        </header>

        {activeView === "dashboard" ? (
          <>
            {!mode && (
              <>
                <PktHeading level={3}>Hva vil du redigere?</PktHeading>
                <ModeCards onSelect={setMode} />
              </>
            )}

            {mode && (
              <ContentList
                mode={mode}
                environment={environment}
                items={items}
                status={catalogStatus}
                metadata={catalogMetadata}
                error={catalogError}
                onReload={reloadCatalog}
                onPreview={handlePreview}
                previewItem={previewItem}
                previewMode={previewMode}
                onClosePreview={handleClosePreview}
                onOpenBenefits={
                  mode === "tiltak"
                    ? () => setActiveView("benefits")
                    : undefined
                }
              />
            )}
          </>
        ) : (
          <BenefitsPage onBack={() => setActiveView("dashboard")} />
        )}
      </div>

    </div>
  );
}
