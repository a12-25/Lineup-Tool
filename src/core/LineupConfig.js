export const LINEUP_CONFIG = Object.freeze({
  sheets: {
    players: "Players",
    lineup: "Lineup"
  },

  players: {
    headerRow: 1,
    firstDataRow: 2,

    headers: {
      player: ["Player", "Player Name", "Name"],
      position: ["Pos", "Position"],
      age: ["Age", "DB_year/Age"],
      value: ["$ Value", "Value", "Player Value"]
    }
  },

  lineup: {
    slotCells: {
      PG: "A3",
      SG: "B3",
      SF: "C3",
      PF: "D3",
      C: "E3"
    },

    slotOrder: ["PG", "SG", "SF", "PF", "C"],

    profile: {
      playerDropdown: "H2",
      bioOutputs: {
        position: "H4",
        offRole: "H5",
        defRole: "H6",
        age: "H7",
        value: "H8"
      }
    }
  }
});
