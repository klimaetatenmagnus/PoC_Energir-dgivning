import { useCallback, useEffect, useState } from "react";
import "./admin.css";
import { ModeCards } from "./components/ModeCards";
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
  AdminMode,
} from "./types";
import { useAdminCatalog } from "./hooks/useAdminCatalog";
import { useDrafts } from "./context/DraftsContext";
import { PktHeading } from "@oslokommune/punkt-react";

const DEFAULT_CONTENT_BASE = "/config/content";
const DEFAULT_STAGING_CONTENT_BASE =
  import.meta.env.VITE_ADMIN_STAGING_CONTENT_BASE ?? DEFAULT_CONTENT_BASE;
const DEFAULT_STAGING_FALLBACK_BASE =
  import.meta.env.VITE_ADMIN_STAGING_FALLBACK_BASE ?? undefined;

export function AdminApp() {
  return (
    <ContentFetchProvider
      includeDrafts={true}
      baseUrl={DEFAULT_STAGING_CONTENT_BASE}
      fallbackBaseUrl={DEFAULT_STAGING_FALLBACK_BASE}
    >
      <AdminDictionaryProvider>
        <DraftsProvider>
          <AdminShell />
        </DraftsProvider>
      </AdminDictionaryProvider>
    </ContentFetchProvider>
  );
}

function AdminShell() {
  const [mode, setMode] = useState<AdminMode | null>(null);
  const [previewItem, setPreviewItem] = useState<AdminContentItem | null>(
    null
  );
  const [previewMode, setPreviewMode] = useState<AdminMode | null>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "benefits" | "glossary" | "editor">(
    "dashboard"
  );
  const [editItem, setEditItem] = useState<AdminContentItem | null>(null);
  const [isCreating, setIsCreating] = useState(false); // Create-modus for nye tiltak
  const [wizardOpen, setWizardOpen] = useState(false);
  const {
    items,
    status: catalogStatus,
    error: catalogError,
    metadata: catalogMetadata,
    reload: reloadCatalog,
  } = useAdminCatalog(mode);

  const { refresh: refreshDrafts } = useDrafts();

  useEffect(() => {
    if (!mode) {
      setPreviewItem(null);
      setPreviewMode(null);
      setEditItem(null);
      setIsCreating(false);
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
    setIsCreating(false);
    setActiveView("dashboard");
  }, []);

  const handleEditorSave = useCallback(() => {
    // Oppdater katalogen og draft-listen etter lagring
    reloadCatalog();
    refreshDrafts();
    // Ikke lukk editoren automatisk etter lagring - la bruker fortsette å redigere
  }, [reloadCatalog, refreshDrafts]);

  const handleCreateNew = useCallback(() => {
    if (mode !== "tiltak" && mode !== "tilskudd") {
      return;
    }
    setIsCreating(true);
    setEditItem(null);
    setActiveView("editor");
    setPreviewItem(null);
    setPreviewMode(null);
  }, [mode]);

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
              Administrer tiltakskort og tilskuddsordninger.
            </p>
          </div>
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
                items={items}
                status={catalogStatus}
                metadata={catalogMetadata}
                error={catalogError}
                onReload={reloadCatalog}
                onPreview={handlePreview}
                onEdit={handleEdit}
                onCreateNew={handleCreateNew}
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
            mode="edit"
          />
        )}

        {activeView === "editor" && isCreating && mode === "tiltak" && (
          <TiltakEditorPage
            tiltakId={null}
            onClose={handleEditorClose}
            onSaveSuccess={handleEditorSave}
            mode="create"
          />
        )}

        {activeView === "editor" && editItem && mode === "tilskudd" && (
          <TilskuddEditorPage
            tilskuddId={editItem.id}
            onClose={handleEditorClose}
            onSaveSuccess={handleEditorSave}
            mode="edit"
          />
        )}

        {activeView === "editor" && isCreating && mode === "tilskudd" && (
          <TilskuddEditorPage
            tilskuddId={null}
            onClose={handleEditorClose}
            onSaveSuccess={handleEditorSave}
            mode="create"
          />
        )}
      </div>

      {/* Floating action bar for publisering */}
      <PublishActionBar
        onOpenWizard={() => setWizardOpen(true)}
        onDiscardSuccess={reloadCatalog}
      />

      {/* Publiserings-wizard modal */}
      <PublishWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onPublishSuccess={reloadCatalog}
      />
    </div>
  );
}
