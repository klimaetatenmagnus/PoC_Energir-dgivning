import { useRef } from "react";
import { PktButton } from "@oslokommune/punkt-react";
import { BenefitsEditor, type BenefitsEditorHandle } from "./BenefitsEditor";
import "./ContentList.css";

interface BenefitsPageProps {
  onBack: () => void;
}

export function BenefitsPage({ onBack }: BenefitsPageProps) {
  const editorRef = useRef<BenefitsEditorHandle | null>(null);

  return (
    <section className="admin-benefits-page">
      <header className="admin-content__header">
        <div className="admin-content__heading">
          <div className="admin-content__heading-row">
            <h2>Fordeler som kan redigeres</h2>
            <PktButton
              skin="secondary"
              size="medium"
              variant="icon-left"
              iconName="arrow-return"
              onClick={onBack}
            >
              <span>Tilbake</span>
            </PktButton>
          </div>
          <div className="admin-content__primary-action">
            <PktButton
              skin="primary"
              size="medium"
              variant="icon-left"
              iconName="plus-sign"
              onClick={() => editorRef.current?.openCreateModal()}
            >
              Opprett fordel
            </PktButton>
          </div>
        </div>
      </header>

      <BenefitsEditor ref={editorRef} />
    </section>
  );
}
