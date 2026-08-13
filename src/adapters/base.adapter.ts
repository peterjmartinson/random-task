import { AppConfig } from '../config/config.schema.js';
import { UnifiedItem } from '../models/unified.model.js';

export interface SourceAdapter {
  name: string;
  fetchItems(targetDate: Date, config: AppConfig): Promise<UnifiedItem[]>;
}
