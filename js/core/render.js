window.NEON_BREW_RENDER = Object.freeze({
  stars(rating) {
    return Array.from({ length: 5 }, (_, index) =>
      `<span class="star ${index < rating ? 'filled' : ''}">${index < rating ? '★' : '☆'}</span>`
    ).join('');
  },
  logHtml(entries) {
    if (!entries.length) {
      return '<div class="log-entry"><b>CA ĐÊM · 00:00</b><span>Quán mở cửa. Thành phố đang chờ.</span></div>';
    }
    return entries.map(entry =>
      `<div class="log-entry"><b>${window.NEON_BREW_HELPERS.escapeHtml(entry.time)} · ${window.NEON_BREW_HELPERS.escapeHtml(entry.label)}</b><span>${window.NEON_BREW_HELPERS.escapeHtml(entry.message)}</span></div>`
    ).join('');
  },
  moneyRate(value) {
    const fixed = value % 1 ? 1 : 0;
    return value.toFixed(fixed);
  }
});
