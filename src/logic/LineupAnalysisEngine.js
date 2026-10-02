export class LineupAnalysisEngine {
  calculateProjectiveOverview(lineup, offensiveRoles = {}, defensiveRoles = {}, loads = {}) {
    const result = {
      creationBalance: 0,
      synergy: 0,
      netRating: 0,
      pace: 0,
      versatility: 0
    };

    const totalGravity = lineup.reduce((sum, player) => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      return sum + (loads[key]?.gravity ?? 50);
    }, 0);

    const averageGravity = lineup.length ? totalGravity / lineup.length : 0;
    const playmakers = lineup.filter(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      return offensiveRoles[key] === "Primary Initiator" || offensiveRoles[key] === "Secondary Initiator";
    }).length;

    const switchable = lineup.filter(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const role = defensiveRoles[key] || "";
      return role.includes("Switch") || role.includes("Stopper") || role.includes("Attack");
    }).length;

    result.creationBalance = Math.min(99, Math.max(0, Math.round((playmakers * 20) + (averageGravity * 0.4))));
    result.synergy = Math.min(99, Math.max(0, Math.round((switchable * 12) + (averageGravity * 0.35))));
    result.netRating = Math.min(99, Math.max(-20, Math.round(averageGravity - 32)));
    result.pace = Math.min(99, Math.max(0, Math.round(averageGravity * 0.7 + playmakers * 5)));
    result.versatility = Math.min(99, Math.max(0, Math.round((switchable * 15) + (playmakers * 8) + (averageGravity * 0.2))));

    return result;
  }

  normalizePlayerName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }
}
