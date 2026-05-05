export interface AuditLog {
  timestamp: string;
  site: string;
  riskScore: number;
  findings: Record<string, number>;
  totalItemsDetected: number;
  totalTypesDetected: number;
}

export async function logAudit(site: string, riskScore: number, findings: Record<string, number>) {
  try {
    if (riskScore === 0) return;
    
    const types = Object.keys(findings);
    const totalItems = types.reduce((sum, key) => sum + findings[key], 0);
    
    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      site,
      riskScore,
      findings,
      totalItemsDetected: totalItems,
      totalTypesDetected: types.length
    };

    const data = await chrome.storage.local.get(['auditLogs']);
    let logs: AuditLog[] = data.auditLogs || [];
    logs.push(log);
    
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }
    
    await chrome.storage.local.set({ auditLogs: logs });
  } catch (error) {
    // Failsafe
  }
}