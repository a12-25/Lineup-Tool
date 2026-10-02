export class ExpectedImpactEngine {
  calculateLineupImpact(lineup, offensiveRoles = {}, defensiveRoles = {}) {
    const result = {};

    lineup.forEach(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const shotProfile = Number(player.gravity ?? 50) * 0.5;
      const shotEfficiency = Number(player.creation ?? 50) * 0.45;
      const opponentEfficiency = Number(player.defense ?? 50) * 0.4;
      const stopsCreation = Number(player.activity ?? 3) * 8;
      const rebounding = Number(player.rebounding ?? 50) * 0.6;
      const netRating = shotProfile + shotEfficiency + opponentEfficiency + stopsCreation + rebounding;

      result[key] = {
        pace: shotProfile,
        shotProfile,
        shotEfficiency,
        opponentEfficiency,
        stopsCreation,
        rebounding,
        netRating
      };
    });

    return result;
  }

  normalizePlayerName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }
}
