const overviewGrid = document.getElementById("overviewGrid");
const lineupOverviewPlayers = document.getElementById("lineupOverviewPlayers");
const ratingGrid = document.getElementById("ratingGrid");
const offenseProjection = document.getElementById("offenseProjection");
const defenseProjection = document.getElementById("defenseProjection");
const usageProjection = document.getElementById("usageProjection");
const performanceTable = document.getElementById("performanceTable");
const lineupForm = document.getElementById("lineupForm");
const statusMessage = document.getElementById("statusMessage");
const positionlessToggle = document.getElementById("positionlessToggle");
const demoBanner = document.getElementById("demoBanner");
const profileSelect = document.getElementById("profileSelect");
const profileContent = document.getElementById("profileContent");
const resultRegions = [...document.querySelectorAll(
  ".lineup-overview-players, #overviewGrid, #ratingGrid, #offenseProjection, #defenseProjection, #usageProjection, .table-scroll, #netRatingChart, #profileContent"
)];
const profilePanel = document.getElementById("profilePanel");
const profileToggle = document.getElementById("mobileProfileToggle");
const profileClose = document.getElementById("profileClose");
const profileBackdrop = document.getElementById("profileBackdrop");
const netRatingChart = document.getElementById("netRatingChart");
const netRatingSvg = document.getElementById("netRatingSvg");
const netRatingTooltip = document.getElementById("netRatingTooltip");
const netRatingEmpty = document.getElementById("netRatingEmpty");
const netRatingAxisTrigger = document.getElementById("netRatingAxisTrigger");
const apiBaseUrl = document.querySelector('meta[name="lineup-api-base-url"]').content.trim().replace(/\/$/, "");
const spreadsheetProjectionUrl = document.querySelector('meta[name="spreadsheet-projection-url"]').content.trim();
const isDemoMode = new URLSearchParams(window.location.search).get("demo") === "1";
const themeToggle = document.getElementById("themeToggle");
const themeCustomizer = document.getElementById("themeCustomizer");
const themeCustomizeButton = document.getElementById("themeCustomizeButton");
const themeCustomizerClose = document.getElementById("themeCustomizerClose");
const primaryColorSwatches = document.getElementById("primaryColorSwatches");
const secondaryColorSwatches = document.getElementById("secondaryColorSwatches");
const themeColorsReset = document.getElementById("themeColorsReset");
let currentLineupNames = [];
let currentProfiles = new Map();
let lastSuccessfulLineupKey = null;
let nbaPlayerIds = {};
let nbaPlayerBirthdates = {};
let currentUsageOptions = { offense: [], defense: [] };
let selectedSystem = { offense: null, defense: null };
const playerPickers = new WeakMap();
let jsonpRequestId = 0;
let selectedNetPoint = null;
let currentNetRatingPoints = [];
let chartRevealObserver = null;
let chartRevealFrame = 0;
let chartRevealPlayedForLineup = false;
let chartRevealRects = [];
let lastLineupData = null;
let currentPlayerSeries = new Map();
let currentPlayerShapes = new Map();
let availablePlayers = [];
let positionlessMode = false;
try {
  positionlessMode = localStorage.getItem("lineup-positionless") === "true";
} catch {
  positionlessMode = false;
}
positionlessToggle.disabled = true;
positionlessToggle.setAttribute("aria-checked", String(positionlessMode));
const DEMO_OFFENSE_SHAPE = [
  "Shot Creating", "Playmaking", "Finishing", "Perimeter Shooting", "Free Throws",
  "Off-ball Scoring", "Ball Security", "Rebounding", "Gravity", "Pace Acceleration"
];
const DEMO_DEFENSE_SHAPE = [
  "Perimeter Defense", "Interior Defense", "Switchability", "Defensive Playmaking",
  "Possession Disruptance", "Stop Creation", "Rebounding", "Shot Suppression"
];
let spotlightOpen = false;
let spotlightBusy = false;
const themeColors = {
  primary: "#1d4ed8",
  secondary: "#0369a1"
};
const themeColorOptions = {
  primary: [
    ["Blue", "#1d4ed8"],
    ["Red", "#b91c1c"],
    ["Green", "#166534"],
    ["Purple", "#6b21a8"],
    ["Orange", "#9a3412"],
    ["Gold", "#854d0e"],
    ["Teal", "#115e59"],
    ["Pink", "#9d174d"]
  ],
  secondary: [
    ["Sky", "#0369a1"],
    ["Navy", "#1e3a8a"],
    ["Crimson", "#9f1239"],
    ["Cyan", "#0e7490"],
    ["Violet", "#7e22ce"],
    ["Olive", "#4d7c0f"],
    ["Amber", "#a16207"],
    ["Slate", "#475569"]
  ]
};
const defaultThemeColors = { ...themeColors };

function setColorTheme(theme, persist = false) {
  const isLightTheme = theme === "light";
  document.documentElement.dataset.theme = isLightTheme ? "light" : "dark";
  themeToggle.textContent = isLightTheme ? "Dark mode" : "Light mode";
  themeToggle.setAttribute("aria-label", `Switch to ${isLightTheme ? "dark" : "light"} theme`);
  themeToggle.setAttribute("aria-pressed", String(isLightTheme));
  document.querySelectorAll("[data-color-mode]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.colorMode === (isLightTheme ? "light" : "dark")));
  });
  if (persist) {
    try {
      localStorage.setItem("lineup-theme", isLightTheme ? "light" : "dark");
    } catch {
      return;
    }
  }
}

function saveThemeColors() {
  try {
    localStorage.setItem("lineup-theme-colors", JSON.stringify(themeColors));
  } catch {
    return;
  }
}

function renderThemeSwatches(role) {
  const container = role === "primary" ? primaryColorSwatches : secondaryColorSwatches;
  container.replaceChildren();
  themeColorOptions[role].forEach(([name, value]) => {
    const swatch = document.createElement("button");
    swatch.className = "theme-swatch";
    swatch.type = "button";
    swatch.title = name;
    swatch.setAttribute("aria-label", `${role} color: ${name}`);
    swatch.setAttribute("aria-pressed", String(themeColors[role] === value));
    swatch.style.setProperty("--swatch-color", value);
    swatch.addEventListener("click", () => {
      themeColors[role] = value;
      document.documentElement.style.setProperty(`--${role}-color`, value);
      saveThemeColors();
      renderThemeSwatches(role);
    });
    container.append(swatch);
  });
}

let savedTheme = "dark";
try {
  savedTheme = localStorage.getItem("lineup-theme") || "dark";
} catch {
  savedTheme = "dark";
}
try {
  const savedColors = JSON.parse(localStorage.getItem("lineup-theme-colors") || "{}");
  Object.keys(themeColors).forEach(role => {
    const isValidColor = themeColorOptions[role].some(([, value]) => value === savedColors[role]);
    if (isValidColor) themeColors[role] = savedColors[role];
  });
} catch {
  localStorage.removeItem("lineup-theme-colors");
}
document.documentElement.style.setProperty("--primary-color", themeColors.primary);
document.documentElement.style.setProperty("--secondary-color", themeColors.secondary);
renderThemeSwatches("primary");
renderThemeSwatches("secondary");
setColorTheme(savedTheme);
themeToggle.addEventListener("click", () => {
  setColorTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
});
document.querySelectorAll("[data-color-mode]").forEach(button => {
  button.addEventListener("click", () => setColorTheme(button.dataset.colorMode, true));
});
themeCustomizeButton.addEventListener("click", () => themeCustomizer.showModal());
themeCustomizerClose.addEventListener("click", () => themeCustomizer.close());
themeCustomizer.addEventListener("click", event => {
  if (event.target === themeCustomizer) themeCustomizer.close();
});
themeColorsReset.addEventListener("click", () => {
  Object.assign(themeColors, defaultThemeColors);
  document.documentElement.style.setProperty("--primary-color", themeColors.primary);
  document.documentElement.style.setProperty("--secondary-color", themeColors.secondary);
  saveThemeColors();
  renderThemeSwatches("primary");
  renderThemeSwatches("secondary");
});

const demoPlayers = [
  { player: "Demo Point Guard", position: "PG", slots: ["PG"] },
  { player: "Demo Combo Guard", position: "G", slots: ["PG", "SG"] },
  { player: "Demo Shooting Guard", position: "SG", slots: ["SG"] },
  { player: "Demo Small Forward", position: "SF", slots: ["SF"] },
  { player: "Demo Wing", position: "G-F", slots: ["SG", "SF"] },
  { player: "Demo Power Forward", position: "PF", slots: ["PF"] },
  { player: "Demo Forward", position: "F", slots: ["SF", "PF"] },
  { player: "Demo Center", position: "C", slots: ["C"] },
  { player: "Demo Stretch Big", position: "F-C", slots: ["PF", "C"] }
];

if (isDemoMode) {
  demoBanner.hidden = false;
}

function showStatus(message) {
  statusMessage.textContent = message;
}

function setResultsLoading(isLoading) {
  resultRegions.forEach(region => {
    region.classList.toggle("is-loading", isLoading);
    region.setAttribute("aria-busy", String(isLoading));
  });
  setPlayerPickerDisabled(profileSelect, isLoading || !currentLineupNames.length);
}

function setProfileDrawerOpen(open) {
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  const shouldOpen = isMobile && open;
  const wasOpen = document.body.classList.contains("profile-drawer-open");
  document.body.classList.toggle("profile-drawer-open", shouldOpen);
  profileToggle.setAttribute("aria-expanded", String(shouldOpen));
  profilePanel.setAttribute("aria-hidden", String(isMobile && !shouldOpen));
  profileBackdrop.hidden = !shouldOpen;
  if (shouldOpen) profileClose.focus();
  else if (isMobile && wasOpen) profileToggle.focus();
}

