import React from 'react';
import type { TiltakComponentProps } from '../shared';
import { TettingContentComponent } from '../Tetting';

type TettingProps = TiltakComponentProps;

export const Tetting: React.FC<TettingProps> = (props) => (
  <TettingContentComponent {...props} audience="gulliste" />
);
