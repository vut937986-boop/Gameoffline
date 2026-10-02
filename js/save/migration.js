window.NEON_BREW_MIGRATION = Object.freeze({
  withShiftDefaults(value, ingredients) {
    const normalized = {
      ...value,
      shift: Math.max(1, Math.floor(Number(value.shift) || 1)),
      shiftOrders: Math.max(0, Math.floor(Number(value.shiftOrders) || 0)),
      shiftServed: Math.max(0, Math.floor(Number(value.shiftServed) || 0)),
      shiftRevenue: Math.max(0, Number(value.shiftRevenue) || 0),
      shiftClosed: !!value.shiftClosed,
      dealIngredient: ingredients.some(item => item.id === value.dealIngredient) ? value.dealIngredient : 'espresso',
      orderSpec: { size: 'M', sugar: 50, ice: 50, topping: 'none', ...(value.orderSpec || {}) }
    };
    normalized.inventoryLots = Object.fromEntries(ingredients.map(item => {
      const saved = Array.isArray(value.inventoryLots?.[item.id]) ? value.inventoryLots[item.id] : null;
      const lots = saved
        ? saved.map(lot => ({
            quantity: Math.max(0, Math.floor(Number(lot.quantity) || 0)),
            purchasedShift: Math.max(1, Math.floor(Number(lot.purchasedShift) || normalized.shift))
          })).filter(lot => lot.quantity > 0)
        : Number(value.inventory?.[item.id]) > 0
          ? [{ quantity: Math.max(0, Math.floor(Number(value.inventory[item.id]) || 0)), purchasedShift: normalized.shift }]
          : [];
      return [item.id, lots];
    }));
    normalized.inventory = Object.fromEntries(ingredients.map(item => [
      item.id,
      normalized.inventoryLots[item.id].reduce((sum, lot) => sum + lot.quantity, 0)
    ]));
    return normalized;
  },

  migrate(parsed, { initialState, withShiftDefaults, ingredients, recipes, eventRules, saveVersion }) {
    const oldCafeVersion = Number(parsed.modernCafeVersion) || 0;
    if (oldCafeVersion === 0) {
      parsed.money = Math.max(0, Number(parsed.money) || 0) * 1000;
      parsed.unlockedRecipes = [];
    }
    if (oldCafeVersion < 6) {
      parsed.shiftOrders = 0;
      parsed.shiftServed = 0;
      parsed.shiftRevenue = 0;
      parsed.shiftClosed = false;
      parsed.orderId = 'meteor';
      parsed.orderNumber = 1;
      parsed.orderSpec = { size: 'M', sugar: 50, ice: 50, topping: 'none' };
      parsed.orderStarted = Date.now();
      parsed.orderExpires = Date.now() + 45000;
      parsed.orderShuffleAt = Date.now() + 30000;
      parsed.orderVip = false;
      parsed.reviewScore = 100;
      parsed.starRating = 5;
      parsed.badOrders = 0;
      parsed.inspectionProgress = 0;
      parsed.inspectionActive = false;
      parsed.gameOver = false;
      parsed.log = [];
    }
    if (oldCafeVersion < saveVersion) parsed.recipeUnlocks = recipes.map(recipe => recipe.id);
    parsed.modernCafeVersion = saveVersion;

    const base = withShiftDefaults(initialState());
    const state = withShiftDefaults({
      ...base,
      ...parsed,
      inventoryLots: parsed.inventoryLots,
      inventory: { ...base.inventory, ...parsed.inventory },
      factionRep: { ...base.factionRep, ...parsed.factionRep },
      customerLoyalty: { ...base.customerLoyalty, ...parsed.customerLoyalty },
      decorations: { ...base.decorations, ...parsed.decorations },
      daily: { ...base.daily, ...parsed.daily },
      badges: { ...base.badges, ...parsed.badges },
      tracks: Array.isArray(parsed.tracks) ? parsed.tracks : ['afterglow'],
      unlockedRecipes: Array.isArray(parsed.unlockedRecipes) ? parsed.unlockedRecipes : [],
      recipeUnlocks: Array.isArray(parsed.recipeUnlocks)
        ? parsed.recipeUnlocks.filter(id => recipes.some(recipe => recipe.id === id))
        : recipes.map(recipe => recipe.id),
      log: Array.isArray(parsed.log) ? parsed.log.slice(0, 5) : []
    });

    for (const key of [
      'money', 'reputation', 'served', 'xp', 'level', 'machineLevel', 'bots', 'branches', 'orderNumber', 'chips',
      'prestiges', 'cyberWaste', 'researchTrials', 'researchSuccesses', 'researchFailures', 'tutorialStep', 'drone',
      'bouncer', 'firewall', 'deliveryDrone', 'matrixCyclesLeft', 'matrixCycleEnds', 'matrixNextAt', 'securityEvictions',
      'ransomwareIncidents', 'yakuzaProtectionUntil', 'arenaBuffUntil', 'stalledUntil', 'maintenanceDueAt',
      'weatherChangedAt', 'orderStarted', 'orderExpires', 'orderShuffleAt', 'lastSeen', 'reviewScore', 'shift',
      'shiftOrders', 'shiftServed', 'shiftRevenue'
    ]) {
      if (!Number.isFinite(state[key])) state[key] = base[key];
    }
    for (const key of [
      'money', 'reputation', 'served', 'xp', 'bots', 'chips', 'prestiges', 'cyberWaste', 'researchTrials',
      'researchSuccesses', 'researchFailures', 'drone', 'bouncer', 'firewall', 'deliveryDrone', 'securityEvictions',
      'ransomwareIncidents'
    ]) state[key] = Math.max(0, Math.floor(state[key]));
    for (const key of ['combo', 'bestCombo', 'totalOrders', 'perfectOrders', 'failedOrders']) {
      state[key] = Math.max(0, Math.floor(Number(state[key]) || 0));
    }
    if (!state.statistics || typeof state.statistics !== 'object' || Array.isArray(state.statistics)) {
      state.statistics = { ...base.statistics };
    } else {
      state.statistics = { ...base.statistics, ...state.statistics };
    }

    state.level = Math.max(1, Math.floor(state.level));
    state.orderNumber = Math.max(1, Math.floor(state.orderNumber));
    state.branches = Math.max(1, Math.min(100, Math.floor(state.branches)));
    state.machineLevel = Math.max(0, Math.min(5, Math.floor(state.machineLevel)));
    state.shift = Math.max(1, Math.floor(state.shift));
    state.shiftOrders = Math.max(0, Math.floor(state.shiftOrders));
    state.shiftServed = Math.max(0, Math.floor(state.shiftServed));
    state.shiftRevenue = Math.max(0, state.shiftRevenue);
    state.shiftClosed = !!state.shiftClosed;
    if (!['M', 'L'].includes(state.orderSpec.size)) state.orderSpec.size = 'M';
    if (![0, 50, 100].includes(state.orderSpec.sugar)) state.orderSpec.sugar = 50;
    if (![0, 50, 100].includes(state.orderSpec.ice)) state.orderSpec.ice = 50;
    if (!['none', 'boba'].includes(state.orderSpec.topping)) state.orderSpec.topping = 'none';
    state.matrixCyclesLeft = Math.max(0, Math.min(eventRules.matrixCycles, Math.floor(state.matrixCyclesLeft)));
    state.deliveryActive = !!state.deliveryActive;
    state.robotUnion = !!state.robotUnion;
    state.researchTrials = Math.max(state.researchTrials, state.researchSuccesses + state.researchFailures);
    state.tutorialStep = Math.max(0, Math.min(2, state.tutorialStep));
    state.tutorialDone = !!state.tutorialDone;
    state.daily = { ...base.daily, ...state.daily };
    for (const key of ['espresso', 'hackers', 'seconds']) state.daily[key] = Math.max(0, Number(state.daily[key]) || 0);
    state.daily.rewarded = !!state.daily.rewarded;
    for (const key of Object.keys(base.inventory)) state.inventory[key] = Math.max(0, Math.floor(Number(state.inventory[key]) || 0));
    for (const key of Object.keys(base.factionRep)) state.factionRep[key] = Math.max(0, Number(state.factionRep[key]) || 0);
    if (!Array.isArray(state.log)) state.log = [];
    return state;
  }
});