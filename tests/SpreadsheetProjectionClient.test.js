import test from "node:test";
import assert from "node:assert/strict";
import { fetchSpreadsheetProjections } from "../src/data/SpreadsheetProjectionClient.js";

const lineupNames = ["A", "B", "C", "D", "E"];

function completeResponse() {
  return {
    players: lineupNames.map((player, index) => ({
      player,
      position: ["PG", "SG", "SF", "PF", "C"][index],
      offensiveRole: "Role",
      defensiveRole: "Role"
    })),
    ratingProjections: { OFF: 118.4, DEF: 111.2, NET: 6.1 },
    overview: { creationBalance: 72, synergy: 81, pace: 99.4, versatility: 87 },
    offensiveProjections: {
      shotBalance: 80,
      offensiveRebounding: 70,
      offensiveRating: 118.4,
      threePointPercentage: 0.37,
      trueShootingPercentage: 0.59
    },
    defensiveProjections: {
      opponentTs: 0.56,
      defensiveRebounding: 71,
      defensiveRating: 111.2,
      turnoverCreation: 75,
      rimProtection: 80
    },
    usage: {
      offense: "4-Out",
      initiator: "C",
      defense: "Switching",
      offRebounding: "Strong",
      defRebounding: "Balanced"
    },
    performance: lineupNames.map(player => ({
      player,
      offense: 70,
      defense: 72,
      load: 65,
      fit: 54
    })),
    netRatingOverTime: Array.from({ length: 25 }, (_, minute) => ({
      minute,
      netRating: minute - 12
    })),
    profile: {
      player: "C",
      bio: { position: "SF", offensiveRole: "Wing", defensiveRole: "Stopper", age: 27, value: "$20M" },
      offensiveLoad: { creation: 60, shots: 70, initiatorRank: 2, gravity: 75, rebounding: 40 },
      defensiveLoad: { perimeter: 68, interior: 42, help: 50, activity: 4, rebounding: 38 },
      expectedShotProfile: { threePointShare: 0.4, midrangeShare: 0.2, rimShare: 0.3, freeThrowRate: 0.2 },
      expectedShotEfficiency: { threePointPct: 0.38, midrangePct: 0.42, rimPct: 0.65, freeThrowPct: 0.8 },
      expectedDefense: { idealMatchup: "Lead Wing", deflectionsPer100: 3, pointsSavedPer100: 4, turnoversCreatedPer100: 2 },
      expectedImpact: {
        pace: 40,
        shotProfile: 35,
        shotEfficiency: 50,
        opponentEfficiency: 25,
        stopsCreation: 30,
        rebounding: 28,
        netRating: 208
      },
      raw: { doNotReturn: true }
    }
  };
}

