import { useCallback, useEffect, useState } from "react";
import "./admin.css";
import { ModeCards } from "./components/ModeCards";
import { EnvironmentToggle } from "./components/EnvironmentToggle";
import { ContentList } from "./components/ContentList";
import { BenefitsPage } from "./components/BenefitsPage";
import { GlossaryPage } from "./components/GlossaryPage";
import { TiltakEditorPage } from "./components/TiltakEditorPage";
import { TilskuddEditorPage } from "./components/TilskuddEditorPage";
import { PublishActionBar } from "./components/PublishActionBar";
import { PublishWizard } from "./components/PublishWizard";
import { AdminDictionaryProvider } from "./context/AdminDictionaryContext";
import { DraftsProvider } from "./context/DraftsContext";
import { ContentFetchProvider } from "../hooks/contentHooks";
import {
  AdminContentItem,
  AdminEnvironment,
  AdminMode,
} from "./types";
import { useAdminCatalog } from "./hooks/useAdminCatalog";
import { PktHeading } from "@oslokommune/punkt-react";

const DEFAULT_CONTENT_BASE = "/config/content";
const DEFAULT_STAGING_CONTENT_BASE =
  import.meta.env.VITE_ADMIN_STAGING_CONTENT_BASE ?? DEFAULT_CONTENT_BASE;
const DEFAULT_STAGING_FALLBACK_BASE =
  import.meta.env.VITE_ADMIN_STAGING_FALLBACK_BASE ?? undefined;
const PROD_CONTENT_BASE =
  import.meta.env.VITE_ADMIN_PROD_CONTENT_BASE ?? DEFAULT_CONTENT_BASE;
const PROD_FALLBACK_BASE =
  import.meta.env.VITE_ADMIN_PROD_FALLBACK_BASE ?? undefined;

const CONTENT_SOURCES: Record<
  AdminEnvironment,
  { includeDrafts: boolean; contentBaseUrl: string; fallbackBaseUrl?: string }
> = {
  staging: {
    includeDrafts: true,
    contentBaseUrl: DEFAULT_STAGING_CONTENT_BASE,
    fallbackBaseUrl: DEFAULT_STAGING_FALLBACK_BASE,
  },
  prod: {
    includeDrafts: false,
    contentBaseUrl: PROD_CONTENT_BASE,
    fallbackBaseUrl: PROD_FALLBACK_BASE,
  },
};

export function AdminApp() {
  const [environment, setEnvironment] =
    useState<AdminEnvironment>("staging");
  const contentSource = CONTENT_SOURCES[environment];

  return (
    <ContentFetchProvider
      includeDrafts={contentSource.includeDrafts}
      baseUrl={contentSource.contentBaseUrl}
      fallbackBaseUrl={contentSource.fallbackBaseUrl}
    >
      <AdminDictionaryProvider>
        <DraftsProvider>
          <AdminShell
            environment={environment}
            onEnvironmentChange={setEnvironment}
          />
        </DraftsProvider>
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
  const [activeView, setActiveView] = useState<"dashboard" | "benefits" | "glossary" | "editor">(
    "dashboard"
  );
  const [editItem, setEditItem] = useState<AdminContentItem | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
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
      setEditItem(null);
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

  const handleEdit = useCallback((item: AdminContentItem) => {
    setEditItem(item);
    setActiveView("editor");
    // Lukk preview når vi går til editor
    setPreviewItem(null);
    setPreviewMode(null);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditItem(null);
    setActiveView("dashboard");
  }, []);

  const handleEditorSave = useCallback(() => {
    // Oppdater katalogen etter lagring
    reloadCatalog();
    setEditItem(null);
    setActiveView("dashboard");
  }, [reloadCatalog]);

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

        {activeView === "dashboard" && (
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
                onEdit={handleEdit}
                previewItem={previewItem}
                previewMode={previewMode}
                onClosePreview={handleClosePreview}
                onOpenBenefits={
                  mode === "tiltak"
                    ? () => setActiveView("benefits")
                    : undefined
                }
                onOpenGlossary={
                  mode === "tiltak"
                    ? () => setActiveView("glossary")
                    : undefined
                }
                onBack={() => setMode(null)}
              />
            )}
          </>
        )}

        {activeView === "benefits" && (
          <BenefitsPage onBack={() => setActiveView("dashboard")} />
        )}

        {activeView === "glossary" && (
          <GlossaryPage onBack={() => setActiveView("dashboard")} />
        )}

        {activeView === "editor" && editItem && mode === "tiltak" && (
          <TiltakEditorPage
            tiltakId={editItem.id}
            onClose={handleEditorClose}
            onSaveSuccess={handleEditorSave}
          />
        )}

        {activeView === "editor" && editItem && mode === "tilskudd" && (
          <TilskuddEditorPage
            tilskuddId={editItem.id}
            onClose={handleEditorClose}
            onSaveSuccess={handleEditorSave}
          />
        )}
      </div>

      {/* Floating action bar for publisering */}
      <PublishActionBar onOpenWizard={() => setWizardOpen(true)} />

      {/* Publiserings-wizard modal */}
      <PublishWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
