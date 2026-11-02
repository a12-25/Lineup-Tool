const OVERVIEW_FIELDS = ["creationBalance", "synergy", "pace", "versatility"];
const RATING_FIELDS = ["OFF", "DEF", "NET"];
const OFFENSIVE_PROJECTION_FIELDS = [
  "shotBalance",
  "offensiveRebounding",
  "offensiveRating",
  "threePointPercentage",
  "trueShootingPercentage"
];
const DEFENSIVE_PROJECTION_FIELDS = [
  "opponentTs",
  "defensiveRebounding",
  "defensiveRating",
  "turnoverCreation",
  "rimProtection"
];
const USAGE_FIELDS = ["offense", "initiator", "defense", "offRebounding", "defRebounding"];

function sanitizeSystemOption(option) {
  if (!option || typeof option.system !== "string" || !option.system.trim()) return null;
  if (!Array.isArray(option.assignments)) return null;
  const assignments = option.assignments
    .filter(assignment => assignment && assignment.player && assignment.job)
    .map(assignment => ({
      player: String(assignment.player),
      job: String(assignment.job),
      jobLabel: String(assignment.jobLabel || assignment.job),
      fit: Number.isFinite(Number(assignment.fit)) ? Number(assignment.fit) : null
    }));
  if (!assignments.length) return null;
  return {
    system: option.system,
    score: Number.isFinite(Number(option.score)) ? Number(option.score) : null,
    usefulPlayers: Number.isFinite(Number(option.usefulPlayers)) ? Number(option.usefulPlayers) : null,
    assignments
  };
}

function sanitizeSystemOptions(options) {
  return Array.isArray(options) ? options.map(sanitizeSystemOption).filter(Boolean) : [];
}
const PROFILE_FIELDS = {
  bio: ["position", "offensiveRole", "defensiveRole", "age", "value"],
  offensiveLoad: ["creation", "shots", "initiatorRank", "gravity", "rebounding"],
  defensiveLoad: ["perimeter", "interior", "help", "activity", "rebounding"],
  expectedShotProfile: ["threePointShare", "midrangeShare", "rimShare", "freeThrowRate"],
  expectedShotEfficiency: ["threePointPct", "midrangePct", "rimPct", "freeThrowPct"],
  expectedDefense: ["idealMatchup", "deflectionsPer100", "pointsSavedPer100", "turnoversCreatedPer100"],
  expectedImpact: [
    "pace",
    "shotProfile",
    "shotEfficiency",
    "opponentEfficiency",
    "stopsCreation",
    "rebounding",
    "netRating"
  ]
};

function sanitizePlayerSeries(entries, lineupPlayers) {
  if (!Array.isArray(entries)) return [];
  const names = new Set((lineupPlayers || []).map(player => player.player));
  return entries
    .filter(entry =>
      entry && names.has(entry.player) && Array.isArray(entry.series) &&
      entry.series.length === 25 &&
      entry.series.every((point, index) =>
        Number(point?.minute) === index &&
        point.netRating !== null &&
        point.netRating !== undefined &&
        Number.isFinite(Number(point.netRating))
      )
    )
    .map(entry => ({
      player: entry.player,
      series: entry.series.map(point => ({
        minute: Number(point.minute),
        netRating: Number(point.netRating)
      }))
    }));
}

function sanitizeShapeAttributes(attributes, expectedCount) {
  if (!Array.isArray(attributes) || attributes.length !== expectedCount) return null;
  const cleaned = attributes.map(attribute => {
    const rating = attribute?.rating;
    const valid = rating === null || (typeof rating === "number" && Number.isFinite(rating));
    return typeof attribute?.name === "string" && valid
      ? { name: attribute.name, rating }
      : null;
  });
  return cleaned.every(Boolean) ? cleaned : null;
}

function sanitizePlayerShapes(entries, lineupPlayers) {
  if (!Array.isArray(entries)) return [];
  const names = new Set((lineupPlayers || []).map(player => player.player));
  return entries.flatMap(entry => {
    if (!entry || !names.has(entry.player)) return [];
    const offense = sanitizeShapeAttributes(entry.offense, 10);
    const defense = sanitizeShapeAttributes(entry.defense, 8);
    return offense && defense ? [{ player: entry.player, offense, defense }] : [];
  });
}

function hasFields(record, fields) {
  return record && fields.every(field => Object.hasOwn(record, field));
}

function pickFields(record, fields) {
  return Object.fromEntries(fields.map(field => [field, record[field]]));
}

