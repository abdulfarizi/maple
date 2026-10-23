/* Open a game app after its ID was copied (phones only).
 *
 * A website can only open an installed app if that app publishes a link scheme.
 * Roblox and Minecraft do, so they open directly. For every other game we open its
 * store page (Play Store / App Store), where one tap on "Open" starts the game.
 * Supercell games try their scheme first and fall back to the store page if it isn't recognised.
 */
(function () {
  var ua = navigator.userAgent || '';
  var ANDROID = /Android/i.test(ua);
  var IOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);

  // scheme = link scheme the app registers; pkg = Android package; ios = App Store id; no pkg/ios -> store search by name
  var G = {
    'Roblox': { scheme: 'roblox', pkg: 'com.roblox.client', ios: '431946152' },
    'Minecraft': { scheme: 'minecraft', pkg: 'com.mojang.minecraftpe', ios: '479516143' },
    'Clash of Clans': { scheme: 'clashofclans', pkg: 'com.supercell.clashofclans', ios: '529479190' },
    'Clash Royale': { scheme: 'clashroyale', pkg: 'com.supercell.clashroyale', ios: '1053012308' },
    'Brawl Stars': { scheme: 'brawlstars', pkg: 'com.supercell.brawlstars', ios: '1229016807' },
    'PUBG Mobile': { pkg: 'com.tencent.ig', ios: '1330123889' },
    'BGMI': { pkg: 'com.pubg.imobile' },
    'Free Fire': { pkg: 'com.dts.freefireth', ios: '1300146617' },
    'Free Fire MAX': { pkg: 'com.dts.freefiremax' },
    'Call of Duty: Mobile': { pkg: 'com.activision.callofduty.shooter', ios: '1287282214' },
    'Call of Duty: Warzone Mobile': { pkg: 'com.activision.callofduty.warzone' },
    'Mobile Legends': { pkg: 'com.mobile.legends', ios: '1160056295' },
    'Wild Rift': { pkg: 'com.riotgames.league.wildrift' },
    'Pokémon UNITE': { pkg: 'jp.pokemon.pokemonunite' },
    'Genshin Impact': { pkg: 'com.miHoYo.GenshinImpact', ios: '1517783697' },
    'Honkai: Star Rail': { pkg: 'com.HoYoverse.hkrpgoversea' },
    'Zenless Zone Zero': { pkg: 'com.HoYoverse.Nap' },
    'Solo Leveling: Arise': { pkg: 'com.netmarble.sololv' },
    'Diablo Immortal': { pkg: 'com.blizzard.diablo.immortal' },
    'Growtopia': { pkg: 'com.rtsoft.growtopia' },
    '8 Ball Pool': { pkg: 'com.miniclip.eightballpool' },
    'EA SPORTS FC Mobile': { pkg: 'com.ea.gp.fifamobile' },
    'Township': { pkg: 'com.playrix.township' },
    'Homescapes': { pkg: 'com.playrix.homescapes' },
    'Dragon City': { pkg: 'es.socialpoint.DragonCity' },
    'Ludo King': { pkg: 'com.ludo.king' }
  };
  var ALIAS = { 'Call of Duty': 'Call of Duty: Mobile' };

  var api = {
    supported: ANDROID || IOS,
    // overridable (tests): goes to the top window so the link isn't blocked inside the card frame
    navigate: function (url) { try { (window.top || window).location.href = url; } catch (e) { window.location.href = url; } },
    info: function (name) { return G[ALIAS[name] || name] || null; },
    open: function (name) {
      if (!api.supported || !name) return 'none';
      var g = G[ALIAS[name] || name] || {}, q = encodeURIComponent(name);
      if (ANDROID) {
        var web = g.pkg ? 'https://play.google.com/store/apps/details?id=' + g.pkg : 'https://play.google.com/store/search?q=' + q + '&c=apps';
        if (g.scheme && g.pkg) {
          api.navigate('intent://#Intent;scheme=' + g.scheme + ';package=' + g.pkg + ';S.browser_fallback_url=' + encodeURIComponent(web) + ';end');
          return 'app';
        }
        api.navigate(g.pkg ? 'market://details?id=' + g.pkg : 'market://search?q=' + q + '&c=apps');
        return 'store';
      }
      var store = g.ios ? 'itms-apps://apps.apple.com/app/id' + g.ios : 'itms-apps://search.itunes.apple.com/WebObjects/MZSearch.woa/wa/search?media=software&term=' + q;
      if (g.scheme) { tryScheme(g.scheme + '://', store); return 'app'; }
      api.navigate(store);
      return 'store';
    }
  };

  // iOS: try the app's scheme in a hidden frame (no "invalid address" alert); if the page never loses focus, go to the store
  function tryScheme(url, fallback) {
    var left = false, host;
    try { host = (window.top || window).document; } catch (e) { host = document; }
    var mark = function () { left = true; };
    document.addEventListener('visibilitychange', function () { if (document.hidden) mark(); });
    window.addEventListener('pagehide', mark); window.addEventListener('blur', mark);
    var f = host.createElement('iframe'); f.style.cssText = 'display:none;width:0;height:0;border:0'; f.src = url; host.body.appendChild(f);
    setTimeout(function () { try { f.remove(); } catch (e) {} if (!left) api.navigate(fallback); }, 1400);
  }
  window.dgLaunch = api;
})();
