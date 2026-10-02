export class PlayerProfileEngine {
  buildPlayerProfile(player) {
    return {
      player: player.player || player.name || "",
      position: player.position || "",
      age: Number(player.age ?? 0),
      value: Number(player.value ?? 0),
      offensiveRole: player.offensiveRole || "",
      defensiveRole: player.defensiveRole || "",
      gravity: Number(player.gravity ?? 50),
      creation: Number(player.creation ?? 50),
      rebounding: Number(player.rebounding ?? 50),
      defense: Number(player.defense ?? 50),
      activity: Number(player.activity ?? 3)
    };
  }

  buildProfileMap(lineup) {
    return lineup.reduce((result, player) => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      result[key] = this.buildPlayerProfile(player);
      return result;
    }, {});
  }

  normalizePlayerName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }
}
