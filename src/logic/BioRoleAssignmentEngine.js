export const BIO_OFFENSIVE_ROLES = Object.freeze({
  PRIMARY_INITIATOR: "Primary Initiator",
  SECONDARY_INITIATOR: "Secondary Initiator",
  PERIMETER_SPECIALIST: "Perimeter Specialist",
  DRIBBLE_PENETRATOR: "Dribble Penetrator",
  CONNECTIVE_PLAYMAKER: "Connective Playmaker",
  ROLL_AND_CUT: "Roll and Cut",
  INTERIOR_FINISHER: "Interior Finisher",
  PICK_AND_POP_BIG: "Pick and Pop Big",
  OFF_BALL_WING: "Off-Ball Wing"
});

export const BIO_DEFENSIVE_ROLES = Object.freeze({
  POINT_OF_ATTACK: "Point of Attack",
  WING_STOPPER: "Wing Stopper",
  POST_DEFENDER: "Post Defender",
  SWITCH_BIG: "Switch Big",
  CHASER: "Chaser",
  HELPSIDE_INTERCEPTOR: "Helpside Interceptor",
  HELPSIDE_SHOT_BLOCKER: "Helpside Shot Blocker",
  HELPSIDE_BODY: "Helpside Body"
});

export const BIO_OFFENSIVE_ROLE_CAPS = Object.freeze({
  [BIO_OFFENSIVE_ROLES.PRIMARY_INITIATOR]: 1,
  [BIO_OFFENSIVE_ROLES.SECONDARY_INITIATOR]: 1,
  [BIO_OFFENSIVE_ROLES.PERIMETER_SPECIALIST]: 3,
  [BIO_OFFENSIVE_ROLES.DRIBBLE_PENETRATOR]: 2,
  [BIO_OFFENSIVE_ROLES.CONNECTIVE_PLAYMAKER]: 3,
  [BIO_OFFENSIVE_ROLES.ROLL_AND_CUT]: 3,
  [BIO_OFFENSIVE_ROLES.INTERIOR_FINISHER]: 2,
  [BIO_OFFENSIVE_ROLES.PICK_AND_POP_BIG]: 2,
  [BIO_OFFENSIVE_ROLES.OFF_BALL_WING]: 3
});

export const BIO_DEFENSIVE_ROLE_CAPS = Object.freeze({
  [BIO_DEFENSIVE_ROLES.POINT_OF_ATTACK]: 1,
  [BIO_DEFENSIVE_ROLES.WING_STOPPER]: 2,
  [BIO_DEFENSIVE_ROLES.POST_DEFENDER]: 2,
  [BIO_DEFENSIVE_ROLES.SWITCH_BIG]: 2,
  [BIO_DEFENSIVE_ROLES.CHASER]: 2,
  [BIO_DEFENSIVE_ROLES.HELPSIDE_INTERCEPTOR]: 2,
  [BIO_DEFENSIVE_ROLES.HELPSIDE_SHOT_BLOCKER]: 2,
  [BIO_DEFENSIVE_ROLES.HELPSIDE_BODY]: 2
});

export class BioRoleAssignmentEngine {
  assignOffensiveRoles(lineup) {
    const result = {};

    lineup.forEach(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      result[key] = this.pickOffensiveRole(player);
    });

    return result;
  }

  assignDefensiveRoles(lineup) {
    const result = {};

    lineup.forEach(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      result[key] = this.pickDefensiveRole(player);
    });

    return result;
  }

  pickOffensiveRole(player) {
    const position = String(player.position || "").toUpperCase();
    const metrics = {
      creation: Number(player.creation ?? player.initiation ?? 50),
      gravity: Number(player.gravity ?? 50),
      shots: Number(player.shots ?? player.shotDemand ?? 50),
      rebound: Number(player.rebounding ?? 50)
    };

    if (position === "PG") {
      return metrics.creation >= 60
        ? BIO_OFFENSIVE_ROLES.PRIMARY_INITIATOR
        : BIO_OFFENSIVE_ROLES.SECONDARY_INITIATOR;
    }

    if (position === "SG") {
      return metrics.shots >= 60
        ? BIO_OFFENSIVE_ROLES.PERIMETER_SPECIALIST
        : BIO_OFFENSIVE_ROLES.CONNECTIVE_PLAYMAKER;
    }

    if (position === "SF") {
      return metrics.gravity >= 62
        ? BIO_OFFENSIVE_ROLES.OFF_BALL_WING
        : BIO_OFFENSIVE_ROLES.CONNECTIVE_PLAYMAKER;
    }

    if (position === "PF") {
      return metrics.rebound >= 60
        ? BIO_OFFENSIVE_ROLES.INTERIOR_FINISHER
        : BIO_OFFENSIVE_ROLES.PICK_AND_POP_BIG;
    }

    return metrics.rebound >= 62
      ? BIO_OFFENSIVE_ROLES.ROLL_AND_CUT
      : BIO_OFFENSIVE_ROLES.INTERIOR_FINISHER;
  }

  pickDefensiveRole(player) {
    const position = String(player.position || "").toUpperCase();
    const metrics = {
      perimeter: Number(player.perimeterDemand ?? 50),
      interior: Number(player.interiorDemand ?? 50),
      help: Number(player.helpDemand ?? 50),
      rebound: Number(player.rebounding ?? 50)
    };

    if (position === "PG") {
      return metrics.perimeter >= 55
        ? BIO_DEFENSIVE_ROLES.POINT_OF_ATTACK
        : BIO_DEFENSIVE_ROLES.CHASER;
    }

    if (position === "SG" || position === "SF") {
      return metrics.help >= 60
        ? BIO_DEFENSIVE_ROLES.WING_STOPPER
        : BIO_DEFENSIVE_ROLES.CHASER;
    }

    if (position === "PF") {
      return metrics.interior >= 58
        ? BIO_DEFENSIVE_ROLES.SWITCH_BIG
        : BIO_DEFENSIVE_ROLES.POST_DEFENDER;
    }

    return metrics.rebound >= 62
      ? BIO_DEFENSIVE_ROLES.POST_DEFENDER
      : BIO_DEFENSIVE_ROLES.HELPSIDE_SHOT_BLOCKER;
  }

  normalizePlayerName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }
}
