const overviewGrid = document.getElementById("overviewGrid");
const lineupOverviewPlayers = document.getElementById("lineupOverviewPlayers");
const ratingGrid = document.getElementById("ratingGrid");
const offenseProjection = document.getElementById("offenseProjection");
const defenseProjection = document.getElementById("defenseProjection");
const usageProjection = document.getElementById("usageProjection");
const performanceTable = document.getElementById("performanceTable");
const lineupForm = document.getElementById("lineupForm");
const statusMessage = document.getElementById("statusMessage");
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
let currentLineupNames = [];
let currentProfiles = new Map();
let lastSuccessfulLineupKey = null;
let nbaPlayerIds = {};
const playerPickers = new WeakMap();
let jsonpRequestId = 0;
let selectedNetPoint = null;
let currentNetRatingPoints = [];
let chartRevealObserver = null;
let chartRevealFrame = 0;
let chartRevealPlayedForLineup = false;
let chartRevealRects = [];
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
        offense: "4-Out + Roamer",
        initiator: names[offensiveRoles.indexOf("Primary Initiator")] || names[0],
        defense: "Switching",
        offRebounding: "Strong",
        defRebounding: "Strong"
      },
      performance: selected.map((player, index) => ({
        player: player.player,
        offense: 68 + index * 4,
        defense: 72 + index * 3,
        load: 64 + index * 5,
        fit: 54 + index * 2
      })),
      netRatingOverTime: [
        0.8, 3.5, 7.8, 4.5, 5.1, 6.2, 9.3, 10.8, 7.6, 11.4,
        12.8, 10.6, 6.2, 5.1, 0.7, 0.5, 3.2, 1.8, 2.9, -1.4,
        -5.9, -10.2, -8.9, -12.2, -16.3
      ].map((netRating, minute) => ({ minute, netRating })),
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
  Object.entries(ratings).forEach(([label, value]) => {
    const card = document.createElement("article");
    card.className = "rating-card";
    const title = document.createElement("span");
    title.textContent = label;
    const rating = document.createElement("strong");
    animateMetricValue(rating, value);
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
const CHART_MINIMUM = -40;
const CHART_MAXIMUM = 40;

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
      const progress = Math.min(1, (timestamp - startedAt) / 1000);
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
    y: geometry.top + ((CHART_MAXIMUM - point.netRating) / (CHART_MAXIMUM - CHART_MINIMUM)) * geometry.plotHeight
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
  for (let rating = CHART_MINIMUM; rating <= CHART_MAXIMUM; rating += 5) {
    const y = geometry.top + ((CHART_MAXIMUM - rating) / 80) * geometry.plotHeight;
    const major = rating % 10 === 0;
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

function renderProfile(profile) {
  profileContent.replaceChildren();
  if (!profile) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "Profile data is unavailable.";
    profileContent.append(message);
    return;
  }

  profileContent.append(createPlayerPortrait(profile.player, "profile-headshot-frame"));

  const sections = [
    ["Bio", profile.bio, {
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

function populateProfileSelector(players, selectedName) {
  profileSelect.replaceChildren();
  players.forEach(player => profileSelect.add(new Option(player.player, player.player)));
  profileSelect.value = selectedName;
  if (playerPickers.has(profileSelect)) {
    const picker = playerPickers.get(profileSelect);
    picker.setPlayers(players);
    picker.syncSelection();
  } else {
    createPlayerPicker(profileSelect);
    const picker = playerPickers.get(profileSelect);
    picker.setPlayers(players);
    picker.syncSelection();
  }
  setPlayerPickerDisabled(profileSelect, false);
}

function renderResults(data, selectedNames, selectedProfile) {
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
  renderKeyValues(usageProjection, data.usage, {
    offense: "Offense",
    initiator: "Initiator",
    defense: "Defense",
    offRebounding: "Offensive Rebounding",
    defRebounding: "Defensive Rebounding"
  });
  renderPerformance(data);
  renderNetRatingChart(data.netRatingOverTime, true);
  currentLineupNames = selectedNames;
  currentProfiles = new Map((data.profiles || []).map(profile => [
    normalizePlayerName(profile.player),
    profile
  ]));
  if (data.profile) {
    currentProfiles.set(normalizePlayerName(data.profile.player), data.profile);
  }
  populateProfileSelector(data.players, selectedProfile);
  renderProfile(currentProfiles.get(normalizePlayerName(selectedProfile)) || data.profile);
  profileToggle.textContent = "Player Profile";
}

async function initialize() {
  try {
    const [players, playerIdsResponse] = await Promise.all([
      apiRequest("players"),
      fetch("./data/nba-player-ids.json").catch(() => null)
    ]);
    if (playerIdsResponse?.ok) {
      nbaPlayerIds = await playerIdsResponse.json().catch(() => ({}));
    }
    lineupForm.querySelectorAll("select").forEach(select => {
      select.replaceChildren(new Option("Choose a player", ""));
      const eligiblePlayers = players.filter(player => player.slots.includes(select.name));
      eligiblePlayers.forEach(player => select.add(new Option(player.player, player.player)));
      if (isDemoMode) {
        const exactPosition = eligiblePlayers.find(player => player.position === select.name);
        if (exactPosition) select.value = exactPosition.player;
      }
      createPlayerPicker(select);
    });
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

profileSelect.addEventListener("change", () => updateSelectedProfile(profileSelect.value));
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
    const cachedProfile = currentProfiles.get(normalizePlayerName(selectedProfile));
    if (cachedProfile) renderProfile(cachedProfile);
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
    renderResults(results, selectedPlayers, selectedProfile);
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
