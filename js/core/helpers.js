window.NEON_BREW_HELPERS = Object.freeze({
  parseThreatAnswer(raw) {
    const value = String(raw ?? '').trim();
    if (!value) return Number.NaN;
    const normalized = value.toLowerCase().replace(/×/g, 'x').replace(/\s+/g, '');
    if (/^\d+$/.test(normalized)) return Number(normalized);
    const match = normalized.match(/^(\d+)([x*+-])(\d+)$/);
    if (!match) return Number.NaN;
    const left = Number(match[1]);
    const op = match[2];
    const right = Number(match[3]);
    if (op === '+') return left + right;
    if (op === '-') return left - right;
    if (op === '*' || op === 'x') return left * right;
    return Number.NaN;
  },
  escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }
});
