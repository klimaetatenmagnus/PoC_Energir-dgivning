import React from 'react';
import type { TiltakComponentProps } from '../shared';
import { EtterisoleringYtterveggContentComponent } from '../EtterisoleringYttervegg';

type EtterisoleringYtterveggGulProps = TiltakComponentProps;

export const EtterisoleringYtterveggGul: React.FC<EtterisoleringYtterveggGulProps> = (props) => (
  <EtterisoleringYtterveggContentComponent {...props} audience="gulliste" />
);
