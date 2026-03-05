export type PivotMeasure =
  | 'quantity'
  | 'quantity_sold'
  | 'avg_price'
  | 'estimated_sales';

export interface PivotRequest {
  rows: string[];
  columns: string[];
  measures: PivotMeasure[];
  filters: {
    sitemap_uid: string;
    start_date?: string;
    end_date?: string;
    month?: string;
  };
}

export interface PivotCell {
  quantity: number;
  quantity_sold: number;
  avg_price: number;
  estimated_sales: number;
}

export interface PivotRow {
  values: Record<string, PivotCell>;
  totals: PivotCell;
  [dimension: string]: any;
}

export interface PivotResponse {
  columns: string[];
  columnTotals: Record<string, PivotCell>;
  rows: PivotRow[];
}
