import assert from 'assert';
import { gameState, lobbyState, uiState } from './src/state/store.js';
import { resolveNightAndStartDay } from './src/screens/game/day-phase.js';
import { checkWinCondition } from './src/screens/game/game-screen.js';
import { manualTriggerAutoFill, smartAutoFillRemainingRoles } from './src/screens/game/autofill.js';

console.log('--- TESTING ANONYMOUS PLAYERS AFTER NIGHT 1 ---');

// Mock DOM
globalThis.document = {
  getElementById(id) {
    return {
      style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      textContent: '',
      innerHTML: '',
      setAttribute() {},
      appendChild() {},
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
  },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() {
    return {
      style: {},
      dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      setAttribute() {},
      innerHTML: '',
      appendChild() {},
      remove() {},
      addEventListener() {}
    };
  }
};

// Setup 6-player game
lobbyState.roleDeck = {
  Werewolf: 2,
  Seer: 1,
  Villager: 3
};
gameState.inProgress = true;
gameState.players = [
  { id: 'p1', seat: 1, name: 'Alice', role: 'Werewolf', status: 'alive', votes: 0 },
  { id: 'p2', seat: 2, name: 'Bob', role: 'Werewolf', status: 'alive', votes: 0 },
  { id: 'p3', seat: 3, name: 'Charlie', role: 'Seer', status: 'alive', votes: 0 },
  { id: 'p4', seat: 4, name: 'Diana', role: 'Unknown', status: 'alive', votes: 0 },
  { id: 'p5', seat: 5, name: 'Evan', role: 'Unknown', status: 'alive', votes: 0 },
  { id: 'p6', seat: 6, name: 'Fiona', role: 'Unknown', status: 'alive', votes: 0 }
];
gameState.phase = 'NIGHT';
gameState.currentNight = 1;
gameState.currentDay = 1;

// TEST 1: Automatic smartAutoFillRemainingRoles(false) does NOT assign unknown players
console.log('Test 1: Auto-fill does not silently trigger during night');
const autoResult = smartAutoFillRemainingRoles(false);
assert.strictEqual(autoResult.length, 0, 'Should not auto-fill when isExplicitManual is false');
assert.strictEqual(gameState.players[3].role, 'Unknown', 'Diana should remain Unknown');
assert.strictEqual(gameState.players[4].role, 'Unknown', 'Evan should remain Unknown');
assert.strictEqual(gameState.players[5].role, 'Unknown', 'Fiona should remain Unknown');
console.log('✓ Test 1 passed!');

// TEST 2: When Night 1 ends, Sunrise resolution preserves Unknown players
console.log('Test 2: Sunrise preserves Unknown / anonymous players');
resolveNightAndStartDay();

assert.strictEqual(gameState.phase, 'DAY', 'Phase should be DAY');
assert.strictEqual(gameState.players[3].role, 'Unknown', 'Diana must stay Unknown / anonymous after Night 1');
assert.strictEqual(gameState.players[4].role, 'Unknown', 'Evan must stay Unknown / anonymous after Night 1');
assert.strictEqual(gameState.players[5].role, 'Unknown', 'Fiona must stay Unknown / anonymous after Night 1');
console.log('✓ Test 2 passed!');

// TEST 3: Win condition works properly with anonymous players
console.log('Test 3: Win condition with anonymous players');
let winTitle = null;
globalThis.showWinOverlay = function(title) {
  winTitle = title;
};

// Kill 1 Werewolf (Bob)
gameState.players[1].status = 'dead';
checkWinCondition();
assert.strictEqual(winTitle, null, 'Game should continue with 1 wolf alive');

// Kill 2nd Werewolf (Alice)
gameState.players[0].status = 'dead';
checkWinCondition();
assert.strictEqual(winTitle, '🎉 Village Wins!', 'Village should win when all werewolves die even with anonymous players alive');
console.log('✓ Test 3 passed!');

// TEST 4: Explicit manual auto-fill works when moderator clicks it
console.log('Test 4: Explicit manual auto-fill');
gameState.players[3].role = 'Unknown';
gameState.players[4].role = 'Unknown';
gameState.players[5].role = 'Unknown';

const manualResult = smartAutoFillRemainingRoles(true);
assert.strictEqual(manualResult.length, 3, 'Manual auto-fill should fill 3 players');
assert.strictEqual(gameState.players[3].role, 'Villager');
assert.strictEqual(gameState.players[4].role, 'Villager');
assert.strictEqual(gameState.players[5].role, 'Villager');
console.log('✓ Test 4 passed!');

console.log('=== ALL ANONYMOUS AFTER NIGHT 1 TESTS PASSED! ===');
