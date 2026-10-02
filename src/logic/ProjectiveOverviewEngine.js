export class ProjectiveOverviewEngine {
  calculateOverview(lineup, offensiveRoles = {}, defensiveRoles = {}, loads = {}) {
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
      const role = offensiveRoles[key] || "";
      return role === "Primary Initiator" || role === "Secondary Initiator";
    }).length;

    const switchable = lineup.filter(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const role = defensiveRoles[key] || "";
      return role.includes("Switch") || role.includes("Stopper") || role.includes("Attack");
    }).length;

    result.creationBalance = this.clamp(Math.round((playmakers * 20) + (averageGravity * 0.4)), 0, 99);
    result.synergy = this.clamp(Math.round((switchable * 12) + (averageGravity * 0.35)), 0, 99);
    result.netRating = this.clamp(Math.round(averageGravity - 32), -20, 99);
    result.pace = this.clamp(Math.round((averageGravity * 0.7) + (playmakers * 5)), 0, 99);
    result.versatility = this.clamp(Math.round((switchable * 15) + (playmakers * 8) + (averageGravity * 0.2)), 0, 99);

    return result;
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  normalizePlayerName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }
}
