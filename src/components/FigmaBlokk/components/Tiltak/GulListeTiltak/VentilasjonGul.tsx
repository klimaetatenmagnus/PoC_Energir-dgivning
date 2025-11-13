import React from 'react';
import type { TiltakComponentProps } from '../shared';
import { VentilasjonContentComponent } from '../Ventilasjon';

type VentilasjonGulProps = TiltakComponentProps;

export const VentilasjonGul: React.FC<VentilasjonGulProps> = (props) => (
  <VentilasjonContentComponent {...props} audience="gulliste" />
);
