'use strict';
// GambelStrike 2 — game content definitions
(function () {
  GS.VERSION = '1.0.0';

  GS.RARITIES = {
    common: { id: 'common', name: 'COMMON', color: '#9aa6b5', order: 0, price: 120, scrap: 15 },
    uncommon: { id: 'uncommon', name: 'UNCOMMON', color: '#4fd18b', order: 1, price: 240, scrap: 30 },
    rare: { id: 'rare', name: 'RARE', color: '#3d8bff', order: 2, price: 480, scrap: 60 },
    epic: { id: 'epic', name: 'EPIC', color: '#a259ff', order: 3, price: 900, scrap: 120 },
    legendary: { id: 'legendary', name: 'LEGENDARY', color: '#ff9f1c', order: 4, price: 1600, scrap: 220 },
    mythic: { id: 'mythic', name: 'MYTHIC', color: '#ff3b5c', order: 5, price: 2800, scrap: 400 },
    ultra: { id: 'ultra', name: 'ULTRA', color: '#00f0ff', order: 6, price: 4800, scrap: 700 },
    knife: { id: 'knife', name: '★ KNIFE', color: '#ffd23f', order: 7, price: 0, scrap: 1500 },
  };
  GS.RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'ultra', 'knife'];
  // case drop odds (percent) — identical for OPEN 1 and OPEN 5
  GS.DROP_ODDS = { common: 40, uncommon: 26, rare: 16, epic: 9, legendary: 5, mythic: 2.2, ultra: 1.0, knife: 0.8 };

  // ---------------------------------------------------------------- weapons
  // spread values are cone half-angles in radians, recoil kick in degrees
  const W = (GS.WEAPONS = {
    ar4: {
      name: 'AR-4', slot: 'main', cls: 'Assault Rifle', model: 'ar4', price: 0, snd: 'rifle',
      dmg: 27, rpm: 660, auto: true, mag: 30, reserve: 150, reload: 2.0, reloadEmpty: 2.5,
      spread: 0.011, adsSpread: 0.0015, bloom: 0.0045, kick: 0.55, kickH: 0.25, mobility: 0.93,
      range: [38, 85, 0.72], hs: 2.4, adsZoom: 0.78, equip: 0.5,
    },
    vector: {
      name: 'Vector X', slot: 'main', cls: 'SMG', model: 'vector', price: 0, snd: 'smg',
      dmg: 20, rpm: 950, auto: true, mag: 32, reserve: 160, reload: 1.7, reloadEmpty: 2.1,
      spread: 0.016, adsSpread: 0.004, bloom: 0.0035, kick: 0.34, kickH: 0.28, mobility: 1.0,
      range: [16, 45, 0.6], hs: 2.0, adsZoom: 0.85, equip: 0.42,
    },
    shotgun: {
      name: 'Heavy Shotgun', slot: 'main', cls: 'Shotgun', model: 'shotgun', price: 0, snd: 'shotgun',
      dmg: 14, pellets: 10, rpm: 72, auto: false, mag: 7, reserve: 35, reload: 0.42, reloadStart: 0.4, shellReload: true,
      pump: true, spread: 0.062, adsSpread: 0.048, bloom: 0, kick: 3.2, kickH: 0.9, mobility: 0.9,
      range: [7, 26, 0.25], hs: 1.5, adsZoom: 0.88, equip: 0.55,
    },
    phantom: {
      name: 'Phantom Rifle', slot: 'main', cls: 'Assault Rifle', model: 'phantom', price: 1500, snd: 'rifle2',
      dmg: 32, rpm: 600, auto: true, mag: 25, reserve: 125, reload: 2.2, reloadEmpty: 2.7,
      spread: 0.009, adsSpread: 0.001, bloom: 0.005, kick: 0.68, kickH: 0.3, mobility: 0.9,
      range: [50, 100, 0.8], hs: 2.5, adsZoom: 0.62, equip: 0.55,
    },
    kestrel: {
      name: 'Kestrel SMG', slot: 'main', cls: 'SMG', model: 'kestrel', price: 900, snd: 'smg2',
      dmg: 17, rpm: 1080, auto: true, mag: 45, reserve: 180, reload: 2.3, reloadEmpty: 2.8,
      spread: 0.02, adsSpread: 0.006, bloom: 0.003, kick: 0.3, kickH: 0.32, mobility: 1.03,
      range: [14, 40, 0.55], hs: 2.0, adsZoom: 0.86, equip: 0.4,
    },
    longbow: {
      name: 'Longbow .338', slot: 'main', cls: 'Sniper Rifle', model: 'longbow', price: 2400, snd: 'sniper',
      dmg: 120, rpm: 44, auto: false, bolt: true, mag: 5, reserve: 25, reload: 2.8, reloadEmpty: 3.3,
      spread: 0.07, adsSpread: 0.0, bloom: 0, kick: 3.6, kickH: 0.6, mobility: 0.82, scope: true,
      range: [200, 300, 1], hs: 2.0, adsZoom: 0.24, equip: 0.7,
    },
    warden: {
      name: 'Warden BR', slot: 'main', cls: 'Battle Rifle', model: 'warden', price: 1800, snd: 'br',
      dmg: 47, rpm: 340, auto: false, mag: 20, reserve: 100, reload: 2.3, reloadEmpty: 2.9,
      spread: 0.008, adsSpread: 0.0008, bloom: 0.006, kick: 1.25, kickH: 0.35, mobility: 0.88,
      range: [60, 120, 0.8], hs: 2.2, adsZoom: 0.55, equip: 0.6,
    },
    viper: {
      name: 'Viper Bullpup', slot: 'main', cls: 'Assault Rifle', model: 'viper', price: 1100, snd: 'rifle3',
      dmg: 24, rpm: 780, auto: true, mag: 30, reserve: 150, reload: 2.1, reloadEmpty: 2.6,
      spread: 0.011, adsSpread: 0.002, bloom: 0.004, kick: 0.45, kickH: 0.26, mobility: 0.96,
      range: [35, 80, 0.7], hs: 2.3, adsZoom: 0.7, equip: 0.5,
    },
    // ---- secondaries
    r9: {
      name: 'R9 Pistol', slot: 'secondary', cls: 'Pistol', model: 'r9', price: 0, snd: 'pistol',
      dmg: 26, rpm: 400, auto: false, mag: 15, reserve: 60, reload: 1.45, reloadEmpty: 1.8,
      spread: 0.012, adsSpread: 0.003, bloom: 0.008, kick: 0.95, kickH: 0.3, mobility: 1.05,
      range: [22, 50, 0.65], hs: 2.6, adsZoom: 0.85, equip: 0.35, pistol: true,
    },
    stinger: {
      name: 'Stinger MP', slot: 'secondary', cls: 'Machine Pistol', model: 'stinger', price: 0, snd: 'mp',
      dmg: 15, rpm: 1100, auto: true, mag: 22, reserve: 110, reload: 1.6, reloadEmpty: 1.95,
      spread: 0.022, adsSpread: 0.01, bloom: 0.003, kick: 0.36, kickH: 0.4, mobility: 1.05,
      range: [12, 35, 0.55], hs: 2.0, adsZoom: 0.88, equip: 0.35, pistol: true,
    },
    hammer: {
      name: 'Hammer .50', slot: 'secondary', cls: 'Heavy Pistol', model: 'hammer', price: 900, snd: 'heavy',
      dmg: 58, rpm: 170, auto: false, mag: 7, reserve: 35, reload: 1.9, reloadEmpty: 2.3,
      spread: 0.016, adsSpread: 0.002, bloom: 0.02, kick: 2.3, kickH: 0.6, mobility: 1.0,
      range: [30, 70, 0.7], hs: 2.4, adsZoom: 0.82, equip: 0.45, pistol: true,
    },
    duke: {
      name: 'Duke Revolver', slot: 'secondary', cls: 'Heavy Pistol', model: 'duke', price: 1200, snd: 'revolver',
      dmg: 70, rpm: 115, auto: false, mag: 6, reserve: 30, reload: 2.6, reloadEmpty: 2.6, revolver: true,
      spread: 0.01, adsSpread: 0.001, bloom: 0.02, kick: 2.9, kickH: 0.5, mobility: 1.0,
      range: [40, 80, 0.75], hs: 2.2, adsZoom: 0.8, equip: 0.5, pistol: true,
    },
    nova: {
      name: 'Nova-17', slot: 'secondary', cls: 'Burst Pistol', model: 'nova', price: 650, snd: 'pistol2',
      dmg: 21, rpm: 950, burst: 3, burstDelay: 0.32, auto: false, mag: 18, reserve: 90, reload: 1.5, reloadEmpty: 1.85,
      spread: 0.011, adsSpread: 0.003, bloom: 0.004, kick: 0.6, kickH: 0.25, mobility: 1.05,
      range: [25, 55, 0.65], hs: 2.4, adsZoom: 0.85, equip: 0.35, pistol: true,
    },
  });
  for (const id in W) W[id].id = id;
  GS.MAINS = Object.keys(W).filter((k) => W[k].slot === 'main');
  GS.SECONDARIES = Object.keys(W).filter((k) => W[k].slot === 'secondary');

  // ---------------------------------------------------------------- knives
  // All knives deal identical damage — purely cosmetic choice.
  const K = (GS.KNIVES = {
    tactical: { name: 'Tactical Knife', desc: 'Fixed blade. Reliable, clean draw with a wrist twirl.' },
    flip: { name: 'Flip Knife', desc: 'Folding blade that snaps open on draw.' },
    combat: { name: 'Combat Knife', desc: 'Heavy clip-point blade with a guard.' },
    talon: { name: 'Talon Knife', desc: 'Curved folding claw with a ring pommel.' },
    shadow: { name: 'Shadow Blade', desc: 'Long, thin tanto blade with an edge glow.' },
    fang: { name: 'Fang Knife', desc: 'Serrated spine, aggressive toss-and-catch draw.' },
    butterfly: { name: 'Butterfly Knife', desc: 'Balisong. Flips, spins and rare aerial inspects.' },
    karambit: { name: 'Karambit', desc: 'Curved claw with finger ring. Ring spins for days.' },
  });
  for (const id in K) {
    Object.assign(K[id], { id, slot: 'knife', cls: 'Knife', slash: 40, stab: 85, slashRate: 0.42, stabRate: 1.0, range: 2.1, mobility: 1.12 });
  }
  GS.KNIFE_IDS = Object.keys(K);

  // ---------------------------------------------------------------- weapon skin designs
  GS.SKINS = {
    default: { name: 'Factory', rarity: 'common' },
    urban_fog: { name: 'Urban Fog', rarity: 'common' },
    sand_drift: { name: 'Sand Drift', rarity: 'common' },
    carbon_lite: { name: 'Carbon Lite', rarity: 'common' },
    field_grid: { name: 'Field Grid', rarity: 'common' },
    digital_dusk: { name: 'Digital Dusk', rarity: 'uncommon' },
    toxic_drip: { name: 'Toxic Drip', rarity: 'uncommon' },
    graffiti_burst: { name: 'Graffiti Burst', rarity: 'uncommon' },
    carbon_pro: { name: 'Carbon Pro', rarity: 'rare' },
    ice_shard: { name: 'Ice Shard', rarity: 'rare' },
    cyber_lines: { name: 'Cyber Lines', rarity: 'rare' },
    magma_core: { name: 'Magma Core', rarity: 'epic' },
    sakura_drift: { name: 'Sakura Drift', rarity: 'epic' },
    glitch_pop: { name: 'Glitch Pop', rarity: 'epic' },
    neon_rush: { name: 'Neon Rush', rarity: 'legendary' },
    galaxy: { name: 'Nebula Galaxy', rarity: 'legendary' },
    chrome_mirror: { name: 'Chrome Mirror', rarity: 'legendary' },
    holo_prism: { name: 'Holo Prism', rarity: 'mythic' },
    gold_leaf: { name: 'Gold Leaf', rarity: 'mythic' },
    singularity: { name: 'Singularity', rarity: 'ultra' },
    aurora_flux: { name: 'Aurora Flux', rarity: 'ultra' },
  };
  // knife skin designs (rarity "knife")
  GS.KNIFE_SKINS = {
    default: { name: 'Vanilla' },
    neon_fade: { name: 'Neon Fade' },
    blackout: { name: 'Blackout' },
    crimson_wave: { name: 'Crimson Wave' },
    frozen_glass: { name: 'Frozen Glass' },
    golden_edge: { name: 'Golden Edge' },
    digital_storm: { name: 'Digital Storm' },
    void: { name: 'Void' },
    inferno: { name: 'Inferno' },
    emerald: { name: 'Emerald' },
    neon_circuit: { name: 'Neon Circuit' },
    blue_plasma: { name: 'Blue Plasma' },
    crimson_lattice: { name: 'Crimson Lattice' },
    night_ops: { name: 'Night Ops' },
    ocean_fade: { name: 'Ocean Fade' },
    damascus_wave: { name: 'Damascus Wave' },
    toxic_fade: { name: 'Toxic Fade' },
  };
  GS.KNIFE_SKIN_SETS = {
    butterfly: ['default', 'neon_fade', 'blackout', 'crimson_wave', 'frozen_glass', 'golden_edge', 'digital_storm'],
    karambit: ['default', 'void', 'inferno', 'emerald', 'neon_circuit', 'blue_plasma', 'crimson_lattice'],
    tactical: ['default', 'night_ops', 'ocean_fade', 'damascus_wave', 'toxic_fade'],
    flip: ['default', 'night_ops', 'ocean_fade', 'damascus_wave', 'toxic_fade'],
    combat: ['default', 'night_ops', 'ocean_fade', 'damascus_wave', 'toxic_fade'],
    talon: ['default', 'night_ops', 'ocean_fade', 'damascus_wave', 'golden_edge'],
    shadow: ['default', 'night_ops', 'void', 'damascus_wave', 'blue_plasma'],
    fang: ['default', 'night_ops', 'ocean_fade', 'inferno', 'toxic_fade'],
  };

  // ---------------------------------------------------------------- cases
  GS.CASES = {
    origin: {
      id: 'origin', name: 'ORIGIN CASE', price: 250, color: '#3d8bff', accent: '#00f0ff',
      desc: 'The original collection. Clean classics and one very dark star.',
      designs: ['urban_fog', 'sand_drift', 'digital_dusk', 'toxic_drip', 'carbon_pro', 'ice_shard', 'magma_core', 'sakura_drift', 'neon_rush', 'chrome_mirror', 'gold_leaf', 'singularity'],
    },
    neon: {
      id: 'neon', name: 'NEON CASE', price: 350, color: '#ff2fd0', accent: '#7a5cff',
      desc: 'Straight out of the district. Loud colours, glowing paint.',
      designs: ['carbon_lite', 'field_grid', 'graffiti_burst', 'digital_dusk', 'cyber_lines', 'ice_shard', 'glitch_pop', 'magma_core', 'galaxy', 'neon_rush', 'holo_prism', 'aurora_flux'],
    },
    vault: {
      id: 'vault', name: 'VAULT CASE', price: 500, color: '#ffd23f', accent: '#ff9f1c',
      desc: 'Every design in the game. Same odds, biggest pool.',
      designs: Object.keys(GS.SKINS).filter((k) => k !== 'default'),
    },
  };

  // ---------------------------------------------------------------- maps
  GS.MAPS = {
    neon: {
      id: 'neon', name: 'NEON DISTRICT', tag: 'NIGHT CITY',
      desc: 'Rain-soaked streets, rooftops, an arcade, a hotel and a parking garage. Tight alleys and a roof bridge over the avenue.',
      color: '#ff2fd0',
    },
    desert: {
      id: 'desert', name: 'DESERT FACILITY', tag: 'ABANDONED RESEARCH SITE',
      desc: 'Sun-baked concrete, a hangar with catwalks, a container yard, a long tunnel and a watchtower over open sand.',
      color: '#ff9f1c',
    },
  };

  // ---------------------------------------------------------------- tokens
  // placement rewards scale with lobby size
  GS.rewardFor = (place, size, kills, headshots, won) => {
    const p = (place - 1) / Math.max(1, size - 1); // 0 = winner, 1 = last
    let placeTok;
    if (place === 1) placeTok = size >= 25 ? 650 : 450;
    else if (place === 2) placeTok = size >= 25 ? 480 : 330;
    else if (place === 3) placeTok = size >= 25 ? 380 : 250;
    else placeTok = Math.round(U_lerp(size >= 25 ? 240 : 170, 50, Math.min(1, p * 1.15)));
    return {
      placement: placeTok,
      kills: kills * 8,
      headshots: headshots * 3,
      win: won ? 100 : 0,
      total: placeTok + kills * 8 + headshots * 3 + (won ? 100 : 0),
    };
  };
  function U_lerp(a, b, t) { return a + (b - a) * t; }

  // ---------------------------------------------------------------- controls & settings
  GS.ACTIONS = [
    ['forward', 'Move Forward'], ['back', 'Move Back'], ['left', 'Strafe Left'], ['right', 'Strafe Right'],
    ['jump', 'Jump'], ['sprint', 'Sprint'], ['crouch', 'Crouch'],
    ['shoot', 'Shoot'], ['aim', 'Aim / Heavy Stab'], ['reload', 'Reload'], ['inspect', 'Inspect'],
    ['slot1', 'Main Weapon'], ['slot2', 'Secondary Weapon'], ['slot3', 'Knife'], ['lastWeapon', 'Last Weapon'],
    ['scoreboard', 'Scoreboard'],
  ];
  GS.DEFAULT_BINDS = {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    jump: 'Space', sprint: 'ShiftLeft', crouch: 'ControlLeft',
    shoot: 'Mouse0', aim: 'Mouse2', reload: 'KeyR', inspect: 'KeyF',
    slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3', lastWeapon: 'KeyQ', scoreboard: 'Tab',
  };
  GS.DEFAULT_SETTINGS = {
    graphics: {
      resolution: 'native', fullscreen: false, vsync: true, texture: 'high', shadows: 'medium',
      effects: 'high', aa: 'fxaa', fov: 100, motionBlur: false, fpsLimit: 0, showFps: true, dmgNumbers: true,
    },
    sound: { master: 0.8, music: 0.45, weapons: 0.8, effects: 0.8, ui: 0.7, voice: 0.7 },
    controls: { sens: 1.0, adsSens: 0.85, invertY: false, binds: Object.assign({}, GS.DEFAULT_BINDS) },
    game: { autoSpin: false, crosshair: '#00ffd0', difficulty: 'normal', roundTime: 240 },
  };

  GS.BOT_NAMES = [
    'NeonWolf', 'Kr4bbe', 'xX_Sn1p3r_Xx', 'GlitchQueen', 'BladeRunner99', 'TokenTitan', 'ZeroPing', 'Spinmaster', 'LuckyLuca',
    'CaseCracker', 'HoloHex', 'DesertFox', 'Rooftop_Rex', 'VoidWalker', 'K4rambitKid', 'FlipFlop', 'MagmaMila', 'Nebula_Nox',
    'PixelPunk', 'ChromeDome', 'RouletteRudi', 'OneHP_Hero', 'SpeedDemon', 'TankMode', 'Headclicker', 'NoScopeNils', 'Bananenbrot',
    'Alley_Cat', 'Wheelie', 'Gambeltron', 'Crit_Happens', 'Mr_Recoil', 'SilentStep', 'BunnyHopper', 'Fragment', 'Kaktus',
    'Lagwitch', 'ShellShock', 'Overkill', 'Pillowfight', 'JackpotJoe', 'Saphira', 'Taktik_Tom', 'Rauchmelder', 'Neonkatze',
  ];
  GS.BOT_COLORS = [
    '#ff2fd0', '#00f0ff', '#ffd23f', '#4fd18b', '#ff6b3d', '#a259ff', '#3d8bff', '#ff3b5c', '#9dff00', '#ff9f1c',
    '#00ffa3', '#ff7ad9', '#6bd6ff', '#ffe066', '#c58bff', '#ff5e5e', '#5effc8', '#ffb86b', '#7c9cff', '#e0ff4f',
    '#ff4fa3', '#4fffe0', '#ffa94f', '#b4ff6b', '#ff6bd1',
  ];

  GS.TIPS = [
    'Every player spins their own roulette — the guy across the street might be a 1 HP glass cannon.',
    'Hold RIGHT MOUSE with the knife for a heavy stab.',
    'Press F to inspect. Butterfly and Karambit have rare inspect animations.',
    'OPEN 5 costs exactly five times OPEN 1 — the odds per case never change.',
    'Crouching tightens your spread. Jumping ruins it.',
    'Skins are purely cosmetic. Bragging rights only.',
    'Scrap duplicate skins in the inventory to recover some tokens.',
    'The roof bridge in Neon District connects the arcade and the hotel.',
    'The tunnel in Desert Facility is the safest route between north and south.',
    'Speed x3.0? Try the rooftops. Speed x0.1? Find a corner and pray.',
  ];
})();
