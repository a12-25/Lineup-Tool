export class ExpectedDefenseEngine {
  calculateLineupDefense(lineup, defensiveRoles = {}) {
    const result = {};

    lineup.forEach(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const profile = this.calculateDefenseProfile(player);
      const matchup = this.selectMatchup(player, defensiveRoles[key]);
      const load = this.calculateLoad(player, defensiveRoles[key], profile, matchup);

      result[key] = {
        profile,
        matchup,
        load,
        deflections: profile.deflections,
        pointsSaved: profile.pointsSaved,
        turnoversCreated: profile.turnoversCreated
      };
    });

    return result;
  }

  calculateDefenseProfile(player) {
    const deflections = Number(player.deflections ?? player.deflectionsPer100 ?? 2.8);
    const pointsSaved = Number(player.pointsSaved ?? player.pointsSavedPer100 ?? 4.1);
    const turnoversCreated = Number(player.turnoversCreated ?? player.turnoversPer100 ?? 1.7);

    return {
      deflections,
      pointsSaved,
      turnoversCreated
    };
  }

  selectMatchup(player, role) {
    const position = String(player.position || "").toUpperCase();

    if (role === "Point of Attack" || position === "PG") {
      return "Lead Guard";
    }

    if (role === "Wing Stopper" || position === "SG" || position === "SF") {
      return "Lead Wing";
    }

    if (role === "Post Defender" || position === "C" || position === "PF") {
      return "Lead Big";
    }

    return "Average Utility Wing";
  }

  calculateLoad(player, role, profile, matchup) {
    const base = Number(profile.deflections || 0) + Number(profile.pointsSaved || 0) + Number(profile.turnoversCreated || 0);
    const positionBonus = String(player.position || "").toUpperCase() === "C" ? 6 : 0;
    const roleBonus = role === "Wing Stopper" ? 3 : role === "Post Defender" ? 5 : 0;

    return {
      base,
      matchup,
      total: base + positionBonus + roleBonus
    };
  }

  normalizePlayerName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }
}