async function apiRequest(path, options = {}) {
  if (isDemoMode && path === "players") return demoPlayers;
  if (path === "players" && !apiBaseUrl) {
    const response = await fetch("./data/roster.json");
    if (!response.ok) throw new Error("The real player roster could not be loaded.");
    return response.json();
  }
  if (isDemoMode && path === "lineup") {
    const { players: names, profilePlayer = names?.[0] } = JSON.parse(options.body || "{}");
    if (!Array.isArray(names) || names.length !== 5 || new Set(names).size !== 5) {
      throw new Error("Choose five different demo players.");
    }
    const selected = names.map(name => demoPlayers.find(player => player.player === name));
    if (selected.some(player => !player)) throw new Error("Choose players from the demo roster.");
    const offensiveRoles = ["Primary Initiator", "Perimeter Specialist", "Off-Ball Wing", "Pick and Pop Big", "Interior Finisher"];
    const defensiveRoles = ["Point of Attack", "Chaser", "Wing Stopper", "Switch Big", "Post Defender"];
    const demoJobLabels = {
      offense: {
        engine: "Primary Engine", handler: "Secondary Handler", spacer: "Spot-Up Spacer",
        mover: "Movement Shooter", connector: "Connective Playmaker", roller: "Roll/Dive Finisher",
        cutter: "Cutter", hub: "Playmaking Hub", popper: "Pick-and-Pop Threat", post: "Post Hub"
      },
      defense: {
        poa: "Point-of-Attack Defender", wing: "Wing Stopper", switch: "Switch Defender",
        anchor: "Rim Anchor", mobileBig: "Mobile Big", helper: "Helpside Defender",
        pressure: "Ball Pressure", hide: "Low-Usage Hide"
      }
    };
    const demoSystemOptions = (side, templates) => templates.map(([system, jobs, score]) => ({
      system,
      score,
      usefulPlayers: jobs.filter(Boolean).length,
      assignments: names.map((name, index) => ({
        player: name,
        job: jobs[index],
        jobLabel: demoJobLabels[side][jobs[index]] || jobs[index],
        fit: Math.round((55 + index * 6) * 10) / 10
      }))
    }));
    const offenseOptions = demoSystemOptions("offense", [
      ["4-Out + Roamer", ["engine", "spacer", "connector", "popper", "roller"], 78.4],
      ["5-Out Drive-and-Kick", ["engine", "spacer", "spacer", "spacer", "popper"], 74.1],
      ["Spread Pick-and-Roll", ["engine", "spacer", "mover", "cutter", "roller"], 71.6]
    ]);
    const defenseOptions = demoSystemOptions("defense", [
      ["Switch 1-5", ["switch", "switch", "switch", "switch", "mobileBig"], 76.2],
      ["Drop and Contain", ["poa", "wing", "wing", "helper", "anchor"], 73.5],
      ["Hedge and Recover", ["pressure", "wing", "wing", "helper", "mobileBig"], 70.9]
    ]);
    const keys = names.map(name => name.toLowerCase().replace(/[^a-z0-9]+/g, ""));
    const profileIndex = names.indexOf(profilePlayer);
    if (profileIndex < 0) throw new Error("Choose a profile player from the selected lineup.");
    const offensiveLoads = Object.fromEntries(keys.map((key, index) => [key, {
      creation: 62 + index * 3,
      shots: 66 + index * 2,
      initiatorRank: index + 1,
      gravity: 64 + index * 3,
      rebounding: 48 + index * 4
    }]));
    const defensiveLoads = Object.fromEntries(keys.map((key, index) => [key, {
      perimeter: 52 + index * 4,
      interior: 48 + index * 3,
      help: 50 + index * 2,
      activity: ["Neutral", "High", "Neutral", "Low", "High"][index],
      rebounding: 54 + index * 3
    }]));
    const profilePlayerRow = selected[profileIndex];
    const roleIndex = names.indexOf(profilePlayer);
    const profile = {
      player: profilePlayer,
      bio: {
        position: ["PG", "SG", "SF", "PF", "C"][profileIndex],
        offensiveRole: offensiveRoles[roleIndex],
        defensiveRole: defensiveRoles[roleIndex],
        age: 27 + profileIndex,
        value: `$${18 + profileIndex * 4}.0M`
      },
      offensiveLoad: offensiveLoads[keys[profileIndex]],
      defensiveLoad: defensiveLoads[keys[profileIndex]],
      expectedShotProfile: {
        threePointShare: 0.34 + profileIndex * 0.02,
        midrangeShare: 0.2,
        rimShare: 0.32 - profileIndex * 0.02,
        freeThrowRate: 0.22 + profileIndex * 0.01
      },
      expectedShotEfficiency: {
        threePointPct: 0.36 + profileIndex * 0.01,
        midrangePct: 0.42,
        rimPct: 0.64 - profileIndex * 0.01,
        freeThrowPct: 0.78 + profileIndex * 0.01
      },
      expectedDefense: {
        idealMatchup: profileIndex === 0 ? "Lead Guard" : profileIndex === 4 ? "Lead Big" : "Lead Wing",
        deflectionsPer100: 2.8 + profileIndex * 0.2,
        pointsSavedPer100: 4.1 + profileIndex * 0.3,
        turnoversCreatedPer100: 1.5 + profileIndex * 0.1
      },
      expectedImpact: {
        pace: 32 + profileIndex,
        shotProfile: 35 + profileIndex * 2,
        shotEfficiency: 40 + profileIndex,
        opponentEfficiency: 22 + profileIndex,
        stopsCreation: 25 + profileIndex * 2,
        rebounding: 30 + profileIndex,
        netRating: 184 + profileIndex * 4
      }
    };

    const demoLineupNet = [
      0.8, 3.5, 7.8, 4.5, 5.1, 6.2, 9.3, 10.8, 7.6, 11.4,
      12.8, 10.6, 6.2, 5.1, 0.7, 0.5, 3.2, 1.8, 2.9, -1.4,
      -5.9, -10.2, -8.9, -12.2, -16.3
    ];

    return {
      players: selected.map((player, index) => ({
        player: player.player,
        position: ["PG", "SG", "SF", "PF", "C"][index],
        offensiveRole: offensiveRoles[index],
        defensiveRole: defensiveRoles[index]
      })),
      overview: { creationBalance: 78, synergy: 71, pace: 102, versatility: 82 },
      ratingProjections: { OFF: 117.8, DEF: 112.5, NET: 5.3 },
      offensiveProjections: {
        shotBalance: 82,
        offensiveRebounding: 76,
        offensiveRating: 117.8,
        threePointPercentage: 0.368,
        trueShootingPercentage: 0.581
      },
      defensiveProjections: {
        opponentTs: 0.554,
        defensiveRebounding: 75,
        defensiveRating: 112.5,
        turnoverCreation: 79,
        rimProtection: 84
      },
      usage: {
        offense: offenseOptions[0].system,
        initiator: names[offensiveRoles.indexOf("Primary Initiator")] || names[0],
        defense: defenseOptions[0].system,
        offRebounding: "Strong",
        defRebounding: "Strong",
        offenseOptions,
        defenseOptions
      },
      performance: selected.map((player, index) => ({
        player: player.player,
        offense: 68 + index * 4,
        defense: 72 + index * 3,
        load: 64 + index * 5,
        fit: 54 + index * 2
      })),
      netRatingOverTime: demoLineupNet.map((netRating, minute) => ({ minute, netRating })),
      playerNetRatingOverTime: selected.map((player, index) => ({
        player: player.player,
        series: demoLineupNet.map((net, minute) => {
          const weight = [0.28, 0.24, 0.2, 0.16, 0.12][index];
          const wobble = Math.sin((minute + index * 3) / 2.4) * (3 - index * 0.4);
          const share = net * weight + wobble * 0.5;
          return { minute, netRating: Math.round(share * 10) / 10 };
        })
      })),
      playerShapes: selected.map((player, index) => ({
        player: player.player,
        offense: DEMO_OFFENSE_SHAPE.map((name, attribute) => ({
          name,
          rating: 38 + ((index * 13 + attribute * 17) % 58)
        })),
        defense: DEMO_DEFENSE_SHAPE.map((name, attribute) => ({
          name,
          rating: 34 + ((index * 11 + attribute * 19) % 60)
        }))
      })),
      profile
    };
  }

  if (path === "lineup" && !apiBaseUrl && spreadsheetProjectionUrl) {
    const request = JSON.parse(options.body || "{}");
    return requestSpreadsheetProjection(request.players, request.profilePlayer);
  }
  if (path === "lineup" && !apiBaseUrl) {
    throw new Error("The spreadsheet projection URL has not been configured yet.");
  }

  const response = await fetch(`${apiBaseUrl}/${path}`, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "The request could not be completed");
  return body;
}

function requestSpreadsheetProjection(players, profilePlayer) {
  return new Promise((resolve, reject) => {
    const callbackName = `__lineupProjectionCallback_${Date.now()}_${++jsonpRequestId}`;
    const endpoint = new URL(spreadsheetProjectionUrl);
    endpoint.searchParams.set("callback", callbackName);
    endpoint.searchParams.set("request", JSON.stringify({ players, profilePlayer }));

    const script = document.createElement("script");
    script.async = true;
    script.src = endpoint.toString();
    let timeoutId;
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = result => {
      cleanup();
      if (!result || result.error) {
        reject(new Error(result?.error || "Spreadsheet projections are unavailable."));
        return;
      }
      resolve(result);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("Unable to reach the spreadsheet projection service."));
    };
    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("The spreadsheet projection request timed out."));
    }, 45000);
    document.head.append(script);
  });
}

function normalizePlayerName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizePlayerSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s'’‘ʼ`´]/gu, "");
}

