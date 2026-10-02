window.NEON_BREW_SAVE_MANAGER = Object.freeze({
  loadUiSettings(storage = localStorage, key) {
    try {
      const settings = JSON.parse(storage.getItem(key) || '{}');
      return {
        theme: ['neon', 'blood', 'fog'].includes(settings.theme) ? settings.theme : 'neon',
        language: settings.language === 'en' ? 'en' : 'vi'
      };
    } catch {
      return { theme: 'neon', language: 'vi' };
    }
  },

  saveUiSettings(settings, storage = localStorage, key) {
    storage.setItem(key, JSON.stringify(settings));
  },

  load({ storage = localStorage, primaryKey, backupKey, createFreshState, migrate }) {
    let parsed = null;
    try {
      parsed = JSON.parse(storage.getItem(primaryKey) || 'null');
    } catch {}
    if (!parsed) {
      try {
        parsed = JSON.parse(storage.getItem(backupKey) || 'null');
      } catch {}
    }
    if (!parsed || typeof parsed !== 'object') return createFreshState();
    try {
      return migrate(parsed);
    } catch {
      return createFreshState();
    }
  },

  save(state, { storage = localStorage, primaryKey, backupKey, isResetting, onSaved, onError }) {
    if (isResetting) return;
    state.lastSeen = Date.now();
    try {
      const snapshot = JSON.stringify(state);
      storage.setItem(primaryKey, snapshot);
      storage.setItem(backupKey, snapshot);
      onSaved?.();
    } catch {
      onError?.();
    }
  },

  clear(keys, storage = localStorage) {
    for (const key of keys) storage.removeItem(key);
  },

  encodeExport(state, version) {
    const bytes = new TextEncoder().encode(JSON.stringify({ game: 'neon-brew', version, state }));
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binary);
  },

  importSave(encoded, { storage = localStorage, key, version }) {
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    const bundle = JSON.parse(new TextDecoder().decode(bytes));
    if (bundle.game !== 'neon-brew' || bundle.version !== version || !bundle.state || typeof bundle.state !== 'object' || !Number.isFinite(bundle.state.money) || !Number.isFinite(bundle.state.served) || !Array.isArray(bundle.state.unlockedRecipes)) {
      throw new Error('Mã lưu không hợp lệ.');
    }
    for (const recipe of bundle.state.unlockedRecipes) {
      if (!recipe || typeof recipe.id !== 'string' || typeof recipe.name !== 'string' || typeof recipe.price !== 'number') {
        throw new Error('Công thức trong mã lưu không hợp lệ.');
      }
      recipe.name = recipe.name.slice(0, 48);
      recipe.short = String(recipe.short || 'Lab').slice(0, 20);
      recipe.details = String(recipe.details || '').slice(0, 100);
      recipe.recipe = String(recipe.recipe || recipe.details).slice(0, 120);
      recipe.icon = String(recipe.icon || '🧪').slice(0, 4);
      recipe.tags = Array.isArray(recipe.tags) ? recipe.tags.filter(tag => ['caffeine', 'bold', 'energy', 'legend', 'premium', 'hot'].includes(tag)) : [];
    }
    storage.setItem(key, JSON.stringify(bundle.state));
  }
});