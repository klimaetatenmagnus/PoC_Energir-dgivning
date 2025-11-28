import { useRef } from "react";
import { PktButton } from "@oslokommune/punkt-react";
import { GlossaryEditor, type GlossaryEditorHandle } from "./GlossaryEditor";
import "./ContentList.css";

interface GlossaryPageProps {
  onBack: () => void;
}

export function GlossaryPage({ onBack }: GlossaryPageProps) {
  const editorRef = useRef<GlossaryEditorHandle | null>(null);

  return (
    <section className="admin-benefits-page">
      <header className="admin-content__header">
        <PktButton
          skin="secondary"
          size="medium"
          variant="icon-left"
          iconName="arrow-return"
          onClick={onBack}
        >
          <span>Tilbake</span>
        </PktButton>
        <div className="admin-content__heading">
          <div className="admin-content__heading-row">
            <h2>Ordliste som kan redigeres</h2>
          </div>
          <div className="admin-content__primary-action">
            <PktButton
              skin="primary"
              size="medium"
              variant="icon-left"
              iconName="plus-sign"
              onClick={() => editorRef.current?.openCreateModal()}
            >
              Opprett begrep
            </PktButton>
          </div>
        </div>
      </header>

      <GlossaryEditor ref={editorRef} />
    </section>
  );
}