function normalizePlayerIdLookup(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function formatLabel(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function formatMetric(value, key = "") {
  if (value === null || value === undefined || value === "") return "Not available";
  if (key === "ratingProjection" && typeof value === "number") return value.toFixed(1);
  const percentageFields = [
    "opponentTs",
    "threePointPercentage",
    "trueShootingPercentage",
    "threePointShare",
    "midrangeShare",
    "rimShare",
    "freeThrowRate",
    "threePointPct",
    "midrangePct",
    "rimPct",
    "freeThrowPct"
  ];
  if (typeof value === "number" && percentageFields.includes(key) && Math.abs(value) <= 1) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (typeof value === "number" && !Number.isInteger(value)) return value.toFixed(1);
  return String(value);
}

function animateMetricValue(element, value, key = "", onFrame = null, duration = 1000) {
  const renderValue = currentValue => {
    element.textContent = formatMetric(currentValue, key);
    if (onFrame) onFrame(currentValue);
  };
  if (typeof value !== "number" || !Number.isFinite(value) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    renderValue(value);
    return;
  }

  renderValue(0);
  const startTime = performance.now();
  const animate = timestamp => {
    const progress = Math.min(1, (timestamp - startTime) / duration);
    const easedProgress = progress * progress * (3 - 2 * progress);
    renderValue(value * easedProgress);
    if (progress < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

const OVERVIEW_SCALE = {
  creationBalance: { min: 0, max: 99, colorStops: [[0, "#d85c5c"], [50, "#d85c5c"], [55, "#df8750"], [60, "#d8c84d"], [78, "#8fba5b"], [99, "#32a77f"]] },
  synergy: { min: 0, max: 99, colorStops: [[0, "#d85c5c"], [50, "#d85c5c"], [55, "#df8750"], [60, "#d8c84d"], [78, "#8fba5b"], [99, "#32a77f"]] },
  versatility: { min: 0, max: 99, colorStops: [[0, "#d85c5c"], [50, "#d85c5c"], [55, "#df8750"], [60, "#d8c84d"], [78, "#8fba5b"], [99, "#32a77f"]] },
  pace: { min: 82, max: 109, colorStops: [[82, "#d85c5c"], [93, "#d85c5c"], [97, "#df8750"], [100, "#d8c84d"], [106, "#62b66b"], [109, "#32a77f"]] }
};
const PLAYER_RATING_STOPS = [
  [0, "#dc2626"],
  [30, "#dc2626"],
  [40, "#f97316"],
  [50, "#eab308"],
  [70, "#22c55e"],
  [99, "#22c55e"]
];

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map(offset => Number.parseInt(normalized.slice(offset, offset + 2), 16));
}

function interpolateColor(firstHex, secondHex, amount) {
  const first = hexToRgb(firstHex);
  const second = hexToRgb(secondHex);
  const channel = index => Math.round(first[index] + (second[index] - first[index]) * amount);
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

function overviewRatingStyle(key, value) {
  const scale = OVERVIEW_SCALE[key];
  if (!scale || !Number.isFinite(Number(value))) return null;
  const number = Math.max(scale.min, Math.min(scale.max, Number(value)));
  const fill = ((number - scale.min) / (scale.max - scale.min)) * 100;
  const stops = scale.colorStops;
  const gradient = stops.map(([stopValue, stopColor]) =>
    `${stopColor} ${((stopValue - scale.min) / (scale.max - scale.min)) * 100}%`
  ).join(", ");
  let color = stops[stops.length - 1][1];
  for (let index = 0; index < stops.length - 1; index += 1) {
    const [lowValue, lowColor] = stops[index];
    const [highValue, highColor] = stops[index + 1];
    if (number <= highValue) {
      color = interpolateColor(lowColor, highColor, (number - lowValue) / (highValue - lowValue));
      break;
    }
  }
  return { fill: `${fill}%`, color, gradient: `linear-gradient(90deg, ${gradient})` };
}

function playerRatingColor(value) {
  const number = Math.max(0, Math.min(99, Number(value)));
  for (let index = 0; index < PLAYER_RATING_STOPS.length - 1; index += 1) {
    const [lowValue, lowColor] = PLAYER_RATING_STOPS[index];
    const [highValue, highColor] = PLAYER_RATING_STOPS[index + 1];
    if (number <= highValue) {
      return interpolateColor(lowColor, highColor, (number - lowValue) / (highValue - lowValue));
    }
  }
  return PLAYER_RATING_STOPS[PLAYER_RATING_STOPS.length - 1][1];
}

function renderMetricGrid(container, values) {
  container.replaceChildren();
  Object.entries(values).forEach(([key, value]) => {
    const cell = document.createElement("div");
    cell.className = "metric-cell";
    const scaleStyle = overviewRatingStyle(key, value);
    if (scaleStyle) {
      cell.classList.add("metric-cell-rated");
      cell.style.setProperty("--rating-fill", scaleStyle.fill);
      cell.style.setProperty("--rating-color", scaleStyle.color);
      cell.style.setProperty("--rating-gradient", scaleStyle.gradient);
    }
    const label = document.createElement("span");
    label.textContent = formatLabel(key);
    const metric = document.createElement("strong");
    animateMetricValue(metric, value, key, currentValue => {
      if (!scaleStyle) return;
      const currentStyle = overviewRatingStyle(key, currentValue);
      metric.style.color = currentStyle.color;
      cell.style.setProperty("--rating-color", currentStyle.color);
    }, 1350);
    cell.append(label, metric);
    container.append(cell);
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.querySelectorAll(".metric-cell-rated").forEach(cell => {
        cell.classList.add("is-animated");
      });
    });
  });
}

function createPlayerPortrait(playerName, className) {
  const portrait = document.createElement("div");
  portrait.className = className;
  portrait.setAttribute("aria-hidden", "true");
  portrait.textContent = playerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

  const playerId = nbaPlayerIds[normalizePlayerIdLookup(playerName)];
  if (playerId) {
    const image = document.createElement("img");
    image.className = "player-headshot";
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("load", () => portrait.classList.add("is-loaded"), { once: true });
    image.addEventListener("error", () => {
      image.remove();
      portrait.classList.remove("is-loaded");
    }, { once: true });
    image.src = `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;
    portrait.append(image);
  }

  return portrait;
}

function renderLineupOverviewPlayers(players) {
  lineupOverviewPlayers.replaceChildren();
  players.forEach(player => {
    const item = document.createElement("article");
    item.className = "overview-player";
    const portrait = createPlayerPortrait(player.player, "portrait-placeholder");
    const name = document.createElement("span");
    name.className = "overview-player-name";
    name.textContent = player.player;
    item.append(portrait, name);
    lineupOverviewPlayers.append(item);
  });
}

function renderRatingProjections(ratings) {
  ratingGrid.replaceChildren();
  const off = Number(ratings.OFF);
  const def = Number(ratings.DEF);
  const entries = Object.entries(ratings).map(([label, value]) =>
    label === "NET" && Number.isFinite(off) && Number.isFinite(def)
      ? [label, Math.round((off - def) * 10) / 10]
      : [label, value]);
  entries.forEach(([label, value]) => {
    const card = document.createElement("article");
    card.className = "rating-card";
    const title = document.createElement("span");
    title.textContent = label;
    const rating = document.createElement("strong");
    animateMetricValue(rating, value, "ratingProjection");
    const source = document.createElement("small");
    source.textContent = "PTS / 100 POSS";
    card.append(title, rating, source);
    ratingGrid.append(card);
  });
}

const CHART_NS = "http://www.w3.org/2000/svg";
const CHART_HEIGHT = 450;
const CHART_TOP = 24;
const CHART_BOTTOM = 380;
let CHART_MINIMUM = -40;
let CHART_MAXIMUM = 40;

function setChartRange(limit) {
  CHART_MINIMUM = -limit;
  CHART_MAXIMUM = limit;
}

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(CHART_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

function chartGeometry() {
  const mobile = window.matchMedia("(max-width: 620px)").matches;
  const width = mobile ? 720 : 960;
  const left = mobile ? 82 : 76;
  const right = width - (mobile ? 20 : 22);
  return {
    mobile,
    width,
    left,
    right,
    top: CHART_TOP,
    bottom: CHART_BOTTOM,
    plotWidth: right - left,
    plotHeight: CHART_BOTTOM - CHART_TOP,
    zero: CHART_TOP + (CHART_MAXIMUM / (CHART_MAXIMUM - CHART_MINIMUM)) * (CHART_BOTTOM - CHART_TOP)
  };
}

function observeChartAxisReveal(geometry) {
  chartRevealRects = [...netRatingSvg.querySelectorAll(".chart-reveal-rect")];
  netRatingAxisTrigger.style.left = `${(geometry.left / geometry.width) * 100}%`;
  netRatingAxisTrigger.style.width = `${(geometry.plotWidth / geometry.width) * 100}%`;
  netRatingAxisTrigger.style.top = `${(geometry.bottom / CHART_HEIGHT) * 100}%`;
  netRatingAxisTrigger.style.height = `${((CHART_HEIGHT - geometry.bottom) / CHART_HEIGHT) * 100}%`;

  const reveal = width => chartRevealRects.forEach(rect => rect.setAttribute("width", String(width)));
  if (chartRevealPlayedForLineup || !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    chartRevealPlayedForLineup = true;
    reveal(geometry.plotWidth);
    return;
  }

  reveal(0);
  chartRevealObserver = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    chartRevealObserver.disconnect();
    chartRevealObserver = null;
    chartRevealPlayedForLineup = true;
    const startedAt = performance.now();
    const animateReveal = timestamp => {
      const progress = Math.max(0, Math.min(1, (timestamp - startedAt) / 1000));
      const easedProgress = 1 - (1 - progress) ** 3;
      reveal(geometry.plotWidth * easedProgress);
      if (progress < 1) {
        chartRevealFrame = requestAnimationFrame(animateReveal);
      } else {
        chartRevealFrame = 0;
      }
    };
    chartRevealFrame = requestAnimationFrame(animateReveal);
  }, { threshold: 0 });
  chartRevealObserver.observe(netRatingAxisTrigger);
}

function chartPoint(point, geometry) {
  return {
    minute: point.minute,
    value: point.netRating,
    x: geometry.left + (point.minute / 24) * geometry.plotWidth,
    y: geometry.top + ((CHART_MAXIMUM - Math.max(CHART_MINIMUM, Math.min(CHART_MAXIMUM, point.netRating))) / (CHART_MAXIMUM - CHART_MINIMUM)) * geometry.plotHeight
  };
}

function formatSignedRating(value) {
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) return `+${rounded.toFixed(1)}`;
  if (rounded < 0) return rounded.toFixed(1);
  return "0.0";
}

function addChartAxes(svg, geometry) {
  const grid = svgElement("g", { "aria-hidden": "true" });
  const fineScale = CHART_MAXIMUM <= 10;
  const step = fineScale ? 1 : 5;
  for (let rating = CHART_MINIMUM; rating <= CHART_MAXIMUM; rating += step) {
    const y = geometry.top + ((CHART_MAXIMUM - rating) / (CHART_MAXIMUM - CHART_MINIMUM)) * geometry.plotHeight;
    const major = rating % (fineScale ? 2 : 10) === 0;
    grid.append(svgElement("line", {
      x1: geometry.left,
      x2: geometry.right,
      y1: y,
      y2: y,
      class: rating === 0 ? "chart-axis" : "chart-grid",
      opacity: major || rating === 0 ? "1" : "0.48"
    }));
    if (major) {
      const tick = svgElement("text", {
        x: geometry.left - 11,
        y: y + 4,
        "text-anchor": "end",
        class: "chart-label"
      });
      tick.textContent = String(rating);
      grid.append(tick);
    }
  }

  for (let minute = 0; minute <= 24; minute += 1) {
    const x = geometry.left + (minute / 24) * geometry.plotWidth;
    const tick = svgElement("text", {
      x,
      y: geometry.bottom + 23,
      "text-anchor": "middle",
      class: "chart-label"
    });
    tick.textContent = String(minute);
    grid.append(tick);
  }

  const axisTitle = svgElement("text", {
    x: (geometry.left + geometry.right) / 2,
    y: CHART_HEIGHT - 8,
    "text-anchor": "middle",
    class: "chart-axis-title"
  });
  axisTitle.textContent = "Minute";
  grid.append(axisTitle);

  const ratingTitle = svgElement("text", {
    x: 20,
    y: (geometry.top + geometry.bottom) / 2,
    transform: `rotate(-90 20 ${(geometry.top + geometry.bottom) / 2})`,
    "text-anchor": "middle",
    class: "chart-axis-title"
  });
  ratingTitle.textContent = "Net Rating";
  grid.append(ratingTitle);
  svg.append(grid);
}

function smoothedCurvePath(points) {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const first = points[index];
    const second = points[index + 1];
    const next = points[Math.min(points.length - 1, index + 2)];
    const control1X = first.x + (second.x - previous.x) / 6;
    const control1Y = first.y + (second.y - previous.y) / 6;
    const control2X = second.x - (next.x - first.x) / 6;
    const control2Y = second.y - (next.y - first.y) / 6;
    path += ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${second.x} ${second.y}`;
  }
  return path;
}

function smoothedCurveSamples(points, samplesPerSegment = 16) {
  const sampled = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const first = points[index];
    const second = points[index + 1];
    const next = points[Math.min(points.length - 1, index + 2)];
    const c1 = {
      x: first.x + (second.x - previous.x) / 6,
      y: first.y + (second.y - previous.y) / 6,
      value: first.value + (second.value - previous.value) / 6,
      minute: first.minute + (second.minute - previous.minute) / 6
    };
    const c2 = {
      x: second.x - (next.x - first.x) / 6,
      y: second.y - (next.y - first.y) / 6,
      value: second.value - (next.value - first.value) / 6,
      minute: second.minute - (next.minute - first.minute) / 6
    };
    for (let step = 0; step < samplesPerSegment; step += 1) {
      const t = step / samplesPerSegment;
      const inverse = 1 - t;
      sampled.push({
        x: inverse ** 3 * first.x + 3 * inverse ** 2 * t * c1.x + 3 * inverse * t ** 2 * c2.x + t ** 3 * second.x,
        y: inverse ** 3 * first.y + 3 * inverse ** 2 * t * c1.y + 3 * inverse * t ** 2 * c2.y + t ** 3 * second.y,
        value: inverse ** 3 * first.value + 3 * inverse ** 2 * t * c1.value + 3 * inverse * t ** 2 * c2.value + t ** 3 * second.value,
        minute: inverse ** 3 * first.minute + 3 * inverse ** 2 * t * c1.minute + 3 * inverse * t ** 2 * c2.minute + t ** 3 * second.minute
      });
    }
  }
  sampled.push(points[points.length - 1]);
  return sampled;
}

function appendSignAreasAndLines(svg, points, geometry) {
  const definitions = svgElement("defs");
  const positiveClip = svgElement("clipPath", { id: "net-rating-positive-clip" });
  positiveClip.append(svgElement("rect", {
    x: geometry.left,
    y: geometry.top,
    width: 0,
    height: geometry.zero - geometry.top,
    class: "chart-reveal-rect"
  }));
  const negativeClip = svgElement("clipPath", { id: "net-rating-negative-clip" });
  negativeClip.append(svgElement("rect", {
    x: geometry.left,
    y: geometry.zero,
    width: 0,
    height: geometry.bottom - geometry.zero,
    class: "chart-reveal-rect"
  }));
  definitions.append(positiveClip, negativeClip);
  svg.append(definitions);

  points.slice(0, -1).forEach((first, index) => {
    const previous = points[Math.max(0, index - 1)];
    const second = points[index + 1];
    const next = points[Math.min(points.length - 1, index + 2)];
    const control1X = first.x + (second.x - previous.x) / 6;
    const control1Y = first.y + (second.y - previous.y) / 6;
    const control2X = second.x - (next.x - first.x) / 6;
    const control2Y = second.y - (next.y - first.y) / 6;
    const segment = [
      `M ${first.x} ${geometry.zero}`,
      `L ${first.x} ${first.y}`,
      `C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${second.x} ${second.y}`,
      `L ${second.x} ${geometry.zero} Z`
    ].join(" ");
    svg.append(svgElement("path", {
      d: segment,
      class: "chart-positive-area",
      "clip-path": "url(#net-rating-positive-clip)"
    }));
    svg.append(svgElement("path", {
      d: segment,
      class: "chart-negative-area",
      "clip-path": "url(#net-rating-negative-clip)"
    }));
  });

  const curve = smoothedCurvePath(points);
  svg.append(svgElement("path", {
    d: curve,
    class: "chart-positive-line",
    "clip-path": "url(#net-rating-positive-clip)"
  }));
  svg.append(svgElement("path", {
    d: curve,
    class: "chart-negative-line",
    "clip-path": "url(#net-rating-negative-clip)"
  }));
}

function showNetRatingTooltip(minute, value, clientX, clientY, pinned = false, pointIndex = null) {
  netRatingTooltip.replaceChildren();
  const timeRow = document.createElement("span");
  timeRow.className = "tooltip-time";
  const roundedMinute = Math.round(minute);
  const displayMinute = Math.abs(minute - roundedMinute) < 0.05
    ? String(roundedMinute)
    : minute.toFixed(1);
  timeRow.textContent = `Minute: ${displayMinute}`;
  const ratingRow = document.createElement("strong");
  ratingRow.className = "tooltip-rating";
  ratingRow.textContent = `Net Rating: ${formatSignedRating(value)}`;
  netRatingTooltip.append(timeRow, ratingRow);
  netRatingTooltip.hidden = false;
  netRatingTooltip.classList.toggle("is-pinned", pinned);
  netRatingTooltip.classList.toggle("is-positive", value >= 0);
  netRatingTooltip.classList.toggle("is-negative", value < 0);
  const bounds = netRatingChart.getBoundingClientRect();
  const left = Math.max(90, Math.min(bounds.width - 90, clientX - bounds.left));
  const top = Math.max(netRatingTooltip.offsetHeight + 12, clientY - bounds.top);
  netRatingTooltip.style.left = `${left}px`;
  netRatingTooltip.style.top = `${top}px`;
  selectedNetPoint = pinned ? pointIndex : null;
  netRatingSvg.querySelectorAll(".chart-point").forEach((point, index) => {
    point.classList.toggle("is-selected", pinned && index === pointIndex);
  });
}

function hideNetRatingTooltip() {
  if (selectedNetPoint !== null) return;
  netRatingTooltip.hidden = true;
  netRatingTooltip.classList.remove("is-pinned");
}

function pinNetRatingPoint(point, index, circle) {
  const rect = circle.getBoundingClientRect();
  showNetRatingTooltip(point.minute, point.value, rect.left + rect.width / 2, rect.top + rect.height / 2, true, index);
}

function nearestLineValue(svgPoint, points) {
  let nearest = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const first = points[index];
    const second = points[index + 1];
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared
      ? Math.max(0, Math.min(1, ((svgPoint.x - first.x) * dx + (svgPoint.y - first.y) * dy) / lengthSquared))
      : 0;
    const closestX = first.x + projection * dx;
    const closestY = first.y + projection * dy;
    const distance = Math.hypot(svgPoint.x - closestX, svgPoint.y - closestY);
    if (!nearest || distance < nearest.distance) {
      nearest = {
        distance,
        minute: first.minute + (second.minute - first.minute) * projection,
        value: first.value + (second.value - first.value) * projection
      };
    }
  }
  return nearest;
}

function renderNetRatingChart(series, resetForLineup = false) {
  if (chartRevealObserver) chartRevealObserver.disconnect();
  chartRevealObserver = null;
  if (chartRevealFrame) cancelAnimationFrame(chartRevealFrame);
  chartRevealFrame = 0;
  if (resetForLineup) chartRevealPlayedForLineup = false;
  netRatingSvg.replaceChildren();
  netRatingTooltip.hidden = true;
  netRatingTooltip.classList.remove("is-pinned");
  selectedNetPoint = null;
  const validSeries = Array.isArray(series) && series.length === 25 && series.every((point, index) =>
    point.minute === index && Number.isFinite(Number(point.netRating))
  );
  if (!validSeries) {
    netRatingChart.classList.remove("has-data");
    currentNetRatingPoints = [];
    return;
  }

  netRatingChart.classList.add("has-data");
  currentNetRatingPoints = series.map(point => ({ minute: point.minute, netRating: Number(point.netRating) }));
  const geometry = chartGeometry();
  netRatingSvg.setAttribute("viewBox", `0 0 ${geometry.width} ${CHART_HEIGHT}`);
  netRatingSvg.replaceChildren();
  addChartAxes(netRatingSvg, geometry);
  const points = currentNetRatingPoints.map(point => chartPoint(point, geometry));
  appendSignAreasAndLines(netRatingSvg, points, geometry);

  points.forEach((point, index) => {
    const circle = svgElement("circle", {
      cx: point.x,
      cy: point.y,
      r: 3.5,
      class: `chart-point ${point.value >= 0 ? "chart-positive-point" : "chart-negative-point"}`,
      tabindex: "0",
      role: "button",
      "data-point-index": index,
      "aria-label": `Minute ${point.minute}, net rating ${formatSignedRating(point.value)}`,
      "clip-path": `url(#net-rating-${point.value >= 0 ? "positive" : "negative"}-clip)`
    });
    circle.addEventListener("click", event => {
      event.stopPropagation();
      pinNetRatingPoint(point, index, circle);
    });
    circle.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        pinNetRatingPoint(point, index, circle);
      }
    });
    circle.addEventListener("focus", () => {
      if (selectedNetPoint === null) {
        const rect = circle.getBoundingClientRect();
        showNetRatingTooltip(point.minute, point.value, rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    });
    circle.addEventListener("blur", hideNetRatingTooltip);
    netRatingSvg.append(circle);
  });
  observeChartAxisReveal(geometry);
}

