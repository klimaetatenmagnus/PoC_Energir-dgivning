import React from 'react';
import type { TiltakComponentProps } from '../shared';
import { SolenergiContentComponent } from '../Solenergi';

type SolenergiGulProps = TiltakComponentProps;

export const SolenergiGul: React.FC<SolenergiGulProps> = (props) => (
  <SolenergiContentComponent {...props} audience="gulliste" />
);
