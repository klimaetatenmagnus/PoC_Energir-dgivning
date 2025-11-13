import React from 'react';
import type { TiltakComponentProps } from '../shared';
import { TemperaturstyringContentComponent } from '../Temperaturstyring';

type TemperaturstyringProps = TiltakComponentProps;

export const Temperaturstyring: React.FC<TemperaturstyringProps> = (props) => (
  <TemperaturstyringContentComponent {...props} audience="gulliste" />
);
