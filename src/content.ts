import { redact } from './redactor';
import { logAudit } from './audit';
import { getSettings } from './settings';

const SITE_SELECTORS = [
  { prompt: 'textarea[id="prompt-textarea"], div[contenteditable="true"]', sendBtn: 'button[data-testid="send-button"]' },
  { prompt: 'div[contenteditable="true"]', sendBtn: 'button[aria-label*="Send"]' },
  { prompt: 'textarea', sendBtn: 'button[type="submit"]' }
];

let isProcessing = false;
let bypassToken = false;

async function handleIntercept(element: HTMLElement, event: Event): Promise<void> {
  if (isProcessing || bypassToken) return;
  
  try {
    isProcessing = true;
    
    const text = (element as HTMLTextAreaElement).value ?? 
                 element.innerText ?? 
                 element.textContent ?? 
                 "";
                 
    if (!text.trim()) return;

    const result = await redact(text);
    
    if (result.riskScore > 0) {
      event.preventDefault();
      event.stopImmediatePropagation(); 
      
      await logAudit(window.location.hostname, result.riskScore, result.findings);
      
      const { strictMode, stealthMode } = await getSettings();

      if (strictMode) {
        if (!stealthMode) {
          alert(`AI Data Shield blocked this message.\nSensitive data must be shielded before sending.`);
        }
        return; 
      } 
      
      if (element instanceof HTMLTextAreaElement) {
        element.value = result.safeText;
      } else {
        element.innerText = result.safeText;
        element.textContent = result.safeText; 
      }
      
      element.dispatchEvent(new Event('input', { bubbles: true }));

      bypassToken = true;
      setTimeout(() => {
        try {
          if (event.type === 'click') {
            (event.target as HTMLElement).click();
          } else if (event.type === 'keydown' && (event as KeyboardEvent).key === 'Enter') {
             const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', bubbles: true, cancelable: true
             });
             element.dispatchEvent(enterEvent);
          } else if (event.type === 'submit') {
            const form = element.closest('form');
            if(form) form.submit();
          }
        } catch(err) {
            // Failsafe silent catch
        } finally {
          bypassToken = false; 
        }
      }, 100);
      
      setTimeout(() => { bypassToken = false; }, 250); 
    }
  } catch (error) {
    // Failsafe
  } finally {
    setTimeout(() => { isProcessing = false; }, 500); 
  }
}

function startObserver() {
  try {
    const observer = new MutationObserver(() => {
      SITE_SELECTORS.forEach(({ prompt, sendBtn }) => {
        
        document.querySelectorAll(prompt).forEach(box => {
          if ((box as HTMLElement).dataset.shielded) return;
          (box as HTMLElement).dataset.shielded = "true";
          
          box.addEventListener('keydown', async (e: Event) => {
            const kbEvent = e as KeyboardEvent;
            if (kbEvent.key === 'Enter' && !kbEvent.shiftKey) {
              await handleIntercept(box as HTMLElement, e);
            }
          }, true); 
        });

        document.querySelectorAll(sendBtn).forEach(btn => {
          if ((btn as HTMLElement).dataset.shielded) return;
          (btn as HTMLElement).dataset.shielded = "true";

          btn.addEventListener('click', async (e: Event) => {
            const box = document.querySelector(prompt) as HTMLElement;
            if (box) await handleIntercept(box, e);
          }, true); 
        });

      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("submit", async (e: Event) => {
      const activeElem = document.activeElement as HTMLElement;
      if (activeElem && (activeElem.tagName === 'TEXTAREA' || activeElem.isContentEditable)) {
        await handleIntercept(activeElem, e);
      }
    }, true);
  } catch (error) {
    // Failsafe
  }
}

getSettings().then(settings => {
  if (!settings.stealthMode) {
    console.log("🔒 AI Data Shield Enterprise Active");
  }
}).catch(() => {});

startObserver();