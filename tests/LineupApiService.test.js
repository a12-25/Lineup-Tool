import test from "node:test";
import assert from "node:assert/strict";
import { buildLineupResults, getPublicPlayerList } from "../src/logic/LineupApiService.js";

const rows = ["A", "B", "C", "D", "E"].map((player, index) => ({
  player: `Player ${player}`,
  position: ["PG", "SG", "SF", "PF", "C"][index],
  raw: {
    age: 25 + index,
    privateMetric: 999,
    "offensive dpm": 1 + index,
    "defensive dpm": 0.5 + index,
    dpm: 1.5 + index
  }
}));

test("public roster contains only names and positions", () => {
  const publicRows = getPublicPlayerList(rows);
  assert.equal(publicRows.length, 5);
  assert.deepEqual(Object.keys(publicRows[0]).sort(), ["player", "position", "slots"]);
});

test("lineup results contain calculations but no raw player records", () => {
  const result = buildLineupResults(rows, rows.map(row => row.player), "Player C");
  assert.equal(result.players.length, 5);
  assert.ok(result.overview);
  assert.deepEqual(Object.keys(result.overview), ["creationBalance", "synergy", "pace", "versatility"]);
  assert.equal(Object.hasOwn(result, "ratingProjections"), false);
  assert.ok(result.usage);
  assert.equal(result.profile.player, "Player C");
  assert.equal(Object.hasOwn(result.profile, "raw"), false);
  assert.equal(Object.hasOwn(result, "offensiveLoads"), false);
  assert.equal(Object.hasOwn(result, "defensiveLoads"), false);
  assert.ok(result.players.every(player => !Object.hasOwn(player, "raw")));
  assert.equal(JSON.stringify(result).includes("privateMetric"), false);
});

test("lineup requests require five unique known players", () => {
  assert.throws(() => buildLineupResults(rows, ["Player A"]), /exactly five/);
  assert.throws(() => buildLineupResults(rows, ["Player A", "Player A", "Player C", "Player D", "Player E"]), /different/);
  assert.throws(() => buildLineupResults(rows, ["Unknown", "Player B", "Player C", "Player D", "Player E"]), /not found/);
  assert.throws(() => buildLineupResults(rows, rows.map(row => row.player), "Not in lineup"), /selected lineup/);
});