# AI Data Shield (Enterprise Edition) 🔒
**Local-First Data Redaction for the Generative AI Era**

AI Data Shield is a high-performance Chrome Extension designed to bridge the gap between AI productivity and enterprise data privacy. It acts as a secure, local-only interceptor that redacts PII (Personally Identifiable Information), PHI (Protected Health Information), and sensitive legal data before it ever reaches the cloud.

## 🚀 Key Value Propositions
* **Zero-Trust Architecture:** Redaction happens locally in the browser. No raw data is ever sent to our servers or AI providers.
* **NLP-Driven Detection:** Utilizes advanced Natural Language Processing to detect names, roles (Plaintiff/Defendant/Attorney), and locations in context.
* **Audit-Ready Compliance:** Maintains a local, encrypted audit log of prevented data leaks for corporate compliance reporting.
* **Round-Trip Restoration:** Seamlessly swap tokens back for original data once the AI provides its output.

## 🛠️ Tech Stack
* **Language:** TypeScript
* **Bundler:** Vite 
* **Engine:** Compromise NLP
* **Security:** GitHub Dependabot + local session vaulting

## 🏗️ Getting Started (For Developers)

1. **Clone the repo:**
   ```bash
   git clone [https://github.com/Marsixmm/ai-data-shield.git](https://github.com/Marsixmm/ai-data-shield.git)