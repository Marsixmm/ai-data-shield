export interface AppSettings {
  strictMode: boolean;
  stealthMode: boolean;
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const result = await chrome.storage.local.get(['strictMode', 'stealthMode']);
    return {
      strictMode: result.strictMode ?? true,
      stealthMode: result.stealthMode ?? false
    };
  } catch (error) {
    return { strictMode: true, stealthMode: false };
  }
}

export async function setSettings(settings: Partial<AppSettings>): Promise<void> {
  try {
    await chrome.storage.local.set(settings);
  } catch (error) {
    // Failsafe
  }
}