test("projection client returns the spreadsheet sections and selected profile", async () => {
  const oldUrl = process.env.SPREADSHEET_PROJECTION_URL;
  const oldKey = process.env.SPREADSHEET_PROJECTION_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SPREADSHEET_PROJECTION_URL = "https://script.example/exec";
  process.env.SPREADSHEET_PROJECTION_KEY = "server-only-test-key";

  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://script.example/exec");
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), {
        apiKey: "server-only-test-key",
        players: lineupNames,
        profilePlayer: "C"
      });
      return {
        ok: true,
        json: async () => completeResponse()
      };
    };

    const result = await fetchSpreadsheetProjections(lineupNames, "C");
    assert.deepEqual(result.ratingProjections, { OFF: 118.4, DEF: 111.2, NET: 6.1 });
    assert.deepEqual(result.overview, {
      creationBalance: 72,
      synergy: 81,
      pace: 99.4,
      versatility: 87
    });
    assert.deepEqual(result.offensiveProjections, completeResponse().offensiveProjections);
    assert.deepEqual(result.defensiveProjections, completeResponse().defensiveProjections);
    assert.deepEqual(result.usage, completeResponse().usage);
    assert.equal(result.performance.length, 5);
    assert.equal(result.netRatingOverTime.length, 25);
    assert.deepEqual(result.netRatingOverTime[0], { minute: 0, netRating: -12 });
    assert.deepEqual(result.netRatingOverTime[24], { minute: 24, netRating: 12 });
    assert.equal(result.profile.player, "C");
    assert.equal(Object.hasOwn(result.profile, "raw"), false);
    assert.equal(Object.hasOwn(result.profile.bio, "raw"), false);
    assert.deepEqual(result.playerNetRatingOverTime, []);
    assert.deepEqual(result.playerShapes, []);

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => {
        const withPlayers = completeResponse();
        const series = Array.from({ length: 25 }, (_, minute) => ({ minute, netRating: minute / 2 }));
        const attributes = count => Array.from({ length: count }, (_, i) => ({ name: `Attr ${i}`, rating: i === 0 ? null : 50 + i }));
        withPlayers.playerShapes = [
          { player: "A", offense: attributes(10), defense: attributes(8) },
          { player: "B", offense: attributes(9), defense: attributes(8) },
          { player: "Outsider", offense: attributes(10), defense: attributes(8) }
        ];
        withPlayers.playerNetRatingOverTime = [
          { player: "A", series },
          { player: "Outsider", series },
          { player: "B", series: series.slice(1) }
        ];
        return withPlayers;
      }
    });
    const withPlayersResult = await fetchSpreadsheetProjections(lineupNames, "C");
    assert.deepEqual(withPlayersResult.playerNetRatingOverTime.map(entry => entry.player), ["A"]);
    assert.equal(withPlayersResult.playerNetRatingOverTime[0].series.length, 25);
    assert.deepEqual(withPlayersResult.playerShapes.map(entry => entry.player), ["A"]);
    assert.equal(withPlayersResult.playerShapes[0].offense[0].rating, null);

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => {
        const incomplete = completeResponse();
        incomplete.defensiveProjections.defensiveRating = null;
        return incomplete;
      }
    });
    await assert.rejects(
      fetchSpreadsheetProjections(lineupNames, "C"),
      /incomplete results/
    );

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => {
        const incomplete = completeResponse();
        incomplete.netRatingOverTime.pop();
        return incomplete;
      }
    });
    await assert.rejects(
      fetchSpreadsheetProjections(lineupNames, "C"),
      /incomplete results/
    );

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => {
        const invalidUsage = completeResponse();
        invalidUsage.usage.initiator = "Initiator Present";
        return invalidUsage;
      }
    });
    await assert.rejects(
      fetchSpreadsheetProjections(lineupNames, "C"),
      /incomplete results/
    );

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => {
        const withOptions = completeResponse();
        withOptions.usage.offenseOptions = [
          {
            system: "4-Out + Roamer",
            score: 78.4,
            usefulPlayers: 5,
            assignments: lineupNames.map((player, index) => ({
              player,
              job: "engine",
              jobLabel: "Primary Engine",
              fit: 60 + index
            }))
          },
          { system: "Invalid - no assignments", assignments: [] },
          "not an object"
        ];
        withOptions.usage.defenseOptions = null;
        return withOptions;
      }
    });
    const withOptionsResult = await fetchSpreadsheetProjections(lineupNames, "C");
    assert.equal(withOptionsResult.usage.offenseOptions.length, 1);
    assert.deepEqual(withOptionsResult.usage.offenseOptions[0].system, "4-Out + Roamer");
    assert.equal(withOptionsResult.usage.offenseOptions[0].assignments.length, 5);
    assert.equal(Object.hasOwn(withOptionsResult.usage, "defenseOptions"), false);

    delete process.env.SPREADSHEET_PROJECTION_URL;
    await assert.rejects(
      fetchSpreadsheetProjections(lineupNames, "C"),
      /not configured/
    );
  } finally {
    if (oldUrl === undefined) delete process.env.SPREADSHEET_PROJECTION_URL;
    else process.env.SPREADSHEET_PROJECTION_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SPREADSHEET_PROJECTION_KEY;
    else process.env.SPREADSHEET_PROJECTION_KEY = oldKey;
    globalThis.fetch = oldFetch;
  }
});