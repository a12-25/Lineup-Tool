import {
  BIO_OFFENSIVE_ROLES,
  BIO_DEFENSIVE_ROLES
} from "../core/RoleDefinitions.js";

export class RoleAssignmentEngine {
  assignOffensiveRoles(lineup) {
    const result = {};

    lineup.forEach(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const preferredRole = this.pickOffensiveRole(player);
      result[key] = preferredRole;
    });

    return result;
  }

  assignDefensiveRoles(lineup) {
    const result = {};

    lineup.forEach(player => {
      const key = this.normalizePlayerName(player.player || player.name || "");
      const preferredRole = this.pickDefensiveRole(player);
      result[key] = preferredRole;
    });

    return result;
  }

  pickOffensiveRole(player) {
    if (player.offensiveRole) {
      return player.offensiveRole;
    }

    const position = String(player.position || "").toUpperCase();

    if (position === "PG") {
      return BIO_OFFENSIVE_ROLES.PRIMARY_INITIATOR;
    }

    if (position === "SG") {
      return BIO_OFFENSIVE_ROLES.PERIMETER_SPECIALIST;
    }

    if (position === "SF") {
      return BIO_OFFENSIVE_ROLES.OFF_BALL_WING;
    }

    if (position === "PF") {
      return BIO_OFFENSIVE_ROLES.INTERIOR_FINISHER;
    }

    return BIO_OFFENSIVE_ROLES.ROLL_AND_CUT;
  }

  pickDefensiveRole(player) {
    if (player.defensiveRole) {
      return player.defensiveRole;
    }

    const position = String(player.position || "").toUpperCase();

    if (position === "PG") {
      return BIO_DEFENSIVE_ROLES.POINT_OF_ATTACK;
    }

    if (position === "SG" || position === "SF") {
      return BIO_DEFENSIVE_ROLES.WING_STOPPER;
    }

    if (position === "PF") {
      return BIO_DEFENSIVE_ROLES.SWITCH_BIG;
    }

    return BIO_DEFENSIVE_ROLES.POST_DEFENDER;
  }

  normalizePlayerName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }
}
