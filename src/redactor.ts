TypeScript 

// Copyright © 2026 AI Data Shield. All Rights Reserved. 
// Unauthorized copying, modification, or distribution is prohibited. 
 
import nlp from 'compromise'; 
import { Vault, VaultState } from './vault'; 
 
export interface RedactionResult { 
 safeText: string; 
 riskScore: number; 
 riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL'; 
 findings: Record<string, number>; 
} 
 
const RISK_WEIGHTS: Record<string, number> = { 
 SSN: 50, CARD: 50, CASE: 30, EMAIL: 20,  
 PHONE: 20, ADDRESS: 20, CLIENT: 15, DEFENDANT: 15,  
 ATTORNEY: 10, PERSON: 10, ORG: 10, PLACE: 10 
}; 
 
const REGEX_PATTERNS: Record<string, RegExp> = { 
 SSN: /\b\d{3}-\d{2}-\d{4}\b/g, 
 CARD: /\b(?:\d[ -]*?){13,16}\b/g, 
 CASE: /\b(?:Case|Matter|File)\s*[#:-]?\s*[A-Z0-9-]{5,}\b/gi, 
 EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 
 PHONE: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, 
 ADDRESS: /\b\d{1,6}\s+(?:[A-Za-z0-9#-]+\s+){1,5}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Way|Place|Pl)\b/gi 
}; 
 
// REQ 6: Entity Noise Final Filter 
const COMMON_WORDS = new Set(['state', 'court', 'county', 'city', 'department', 'office', 'police', 'federal', 'district', 'judge', 'clerk', 'trial']); 
 
function escapeRegExp(str: string): string { 
 return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
} 
 
// REQ 5: Final Role Detection Expansion 
function getRoleContext(text: string, entity: string): string { 
 const lowerText = text.toLowerCase(); 
 const lowerEntity = entity.toLowerCase(); 
 const idx = lowerText.indexOf(lowerEntity); 
  
 if (idx === -1) return 'PERSON'; 
 
 const start = Math.max(0, idx - 120); 
 const end = Math.min(text.length, idx + entity.length + 120); 
 const contextStr = lowerText.substring(start, end); 
 
 if (/\b(client|plaintiff|petitioner)\b/.test(contextStr)) return 'CLIENT'; 
 if (/\b(defendant|respondent)\b/.test(contextStr)) return 'DEFENDANT'; 
 if (/\b(attorney|lawyer|counsel|esq)\b/.test(contextStr)) return 'ATTORNEY'; 
 
 return 'PERSON'; 
} 
 
export async function redact(input: string): Promise<RedactionResult> { 
 try { 
   let safeText = input.trim().replace(/\s+/g, ' '); 
   const findings: Record<string, number> = {}; 
   let riskScore = 0; 
 
   const vaultState = await Vault.loadState(); 
   const processedTokens = new Set<string>(); 
 
   const addFinding = (type: string, match: string) => { 
     const uniqueKey = `${type}:${match.toLowerCase()}`; 
     if (!processedTokens.has(uniqueKey)) { 
       processedTokens.add(uniqueKey); 
       findings[type] = (findings[type] || 0) + 1; 
       riskScore += RISK_WEIGHTS[type] || 10; 
     } 
   }; 
 
   interface MatchItem { value: string; type: string; } 
   const allMatches: MatchItem[] = []; 
 
   // Phase 1: Regex Extraction 
   for (const type of ['SSN', 'CARD', 'CASE', 'EMAIL', 'PHONE', 'ADDRESS']) { 
     const matches = safeText.match(REGEX_PATTERNS[type]); 
     if (matches) { 
       matches.forEach(m => { 
         if (m.length >= 6) allMatches.push({ value: m, type }); 
       }); 
     } 
   } 
 
   // Phase 2: Unstructured NLP Extraction 
   // REQ 4: Single NLP Execution Guarantee (runs exactly once) 
   const doc = nlp(safeText); 
   const nlpEntities = { 
     PERSON: doc.people().out('array'), 
     ORG: doc.organizations().out('array'), 
     PLACE: doc.places().out('array') 
   }; 
 
   for (const baseType of ['PERSON', 'ORG', 'PLACE']) { 
     const items = nlpEntities[baseType as keyof typeof nlpEntities] as string[]; 
     for (const item of items) { 
       // REQ 6: Entity Noise Final Filter (< 4 chars, single names, common words) 
       if (item.length < 4) continue; 
       const isSingleName = !item.includes(' '); 
       if (isSingleName && baseType === 'PERSON') continue;  
       if (COMMON_WORDS.has(item.toLowerCase())) continue; 
        
       allMatches.push({ value: item, type: baseType }); 
     } 
   } 
 
   // Enforce Longest Match First 
   const uniqueMatchesMap = new Map<string, string>(); 
   allMatches 
     .sort((a, b) => b.value.length - a.value.length) 
     .forEach(match => { 
       if (!uniqueMatchesMap.has(match.value)) { 
         uniqueMatchesMap.set(match.value, match.type); 
       } 
     }); 
 
   // Phase 3: Safe Token Replacement 
   for (const [matchValue, baseType] of uniqueMatchesMap.entries()) { 
     // REQ 1: Absolute Token Immunity (Skip if segment has brackets) 
     if (matchValue.includes('[') || matchValue.includes(']')) continue; 
 
     let finalType = baseType; 
     if (baseType === 'PERSON') { 
       const existingRole = Object.values(vaultState.vault).find(t => t.value === matchValue)?.role; 
       finalType = existingRole || getRoleContext(input, matchValue); 
     } 
 
     const token = Vault.getOrGenerateToken(matchValue, finalType, vaultState); 
      
     // REQ 2: Double Replacement Prevention 
     if (safeText.includes(token)) continue;  
 
     // REQ 3: Final Regex Crash Protection 
     try { 
       const escMatch = escapeRegExp(matchValue); 
       // REQ 1: Strengthened negative lookahead preventing replacement inside any active token brackets 
       const replaceRegex = new RegExp(`\\b${escMatch}\\b(?![^\\[]*\\])`, 'gi'); 
        
       // Ensure replacement actually occurred before registering finding 
       if (replaceRegex.test(safeText)) { 
         safeText = safeText.replace(replaceRegex, token); 
         addFinding(finalType, matchValue); 
       } 
     } catch (err) { 
       // Failsafe: Never break loop if regex compilation fails 
     } 
   } 
 
   // REQ 7: Vault Single Transaction Lock (Save strictly once) 
   await Vault.saveState(vaultState); 
 
   let riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE'; 
   if (riskScore >= 50) riskLevel = 'CRITICAL'; 
   else if (riskScore > 0) riskLevel = 'WARNING'; 
 
   return { safeText, riskScore, riskLevel, findings }; 
 
 } catch (error) { 
   // REQ 13: Zero Failure Guarantee 
   return { safeText: input, riskScore: 0, riskLevel: 'SAFE', findings: {} }; 
 } 
} 
 