netRatingChart.addEventListener("pointermove", event => {
  if (selectedNetPoint !== null || currentNetRatingPoints.length !== 25) return;
  const matrix = netRatingSvg.getScreenCTM();
  if (!matrix) return;
  const cursor = netRatingSvg.createSVGPoint();
  cursor.x = event.clientX;
  cursor.y = event.clientY;
  const local = cursor.matrixTransform(matrix.inverse());
  const nearest = nearestLineValue(
    local,
    smoothedCurveSamples(currentNetRatingPoints.map(point => chartPoint(point, chartGeometry())))
  );
  const scale = netRatingSvg.getBoundingClientRect().width / chartGeometry().width;
  const threshold = (event.pointerType === "touch" ? 34 : 22) / Math.max(scale, 0.1);
  if (nearest && nearest.distance <= threshold) {
    showNetRatingTooltip(nearest.minute, nearest.value, event.clientX, event.clientY);
  } else if (event.pointerType !== "touch") {
    hideNetRatingTooltip();
  }
});

netRatingChart.addEventListener("pointerleave", hideNetRatingTooltip);
netRatingSvg.addEventListener("click", event => {
  if (!event.target.closest(".chart-point") && selectedNetPoint !== null) {
    selectedNetPoint = null;
    netRatingSvg.querySelectorAll(".chart-point.is-selected").forEach(point => point.classList.remove("is-selected"));
    netRatingTooltip.hidden = true;
    netRatingTooltip.classList.remove("is-pinned");
  }
});
window.addEventListener("resize", () => {
  if (currentNetRatingPoints.length) renderNetRatingChart(currentNetRatingPoints);
});

