export class PlayerCatalog {
  constructor(rows = []) {
    this.rows = rows;
  }

  static fromRows(rows) {
    return new PlayerCatalog(rows);
  }

  getPlayerByName(playerName) {
    return this.rows.find(row => row.player === playerName) || null;
  }

  buildDropdownOptions(slot, players = this.rows) {
    const options = [];

    players.forEach(player => {
      const position = this.normalizePosition(player.position);
      const eligibleSlots = this.getEligibleLineupSlots(position);

      if (eligibleSlots.includes(slot)) {
        options.push(player.player);
      }
    });

    return this.uniqueSorted(options);
  }

  normalizePosition(value) {
    return String(value ?? "")
      .toUpperCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[\/,]/g, "-")
      .replace(/[–—]/g, "-")
      .replace(/-+/g, "-");
  }

  getEligibleLineupSlots(position) {
    const positionMap = {
      PG: ["PG"],
      G: ["PG", "SG"],
      "G-F": ["SG", "SF"],
      "F-G": ["SG", "SF"],
      F: ["SF", "PF"],
      "F-C": ["PF", "C"],
      "C-F": ["PF", "C"],
      C: ["C"]
    };

    return positionMap[position] || [];
  }

  uniqueSorted(values) {
    return [...new Set(values)]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }
}