export async function fetchSpreadsheetProjections(players, profilePlayer = players?.[0]) {
  const endpoint = process.env.SPREADSHEET_PROJECTION_URL;
  const apiKey = process.env.SPREADSHEET_PROJECTION_KEY;

  if (!endpoint || !apiKey) {
    throw new Error("The spreadsheet projection service is not configured");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, players, profilePlayer }),
    signal: AbortSignal.timeout(30000)
  });
  const body = await response.json();

  if (!response.ok || body.error) {
    throw new Error("The spreadsheet projection service rejected the request");
  }

  const hasAllFiniteValues = (record, keys) =>
    record && keys.every(key =>
      record[key] !== null &&
      record[key] !== undefined &&
      record[key] !== "" &&
      Number.isFinite(Number(record[key]))
    );

  const performanceIsValid = Array.isArray(body.performance) &&
    body.performance.length === 5 &&
    body.performance.every(player =>
      player.player &&
      ["offense", "defense", "load", "fit"].every(metric =>
        player[metric] !== null &&
        player[metric] !== undefined &&
        Number.isFinite(Number(player[metric]))
      )
    );
  const playersAreValid = Array.isArray(body.players) &&
    body.players.length === 5 &&
    body.players.every(player =>
      player.player && player.position && player.offensiveRole && player.defensiveRole
    );
  const usageIsValid = body.usage &&
    USAGE_FIELDS.every(key => typeof body.usage[key] === "string" && body.usage[key].trim()) &&
    body.players?.some(player => player.player === body.usage.initiator);
  const profileIsValid = body.profile &&
    body.profile.player === profilePlayer &&
    Object.entries(PROFILE_FIELDS).every(([section, fields]) =>
      hasFields(body.profile[section], fields)
    );
  const netRatingSeriesIsValid = Array.isArray(body.netRatingOverTime) &&
    body.netRatingOverTime.length === 25 &&
    body.netRatingOverTime.every((point, index) =>
      Number(point?.minute) === index &&
      point.netRating !== null &&
      point.netRating !== undefined &&
      Number.isFinite(Number(point.netRating))
    );

  if (
    !hasAllFiniteValues(body.ratingProjections, RATING_FIELDS) ||
    !hasAllFiniteValues(body.overview, OVERVIEW_FIELDS) ||
    !hasAllFiniteValues(body.offensiveProjections, OFFENSIVE_PROJECTION_FIELDS) ||
    !hasAllFiniteValues(body.defensiveProjections, DEFENSIVE_PROJECTION_FIELDS) ||
    !usageIsValid ||
    !playersAreValid ||
    !performanceIsValid ||
    !profileIsValid ||
    !netRatingSeriesIsValid
  ) {
    throw new Error("The spreadsheet projection service returned incomplete results");
  }

  return {
    players: body.players.map(player => ({
      player: player.player,
      position: player.position,
      offensiveRole: player.offensiveRole,
      defensiveRole: player.defensiveRole
    })),
    ratingProjections: Object.fromEntries(
      RATING_FIELDS.map(key => [key, Number(body.ratingProjections[key])])
    ),
    overview: Object.fromEntries(
      OVERVIEW_FIELDS.map(key => [key, Number(body.overview[key])])
    ),
    offensiveProjections: Object.fromEntries(
      OFFENSIVE_PROJECTION_FIELDS.map(key => [key, Number(body.offensiveProjections[key])])
    ),
    defensiveProjections: Object.fromEntries(
      DEFENSIVE_PROJECTION_FIELDS.map(key => [key, Number(body.defensiveProjections[key])])
    ),
    usage: (() => {
      const offenseOptions = sanitizeSystemOptions(body.usage.offenseOptions);
      const defenseOptions = sanitizeSystemOptions(body.usage.defenseOptions);
      return {
        ...Object.fromEntries(USAGE_FIELDS.map(key => [key, body.usage[key]])),
        ...(offenseOptions.length ? { offenseOptions } : {}),
        ...(defenseOptions.length ? { defenseOptions } : {})
      };
    })(),
    performance: body.performance.map(player => ({
      player: player.player,
      offense: Number(player.offense),
      defense: Number(player.defense),
      load: Number(player.load),
      fit: Number(player.fit)
    })),
    netRatingOverTime: body.netRatingOverTime.map(point => ({
      minute: Number(point.minute),
      netRating: Number(point.netRating)
    })),
    playerNetRatingOverTime: sanitizePlayerSeries(body.playerNetRatingOverTime, body.players),
    playerShapes: sanitizePlayerShapes(body.playerShapes, body.players),
    profile: {
      player: body.profile.player,
      ...Object.fromEntries(
        Object.entries(PROFILE_FIELDS).map(([section, fields]) => [
          section,
          pickFields(body.profile[section], fields)
        ])
      )
    }
  };
}