function renderKeyValues(container, values, labels = {}) {
  container.replaceChildren();
  Object.entries(values).forEach(([key, value]) => {
    const row = document.createElement("div");
    row.className = "metric-row";
    const label = document.createElement("span");
    label.textContent = labels[key] || formatLabel(key);
    const metric = document.createElement("strong");
    metric.textContent = formatMetric(value, key);
    row.append(label, metric);
    container.append(row);
  });
}

function renderUsageStaticRow(container, label, value) {
  const row = document.createElement("div");
  row.className = "metric-row";
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const metric = document.createElement("strong");
  metric.textContent = formatMetric(value, "");
  row.append(labelEl, metric);
  container.append(row);
}

function renderUsageSystemRow(container, side, label, width) {
  const options = currentUsageOptions[side] || [];
  const row = document.createElement("div");
  row.className = "metric-row metric-row-select";
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const wrap = document.createElement("div");
  wrap.className = "system-dropdown";
  if (width) wrap.style.width = width;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "usage-system-select";
  button.setAttribute("aria-label", `${label} system`);
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  const list = document.createElement("ul");
  list.className = "system-dropdown-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;

  const close = () => {
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", onOutside, true);
  };
  const onOutside = event => { if (!wrap.contains(event.target)) close(); };
  const choose = system => {
    selectedSystem[side] = system;
    button.textContent = system;
    list.querySelectorAll("li").forEach(item => {
      item.setAttribute("aria-selected", String(item.dataset.system === system));
    });
    close();
    refreshProfileForSelectedSystems();
  };

  options.forEach(option => {
    const pct = systemFitPercent(options, option);
    const item = document.createElement("li");
    item.setAttribute("role", "option");
    item.tabIndex = -1;
    item.dataset.system = option.system;
    item.setAttribute("aria-selected", String(option.system === selectedSystem[side]));
    const name = document.createElement("span");
    name.className = "system-option-name";
    name.textContent = option.system;
    const fit = document.createElement("span");
    fit.className = "system-option-fit";
    fit.style.setProperty("--fit-color", overviewRatingStyle("synergy", pct).color);
    const bar = document.createElement("span");
    bar.className = "system-option-bar";
    const text = document.createElement("span");
    text.textContent = `${pct}% best fit`;
    fit.append(bar, text);
    item.append(name, fit);
    item.addEventListener("click", () => choose(option.system));
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(option.system); }
      else if (event.key === "ArrowDown") { event.preventDefault(); (item.nextElementSibling || item).focus(); }
      else if (event.key === "ArrowUp") { event.preventDefault(); (item.previousElementSibling || item).focus(); }
      else if (event.key === "Escape") { close(); button.focus(); }
    });
    list.append(item);
  });

  if (options.length) {
    button.textContent = selectedSystem[side] || options[0].system;
    button.addEventListener("click", () => {
      if (!list.hidden) { close(); return; }
      list.hidden = false;
      button.setAttribute("aria-expanded", "true");
      document.addEventListener("mousedown", onOutside, true);
      (list.querySelector('[aria-selected="true"]') || list.firstElementChild)?.focus();
    });
    button.addEventListener("keydown", event => {
      if (event.key === "ArrowDown" && list.hidden) { event.preventDefault(); button.click(); }
    });
  } else {
    button.disabled = true;
    button.textContent = "Not available";
  }
  wrap.append(button, list);
  row.append(labelEl, wrap);
  container.append(row);
}

// The top system sits at 90-99%; other systems drop off by their raw score gap,
// so versatile lineups show tightly packed fits and narrow ones show steep drops.
function systemFitPercent(options, option) {
  const scores = options.map(item => Number(item.score) || 0);
  const top = Math.max(...scores);
  const topPct = Math.max(90, Math.min(99, 90 + (top - 60) * 0.25));
  const pct = topPct - (top - (Number(option.score) || 0)) * 2.2;
  return Math.max(1, Math.min(99, Math.round(pct)));
}

function renderUsagePanel(usage, preserveSelection = false) {
  usageProjection.replaceChildren();
  currentUsageOptions = {
    offense: Array.isArray(usage.offenseOptions) ? usage.offenseOptions.slice(0, 3) : [],
    defense: Array.isArray(usage.defenseOptions) ? usage.defenseOptions.slice(0, 3) : []
  };
  const previousSelection = preserveSelection ? selectedSystem : { offense: null, defense: null };
  selectedSystem = {
    offense: currentUsageOptions.offense.some(option => option.system === (previousSelection.offense || usage.offense))
      ? (previousSelection.offense || usage.offense)
      : currentUsageOptions.offense[0]?.system || null,
    defense: currentUsageOptions.defense.some(option => option.system === (previousSelection.defense || usage.defense))
      ? (previousSelection.defense || usage.defense)
      : currentUsageOptions.defense[0]?.system || null
  };

  const allSystemNames = [...currentUsageOptions.offense, ...currentUsageOptions.defense]
    .map(option => option.system || "");
  const widestNameLength = allSystemNames.reduce((max, name) => Math.max(max, name.length), 0);
  const selectWidth = widestNameLength ? `${widestNameLength + 3}ch` : null;

  if (currentUsageOptions.offense.length) {
    renderUsageSystemRow(usageProjection, "offense", "Offense", selectWidth);
  } else {
    renderUsageStaticRow(usageProjection, "Offense", usage.offense);
  }
  renderUsageStaticRow(usageProjection, "Initiator", usage.initiator);
  if (currentUsageOptions.defense.length) {
    renderUsageSystemRow(usageProjection, "defense", "Defense", selectWidth);
  } else {
    renderUsageStaticRow(usageProjection, "Defense", usage.defense);
  }
  renderUsageStaticRow(usageProjection, "Offensive Rebounding", usage.offRebounding);
  renderUsageStaticRow(usageProjection, "Defensive Rebounding", usage.defRebounding);
}

function findSystemAssignment(side, playerName) {
  const options = currentUsageOptions[side] || [];
  const system = selectedSystem[side];
  const option = options.find(candidate => candidate.system === system);
  if (!option || !Array.isArray(option.assignments)) return null;
  const normalizedTarget = normalizePlayerName(playerName);
  return option.assignments.find(assignment => normalizePlayerName(assignment.player) === normalizedTarget) || null;
}

function refreshProfileForSelectedSystems() {
  const activeName = profileSelect && profileSelect.value;
  if (!activeName) return;
  const profile = currentProfiles.get(normalizePlayerName(activeName));
  if (profile) renderProfile(profile);
}

function getPlayerBirthdate(playerName) {
  const iso = nbaPlayerBirthdates[normalizePlayerIdLookup(playerName)];
  if (!iso) return null;
  const parts = String(iso).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [year, month, day] = parts;
  return { year, month, day };
}

function getPlayerAgeInfo(playerName, fallbackAge) {
  const birthdate = getPlayerBirthdate(playerName);
  if (!birthdate) return { age: fallbackAge, isBirthday: false };
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const hasHadBirthdayThisYear = todayMonth > birthdate.month ||
    (todayMonth === birthdate.month && todayDay >= birthdate.day);
  const age = today.getFullYear() - birthdate.year - (hasHadBirthdayThisYear ? 0 : 1);
  const isBirthday = todayMonth === birthdate.month && todayDay === birthdate.day;
  return { age, isBirthday };
}

