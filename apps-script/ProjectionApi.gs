/**
 * Private server-to-server projection endpoint for the web app.
 *
 * Store PROJECTION_API_KEY in Script Properties and configure the same value
 * only in the Azure Function App settings. This endpoint never writes cells.
 */
function doPost(e) {
  let request;

  try {
    request = JSON.parse(e && e.postData && e.postData.contents || "{}");
  } catch (error) {
    return projectionApiResponse_({ error: "Request body must be JSON." });
  }

  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return projectionApiResponse_({ error: "Request body must be a JSON object." });
  }

  const expectedKey = PropertiesService
    .getScriptProperties()
    .getProperty("PROJECTION_API_KEY");

  if (!expectedKey || request.apiKey !== expectedKey) {
    return projectionApiResponse_({ error: "Unauthorized." });
  }

  try {
    return projectionApiResponse_(
      calculatePrivateLineupProjections_(request.players, request.profilePlayer)
    );
  } catch (error) {
    console.error("Projection API request failed: " + error.message);
    return projectionApiResponse_({ error: "Unable to calculate lineup projections." });
  }
}

function calculatePrivateLineupProjections_(playerNames, selectedProfileName) {
  if (
    !Array.isArray(playerNames) ||
    playerNames.length !== 5 ||
    playerNames.some(name => !String(name || "").trim())
  ) {
    throw new Error("Exactly five player names are required.");
  }

  const selectedKeys = playerNames.map(normalizeBioPlayerName_);
  if (new Set(selectedKeys).size !== 5) {
    throw new Error("Player names must be unique.");
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const playersSheet = getRequiredSheet_(spreadsheet, CONFIG.SHEETS.PLAYERS);
  const database = buildBioDatabase_(playersSheet);
  const lineup = selectedKeys.map((key, index) => {
    const record = database.recordsByName[key];
    if (!record) throw new Error("A selected player was not found.");
    return { ...record, lineupSlot: ["PG", "SG", "SF", "PF", "C"][index] };
  });

  const offensiveRoles = assignBioOffensiveRoles_(lineup);
  const defensiveRoles = assignBioDefensiveRoles_(lineup);
  const sharedAnalysis = buildLineupSharedAnalysis_(
    playersSheet,
    lineup,
    offensiveRoles,
    defensiveRoles
  );
  const preparedLineup = sharedAnalysis.records;
  const offensiveProjection = calculateLineupOffensiveProjections_(
    preparedLineup,
    offensiveRoles,
    defensiveRoles
  );

  const calibration = getCachedPlayerPerformanceCalibration_(playersSheet);
  const playerDefenseRatings = {};
  preparedLineup.forEach(player => {
    const key = normalizeBioPlayerName_(player.player);
    playerDefenseRatings[key] = calculatePlayerPerformanceDefScore_(
      player,
      defensiveRoles[key],
      calculatePlayerPerformanceDefRaw_(player),
      calibration.defense
    );
  });

  const defensiveProjection = calculateLineupDefensiveProjections_(
    preparedLineup,
    defensiveRoles,
    offensiveRoles,
    playerDefenseRatings
  );
  const selectedProfileKey = normalizeBioPlayerName_(
    selectedProfileName || playerNames[0]
  );
  if (!selectedKeys.includes(selectedProfileKey)) {
    throw new Error("The profile player must be in the selected lineup.");
  }

  const keyFor = player => normalizeBioPlayerName_(player.player);
  const expectedShotProfiles = calculateLineupExpectedShotProfiles_(
    preparedLineup,
    offensiveRoles
  );
  const expectedShotEfficiencies = calculateLineupExpectedShotEfficiencies_(
    preparedLineup,
    offensiveRoles
  );
  const expectedDefenses = calculateLineupExpectedDefense_(
    preparedLineup,
    defensiveRoles
  );
  const selectedProfilePlayer = preparedLineup.find(
    player => keyFor(player) === selectedProfileKey
  );
  const selectedShotProfile = expectedShotProfiles[selectedProfileKey];
  const selectedShotEfficiency = expectedShotEfficiencies[selectedProfileKey];
  const selectedDefense = expectedDefenses[selectedProfileKey];
  const selectedImpact = sharedAnalysis.impact[selectedProfileKey];
  const selectedOffenseLoad = sharedAnalysis.offenseLoads[selectedProfileKey];
  const selectedDefenseLoad = sharedAnalysis.defenseLoads[selectedProfileKey];
  const playerPerformance = preparedLineup.map(player => {
    const key = keyFor(player);
    const offensiveRaw = calculatePlayerPerformanceOffRaw_(player);
    const defensiveRaw = calculatePlayerPerformanceDefRaw_(player);
    const baseOffense = calculatePlayerPerformanceOffScore_(
      player,
      sharedAnalysis.offenseLoads[key],
      offensiveRaw,
      calibration.offense
    );
    const baseDefense = calculatePlayerPerformanceDefScore_(
      player,
      defensiveRoles[key],
      defensiveRaw,
      calibration.defense
    );

    return {
      player: player.player,
      offense: calibratePlayerPerformanceScore_(player, "off", baseOffense),
      defense: calibratePlayerPerformanceScore_(player, "def", baseDefense),
      load: calculatePlayerPerformanceLoad_(
        sharedAnalysis.offenseLoads[key],
        sharedAnalysis.defenseLoads[key]
      ),
      fit: calculatePlayerPerformanceFit_(
        player,
        key,
        preparedLineup,
        offensiveRoles,
        defensiveRoles,
        sharedAnalysis.offenseLoads,
        sharedAnalysis.defenseLoads,
        sharedAnalysis.impact[key],
        calibration
      )
    };
  });

  const overview = calculateProjectiveOverview_(
    preparedLineup,
    offensiveRoles,
    defensiveRoles,
    sharedAnalysis.offenseLoads,
    sharedAnalysis.defenseLoads,
    offensiveProjection,
    defensiveProjection
  );
  const stintSimulation = calculateLineupStintSimulation_({
    lineup: preparedLineup,
    offensiveRoles,
    defensiveRoles,
    offenseLoads: sharedAnalysis.offenseLoads,
    defenseLoads: sharedAnalysis.defenseLoads,
    playerDefenseRatings,
    offensiveProjection,
    defensiveProjection,
    overview
  });

  return {
    players: preparedLineup.map(player => {
      const key = keyFor(player);
      return {
        player: player.player,
        position: player.lineupSlot,
        offensiveRole: offensiveRoles[key],
        defensiveRole: defensiveRoles[key]
      };
    }),
    offensiveProjections: {
      shotBalance: offensiveProjection.shotBalance,
      offensiveRebounding: offensiveProjection.offensiveRebounding,
      offensiveRating: offensiveProjection.offensiveRating,
      threePointPercentage: projectionApiPercent_(offensiveProjection.threePointPercentage),
      trueShootingPercentage: projectionApiPercent_(offensiveProjection.trueShootingPercentage)
    },
    defensiveProjections: {
      opponentTs: projectionApiPercent_(defensiveProjection.opponentTs),
      defensiveRebounding: defensiveProjection.defensiveRebounding,
      defensiveRating: defensiveProjection.defensiveRating,
      turnoverCreation: defensiveProjection.turnoverCreation,
      rimProtection: defensiveProjection.rimProtection
    },
    usage: {
      offense: calculateOptimalOffensiveSpacing_(
        preparedLineup,
        offensiveRoles,
        sharedAnalysis.offenseLoads
      ),
      initiator: calculateOptimalInitiator_(preparedLineup, offensiveRoles),
      defense: calculateOptimalDefensiveScheme_(
        preparedLineup,
        defensiveRoles,
        sharedAnalysis.defenseLoads
      ),
      offRebounding: calculateOptimalOffensiveRebounding_(
        preparedLineup,
        offensiveRoles,
        sharedAnalysis.offenseLoads
      ),
      defRebounding: calculateOptimalDefensiveRebounding_(
        preparedLineup,
        defensiveRoles,
        sharedAnalysis.defenseLoads
      )
    },
    performance: playerPerformance,
    netRatingOverTime: stintSimulation.rows.map(row => ({
      minute: row[0],
      netRating: row[1]
    })),
    ratingProjections: {
      OFF: offensiveProjection.offensiveRating,
      DEF: defensiveProjection.defensiveRating,
      NET: overview.netRating
    },
    overview: {
      creationBalance: overview.creationBalance,
      synergy: overview.synergy,
      pace: overview.pace,
      versatility: overview.versatility
    },
    profile: {
      player: selectedProfilePlayer.player,
      bio: {
        position: selectedProfilePlayer.lineupSlot,
        offensiveRole: offensiveRoles[selectedProfileKey],
        defensiveRole: defensiveRoles[selectedProfileKey],
        age: selectedProfilePlayer.age,
        value: selectedProfilePlayer.value
      },
      offensiveLoad: selectedOffenseLoad,
      defensiveLoad: selectedDefenseLoad,
      expectedShotProfile: {
        threePointShare: projectionApiPercent_(selectedShotProfile.threeShare),
        midrangeShare: projectionApiPercent_(selectedShotProfile.midShare),
        rimShare: projectionApiPercent_(selectedShotProfile.rimShare),
        freeThrowRate: projectionApiPercent_(selectedShotProfile.freeThrowRate)
      },
      expectedShotEfficiency: {
        threePointPct: projectionApiPercent_(selectedShotEfficiency.threePoint),
        midrangePct: projectionApiPercent_(selectedShotEfficiency.midrange),
        rimPct: projectionApiPercent_(selectedShotEfficiency.rim),
        freeThrowPct: projectionApiPercent_(selectedShotEfficiency.freeThrow)
      },
      expectedDefense: {
        idealMatchup: selectedDefense.idealMatchup,
        deflectionsPer100: selectedDefense.deflections,
        pointsSavedPer100: selectedDefense.pointsSaved,
        turnoversCreatedPer100: selectedDefense.turnoversCreated
      },
      expectedImpact: {
        pace: selectedImpact.pace,
        shotProfile: selectedImpact.shotProfile,
        shotEfficiency: selectedImpact.shotEfficiency,
        opponentEfficiency: selectedImpact.opponentEfficiency,
        stopsCreation: selectedImpact.stopsCreation,
        rebounding: selectedImpact.rebounding,
        netRating: selectedImpact.netRating
      }
    }
  };
}

function projectionApiPercent_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number / 100 : null;
}

function projectionApiResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}