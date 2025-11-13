import React from 'react';
import type { TiltakComponentProps } from '../shared';
import { VarmepumpeContentComponent } from '../Varmepumpe';

type VarmepumpeGulProps = TiltakComponentProps;

export const VarmepumpeGul: React.FC<VarmepumpeGulProps> = (props) => (
  <VarmepumpeContentComponent {...props} audience="gulliste" />
);