function renderProfile(profile) {
  profileContent.replaceChildren();
  if (!profile) {
    profileContent.append(createPlayerPortrait("", "profile-headshot-frame"));
    return;
  }

  profileContent.append(createPlayerPortrait(profile.player, "profile-headshot-frame"));

  const offenseAssignment = findSystemAssignment("offense", profile.player);
  const defenseAssignment = findSystemAssignment("defense", profile.player);
  const ageInfo = getPlayerAgeInfo(profile.player, profile.bio?.age);
  const bio = {
    ...profile.bio,
    offensiveRole: offenseAssignment ? offenseAssignment.jobLabel : profile.bio?.offensiveRole,
    defensiveRole: defenseAssignment ? defenseAssignment.jobLabel : profile.bio?.defensiveRole,
    age: ageInfo.age
  };

  const sections = [
    ["Bio", bio, {
      position: "Position",
      offensiveRole: "OFF Role",
      defensiveRole: "DEF Role",
      age: "Age",
      value: "Value"
    }],
    ["Offensive Load", profile.offensiveLoad, {
      creation: "Creation",
      shots: "Shots",
      initiatorRank: "Play Initiator Rank (#)",
      gravity: "Gravity",
      rebounding: "Rebounding"
    }],
    ["Defensive Load", profile.defensiveLoad, {
      perimeter: "Perimeter Defense",
      interior: "Interior Defense",
      help: "Help Defense",
      activity: "Activity",
      rebounding: "Rebounding"
    }],
    ["Expected Shot Profile", profile.expectedShotProfile, {
      threePointShare: "3PA%",
      midrangeShare: "Mid FGA%",
      rimShare: "Rim FGA%",
      freeThrowRate: "Free Throw Rate"
    }],
    ["Expected Shot Efficiency", profile.expectedShotEfficiency, {
      threePointPct: "3P%",
      midrangePct: "Mid FG%",
      rimPct: "Rim FG%",
      freeThrowPct: "FT%"
    }],
    ["Expected Defense", profile.expectedDefense, {
      idealMatchup: "Ideal Matchup",
      deflectionsPer100: "Deflections/100",
      pointsSavedPer100: "Points Saved/100",
      turnoversCreatedPer100: "Turnovers Created/100"
    }],
    ["Expected Impact to Lineup", profile.expectedImpact, {
      pace: "Pace",
      shotProfile: "Shot Profile",
      shotEfficiency: "Shot Efficiency",
      opponentEfficiency: "Opponent Efficiency Suppression",
      stopsCreation: "Stops Creation",
      rebounding: "Rebounding",
      netRating: "Net Rating"
    }]
  ];

  sections.forEach(([title, values, labels], index) => {
    const details = document.createElement("details");
    details.open = index === 0;
    const summary = document.createElement("summary");
    summary.textContent = title;
    const fields = document.createElement("dl");
    fields.className = "profile-fields";
    Object.entries(values || {}).forEach(([key, value]) => {
      const label = document.createElement("dt");
      label.textContent = labels[key] || formatLabel(key);
      const metric = document.createElement("dd");
      const isLoadShare = title.includes("Load") &&
        key !== "initiatorRank" &&
        key !== "activity";
      metric.textContent = isLoadShare && value !== null && value !== undefined && value !== ""
        ? `${formatMetric(value, key)}%`
        : formatMetric(value, key);
      if (title === "Bio" && key === "age" && ageInfo.isBirthday) {
        const badge = document.createElement("span");
        badge.className = "age-birthday-badge";
        badge.textContent = " (Happy Birthday! \u{1F973})";
        metric.append(badge);
      }
      fields.append(label, metric);
    });
    details.append(summary, fields);
    profileContent.append(details);
  });
}

function renderPerformance(data) {
  performanceTable.replaceChildren();
  data.performance.forEach(player => {
    const row = document.createElement("tr");
    const values = [
      player.player,
      player.offense,
      player.defense,
      player.load,
      player.fit
    ];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      if ((index === 1 || index === 2) && Number.isFinite(Number(value))) {
        cell.className = "performance-rating";
        cell.textContent = value;
        cell.style.color = playerRatingColor(value);
      } else {
        cell.textContent = value;
      }
      row.append(cell);
    });
    performanceTable.append(row);
  });
}

