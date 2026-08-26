import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountType, DirectDebitStatus, UserAccount } from "@/lib/domain/types";

export interface AccountWriteInput {
  providerId: string | null;
  accountType: AccountType;
  nickname: string | null;
  lastFour: string | null;
  balanceMinor: number | null;
  creditLimitMinor: number | null;
  directDebitStatus: DirectDebitStatus;
}

export function mapAccountRow(row: Record<string, unknown>): UserAccount {
  const provider = row.providers as { display_name?: string } | null | undefined;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    providerId: row.provider_id ? String(row.provider_id) : null,
    providerName: provider?.display_name ?? null,
    accountType: row.account_type as UserAccount["accountType"],
    nickname: row.nickname ? String(row.nickname) : null,
    lastFour: row.last_four ? String(row.last_four) : null,
    balanceMinor: row.balance_minor === null || row.balance_minor === undefined ? null : Number(row.balance_minor),
    creditLimitMinor: row.credit_limit_minor === null || row.credit_limit_minor === undefined ? null : Number(row.credit_limit_minor),
    currency: String(row.currency ?? "GBP"),
    directDebitStatus: row.direct_debit_status as UserAccount["directDebitStatus"],
    source: row.source as UserAccount["source"],
    active: Boolean(row.active),
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null,
  };
}

const ACCOUNT_SELECT = "*, providers(display_name)";

export async function listUserAccounts(supabase: SupabaseClient, userId: string): Promise<UserAccount[]> {
  const { data, error } = await supabase
    .from("user_accounts")
    .select(ACCOUNT_SELECT)
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapAccountRow(row as Record<string, unknown>));
}

export async function getUserAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<UserAccount | null> {
  const { data, error } = await supabase
    .from("user_accounts")
    .select(ACCOUNT_SELECT)
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAccountRow(data as Record<string, unknown>) : null;
}

export async function createUserAccount(
  supabase: SupabaseClient,
  userId: string,
  input: AccountWriteInput,
): Promise<UserAccount> {
  const { data, error } = await supabase
    .from("user_accounts")
    .insert({
      user_id: userId,
      provider_id: input.providerId,
      account_type: input.accountType,
      nickname: input.nickname,
      last_four: input.lastFour,
      balance_minor: input.balanceMinor,
      credit_limit_minor: input.creditLimitMinor,
      direct_debit_status: input.directDebitStatus,
      source: "manual",
    })
    .select(ACCOUNT_SELECT)
    .single();
  if (error) throw error;
  return mapAccountRow(data as Record<string, unknown>);
}

export async function updateUserAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  input: Partial<AccountWriteInput>,
): Promise<UserAccount | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("providerId" in input) update.provider_id = input.providerId;
  if ("accountType" in input) update.account_type = input.accountType;
  if ("nickname" in input) update.nickname = input.nickname;
  if ("lastFour" in input) update.last_four = input.lastFour;
  if ("balanceMinor" in input) update.balance_minor = input.balanceMinor;
  if ("creditLimitMinor" in input) update.credit_limit_minor = input.creditLimitMinor;
  if ("directDebitStatus" in input) update.direct_debit_status = input.directDebitStatus;

  const { data, error } = await supabase
    .from("user_accounts")
    .update(update)
    .eq("id", accountId)
    .eq("user_id", userId)
    .select(ACCOUNT_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAccountRow(data as Record<string, unknown>) : null;
}

export async function deactivateUserAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_accounts")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
