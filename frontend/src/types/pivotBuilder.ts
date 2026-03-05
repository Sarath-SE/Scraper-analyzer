import type { PivotMeasure } from './pivot';

export interface PivotBuilderState {
  rows: string[];
  columns: string[];
  measures: PivotMeasure[];
}