function createPlayerPicker(select) {
  const picker = document.createElement("div");
  picker.className = "player-picker";
  const input = document.createElement("input");
  input.type = "search";
  input.autocomplete = "off";
  input.placeholder = "Search players";
  input.required = true;
  input.setCustomValidity("Choose a player from the list.");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-label", select.name || "Player");
  const listbox = document.createElement("div");
  listbox.className = "player-picker-options";
  listbox.id = `player-picker-${++createPlayerPicker.id}-options`;
  listbox.setAttribute("role", "listbox");
  listbox.hidden = true;
  input.setAttribute("aria-controls", listbox.id);
  picker.append(input, listbox);
  select.after(picker);
  select.hidden = true;
  select.required = false;

  let players = [];
  let filteredPlayers = [];
  let activeIndex = -1;

  const close = () => {
    listbox.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  };

  const setActiveOption = index => {
    if (!filteredPlayers.length) return;
    activeIndex = (index + filteredPlayers.length) % filteredPlayers.length;
    const options = listbox.querySelectorAll("[role='option']");
    options.forEach((option, optionIndex) => {
      option.classList.toggle("is-active", optionIndex === activeIndex);
    });
    const activeOption = options[activeIndex];
    input.setAttribute("aria-activedescendant", activeOption.id);
    activeOption.scrollIntoView({ block: "nearest" });
  };

  const renderOptions = query => {
    const normalizedQuery = normalizePlayerSearch(query);
    filteredPlayers = players.filter(player =>
      normalizePlayerSearch(player.label).includes(normalizedQuery)
    );
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    listbox.replaceChildren();

    if (!filteredPlayers.length) {
      const empty = document.createElement("div");
      empty.className = "player-picker-empty";
      empty.textContent = "No players match";
      listbox.append(empty);
    } else {
      filteredPlayers.forEach((player, index) => {
        const option = document.createElement("div");
        option.className = "player-picker-option";
        option.id = `${listbox.id}-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(select.value === player.value));
        option.textContent = player.label;
        option.addEventListener("pointerdown", event => event.preventDefault());
        option.addEventListener("pointerenter", () => setActiveOption(index));
        option.addEventListener("click", () => choosePlayer(player));
        listbox.append(option);
      });
    }

    listbox.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };

  const choosePlayer = player => {
    select.value = player.value;
    input.value = player.label;
    input.setCustomValidity("");
    close();
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };

  input.addEventListener("focus", () => renderOptions(input.value));
  input.addEventListener("input", () => {
    select.value = "";
    input.setCustomValidity("Choose a player from the list.");
    renderOptions(input.value);
  });
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (listbox.hidden) renderOptions(input.value);
      const nextIndex = activeIndex < 0
        ? (event.key === "ArrowDown" ? 0 : filteredPlayers.length - 1)
        : activeIndex + (event.key === "ArrowDown" ? 1 : -1);
      setActiveOption(nextIndex);
    } else if (event.key === "Enter" && !listbox.hidden) {
      event.preventDefault();
      if (activeIndex >= 0) {
        choosePlayer(filteredPlayers[activeIndex]);
      } else if (filteredPlayers.length === 1) {
        choosePlayer(filteredPlayers[0]);
      }
    } else if (event.key === "Escape" && !listbox.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  document.addEventListener("pointerdown", event => {
    if (!picker.contains(event.target)) close();
  });

  const pickerApi = {
    setPlayers(nextPlayers) {
      players = nextPlayers.map(player => ({ player, label: player.player, value: player.player }));
    },
    syncSelection() {
      input.value = players.find(player => player.value === select.value)?.label || "";
      input.setCustomValidity(select.value ? "" : "Choose a player from the list.");
    },
    setDisabled(disabled) {
      input.disabled = disabled;
      if (disabled) close();
    }
  };

  players = [...select.options]
    .filter(option => option.value)
    .map(option => ({ label: option.text, value: option.value }));
  pickerApi.syncSelection();
  input.disabled = select.disabled;
  playerPickers.set(select, pickerApi);
  return pickerApi;
}
createPlayerPicker.id = 0;

function setPlayerPickerDisabled(select, disabled) {
  select.disabled = disabled;
  playerPickers.get(select)?.setDisabled(disabled);
}

function refreshLineupPlayerOptions(initializeDemo = false) {
  lineupForm.querySelectorAll("select").forEach(select => {
    const previousSelection = select.value;
    const players = positionlessMode
      ? availablePlayers
      : availablePlayers.filter(player => player.slots.includes(select.name));
    select.replaceChildren(new Option("Choose a player", ""));
    players.forEach(player => select.add(new Option(player.player, player.player)));
    if (players.some(player => player.player === previousSelection)) {
      select.value = previousSelection;
    } else if (initializeDemo && isDemoMode) {
      const exactPosition = players.find(player => player.position === select.name);
      if (exactPosition) select.value = exactPosition.player;
    }

    const picker = playerPickers.get(select) || createPlayerPicker(select);
    picker.setPlayers(players);
    picker.syncSelection();
  });
}

positionlessToggle.addEventListener("click", () => {
  positionlessMode = positionlessToggle.getAttribute("aria-checked") !== "true";
  positionlessToggle.setAttribute("aria-checked", String(positionlessMode));
  refreshLineupPlayerOptions();
  try {
    localStorage.setItem("lineup-positionless", String(positionlessMode));
  } catch {
    showStatus("Could not save Positionless preference in this browser.");
  }
});

function populateProfileSelector(players) {
  profileSelect.replaceChildren();
  profileSelect.add(new Option("Select Player", ""));
  players.forEach(player => profileSelect.add(new Option(player.player, player.player)));
  profileSelect.value = "";
  profileSelect.disabled = false;
  updateSpotlightButton();
}

function renderLineupSections(data, preserveSystems = false) {
  renderLineupOverviewPlayers(data.players);
  renderMetricGrid(overviewGrid, data.overview);
  renderRatingProjections(data.ratingProjections);
  renderKeyValues(offenseProjection, {
    shotBalance: data.offensiveProjections.shotBalance,
    offensiveRebounding: data.offensiveProjections.offensiveRebounding,
    threePointPercentage: data.offensiveProjections.threePointPercentage,
    trueShootingPercentage: data.offensiveProjections.trueShootingPercentage
  }, {
    shotBalance: "Shot Balance",
    offensiveRebounding: "Offensive Rebounding",
    threePointPercentage: "3P%",
    trueShootingPercentage: "TS%"
  });
  renderKeyValues(defenseProjection, {
    opponentTs: data.defensiveProjections.opponentTs,
    defensiveRebounding: data.defensiveProjections.defensiveRebounding,
    turnoverCreation: data.defensiveProjections.turnoverCreation,
    rimProtection: data.defensiveProjections.rimProtection
  }, {
    opponentTs: "Opponent TS%",
    defensiveRebounding: "Defensive Rebounding",
    turnoverCreation: "Turnover Creation",
    rimProtection: "Rim Protection"
  });
  renderUsagePanel(data.usage || {}, preserveSystems);
  renderPerformance(data);
  setChartRange(40);
  renderNetRatingChart(data.netRatingOverTime, true);
}

const IMPACT_PER_OVERRIDE_POINT = 0.08;
const SHAPE_IMPACT_WEIGHTS = {
  offense: { "Perimeter Shooting": 0.05, "Free Throws": 0.02, default: 0.03 },
  defense: { "Perimeter Defense": 0.045, "Interior Defense": 0.045, default: 0.035 }
};

function playerManualImpact(entry, deltaEntry, performance) {
  let off = 0;
  let def = 0;
  if (deltaEntry) {
    off += deltaEntry.off * IMPACT_PER_OVERRIDE_POINT;
    def += deltaEntry.def * IMPACT_PER_OVERRIDE_POINT;
  }
  if (entry) {
    ["offense", "defense"].forEach(side => {
      const weights = SHAPE_IMPACT_WEIGHTS[side];
      const performanceKey = side === "offense" ? "offense" : "defense";
      const performanceRating = Number(performance && performance[performanceKey]);
      const blocksPositiveImpact = Number.isFinite(performanceRating) && performanceRating >= 90;
      (entry[side] || []).forEach(attribute => {
        if (!Number.isFinite(attribute.rating)) return;
        const change = adjustShapeRating(entry.player, side, attribute) - attribute.rating;
        if (blocksPositiveImpact && change > 0) return;
        const amount = change * (weights[attribute.name] ?? weights.default);
        if (side === "offense") off += amount; else def += amount;
      });
    });
  }
  return { off, def };
}

function applyManualImpact(data) {
  if (!data || data.manualImpactApplied) return data;
  const shapes = new Map((data.playerShapes || []).map(entry => [normalizePlayerName(entry.player), entry]));
  const deltas = new Map((data.overrideDeltas || []).map(entry => [normalizePlayerName(entry.player), entry]));
  const performance = new Map((data.performance || []).map(entry => [normalizePlayerName(entry.player), entry]));
  const impacts = new Map();
  let off = 0;
  let def = 0;
  (data.players || []).forEach(player => {
    const key = normalizePlayerName(player.player);
    const impact = playerManualImpact(shapes.get(key), deltas.get(key), performance.get(key));
    impacts.set(key, impact.off + impact.def);
    off += impact.off;
    def += impact.def;
  });
  data.manualImpactApplied = true;
  if (!off && !def) return data;
  const ratings = data.ratingProjections;
  if (ratings && Number.isFinite(ratings.OFF) && Number.isFinite(ratings.DEF)) {
    ratings.OFF += off;
    ratings.DEF -= def;
    ratings.NET = ratings.OFF - ratings.DEF;
  }
  const lineupShift = off + def;
  data.netRatingOverTime = (data.netRatingOverTime || []).map(point => ({
    ...point,
    netRating: point.netRating + lineupShift
  }));
  data.playerNetRatingOverTime = (data.playerNetRatingOverTime || []).map(entry => {
    const shift = impacts.get(normalizePlayerName(entry.player)) || 0;
    return { ...entry, series: entry.series.map(point => ({ ...point, netRating: point.netRating + shift })) };
  });
  return data;
}

function renderResults(data, selectedNames) {
  applyManualImpact(data);
  lastLineupData = data;
  currentPlayerShapes = new Map((data.playerShapes || []).map(entry => [
    normalizePlayerName(entry.player),
    entry
  ]));
  currentPlayerSeries = new Map((data.playerNetRatingOverTime || []).map(entry => [
    normalizePlayerName(entry.player),
    entry.series
  ]));
  renderLineupSections(data);
  currentLineupNames = selectedNames;
  currentProfiles = new Map((data.profiles || []).map(profile => [
    normalizePlayerName(profile.player),
    profile
  ]));
  if (data.profile) {
    currentProfiles.set(normalizePlayerName(data.profile.player), data.profile);
  }
  populateProfileSelector(data.players);
  renderProfile(null);
  profileToggle.textContent = "Player Profiles";
}

async function initialize() {
  try {
    const [players, playerIdsResponse, birthdatesResponse] = await Promise.all([
      apiRequest("players"),
      fetch("./data/nba-player-ids.json").catch(() => null),
      fetch("./data/nba-player-birthdates.json").catch(() => null)
    ]);
    if (playerIdsResponse?.ok) {
      nbaPlayerIds = await playerIdsResponse.json().catch(() => ({}));
    }
    if (birthdatesResponse?.ok) {
      nbaPlayerBirthdates = await birthdatesResponse.json().catch(() => ({}));
    }
    availablePlayers = players;
    refreshLineupPlayerOptions(true);
    positionlessToggle.disabled = false;
    const submitButton = lineupForm.querySelector("button[type='submit']");
    const rosterOnlyMode = !apiBaseUrl && !spreadsheetProjectionUrl && !isDemoMode;
    submitButton.disabled = rosterOnlyMode;
    showStatus(isDemoMode
      ? "Fictional sample roster loaded."
      : rosterOnlyMode
        ? `${players.length} real players loaded. Configure the spreadsheet projection URL to submit lineups.`
        : spreadsheetProjectionUrl && !apiBaseUrl
          ? `${players.length} real players loaded. Spreadsheet projection URL configured.`
          : `${players.length} players available`);
  } catch (error) {
    showStatus(error.message);
  }
}

async function updateSelectedProfile(profilePlayer) {
  if (!currentLineupNames.length) return;
  const cachedProfile = currentProfiles.get(normalizePlayerName(profilePlayer));
  if (cachedProfile) {
    renderProfile(cachedProfile);
    showStatus(`${profilePlayer} profile loaded.`);
    return;
  }

  setPlayerPickerDisabled(profileSelect, true);
  profileContent.classList.add("is-loading");
  profileContent.setAttribute("aria-busy", "true");
  showStatus("Loading player profile...");
  try {
    const data = await apiRequest("lineup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: currentLineupNames, profilePlayer })
    });
    currentProfiles.set(normalizePlayerName(profilePlayer), data.profile);
    renderProfile(data.profile);
    showStatus(`${profilePlayer} profile loaded.`);
  } catch (error) {
    showStatus(error.message);
  } finally {
    profileContent.classList.remove("is-loading");
    profileContent.setAttribute("aria-busy", "false");
    setPlayerPickerDisabled(profileSelect, false);
  }
}

const lineupView = document.getElementById("lineupView");
const spotlightView = document.getElementById("spotlightView");
const spotlightHeading = document.getElementById("spotlightHeading");
const spotlightClose = document.getElementById("spotlightClose");
const spotlightOpenButton = document.getElementById("spotlightOpen");
const spotlightChartSection = document.getElementById("spotlightChartSection");
const lineupChartSection = lineupView.querySelector(".net-rating-section");
const mainColumn = document.querySelector(".main-column");
const SPOTLIGHT_SLIDE_MS = 300;
const SPOTLIGHT_GLOW_MS = 280;
const SPOTLIGHT_SLIDE_DISTANCE = "calc(100% + 28px)";

function spotlightSeriesFor(playerName) {
  return currentPlayerSeries.get(normalizePlayerName(playerName)) || null;
}

function updateSpotlightButton() {
  const hasPlayer = Boolean(profileSelect.value) && currentLineupNames.length > 0;
  const hasData = hasPlayer && Boolean(spotlightSeriesFor(profileSelect.value));
  spotlightOpenButton.disabled = spotlightOpen || spotlightBusy || !hasData;
  spotlightOpenButton.classList.toggle("is-open", spotlightOpen);
  spotlightOpenButton.textContent = spotlightOpen ? "Spotlight Open" : "Open Player Spotlight";
  spotlightOpenButton.title = hasPlayer && !hasData
    ? "Spotlight data is not available for this lineup."
    : "";
  spotlightClose.disabled = spotlightBusy;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(milliseconds) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

async function slidePane(pane, from, to) {
  if (prefersReducedMotion() || !pane.animate) return null;
  const animation = pane.animate(
    [{ transform: from }, { transform: to }],
    { duration: SPOTLIGHT_SLIDE_MS, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" }
  );
  await animation.finished.catch(() => {});
  return animation;
}

async function swapPanes(outgoing, incoming, prepareIncoming) {
  spotlightBusy = true;
  updateSpotlightButton();
  mainColumn.classList.add("is-transitioning");
  try {
    if (!prefersReducedMotion() && !window.matchMedia("(max-width: 900px)").matches) {
      profilePanel.classList.add("is-glowing");
      await wait(SPOTLIGHT_GLOW_MS);
    }
    const outgoingAnimation = await slidePane(outgoing, "translateX(0)", `translateX(${SPOTLIGHT_SLIDE_DISTANCE})`);
    outgoing.hidden = true;
    outgoingAnimation?.cancel();
    prepareIncoming();
    incoming.hidden = false;
    const incomingAnimation = await slidePane(incoming, `translateX(${SPOTLIGHT_SLIDE_DISTANCE})`, "translateX(0)");
    incomingAnimation?.cancel();
  } finally {
    profilePanel.classList.remove("is-glowing");
    await wait(SPOTLIGHT_GLOW_MS);
    mainColumn.classList.remove("is-transitioning");
    spotlightBusy = false;
    updateSpotlightButton();
  }
}

function revealWhenVisible(element, callback) {
  if (!("IntersectionObserver" in window)) {
    callback();
    return () => {};
  }
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    callback();
  });
  observer.observe(element);
  return () => observer.disconnect();
}

const SHAPE_COLORS = [
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#38bdf8",
  "#6366f1", "#a855f7", "#ec4899", "#ef4444", "#84cc16"
];
const SHAPE_COLORS_LIGHT = [
  "#d9561f", "#2e9d4f", "#8e44ad", "#c99a00", "#2a86c8",
  "#c62828", "#0f8f8f", "#d6336c", "#8d5a3b", "#4b4fc4"
];
const shapeColorsForTheme = () =>
  document.documentElement.dataset.theme === "light" ? SHAPE_COLORS_LIGHT : SHAPE_COLORS;
new MutationObserver(() => {
  if (spotlightOpen && profileSelect.value) renderShapes(profileSelect.value, true);
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
const spotlightShapes = document.getElementById("spotlightShapes");
const shapePause = document.getElementById("shapePause");
shapePause.addEventListener("click", () => {
  const paused = shapePause.getAttribute("aria-pressed") !== "true";
  shapePause.setAttribute("aria-pressed", String(paused));
  const label = paused ? "Resume graphs" : "Pause graphs";
  shapePause.setAttribute("aria-label", label);
  shapePause.title = label;
  shapeColumns.forEach(column => column.radar.setPaused(paused));
});
const shapeColumns = [...spotlightShapes.querySelectorAll(".shape-column")].map(column => {
  const canvas = column.querySelector("canvas");
  return {
    side: column.dataset.side,
    canvas,
    list: column.querySelector("ul"),
    radar: window.createShapeRadar(canvas),
    cancelReveal: null
  };
});

function renderShapeAttributes(column, attributes, swap = false) {
  // Swaps wait only for the old shape to collapse; first loads also wait for the axes to open.
  const delay = swap ? 250 : 300;
  column.cancelReveal?.();
  column.list.replaceChildren();
  const rows = attributes.map(attribute => {
    const hasRating = Number.isFinite(attribute.rating);
    const item = document.createElement("li");
    item.className = "shape-attribute";
    item.style.setProperty("--attr-color", attribute.color);
    item.style.setProperty("--attr-delay", `${delay}ms`);
    item.style.setProperty("--attr-fill", `${hasRating ? Math.max(0, Math.min(99, attribute.rating)) / 99 * 100 : 0}%`);
    const name = document.createElement("span");
    name.className = "shape-attr-name";
    name.textContent = attribute.name;
    const value = document.createElement("strong");
    value.className = "shape-attr-value";
    value.textContent = hasRating ? "0" : "N/A";
    const bar = document.createElement("div");
    bar.className = "shape-attr-bar";
    item.append(name, value, bar);
    column.list.append(item);
    return { item, value, rating: attribute.rating, hasRating };
  });
  column.cancelReveal = revealWhenVisible(column.list, () => {
    rows.forEach(({ item, value, rating, hasRating }) => {
      if (!hasRating) return;
      setTimeout(() => animateMetricValue(value, rating, "", null, 500), delay);
      item.classList.add("is-animated");
    });
  });
}

const SHAPE_ADJUSTMENTS = {
  jarredvanderbilt: { defense: { all: 17 }, offense: { set: { Rebounding: 83 } } },
  jadenhardy: { defense: { all: -10 } },
  collinsexton: { defense: { all: 5 } },
  quentingrimes: {
    defense: { set: { "Perimeter Defense": 77 } },
    offense: { add: { "Perimeter Shooting": 30, "Free Throws": 30 } }
  },
  stephencurry: { offense: { all: 20, exclude: ["Rebounding"], max: 99 } },
  lukadoncic: { offense: { add: { "Free Throws": 40, "Perimeter Shooting": 15 } } },
  jakelaravia: { offense: { add: { "Perimeter Shooting": 30 } } },
  walkerkessler: {
    offense: { add: { "Perimeter Shooting": -20, "Free Throws": -20, Rebounding: 10 } },
    defense: {
      add: {
        "Interior Defense": 20,
        "Perimeter Defense": -10,
        Switchability: -10,
        "Defensive Playmaking": 20,
        "Stop Creation": 10,
        Rebounding: 10
      }
    }
  },
  kevonlooney: { offense: { all: -30 } },
  sandromamukelashvili: {
    defense: { add: { "Perimeter Defense": -15, "Interior Defense": -15, "Possession Disruptance": -15, "Switchability": -15, "Stop Creation": -15, "Shot Suppression": -20 } },
    offense: { add: { "Free Throws": 25 } }
  },
  austinreaves: {
    defense: { add: { "Possession Disruptance": -20, "Stop Creation": -20, "Shot Suppression": -20 } },
    offense: { all: 7, add: { Finishing: 8, "Perimeter Shooting": 8, "Off-ball Scoring": 15, Gravity: 10 } }
  }
};

function adjustShapeRating(playerName, side, attribute) {
  const rule = SHAPE_ADJUSTMENTS[normalizePlayerIdLookup(playerName)]?.[side];
  if (!rule) return attribute.rating;
  if (rule.set && rule.set[attribute.name] !== undefined) return rule.set[attribute.name];
  if (rule.exclude?.includes(attribute.name)) return attribute.rating;
  const delta = (rule.all || 0) + ((rule.add && rule.add[attribute.name]) || 0);
  return Math.max(1, Math.min(rule.max || 99, attribute.rating + delta));
}
function renderShapes(playerName, swap = false) {
  const shape = currentPlayerShapes.get(normalizePlayerName(playerName));
  spotlightShapes.hidden = !shape;
  if (!shape) return;
  const palette = shapeColorsForTheme();
  shapeColumns.forEach(column => {
    const attributes = shape[column.side].map((attribute, index) => ({
      name: attribute.name,
      rating: adjustShapeRating(playerName, column.side, attribute),
      color: palette[index % palette.length]
    }));
    column.canvas.setAttribute(
      "aria-label",
      `${playerName} ${column.side} shape radar. Drag or use arrow keys to rotate.`
    );
    column.radar.setData(attributes, { swap });
    renderShapeAttributes(column, attributes, swap);
  });
}

function renderSpotlightPlayer(playerName, swap = false) {
  const series = spotlightSeriesFor(playerName);
  if (!series) return;
  spotlightHeading.textContent = `Player Spotlight: ${playerName}`;
  renderShapes(playerName, swap);
  netRatingChart.setAttribute("aria-label", `${playerName} net rating contribution from minute 0 through minute 24`);
  setChartRange(10);
  renderNetRatingChart(series, true);
}

async function openSpotlight() {
  if (spotlightOpen || spotlightBusy || !spotlightSeriesFor(profileSelect.value)) return;
  const playerName = profileSelect.value;
  setProfileDrawerOpen(false);
  await swapPanes(lineupView, spotlightView, () => {
    spotlightChartSection.append(netRatingChart);
    spotlightOpen = true;
    window.scrollTo(0, 0);
    renderSpotlightPlayer(playerName);
  });
}

async function closeSpotlight() {
  if (!spotlightOpen || spotlightBusy) return;
  await swapPanes(spotlightView, lineupView, () => {
    lineupChartSection.append(netRatingChart);
    netRatingChart.setAttribute("aria-label", "Net rating from minute 0 through minute 24");
    spotlightOpen = false;
    window.scrollTo(0, 0);
    if (lastLineupData) renderLineupSections(lastLineupData, true);
  });
}

spotlightOpenButton.addEventListener("click", openSpotlight);
spotlightClose.addEventListener("click", closeSpotlight);

profileSelect.addEventListener("change", () => {
  updateSpotlightButton();
  if (spotlightOpen && profileSelect.value) renderSpotlightPlayer(profileSelect.value, true);
  if (!profileSelect.value) {
    renderProfile(null);
    return;
  }
  updateSelectedProfile(profileSelect.value);
});
profileToggle.addEventListener("click", () => {
  setProfileDrawerOpen(profileToggle.getAttribute("aria-expanded") !== "true");
});
profileClose.addEventListener("click", () => setProfileDrawerOpen(false));
profileBackdrop.addEventListener("click", () => setProfileDrawerOpen(false));
window.addEventListener("keydown", event => {
  if (event.key === "Escape") setProfileDrawerOpen(false);
});
window.addEventListener("resize", () => {
  if (!window.matchMedia("(max-width: 900px)").matches) setProfileDrawerOpen(false);
});
setProfileDrawerOpen(false);

lineupForm.addEventListener("submit", async event => {
  event.preventDefault();
  const selectedPlayers = [...lineupForm.querySelectorAll("select")].map(select => select.value);
  if (selectedPlayers.some(player => !player) || new Set(selectedPlayers).size !== 5) {
    showStatus("Choose five different players, one for each position.");
    return;
  }

  const selectedProfile = selectedPlayers.includes(profileSelect.value)
    ? profileSelect.value
    : selectedPlayers[0];
  const lineupKey = JSON.stringify(selectedPlayers);
  if (lineupKey === lastSuccessfulLineupKey) {
    const cachedProfile = profileSelect.value
      ? currentProfiles.get(normalizePlayerName(profileSelect.value))
      : null;
    renderProfile(cachedProfile || null);
    showStatus("Lineup analysis complete.");
    return;
  }

  const button = lineupForm.querySelector("button[type='submit']");
  button.disabled = true;
  setResultsLoading(true);
  showStatus("Calculating lineup...");
  try {
    const results = await apiRequest("lineup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: selectedPlayers, profilePlayer: selectedProfile })
    });
    renderResults(results, selectedPlayers);
    lastSuccessfulLineupKey = lineupKey;
    showStatus("Lineup analysis complete.");
  } catch (error) {
    showStatus(error.message);
  } finally {
    setResultsLoading(false);
    button.disabled = false;
  }
});

initialize();
