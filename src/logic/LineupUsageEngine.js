export class LineupUsageEngine {
  constructor() {
    this.defaultRoleMap = {
      offensive: {
        spacing: "5-Out",
        initiator: "Balanced Initiator",
        defense: "Switching",
        offensiveRebounding: "Balanced",
        defensiveRebounding: "Balanced"
      }
    };
  }

  calculateLineupOutputs(lineup, offensiveRoles = {}, defensiveRoles = {}, loads = {}) {
    const lineupSize = Array.isArray(lineup) ? lineup.length : 0;
    if (lineupSize !== 5) {
      return {
        offensiveSpacing: "N/A",
        initiator: "N/A",
        defense: "N/A",
        offensiveRebounding: "N/A",
        defensiveRebounding: "N/A"
      };
    }

    const offensiveSpacing = this.calculateOptimalOffensiveSpacing(lineup, offensiveRoles, loads);
    const initiator = this.calculateOptimalInitiator(lineup, offensiveRoles);
    const defense = this.calculateOptimalDefensiveScheme(lineup, defensiveRoles, loads);
    const offensiveRebounding = this.calculateOptimalOffensiveRebounding(lineup, offensiveRoles, loads);
    const defensiveRebounding = this.calculateOptimalDefensiveRebounding(lineup, defensiveRoles, loads);

    return {
      offensiveSpacing,
      initiator,
      defense,
      offensiveRebounding,
      defensiveRebounding
    };
  }

  calculateOptimalOffensiveSpacing(lineup, roles = {}, loads = {}) {
    let credibleSpacers = 0;
    let eliteSpacers = 0;
    let interiorPlayers = 0;
    let roamerCandidates = 0;
    let trueBigs = 0;
    let shootingTotal = 0;

    lineup.forEach(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const gravity = loads[key]?.gravity ?? 50;
      const role = roles[key] || "";
      const bigLikelihood = this.calculateBigLikelihood(player);

      shootingTotal += gravity;

      if (gravity >= 62) {
        credibleSpacers += 1;
      }

      if (gravity >= 78) {
        eliteSpacers += 1;
      }

      if (role === "Interior Finisher" || role === "Roll and Cut") {
        interiorPlayers += 1;
      }

      const connectiveScore = this.calculateConnectiveScore(player);
      const mobileFrontcourtRole = [
        "Connective Playmaker",
        "Pick and Pop Big",
        "Roll and Cut",
        "Off-Ball Wing"
      ].includes(role);

      if (
        bigLikelihood >= 52 &&
        bigLikelihood <= 88 &&
        gravity >= 52 &&
        connectiveScore >= 55 &&
        mobileFrontcourtRole
      ) {
        roamerCandidates += 1;
      }

      if (bigLikelihood >= 67) {
        trueBigs += 1;
      }
    });

    const averageGravity = shootingTotal / lineup.length;

    if (credibleSpacers >= 5 && averageGravity >= 66) {
      return "5-Out";
    }

    if (credibleSpacers >= 4 && interiorPlayers <= 1) {
      return roamerCandidates >= 1 ? "4-Out + Roamer" : "4-Out";
    }

    if (trueBigs >= 2 && credibleSpacers >= 3) {
      return "Big 3-Out";
    }

    return "Balanced";
  }

  calculateOptimalInitiator(lineup, roles = {}) {
    const initiators = lineup.filter(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const role = roles[key] || "";
      return role === "Primary Initiator" || role === "Secondary Initiator";
    });

    return initiators.length >= 1 ? "Initiator Present" : "Secondary Creator";
  }

  calculateOptimalDefensiveScheme(lineup, defensiveRoles = {}, loads = {}) {
    const switchable = lineup.filter(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const role = defensiveRoles[key] || "";
      const defenseGravity = loads[key]?.defense ?? 50;
      return role === "Switch Big" || role === "Wing Stopper" || defenseGravity >= 61;
    }).length;

    return switchable >= 3 ? "Switching" : "Drop Coverage";
  }

  calculateOptimalOffensiveRebounding(lineup, offensiveRoles = {}, loads = {}) {
    const reboundThreats = lineup.filter(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const role = offensiveRoles[key] || "";
      return role.includes("Big") || (loads[key]?.gravity ?? 50) >= 58;
    }).length;

    return reboundThreats >= 2 ? "Strong" : "Balanced";
  }

  calculateOptimalDefensiveRebounding(lineup, defensiveRoles = {}, loads = {}) {
    const rebounders = lineup.filter(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const role = defensiveRoles[key] || "";
      return role.includes("Big") || (loads[key]?.defense ?? 50) >= 60;
    }).length;

    return rebounders >= 2 ? "Strong" : "Balanced";
  }

  calculateBigLikelihood(player) {
    const values = [
      Number(player.bigLikelihood ?? player.big ?? 50),
      Number(player.bulk ?? 50),
      Number(player.rimRole ?? 50)
    ];

    const total = values.reduce((sum, value) => sum + value, 0);
    return total / Math.max(values.length, 1);
  }

  calculateConnectiveScore(player) {
    const values = [
      Number(player.creation ?? 50),
      Number(player.assistsPer100 ?? 50),
      Number(player.potentialAssistsPer100 ?? 50),
      Number(player.pointsCreatedPer100 ?? 50),
      Number(player.finishing ?? 50),
      Number(player.atRimAssistsPer100 ?? 50)
    ];

    const total = values.reduce((sum, value) => sum + value, 0);
    return total / Math.max(values.length, 1);
  }

  normalizePlayerName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }
}
