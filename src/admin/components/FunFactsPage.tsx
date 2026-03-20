import { useRef } from "react";
import { PktButton } from "@oslokommune/punkt-react";
import { FunFactsEditor, type FunFactsEditorHandle } from "./FunFactsEditor";
import "./ContentList.css";

interface FunFactsPageProps {
  onBack: () => void;
}

export function FunFactsPage({ onBack }: FunFactsPageProps) {
  const editorRef = useRef<FunFactsEditorHandle | null>(null);

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
            <h2>Fun facts</h2>
            <p className="admin-subtitle">
              Korte tekster som vises mens brukeren venter på boliginformasjon.
            </p>
          </div>
          <div className="admin-content__primary-action">
            <PktButton
              skin="primary"
              size="medium"
              variant="icon-left"
              iconName="plus-sign"
              onClick={() => editorRef.current?.openCreateModal()}
            >
              Opprett fun fact
            </PktButton>
          </div>
        </div>
      </header>

      <FunFactsEditor ref={editorRef} />
    </section>
  );
}
