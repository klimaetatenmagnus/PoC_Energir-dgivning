import React from 'react';
import type { TiltakComponentProps } from '../shared';
import { UtskiftningAvVinduContentComponent } from '../UtskiftningAvVindu';

type UtskiftningAvVinduGulProps = TiltakComponentProps;

export const UtskiftningAvVinduGul: React.FC<UtskiftningAvVinduGulProps> = (props) => (
  <UtskiftningAvVinduContentComponent {...props} audience="gulliste" />
);
