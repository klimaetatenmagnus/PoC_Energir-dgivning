import React from 'react';
import type { TiltakComponentProps } from '../shared';
import { IsoleringAvKjellerOgLoftContentComponent } from '../IsoleringAvKjellerOgLoft';

type IsoleringAvKjellerOgLoftGulProps = TiltakComponentProps;

export const IsoleringAvKjellerOgLoftGul: React.FC<IsoleringAvKjellerOgLoftGulProps> = (props) => (
  <IsoleringAvKjellerOgLoftContentComponent {...props} audience="gulliste" />
);
