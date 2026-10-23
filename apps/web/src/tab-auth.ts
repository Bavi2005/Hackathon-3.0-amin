/**
 * Authentication belongs to this browser tab, not every tab on the origin.
 *
 * Supabase normally stores one localStorage session and broadcasts sign-in/out
 * across tabs using its auth storageKey. A per-tab sessionStorage key isolates
 * both the persisted credentials and Supabase's BroadcastChannel namespace.
 * The identity survives a normal reload but goes away when the tab closes.
 */
export function tabAuthOptions(projectUrl: string) {
  const storage = window.sessionStorage;
  const project = new URL(projectUrl).hostname.split('.')[0];
  const tabKey = `smarttownship.tab-id.v1.${project}`;
  let tabId = storage.getItem(tabKey);
  if (!tabId || !/^[0-9a-f-]{36}$/i.test(tabId)) {
    tabId = crypto.randomUUID();
    storage.setItem(tabKey, tabId);
  }

  // Discard the old origin-wide login from the previous app version.
  // The first load after upgrading needs a fresh sign-in in each tab.
  try { window.localStorage.removeItem(`sb-${project}-auth-token`); } catch { /* Storage may be blocked. */ }

  return {
    storage,
    storageKey: `smarttownship-tab-auth-${project}-${tabId}`,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  };
}
