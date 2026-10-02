import { BioRoleAssignmentEngine } from "./BioRoleAssignmentEngine.js";
import { LineupAnalysisEngine } from "./LineupAnalysisEngine.js";
import { LineupUsageEngine } from "./LineupUsageEngine.js";
import { OffensiveLoadEngine } from "./OffensiveLoadEngine.js";
import { DefensiveLoadEngine } from "./DefensiveLoadEngine.js";
import { LoadNormalizationEngine } from "./LoadNormalizationEngine.js";
import { PlayerCatalog } from "../core/PlayerCatalog.js";
import { ExpectedDefenseEngine } from "./ExpectedDefenseEngine.js";
import { ExpectedImpactEngine } from "./ExpectedImpactEngine.js";

const bioRoleEngine = new BioRoleAssignmentEngine();
const analysisEngine = new LineupAnalysisEngine();
const usageEngine = new LineupUsageEngine();
const offensiveLoadEngine = new OffensiveLoadEngine();
const defensiveLoadEngine = new DefensiveLoadEngine();
const loadNormalizationEngine = new LoadNormalizationEngine();
const expectedDefenseEngine = new ExpectedDefenseEngine();
const expectedImpactEngine = new ExpectedImpactEngine();

function normalizePlayerName(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function numericMetric(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ratio(numerator, denominator) {
  return numerator !== null && denominator > 0 ? numerator / denominator : null;
}

export function getPublicPlayerList(rows) {
  const catalog = PlayerCatalog.fromRows(rows);
  return rows
    .filter(row => row.player && row.position)
    .map(({ player, position }) => ({
      player,
      position,
      slots: catalog.getEligibleLineupSlots(catalog.normalizePosition(position))
    }))
    .sort((left, right) => left.player.localeCompare(right.player));
}

export function buildLineupResults(rows, selectedNames, selectedProfileName = selectedNames?.[0]) {
  if (!Array.isArray(selectedNames) || selectedNames.length !== 5) {
    throw new TypeError("Select exactly five players");
  }

  const selectedKeys = selectedNames.map(normalizePlayerName);
  if (selectedKeys.some(key => !key) || new Set(selectedKeys).size !== 5) {
    throw new TypeError("Select five different players");
  }

  const rowByName = new Map(rows.map(row => [normalizePlayerName(row.player), row]));
  const lineup = selectedKeys.map(key => rowByName.get(key));
  if (lineup.some(player => !player)) throw new TypeError("One or more players were not found");

  const offenseRoles = bioRoleEngine.assignOffensiveRoles(lineup);
  const defenseRoles = bioRoleEngine.assignDefensiveRoles(lineup);
  const offensiveLoads = offensiveLoadEngine.calculateLineupLoads(lineup, offenseRoles);
  const defensiveLoads = defensiveLoadEngine.calculateLineupLoads(lineup, defenseRoles, offenseRoles);
  const offenseShares = loadNormalizationEngine.normalizeShares(
    Object.fromEntries(
      Object.entries(offensiveLoads).map(([key, value]) => [key, value.creation + value.shots + value.rebounding])
    )
  );
  const loads = lineup.reduce((result, player) => {
    const key = normalizePlayerName(player.player);
    result[key] = {
      gravity: Number(player.raw?.gravity ?? player.gravity ?? 50),
      defense: 60 + (Number(player.raw?.age ?? player.age ?? 28) || 28) / 10
    };
    return result;
  }, {});

  const expectedDefense = expectedDefenseEngine.calculateLineupDefense(
    lineup.map(player => ({
      ...player,
      deflections: numericMetric(player.raw?.["deflections per 100"]),
      pointsSaved: numericMetric(player.raw?.["points saved per 100"]),
      turnoversCreated: numericMetric(player.raw?.["turnovers per 100"])
    })),
    defenseRoles
  );
  const impactInputs = lineup.map(player => {
    const key = normalizePlayerName(player.player);
    return {
      ...player,
      gravity: offensiveLoads[key].gravity,
      creation: offensiveLoads[key].creation,
      defense: 100 - (defensiveLoads[key].perimeter + defensiveLoads[key].interior) / 2,
      activity: defensiveLoads[key].activity,
      rebounding: offensiveLoads[key].rebounding
    };
  });
  const expectedImpact = expectedImpactEngine.calculateLineupImpact(
    impactInputs,
    offenseRoles,
    defenseRoles
  );

  const players = lineup.map(player => {
    const key = normalizePlayerName(player.player);
    return {
      player: player.player,
      position: player.position,
      offensiveRole: offenseRoles[key] || "Balanced",
      defensiveRole: defenseRoles[key] || "Balanced"
    };
  });
  const profileKey = normalizePlayerName(selectedProfileName || selectedNames[0]);
  const profilePlayer = lineup.find(player => normalizePlayerName(player.player) === profileKey);
  if (!profilePlayer) throw new TypeError("Choose a profile player from the selected lineup");
  const profileRaw = profilePlayer.raw || {};
  const profileDefense = expectedDefense[profileKey];
  const profileImpact = expectedImpact[profileKey];
  const profile = {
    player: profilePlayer.player,
    bio: {
      position: profilePlayer.position,
      offensiveRole: offenseRoles[profileKey] || "Balanced",
      defensiveRole: defenseRoles[profileKey] || "Balanced",
      age: numericMetric(profileRaw.age ?? profilePlayer.age),
      value: profileRaw.value ?? profilePlayer.value ?? null
    },
    offensiveLoad: {
      share: offenseShares[profileKey] ?? 0,
      ...offensiveLoads[profileKey]
    },
    defensiveLoad: defensiveLoads[profileKey],
    expectedShotProfile: {
      threePointShare: numericMetric(profileRaw["3p shot share"]),
      midrangeShare: numericMetric(profileRaw["midrange shot share"]),
      rimShare: numericMetric(profileRaw["paint shot share"]),
      freeThrowRate: ratio(
        numericMetric(profileRaw["fta per 100"]),
        (numericMetric(profileRaw["2pa per 100"]) || 0) + (numericMetric(profileRaw["3pa per 100"]) || 0)
      )
    },
    expectedShotEfficiency: {
      threePointPct: numericMetric(profileRaw["3p"]),
      midrangePct: numericMetric(profileRaw["midrange fg"]),
      rimPct: numericMetric(profileRaw["paint fg"]),
      freeThrowPct: numericMetric(profileRaw["ft"])
    },
    expectedDefense: {
      idealMatchup: profileDefense.matchup,
      deflectionsPer100: profileDefense.deflections,
      pointsSavedPer100: profileDefense.pointsSaved,
      turnoversCreatedPer100: profileDefense.turnoversCreated
    },
    expectedImpact: {
      pace: profileImpact.pace,
      shotProfile: profileImpact.shotProfile,
      shotEfficiency: profileImpact.shotEfficiency,
      opponentEfficiencySuppression: profileImpact.opponentEfficiency,
      stopsCreation: profileImpact.stopsCreation,
      rebounding: profileImpact.rebounding,
      netRating: profileImpact.netRating
    }
  };

  return {
    players,
    profile,
    overview: (() => {
      const { netRating, ...lineupOverview } = analysisEngine.calculateProjectiveOverview(
        lineup,
        offenseRoles,
        defenseRoles,
        loads
      );
      return lineupOverview;
    })(),
    usage: usageEngine.calculateLineupOutputs(lineup, offenseRoles, defenseRoles, loads)
  };
}