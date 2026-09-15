import assert from 'assert';
import { gameState, lobbyState, uiState } from './src/state/store.js';
import { resolveNightAndStartDay, setDaySubPhase, toggleDiscussionTimer, addPlayerVote, resetAllVotes, executeCurrentLynchLeader, startNightPhase } from './src/screens/game/day-phase.js';
import { handleTableNodeTap } from './src/screens/game/table.js';
import { handleCenterHubTap } from './src/screens/game/center-hub.js';
import { updateTimerDisplay } from './src/utils/timer.js';
import { handleCustomDialogResolve } from './src/ui/dialog.js';

globalThis.executeCurrentLynchLeader = executeCurrentLynchLeader;
globalThis.startNightPhase = startNightPhase;

console.log('--- STARTING DAY PHASE SECTIONS & VOTE SYSTEM INTEGRATION TESTS ---');

// Mock DOM elements required for tests
globalThis.document = {
  getElementById(id) {
    return {
      style: {},
      classList: {
        add() {},
        remove() {},
        toggle() {},
        contains() { return false; }
      },
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

// Setup initial state
lobbyState.discussionTimer = 90;
gameState.players = [
  { id: 'p1', seat: 1, name: 'Alice', role: 'Villager', status: 'alive', votes: 0 },
  { id: 'p2', seat: 2, name: 'Bob', role: 'Werewolf', status: 'alive', votes: 0 },
  { id: 'p3', seat: 3, name: 'Charlie', role: 'Seer', status: 'alive', votes: 0 },
  { id: 'p4', seat: 4, name: 'Diana', role: 'Bodyguard', status: 'alive', votes: 0 }
];

let actionSheetOpenedFor = null;
globalThis.openPlayerActionSheet = function(playerId) {
  actionSheetOpenedFor = playerId;
};

// TEST 1: Sunrise initializes Day with Discussion sub-phase
console.log('Test 1: Sunrise initializes daySubPhase = discussion');
gameState.phase = 'NIGHT';
gameState.currentNight = 1;
gameState.currentDay = 1;
resolveNightAndStartDay();

assert.strictEqual(gameState.phase, 'DAY', 'Phase should be DAY');
assert.strictEqual(gameState.daySubPhase, 'discussion', 'Sub-phase should be discussion');
assert.strictEqual(gameState.timerRemaining, 90, 'Timer should be 90s');
assert.strictEqual(gameState.timerRunning, false, 'Timer should be paused initially (1-click ready)');
console.log('✓ Test 1 passed!');

// TEST 2: In Discussion sub-phase, tapping player card opens Action Sheet without adding votes
console.log('Test 2: Tapping card in Discussion opens Action Sheet without casting votes');
actionSheetOpenedFor = null;
handleTableNodeTap('p1');
assert.strictEqual(actionSheetOpenedFor, 'p1', 'Action sheet should be opened for p1');
assert.strictEqual(gameState.players[0].votes, 0, 'No vote should be added during discussion');
console.log('✓ Test 2 passed!');

// TEST 3: One-click turn on discussion timer
console.log('Test 3: 1-click Discussion bar turns on timer');
assert.strictEqual(gameState.timerRunning, false);
toggleDiscussionTimer();
assert.strictEqual(gameState.timerRunning, true, 'Timer should be running after 1-click');
toggleDiscussionTimer();
assert.strictEqual(gameState.timerRunning, false, 'Timer should pause after 2nd click');
console.log('✓ Test 3 passed!');

// TEST 4: Center Hub during Discussion transitions to Lynch sub-phase
console.log('Test 4: Center Hub during Discussion advances to Lynch mode');
assert.strictEqual(gameState.daySubPhase, 'discussion');
handleCenterHubTap();
assert.strictEqual(gameState.daySubPhase, 'lynch', 'Center hub tap in discussion should switch to lynch');
console.log('✓ Test 4 passed!');

// TEST 5: In Lynch sub-phase, tapping player card casts votes
console.log('Test 5: Tapping card in Lynch casts votes');
actionSheetOpenedFor = null;
handleTableNodeTap('p2');
assert.strictEqual(actionSheetOpenedFor, null, 'Action sheet should NOT open in lynch mode');
assert.strictEqual(gameState.players[1].votes, 1, 'Bob (p2) should have 1 vote');

handleTableNodeTap('p2');
assert.strictEqual(gameState.players[1].votes, 2, 'Bob (p2) should have 2 votes');
console.log('✓ Test 5 passed!');

// TEST 6: Switching back to Discussion via setDaySubPhase
console.log('Test 6: Switching back to Discussion');
setDaySubPhase('discussion');
assert.strictEqual(gameState.daySubPhase, 'discussion', 'Should switch back to discussion');
handleTableNodeTap('p2');
assert.strictEqual(actionSheetOpenedFor, 'p2', 'Action sheet should open now that we are in discussion');
assert.strictEqual(gameState.players[1].votes, 2, 'Bob votes should stay at 2 without adding new vote');
console.log('✓ Test 6 passed!');

// TEST 7: Reset all votes
console.log('Test 7: Reset all votes');
resetAllVotes();
assert.strictEqual(gameState.players[1].votes, 0, 'Bob votes should be 0 after reset');
console.log('✓ Test 7 passed!');

// TEST 8: Lynch execution via Center Hub when 1 leader
console.log('Test 8: Lynch execution via Center Hub');
setDaySubPhase('lynch');
gameState.players[1].votes = 3; // Bob has 3 votes

handleCenterHubTap();
// Resolve the custom confirmation dialog with true (confirm lynch)
handleCustomDialogResolve(true);
assert.strictEqual(gameState.players[1].status, 'dead', 'Bob should be dead after execution');
console.log('✓ Test 8 passed!');

// TEST 9: Center Hub tie detection
console.log('Test 9: Center Hub tie detection');
gameState.dayLynchedPlayer = null; // Reset for tie test
gameState.players[0].votes = 2; // Alice
gameState.players[2].votes = 2; // Charlie

let alertedTieMsg = null;
globalThis.showCustomAlert = function(msg) {
  alertedTieMsg = msg;
};

handleCenterHubTap();
assert.ok(alertedTieMsg && alertedTieMsg.includes('Tie'), 'Should alert about vote tie');
assert.strictEqual(gameState.players[0].status, 'alive', 'Alice should remain alive on tie');
assert.strictEqual(gameState.players[2].status, 'alive', 'Charlie should remain alive on tie');
console.log('✓ Test 9 passed!');

// TEST 10: Post-lynch Sleep Night transition
console.log('Test 10: Post-lynch Sleep Night transition');
gameState.dayLynchedPlayer = '#2 Bob';
gameState.currentNight = 1;
gameState.currentDay = 1;

handleCenterHubTap(); // Taps center hub to sleep
handleCustomDialogResolve(true); // Confirms Night 2

assert.strictEqual(gameState.phase, 'NIGHT', 'Phase should be NIGHT');
assert.strictEqual(gameState.currentNight, 2, 'Should advance to Night 2');
assert.strictEqual(gameState.dayLynchedPlayer, null, 'dayLynchedPlayer should reset on Night 2');
console.log('✓ Test 10 passed!');

console.log('=== ALL TESTS PASSED SUCCESSFULLY! ===');
