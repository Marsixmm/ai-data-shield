// Copyright © 2026 AI Data Shield. All Rights Reserved. 
// Unauthorized copying, modification, or distribution is prohibited. 
 
export interface AuditLog { 
 timestamp: string; 
 site: string; 
 riskScore: number; 
 findings: Record<string, number>; 
 totalItemsDetected: number; 
 totalTypesDetected: number; 
} 
 
export async function logAudit(site: string, riskScore: number, findings: Record<string, number>) { 
 // REQ 13: Zero Failure Guarantee (Global silent try/catch) 
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
    
   // REQ 12: Memory Hard Limit Enforcement 
   if (logs.length > 100) { 
     logs = logs.slice(-100); 
   } 
    
   await chrome.storage.local.set({ auditLogs: logs }); 
 } catch (error) { 
   // Failsafe: Never crash the main thread. 
 } 
} 
 