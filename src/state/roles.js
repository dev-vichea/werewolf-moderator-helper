/**
 * Role Catalog & Role Metadata Helpers
 */
export const ROLES_CATALOG = [
  { name: 'Werewolf', team: 'Werewolf', image: 'images/werewolf.jpeg', desc: 'Eliminates 1 villager each night.', defaultCount: 2 },
  { name: 'Seer', team: 'Town', image: 'images/seer.jpeg', desc: 'Inspects 1 player alignment per night.', defaultCount: 1 },
  { name: 'Bodyguard', team: 'Town', image: 'images/bodyguard.jpeg', desc: 'Protects 1 player each night from attack.', defaultCount: 1 },
  { name: 'Witch', team: 'Town', image: 'images/witch.jpeg', desc: 'Has 1 heal potion (saves wolf victim) and 1 poison potion (kills any player). Max 1 potion per night. Once both are used, Witch no longer wakes.', defaultCount: 1 },
  { name: 'Hunter', team: 'Town', image: 'images/hunter.jpeg', desc: 'If eliminated, immediately takes another player down with them.', defaultCount: 0 },
  { name: 'Cupid', team: 'Town', image: 'images/cupid.jpeg', desc: 'Pairs 2 lovers on Night 1.', defaultCount: 0 },
  { name: 'Mason', team: 'Town', image: 'images/mason.jpeg', desc: 'Masons know each other Night 1.', defaultCount: 0 },
  { name: 'Spellcaster', team: 'Town', image: 'images/spellcaster.jpeg', desc: 'Silences a player each night.', defaultCount: 0 },
  { name: 'Lycan', team: 'Town', image: 'images/lycan.jpeg', desc: 'Town member who appears as Werewolf to Seer.', defaultCount: 0 },
  { name: 'Doppelganger', team: 'Town', image: 'images/doppelganger.jpeg', desc: 'Takes the role of a player who has died.', defaultCount: 0 },
  { name: 'Villager', team: 'Town', image: 'images/villager.jpeg', desc: 'Deduces and votes during day.', defaultCount: 3 },
  { name: 'Tanner', team: 'Neutral', image: 'images/tanner.jpeg', desc: 'Wins alone if lynched by town.', defaultCount: 0 },
  { name: 'Cursed', team: 'Town', image: 'images/cursed.jpeg', desc: 'Town until bitten by wolves, then turns Werewolf.', defaultCount: 0 },
  { name: 'Prince', team: 'Town', image: 'images/prince.jpeg', desc: 'Cannot be lynched by town vote.', defaultCount: 0 }
];

export function getRoleData(roleName) {
  if (!roleName || roleName === 'Unknown') {
    return {
      name: 'Unknown',
      team: 'Town',
      image: 'images/anonymous.jpeg',
      desc: 'Physical card not yet revealed or assigned.'
    };
  }
  return ROLES_CATALOG.find(r => r.name.toLowerCase() === (roleName || '').toLowerCase()) || {
    name: roleName,
    team: 'Town',
    image: 'images/anonymous.jpeg',
    desc: 'Town member'
  };
}

export function getRoleImage(roleName) {
  if (!roleName || roleName === 'Unknown') return 'images/anonymous.jpeg';
  return getRoleData(roleName).image || 'images/anonymous.jpeg';
}

export function isRoleInGame(roleName, gameState = null, lobbyState = null) {
  const gState = gameState || (typeof window !== 'undefined' ? window.gameState : null);
  const lState = lobbyState || (typeof window !== 'undefined' ? window.lobbyState : null);

  if (gState && gState.players && gState.players.some(p => p.role === roleName)) {
    return true;
  }
  if (lState && lState.roleDeck && Object.keys(lState.roleDeck).length > 0) {
    return (lState.roleDeck[roleName] || 0) > 0;
  }
  // Default active roles if deck was not customized
  const defaultActiveRoles = ['Werewolf', 'Seer', 'Bodyguard', 'Witch'];
  return defaultActiveRoles.includes(roleName);
}

export function getRoleTargetCount(roleName, lobbyState = null) {
  const lState = lobbyState || (typeof window !== 'undefined' ? window.lobbyState : null);
  if (lState && lState.roleDeck && (lState.roleDeck[roleName] || 0) > 0) {
    return lState.roleDeck[roleName];
  }
  if (roleName === 'Werewolf') return 2;
  if (roleName === 'Mason') return 2;
  return 1;
}

