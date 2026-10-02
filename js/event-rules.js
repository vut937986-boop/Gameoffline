window.NEON_BREW_EVENT_RULES = Object.freeze({
  securityKind(random) {
    const roll = random();
    if (roll < .2) return 'ransomware';
    if (roll < .36) return 'union';
    return random() < .55 ? 'hacker' : 'gang';
  },
  challenge(random, kind) {
    const left = Math.floor(random() * 8) + 2;
    const right = Math.floor(random() * 7) + 2;
    return {left, right, answer: kind === 'hacker' ? left * right : left + right};
  },
  ransom(money) {
    return Math.max(1, Math.ceil(money * .1));
  },
  hackSucceeds(random, firewallLevel) {
    return random() < Math.min(.95, .7 + firewallLevel * .1);
  },
  formatSucceeds(random) {
    return random() < .3;
  },
  matrixDuration: 10000,
  matrixCycles: 3
});
