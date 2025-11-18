import { PktButton } from "@oslokommune/punkt-react";
import { AdminEnvironment } from "../types";
import "./EnvironmentToggle.css";

interface EnvironmentToggleProps {
  environment: AdminEnvironment;
  onChange: (env: AdminEnvironment) => void;
}

export function EnvironmentToggle({
  environment,
  onChange,
}: EnvironmentToggleProps) {
  const isProd = environment === "prod";

  return (
    <div className="admin-env-toggle">
      <p className="admin-env-toggle__label">
        {isProd ? "Produksjon (lesevisning)" : "Staging (skrivetilgang)"}
      </p>
      <div className="admin-env-toggle__actions">
        <PktButton
          skin={!isProd ? "primary" : "secondary"}
          onClick={() => onChange("staging")}
          variant="label-only"
        >
          Staging
        </PktButton>
        <PktButton
          skin={isProd ? "primary" : "secondary"}
          onClick={() => onChange("prod")}
          variant="label-only"
        >
          Produksjon
        </PktButton>
      </div>
    </div>
  );
}
