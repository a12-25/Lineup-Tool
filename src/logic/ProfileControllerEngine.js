export class ProfileControllerEngine {
  constructor({
    bioRoleEngine,
    offensiveLoadEngine,
    defensiveLoadEngine,
    expectedDefenseEngine,
    expectedImpactEngine
  }) {
    this.bioRoleEngine = bioRoleEngine;
    this.offensiveLoadEngine = offensiveLoadEngine;
    this.defensiveLoadEngine = defensiveLoadEngine;
    this.expectedDefenseEngine = expectedDefenseEngine;
    this.expectedImpactEngine = expectedImpactEngine;
  }

  buildSelectedPlayerProfileContext(lineup, selectedPlayer) {
    const selectedKey = this.normalizePlayerName(selectedPlayer);
    const selectedLineupEntry = lineup.find(entry => {
      return this.normalizePlayerName(entry.player || entry.name) === selectedKey;
    });

    if (!selectedLineupEntry) {
      throw new Error(`"${selectedPlayer}" is not part of the submitted lineup.`);
    }

    const lineupRecords = lineup.map(entry => ({
      ...entry,
      lineupSlot: entry.slot || entry.position || ""
    }));

    const offensiveRoles = this.bioRoleEngine.assignOffensiveRoles(lineupRecords);
    const defensiveRoles = this.bioRoleEngine.assignDefensiveRoles(lineupRecords);

    return {
      lineup,
      lineupRecords,
      selectedKey,
      offensiveRoles,
      defensiveRoles
    };
  }

  populateSelectedPlayerProfile(selectedPlayer, lineup) {
    const context = this.buildSelectedPlayerProfileContext(lineup, selectedPlayer);

    const offensiveLoad = this.offensiveLoadEngine.calculateLineupLoads(
      context.lineupRecords,
      context.offensiveRoles
    );

    const defensiveLoad = this.defensiveLoadEngine.calculateLineupLoads(
      context.lineupRecords,
      context.defensiveRoles,
      context.offensiveRoles
    );

    const expectedDefense = this.expectedDefenseEngine.calculateLineupDefense(
      context.lineupRecords,
      context.defensiveRoles
    );

    const impact = this.expectedImpactEngine.calculateLineupImpact(
      context.lineupRecords,
      context.offensiveRoles,
      context.defensiveRoles
    );

    return {
      ...context,
      offensiveLoad,
      defensiveLoad,
      expectedDefense,
      impact
    };
  }

  normalizePlayerName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }
}
