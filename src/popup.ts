import { redact } from './redactor';
import { Vault } from './vault';
import { getSettings, setSettings } from './settings';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const settings = await getSettings();
    const strictToggle = document.getElementById('strictToggle') as HTMLInputElement;
    const stealthToggle = document.getElementById('stealthToggle') as HTMLInputElement;
    
    if (strictToggle) strictToggle.checked = settings.strictMode;
    if (stealthToggle) stealthToggle.checked = settings.stealthMode;

    strictToggle?.addEventListener('change', async (e) => {
      await setSettings({ strictMode: (e.target as HTMLInputElement).checked });
    });
    stealthToggle?.addEventListener('change', async (e) => {
      await setSettings({ stealthMode: (e.target as HTMLInputElement).checked });
    });

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.tab, .panel').forEach(el => el.classList.remove('active'));
        const target = (e.target as HTMLElement).dataset.target;
        (e.target as HTMLElement).classList.add('active');
        document.getElementById(target!)!.classList.add('active');
        if (target === 'reportPanel') loadComplianceReport();
      });
    });

    const shieldBtn = document.getElementById('shieldBtn') as HTMLButtonElement;
    shieldBtn?.addEventListener('click', async () => {
      try {
        shieldBtn.disabled = true;
        shieldBtn.innerText = "Processing...";

        const rawInput = (document.getElementById('rawInput') as HTMLTextAreaElement).value;
        if (!rawInput) return;

        const result = await redact(rawInput);
        
        const resultDiv = document.getElementById('shieldResult')!;
        const badge = document.getElementById('riskBadge')!;
        const outBox = document.getElementById('shieldOutput') as HTMLTextAreaElement;
        
        resultDiv.style.display = 'block';
        badge.className = `badge ${result.riskLevel}`;
        badge.innerText = `${result.riskLevel} RISK AVERTED`;
        outBox.value = result.safeText;
        
        await navigator.clipboard.writeText(result.safeText);
        
        shieldBtn.innerText = "✓ Copied to Clipboard!";
      } catch (err) {
        // Failsafe
      } finally {
        setTimeout(() => {
          shieldBtn.disabled = false;
          shieldBtn.innerText = "Tokenize & Copy";
        }, 2000);
      }
    });

    const restoreBtn = document.getElementById('restoreBtn') as HTMLButtonElement;
    restoreBtn?.addEventListener('click', async () => {
      try {
        restoreBtn.disabled = true;
        restoreBtn.innerText = "Restoring...";

        const aiInput = (document.getElementById('aiInput') as HTMLTextAreaElement).value;
        if (!aiInput) return;

        const restored = await Vault.restoreText(aiInput);
        (document.getElementById('restoreOutput') as HTMLTextAreaElement).value = restored;
      } catch (err) {
        // Failsafe
      } finally {
        restoreBtn.disabled = false;
        restoreBtn.innerText = "De-Tokenize Data";
      }
    });

    document.getElementById('clearVaultBtn')?.addEventListener('click', async () => {
      await Vault.clearVault();
      alert("Session vault cleared successfully.");
    });

    async function loadComplianceReport() {
      const data = await chrome.storage.local.get(['auditLogs']);
      const logs = data.auditLogs || [];
      
      let totalPrevented = 0;
      logs.forEach((log: any) => {
        if (log.totalItemsDetected) {
            totalPrevented += log.totalItemsDetected;
        } else {
            Object.values(log.findings).forEach((count: any) => {
              totalPrevented += (count as number);
            });
        }
      });

      document.getElementById('totalLeaks')!.innerText = totalPrevented.toString();

      const list = document.getElementById('auditList')!;
      list.innerHTML = '';
      
      if (logs.length === 0) {
        list.innerHTML = '<li style="color:#999; text-align:center; padding:10px;">No threats detected yet.</li>';
        return;
      }

      [...logs].reverse().slice(0, 50).forEach((log: any) => {
        const date = new Date(log.timestamp).toLocaleTimeString();
        list.innerHTML += `
          <li class="log-item">
            <span><strong style="color:#0a192f">${log.site}</strong> <span style="color:#888; font-size:10px;">(${date})</span></span>
            <span style="color:#dc3545; font-weight:600;">+${log.riskScore} pts</span>
          </li>
        `;
      });
    }

  } catch (error) {
    // Failsafe
  }
});