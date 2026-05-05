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

const COMMON_WORDS = new Set(['state', 'court', 'county', 'city', 'department', 'office', 'police', 'federal', 'district', 'judge', 'clerk', 'trial']);

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

    for (const type of ['SSN', 'CARD', 'CASE', 'EMAIL', 'PHONE', 'ADDRESS']) {
      const matches = safeText.match(REGEX_PATTERNS[type]);
      if (matches) {
        matches.forEach(m => {
          if (m.length >= 6) allMatches.push({ value: m, type });
        });
      }
    }

    const doc = nlp(safeText);
    const nlpEntities = {
      PERSON: doc.people().out('array'),
      ORG: doc.organizations().out('array'),
      PLACE: doc.places().out('array')
    };

    for (const baseType of ['PERSON', 'ORG', 'PLACE']) {
      const items = nlpEntities[baseType as keyof typeof nlpEntities] as string[];
      for (const item of items) {
        if (item.length < 4) continue;
        const isSingleName = !item.includes(' ');
        if (isSingleName && baseType === 'PERSON') continue; 
        if (COMMON_WORDS.has(item.toLowerCase())) continue;
        
        allMatches.push({ value: item, type: baseType });
      }
    }

    const uniqueMatchesMap = new Map<string, string>();
    allMatches
      .sort((a, b) => b.value.length - a.value.length)
      .forEach(match => {
        if (!uniqueMatchesMap.has(match.value)) {
          uniqueMatchesMap.set(match.value, match.type);
        }
      });

    for (const [matchValue, baseType] of uniqueMatchesMap.entries()) {
      if (matchValue.includes('[') || matchValue.includes(']')) continue;

      let finalType = baseType;
      if (baseType === 'PERSON') {
        const existingRole = Object.values(vaultState.vault).find(t => t.value === matchValue)?.role;
        finalType = existingRole || getRoleContext(input, matchValue);
      }

      const token = Vault.getOrGenerateToken(matchValue, finalType, vaultState);
      
      if (safeText.includes(token)) continue; 

      try {
        const escMatch = escapeRegExp(matchValue);
        const replaceRegex = new RegExp(`\\b${escMatch}\\b(?![^\\[]*\\])`, 'gi');
        
        if (replaceRegex.test(safeText)) {
          safeText = safeText.replace(replaceRegex, token);
          addFinding(finalType, matchValue);
        }
      } catch (err) {
        // Failsafe
      }
    }

    await Vault.saveState(vaultState);

    let riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
    if (riskScore >= 50) riskLevel = 'CRITICAL';
    else if (riskScore > 0) riskLevel = 'WARNING';

    return { safeText, riskScore, riskLevel, findings };

  } catch (error) {
    return { safeText: input, riskScore: 0, riskLevel: 'SAFE', findings: {} };
  }
}