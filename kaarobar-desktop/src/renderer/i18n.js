(function (global) {
  const catalogs = {
    en: null,
    ur: null,
  };

  let locale = localStorage.getItem("kaarobar_locale") === "ur" ? "ur" : "en";

  function lookup(dict, key) {
    if (!dict) return undefined;
    const parts = key.split(".");
    let cur = dict;
    for (const part of parts) {
      if (cur && typeof cur === "object" && part in cur) cur = cur[part];
      else return undefined;
    }
    return typeof cur === "string" ? cur : undefined;
  }

  function t(key, vars) {
    let text =
      lookup(catalogs[locale], key) ||
      lookup(catalogs.en, key) ||
      key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        text = text.replace("{" + k + "}", String(vars[k]));
      });
    }
    return text;
  }

  function applyDir() {
    document.documentElement.lang = locale === "ur" ? "ur" : "en";
    document.documentElement.dir = locale === "ur" ? "rtl" : "ltr";
  }

  function setLocale(next) {
    locale = next === "ur" ? "ur" : "en";
    localStorage.setItem("kaarobar_locale", locale);
    applyDir();
  }

  function getLocale() {
    return locale;
  }

  async function loadCatalogs() {
    const [en, ur] = await Promise.all([
      fetch("i18n/en.json").then((r) => r.json()),
      fetch("i18n/ur.json").then((r) => r.json()),
    ]);
    catalogs.en = en;
    catalogs.ur = ur;
    applyDir();
  }

  global.KaarobarI18n = { t, setLocale, getLocale, loadCatalogs, applyDir };
})(window);
