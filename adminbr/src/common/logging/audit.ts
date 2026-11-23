export interface AuditLogEntry {
  actorId: string;
  actorEmail: string;
  targetType:
    | "SUPPLIER_PROFILE"
    | "USER"
    | "RFQ"
    | "ORDER"
    | "SAMPLE"
    | "SUPPLIER_CATALOG_ITEM"
    | "FABRIC_COLLECTION";
  targetId: string;
  action: string;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  reason: string;
  requestId?: string;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const timestamp = new Date().toISOString();
  const payload = {
    ...entry,
    timestamp,
  };

  // Structured audit output for log aggregators
  // eslint-disable-next-line no-console
  console.log(`[AUDIT_EVENT] ${JSON.stringify(payload)}`);
}
