(function () {
  "use strict";

  var V = globalThis.vendetta || globalThis.revenge;
  if (!V) { console.error("[ProfileUnlocked] global vendetta nao encontrado"); return; }

  var metro = V.metro, patcher = V.patcher, storage = V.plugin.storage;
  var React = metro.common.React;
  var Forms = V.ui.components.Forms;
  var showToast = V.ui.toasts.showToast;
  var findByProps = metro.findByProps, findByStoreName = metro.findByStoreName;

  if (storage.badges === undefined) storage.badges = true;
  if (storage.nitro === undefined) storage.nitro = true;
  if (storage.freeName === undefined) storage.freeName = true;

  var ALL_BADGES =
    (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) |
    (1 << 6) | (1 << 7) | (1 << 8) | (1 << 9) |
    (1 << 14) | (1 << 17) | (1 << 18) | (1 << 22);
  var NITRO_FULL = 2;

  var UserStore = findByStoreName("UserStore");
  var patches = [];

  function ownId() {
    try { var u = UserStore.getCurrentUser(); return u && u.id; } catch (e) { return undefined; }
  }
  function decorate(user) {
    if (!user) return user;
    if (storage.badges) user.flags = (user.flags || 0) | ALL_BADGES;
    if (storage.nitro) user.premiumType = NITRO_FULL;
    return user;
  }

  function patchUsers() {
    if (!UserStore) return;
    patches.push(patcher.after("getCurrentUser", UserStore, function (_a, u) { return decorate(u); }));
    patches.push(patcher.after("getUser", UserStore, function (args, u) {
      return args[0] === ownId() ? decorate(u) : u;
    }));
  }

  function patchPremium() {
    ["OverridePremiumTypeStore", "PremiumStore"].forEach(function (name) {
      var store = findByStoreName(name);
      if (!store) return;
      ["getPremiumTypeActual", "getPremiumType"].some(function (m) {
        if (typeof store[m] !== "function") return false;
        patches.push(patcher.instead(m, store, function (args, orig) {
          return storage.nitro ? NITRO_FULL : orig.apply(null, args);
        }));
        return true;
      });
    });
  }

  function patchNameLimit() {
    ["canChangeUsername", "canChangeDisplayName", "canChangeNickname"].forEach(function (p) {
      var mod = findByProps(p);
      if (mod && typeof mod[p] === "function") patches.push(patcher.instead(p, mod, function () { return true; }));
    });
    ["getUsernameChangeDelay", "getDisplayNameChangeDelay", "getUsernameChangeDelayMs"].forEach(function (p) {
      var mod = findByProps(p);
      if (mod && typeof mod[p] === "function") patches.push(patcher.instead(p, mod, function () { return 0; }));
    });
  }

  var plugin = {
    onLoad: function () {
      patchUsers();
      patchPremium();
      if (storage.freeName) patchNameLimit();
      showToast("ProfileUnlocked ativo");
    },
    onUnload: function () {
      while (patches.length) { try { patches.pop()(); } catch (e) {} }
    },
    settings: function () {
      var rerender = React.useReducer(function (x) { return x + 1; }, 0)[1];
      function toggle(key, label) {
        return React.createElement(Forms.FormSwitchRow, {
          label: label,
          value: !!storage[key],
          onValueChange: function (v) { storage[key] = v; rerender(); },
        });
      }
      return React.createElement(
        Forms.FormSection,
        { title: "ProfileUnlocked (client-side)" },
        toggle("badges", "Todos os badges"),
        toggle("nitro", "Nitro (badge + tag)"),
        toggle("freeName", "Sem limite de troca de nome")
      );
    },
  };

  // funciona tanto se o loader ler module.exports quanto o valor da ultima expressao
  if (typeof module !== "undefined" && module.exports) module.exports = plugin;
  return plugin;
})();
