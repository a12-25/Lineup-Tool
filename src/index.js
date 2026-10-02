import { LINEUP_CONFIG } from "./core/LineupConfig.js";
import { SpreadsheetAdapter } from "./core/SpreadsheetAdapter.js";
import { PlayerCatalog } from "./core/PlayerCatalog.js";
import { LineupUsageEngine } from "./logic/LineupUsageEngine.js";

const adapter = new SpreadsheetAdapter();
const engine = new LineupUsageEngine();

const rows = [
  { player: "Player A", position: "PG", name: "Player A" },
  { player: "Player B", position: "SG", name: "Player B" },
  { player: "Player C", position: "SF", name: "Player C" },
  { player: "Player D", position: "PF", name: "Player D" },
  { player: "Player E", position: "C", name: "Player E" }
];

const catalog = PlayerCatalog.fromRows(rows);
const lineup = [
  { player: "Player A", name: "Player A" },
  { player: "Player B", name: "Player B" },
  { player: "Player C", name: "Player C" },
  { player: "Player D", name: "Player D" },
  { player: "Player E", name: "Player E" }
];

const normalized = adapter.normalizePosition("G-F");
const eligibleSlots = adapter.getEligibleLineupSlots(normalized);
const dropdownOptions = catalog.buildDropdownOptions("PG");
const usage = engine.calculateLineupOutputs(lineup, {}, {}, {
  playera: { gravity: 80 },
  playerb: { gravity: 72 },
  playerc: { gravity: 68 },
  playerd: { gravity: 65 },
  playere: { gravity: 60 }
});

console.log(LINEUP_CONFIG);
console.log(eligibleSlots);
console.log(dropdownOptions);
console.log(usage);
