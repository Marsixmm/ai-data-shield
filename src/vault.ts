export interface TokenData {
  value: string;
  role: string;
}

export interface TokenMap {
  [token: string]: TokenData;
}

export interface VaultState {
  vault: TokenMap;
  counters: Record<string, number>;
}

const getLetter = (index: number) => String.fromCharCode(65 + index);

export class Vault {
  static async clearVault(state?: VaultState): Promise<void> {
    try {
      await chrome.storage.session.clear();
    } catch (error) {
      // Failsafe
    } finally {
      if (state) {
        state.vault = {};
        state.counters = {};
      }
    }
  }

  static async loadState(): Promise<VaultState> {
    try {
      const data = await chrome.storage.session.get(['tokenVault', 'counters']);
      let vault: TokenMap = data.tokenVault || {};
      let counters: Record<string, number> = data.counters || {};

      if (Object.keys(vault).length > 200) {
        await this.clearVault();
        vault = {};
        counters = {};
      }
      return { vault, counters };
    } catch (error) {
      return { vault: {}, counters: {} };
    }
  }

  static async saveState(state: VaultState): Promise<void> {
    try {
      await chrome.storage.session.set({ tokenVault: state.vault, counters: state.counters });
    } catch (error) {
      // Failsafe
    }
  }

  static getOrGenerateToken(originalText: string, type: string, state: VaultState): string {
    try {
      const existingToken = Object.keys(state.vault).find(key => state.vault[key].value === originalText);
      if (existingToken) return existingToken;

      state.counters[type] = state.counters[type] || 0;
      const token = `[${type}_${getLetter(state.counters[type])}]`;
      state.counters[type]++;

      state.vault[token] = { value: originalText, role: type };
      return token;
    } catch (error) {
      return `[${type}_REDACTED]`;
    }
  }

  static async restoreText(shieldedText: string): Promise<string> {
    try {
      const state = await this.loadState();
      let restored = shieldedText;
      for (const [token, tokenData] of Object.entries(state.vault)) {
        restored = restored.split(token).join(tokenData.value);
      }
      return restored;
    } catch (error) {
      return shieldedText;
    }
  }
}