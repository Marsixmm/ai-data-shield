/**
 * AI Data Shield - Enterprise Edition
 * Content Script: Intercepts text input in web-based LLMs
 */

import { getSettings } from './settings';

// Selectors for AI platforms
const PLATFORM_SELECTORS = [
  { prompt: `textarea[id="prompt-textarea"], div[contenteditable="true"]`, sendBtn: `button[data-testid="send-button"]` },
  { prompt: `div[contenteditable="true"]`, sendBtn: `button[aria-label*="Send"]` },
  { prompt: `textarea`, sendBtn: `button[type="submit"]` }
];

// Audit logging
async function logAudit(hostname: string, riskScore: number, findings: Record<string, number>): Promise<void> {
  try {
    if (riskScore === 0) return;

    const findingKeys = Object.keys(findings);
    const totalItems = findingKeys.reduce((sum, key) => sum + findings[key], 0);

    const auditEntry = {
      timestamp: new Date().toISOString(),
      site: hostname,
      riskScore,
      findings,
      totalItemsDetected: totalItems,
      totalTypesDetected: findingKeys.length
    };

    let logs = (await chrome.storage.local.get(['auditLogs'])).auditLogs || [];
    logs.push(auditEntry);
    
    // Keep only last 100 entries
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }

    await chrome.storage.local.set({ auditLogs: logs });
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
}

// Process and shield text before submission
async function shieldAndSubmit(inputElement: HTMLElement, event: Event): Promise<void> {
  try {
    // Get current text
    const text = inputElement instanceof HTMLTextAreaElement 
      ? inputElement.value 
      : inputElement.innerText || inputElement.textContent || '';

    if (!text.trim()) return;

    // Analyze for sensitive data
    const analysis = await analyzeText(text);

    if (analysis.riskScore > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();

      // Log the threat
      await logAudit(window.location.hostname, analysis.riskScore, analysis.findings);

      const { strictMode, stealthMode } = await getSettings();

      // Strict mode: block submission
      if (strictMode) {
        if (!stealthMode) {
          alert('AI Data Shield blocked this message.\nSensitive data must be shielded before sending.');
        }
        return;
      }

      // Auto-shield: replace sensitive data
      if (inputElement instanceof HTMLTextAreaElement) {
        inputElement.value = analysis.safeText;
      } else {
        inputElement.innerText = analysis.safeText;
        inputElement.textContent = analysis.safeText;
      }

      // Trigger input event for framework detection
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));

      // Proceed with submission after shield applied
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        if (event.type === 'click') {
          (event.target as HTMLElement).click();
        } else if (event.type === 'keydown' && (event as KeyboardEvent).key === 'Enter') {
          const keyEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true,
            cancelable: true
          });
          inputElement.dispatchEvent(keyEvent);
        } else if (event.type === 'submit') {
          const form = inputElement.closest('form');
          if (form) form.submit();
        }
      } catch (error) {
        console.error('Submission failed:', error);
      }
    }
  } catch (error) {
    console.error('Shield processing failed:', error);
  }
}

// Setup DOM mutation observer for dynamic content
function setupShield(): void {
  try {
    const observer = new MutationObserver(() => {
      PLATFORM_SELECTORS.forEach(({ prompt, sendBtn }) => {
        // Shield all prompt inputs
        document.querySelectorAll(prompt).forEach((element) => {
          if (!element.dataset.shielded) {
            element.dataset.shielded = 'true';

            // Intercept Enter key
            element.addEventListener('keydown', async (e: Event) => {
              const keyEvent = e as KeyboardEvent;
              if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
                await shieldAndSubmit(element as HTMLElement, e);
              }
            }, true);
          }
        });

        // Shield all send buttons
        document.querySelectorAll(sendBtn).forEach((button) => {
          if (!button.dataset.shielded) {
            button.dataset.shielded = 'true';

            button.addEventListener('click', async (e: Event) => {
              const promptElement = document.querySelector(prompt);
              if (promptElement) {
                await shieldAndSubmit(promptElement as HTMLElement, e);
              }
            }, true);
          }
        });
      });
    });

    // Watch for new elements
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also catch form submissions
    document.addEventListener('submit', async (e: Event) => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
        await shieldAndSubmit(activeElement, e);
      }
    }, true);
  } catch (error) {
    console.error('Shield setup failed:', error);
  }
}

// Initialize
getSettings()
  .then(settings => {
    if (!settings.stealthMode) {
      console.log('🔒 AI Data Shield Enterprise Active');
    }
  })
  .catch(() => {
    // Settings unavailable, proceed anyway
  });

setupShield();