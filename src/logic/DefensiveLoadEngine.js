export class DefensiveLoadEngine {
  calculateLineupLoads(lineup, roles = {}, offensiveRoles = {}) {
    const result = {};

    lineup.forEach(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const role = roles[key] || "";
      const offensiveRole = offensiveRoles[key] || "";

      const perimeter = this.calculatePerimeterDemand(player, role, offensiveRole);
      const interior = this.calculateInteriorDemand(player, role, offensiveRole);
      const help = this.calculateHelpDemand(player, role, offensiveRole);
      const rebounding = this.calculateReboundingDemand(player, role);
      const activity = this.calculateActivityScore(player, role, offensiveRole);

      result[key] = {
        perimeter,
        interior,
        help,
        rebounding,
        activity
      };
    });

    return result;
  }

  calculatePerimeterDemand(player, role, offensiveRole) {
    const base = Number(player.perimeterDemand ?? player.perimeter ?? 40);
    const roleAdjustment = this.roleAdjustment(role, "perimeter");
    const burdenAdjustment = this.offensiveBurdenAdjustment(offensiveRole, "perimeter");
    return this.clamp(Math.round(base + roleAdjustment + burdenAdjustment), 0, 100);
  }

  calculateInteriorDemand(player, role, offensiveRole) {
    const base = Number(player.interiorDemand ?? player.interior ?? 35);
    const roleAdjustment = this.roleAdjustment(role, "interior");
    const burdenAdjustment = this.offensiveBurdenAdjustment(offensiveRole, "interior");
    return this.clamp(Math.round(base + roleAdjustment + burdenAdjustment), 0, 100);
  }

  calculateHelpDemand(player, role, offensiveRole) {
    const base = Number(player.helpDemand ?? player.help ?? 30);
    const roleAdjustment = this.roleAdjustment(role, "help");
    const burdenAdjustment = this.offensiveBurdenAdjustment(offensiveRole, "help");
    return this.clamp(Math.round(base + roleAdjustment + burdenAdjustment), 0, 100);
  }

  calculateReboundingDemand(player, role) {
    const base = Number(player.rebounding ?? player.defensiveRebounding ?? 35);
    const roleAdjustment = this.roleAdjustment(role, "rebounding");
    return this.clamp(Math.round(base + roleAdjustment), 0, 100);
  }

  calculateActivityScore(player, role, offensiveRole) {
    const base = Number(player.activity ?? 3);
    const roleAdjustment = this.roleAdjustment(role, "activity");
    const burdenAdjustment = this.offensiveBurdenAdjustment(offensiveRole, "activity");
    return this.clamp(Math.round(base + roleAdjustment + burdenAdjustment), 1, 5);
  }

  roleAdjustment(role, metric) {
    const roleMap = {
      "Point of Attack": { perimeter: 14, interior: 2, help: 4, rebounding: 2, activity: 1 },
      "Wing Stopper": { perimeter: 12, interior: 6, help: 4, rebounding: 3, activity: 1 },
      "Post Defender": { perimeter: 4, interior: 16, help: 7, rebounding: 8, activity: 1 },
      "Switch Big": { perimeter: 8, interior: 12, help: 10, rebounding: 5, activity: 1 },
      "Chaser": { perimeter: 10, interior: 4, help: 12, rebounding: 3, activity: 1 },
      "Helpside Interceptor": { perimeter: 5, interior: 4, help: 15, rebounding: 5, activity: 1 },
      "Helpside Shot Blocker": { perimeter: 2, interior: 10, help: 16, rebounding: 9, activity: 1 },
      "Helpside Body": { perimeter: 2, interior: 8, help: 9, rebounding: 7, activity: 1 }
    };

    const selected = roleMap[role] || { perimeter: 0, interior: 0, help: 0, rebounding: 0, activity: 0 };
    return selected[metric] || 0;
  }

  offensiveBurdenAdjustment(role, metric) {
    const roleMap = {
      "Primary Initiator": { perimeter: 8, interior: -2, help: 0, rebounding: 0, activity: 1 },
      "Secondary Initiator": { perimeter: 6, interior: -1, help: 2, rebounding: 0, activity: 1 },
      "Connective Playmaker": { perimeter: 5, interior: 0, help: 5, rebounding: 0, activity: 1 },
      "Perimeter Specialist": { perimeter: 6, interior: 0, help: 0, rebounding: 0, activity: 1 },
      "Interior Finisher": { perimeter: -2, interior: 7, help: 3, rebounding: 4, activity: 1 },
      "Roll and Cut": { perimeter: 0, interior: 4, help: 5, rebounding: 3, activity: 1 },
      "Off-Ball Wing": { perimeter: 3, interior: 0, help: 3, rebounding: 0, activity: 1 }
    };

    const selected = roleMap[role] || { perimeter: 0, interior: 0, help: 0, rebounding: 0, activity: 0 };
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
