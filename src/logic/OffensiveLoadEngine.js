export class OffensiveLoadEngine {
  calculateLineupLoads(lineup, roles = {}) {
    const result = {};

    lineup.forEach(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const role = roles[key] || "";

      const creation = this.calculateCreationDemand(player, role);
      const shots = this.calculateShotDemand(player, role);
      const rebounding = this.calculateReboundingDemand(player, role);
      const initiatorRank = this.calculateInitiatorRank(player, role);
      const gravity = this.calculateGravity(player, role);

      result[key] = {
        creation,
        shots,
        rebounding,
        initiatorRank,
        gravity
      };
    });

    return result;
  }

  calculateCreationDemand(player, role) {
    const base = Number(player.creation ?? player.creationDemand ?? 50);
    const roleAdjustment = this.roleAdjustment(role, "creation");
    return this.clamp(Math.round(base + roleAdjustment), 0, 100);
  }

  calculateShotDemand(player, role) {
    const base = Number(player.shots ?? player.shotDemand ?? 50);
    const roleAdjustment = this.roleAdjustment(role, "shots");
    return this.clamp(Math.round(base + roleAdjustment), 0, 100);
  }

  calculateReboundingDemand(player, role) {
    const base = Number(player.rebounding ?? player.reboundShare ?? 50);
    const roleAdjustment = this.roleAdjustment(role, "rebounding");
    return this.clamp(Math.round(base + roleAdjustment), 0, 100);
  }

  calculateInitiatorRank(player, role) {
    const base = Number(player.initiatorRank ?? 3);
    if (role === "Primary Initiator") return 1;
    if (role === "Secondary Initiator") return 2;
    return this.clamp(base, 1, 5);
  }

  calculateGravity(player, role) {
    const base = Number(player.gravity ?? 50);
    const roleAdjustment = this.roleAdjustment(role, "gravity");
    return this.clamp(Math.round(base + roleAdjustment), 0, 100);
  }

  roleAdjustment(role, metric) {
    const roleMap = {
      "Primary Initiator": { creation: 18, shots: 10, rebounding: 0, gravity: 18 },
      "Secondary Initiator": { creation: 12, shots: 6, rebounding: 0, gravity: 12 },
      "Connective Playmaker": { creation: 10, shots: 5, rebounding: 0, gravity: 10 },
      "Perimeter Specialist": { creation: 6, shots: 10, rebounding: 0, gravity: 8 },
      "Off-Ball Wing": { creation: 2, shots: 12, rebounding: 0, gravity: 8 },
      "Interior Finisher": { creation: 0, shots: 10, rebounding: 12, gravity: 7 },
      "Roll and Cut": { creation: 0, shots: 8, rebounding: 6, gravity: 6 },
      "Pick and Pop Big": { creation: 0, shots: 12, rebounding: 8, gravity: 9 }
    };

    const selected = roleMap[role] || { creation: 0, shots: 0, rebounding: 0, gravity: 0 };
    return selected[metric] || 0;
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
