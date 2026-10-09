export type Row = Record<string, unknown>;
export type Dataset = { rows: Row[]; total: number | null; complete: boolean; status?: number; error?: string; endpoint: string };
export type Assignment = { resourceKey: string; username: string; userId: string; systemUser: string; allocationType: string };
export type ResourceReport = { fetchedAt: string; baseUrl: string; resources: Dataset; users: Dataset; assignments: Assignment[]; allocationErrors: string[]; allocationComplete: boolean };
export function label(value: unknown): string { if (value == null || value === "") return "—"; if (typeof value === "object") { const obj=value as Row; return label(obj.username ?? obj.name ?? obj.display_name ?? obj.id); } return String(value); }
export function resourceKey(row: Row) { return label(row.resource_type) + ":" + label(row.id); }
export function resourceName(row: Row) { return label(row.display_name ?? row.asset_name ?? row.app_name ?? row.web_app_name ?? row.name ?? row.id); }
