(() => {
  const bundles = { vi: [], en: [] };
  let activeLanguage = 'vi';
  let applyScheduled = false;
  const textRecords = new WeakMap();
  const attributeRecords = new WeakMap();
  const translationCache = new Map();

  function loadBundle(language, callback) {
    const key = language === 'en' ? 'en' : 'vi';
    const bundle = window.NEON_BREW_I18N_BUNDLES?.[key];
    if (Array.isArray(bundle) && bundle.length > 0) {
      callback?.();
      return;
    }
    const script = document.createElement('script');
    script.src = `js/i18n/${key}.js?v=coffee-20261001`;
    script.onload = callback;
    script.onerror = callback;
    document.head.appendChild(script);
  }

  function getBundle() {
    const list = window.NEON_BREW_I18N_BUNDLES?.[activeLanguage] || [];
    return list.slice().sort((left, right) => right[0].length - left[0].length);
  }

  function translateText(source) {
    const value = String(source ?? '');
    if (activeLanguage !== 'en' || !value) return value;
    const cacheKey = `${activeLanguage}:${value}`;
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);
    let translated = value;
    for (const [from, to] of getBundle()) translated = translated.split(from).join(to);
    translationCache.set(cacheKey, translated);
    return translated;
  }

  function translateTextNode(node) {
    if (!node.nodeValue || !node.nodeValue.trim()) return;
    let record = textRecords.get(node);
    if (!record) {
      record = { source: node.nodeValue, output: node.nodeValue };
      textRecords.set(node, record);
    }
    const original = record.source || node.nodeValue;
    const output = activeLanguage === 'en' ? translateText(original) : original;
    record.output = output;
    record.source = original;
    textRecords.set(node, record);
    if (node.nodeValue !== output) node.nodeValue = output;
  }

  function translateAttribute(element, name) {
    let records = attributeRecords.get(element);
    if (!records) {
      records = new Map();
      attributeRecords.set(element, records);
    }
    const current = element.getAttribute(name);
    if (current === null) return;
    let record = records.get(name);
    if (!record) {
      record = { source: current, output: current };
      records.set(name, record);
    }
    const original = record.source || current;
    const output = activeLanguage === 'en' ? translateText(original) : original;
    record.output = output;
    record.source = original;
    records.set(name, record);
    if (current !== output) element.setAttribute(name, output);
  }

  function translateElement(element) {
    if (!element || ['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE'].includes(element.tagName)) return;
    for (const attribute of ['placeholder', 'title', 'aria-label']) translateAttribute(element, attribute);
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) translateTextNode(child);
      else if (child.nodeType === Node.ELEMENT_NODE) translateElement(child);
    }
  }

  function scheduleApply() {
    if (applyScheduled) return;
    applyScheduled = true;
    const runner = typeof requestAnimationFrame === 'function'
      ? () => requestAnimationFrame(() => {
          if (document.body) translateElement(document.body);
          applyScheduled = false;
        })
      : () => setTimeout(() => {
          if (document.body) translateElement(document.body);
          applyScheduled = false;
        }, 0);
    runner();
  }

  function apply(language) {
    const next = language === 'en' ? 'en' : 'vi';
    if (activeLanguage === next && document.body && document.body.dataset.lang === next) return;
    const bundle = window.NEON_BREW_I18N_BUNDLES?.[next];
    if (!Array.isArray(bundle) || bundle.length === 0) {
      loadBundle(next, () => apply(next));
      return;
    }
    activeLanguage = next;
    document.body && (document.body.dataset.lang = next);
    document.documentElement.lang = next;
    document.title = next === 'en' ? 'NEON BREW — Coffee Counter' : 'NEON BREW — Quầy cà phê';
    if (document.body) scheduleApply();
  }

  if (!window.NEON_BREW_I18N_BUNDLES) {
    window.NEON_BREW_I18N_BUNDLES = bundles;
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') translateTextNode(record.target);
      else if (record.type === 'attributes') translateAttribute(record.target, record.attributeName);
      else for (const node of record.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
        else if (node.nodeType === Node.ELEMENT_NODE) translateElement(node);
      }
    }
  });

  if (document.body) observer.observe(document.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  window.NEON_BREW_I18N = { apply };
})();
