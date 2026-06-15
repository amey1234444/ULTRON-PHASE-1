export type SensorStatus = 'normal' | 'warning' | 'alarm' | 'not_installed';
export type SensorPhase  = 'phase1' | 'phase2' | 'future';
export type CalloutSide  = 'left' | 'right';

export interface SensorPoint {
  tag:         string;
  name:        string;
  value:       number | string | null;
  unit:        string;
  status:      SensorStatus;
  installed:   boolean;
  phase:       SensorPhase;
  location:    string;
  description: string;
  dotX:        number;
  dotY:        number;
  calloutX:    number;
  calloutY:    number;
  calloutSide: CalloutSide;
}
