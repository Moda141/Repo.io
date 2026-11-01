import { api } from './axiosClient';
import type { EntityType } from '@/constants/routes';

export interface GoldenRecord {
  master_id: string;
  entity_type: EntityType;
  name: string;
  attributes: Record<string, unknown>;
  sources: string[];
  parent_id?: string | null;
  status: 'golden' | 'review' | 'duplicate';
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  data: T[];
  paging: { total: number; after?: string; before?: string };
}

export async function listEntities(
  entityType: EntityType,
  params: { limit?: number; after?: string; q?: string } = {}
): Promise<Page<GoldenRecord>> {
  const { data } = await api.get<Page<GoldenRecord>>(
    `/v1/entity/${entityType}`,
    { params }
  );
  return data;
}

export async function getEntity(
  entityType: EntityType,
  masterId: string
): Promise<GoldenRecord> {
  const { data } = await api.get<GoldenRecord>(
    `/v1/entity/${entityType}/${encodeURIComponent(masterId)}`
  );
  return data;
}

export async function patchEntity(
  entityType: EntityType,
  masterId: string,
  patch: Partial<GoldenRecord>
): Promise<GoldenRecord> {
  const { data } = await api.patch<GoldenRecord>(
    `/v1/entity/${entityType}/${encodeURIComponent(masterId)}`,
    patch
  );
  return data;
}
