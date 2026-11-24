import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminAuditLog, UserRole } from '../db/types';
import { supabase } from './supabase';

export interface AuthorizedRecord {
  owner_id: string;
  table_name: string;
  record_id: string;
  site_id: string | null;
  data: Record<string, unknown>;
}

export interface MemberRow {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  mobile: string;
  role: 'USER' | 'SUB_ADMIN' | 'SUPER_ADMIN';
  is_active: boolean;
  permissions: Record<string, { read: boolean; write: boolean }>;
  created_at: string;
}

interface AuditRow {
  id: number;
  actor_id: string | null;
  target_user_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

function requireClient(client = supabase): SupabaseClient {
  if (!client) throw new Error('Supabase Auth is not configured.');
  return client;
}

export async function getAuthorizedRecords(client = supabase): Promise<AuthorizedRecord[]> {
  const dbClient = requireClient(client);
  const pageSize = 1000;
  const records: AuthorizedRecord[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await dbClient
      .from('mistry_records')
      .select('owner_id,table_name,record_id,site_id,data')
      .order('owner_id')
      .order('table_name')
      .order('record_id')
      .range(offset, offset + pageSize - 1);
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) return [];
      throw new Error(`Could not load authorized construction records: ${error.message}`);
    }
    const page = (data || []) as AuthorizedRecord[];
    records.push(...page);
    if (page.length < pageSize) return records;
  }
}

export async function getAdminAuditLogs(client = supabase): Promise<AdminAuditLog[]> {
  const dbClient = requireClient(client);
  const { data, error } = await dbClient
    .from('mistry_admin_audit')
    .select('id,actor_id,target_user_id,action,details,created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) return [];
    throw new Error(`Could not load the secure admin audit log: ${error.message}`);
  }
  return ((data || []) as AuditRow[]).map(row => ({
    id: String(row.id),
    action: row.action,
    actorId: row.actor_id || '',
    actorName: row.actor_id || 'Unknown',
    actorRole: 'SUPER_ADMIN' as UserRole,
    affectedRecordId: row.target_user_id || undefined,
    affectedTable: 'mistry_members',
    result: 'SUCCESS',
    details: JSON.stringify(row.details),
    timestamp: row.created_at,
  }));
}

export async function getMemberProfiles(client = supabase): Promise<MemberRow[]> {
  const dbClient = requireClient(client);
  const { data, error } = await dbClient
    .from('mistry_members')
    .select('user_id,email,username,full_name,mobile,role,is_active,permissions,created_at')
    .order('created_at', { ascending: false });
  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) return [];
    throw new Error(`Could not load authorized account profiles: ${error.message}`);
  }
  return (data || []) as MemberRow[];
}

export function toAppRecord(record: AuthorizedRecord): Record<string, unknown> {
  const data: Record<string, unknown> = { ...record.data, id: record.record_id };
  if (record.table_name === 'sites' || 'userId' in data) data.userId = record.owner_id;
  return data;
}

export function groupAuthorizedRecords(records: AuthorizedRecord[]): Map<string, Record<string, unknown>[]> {
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const record of records) {
    const rows = grouped.get(record.table_name) || [];
    rows.push(toAppRecord(record));
    grouped.set(record.table_name, rows);
  }
  return grouped;
}
