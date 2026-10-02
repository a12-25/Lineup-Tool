import { app } from "@azure/functions";
import { getPlayerRows } from "./data/PlayerDataRepository.js";
import { fetchSpreadsheetProjections } from "./data/SpreadsheetProjectionClient.js";
import { buildLineupResults, getPublicPlayerList } from "./logic/LineupApiService.js";

app.http("players", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "players",
  handler: async () => {
    try {
      return { jsonBody: getPublicPlayerList(await getPlayerRows()) };
    } catch (error) {
      console.error("Unable to load player list", error);
      return { status: 503, jsonBody: { error: "Player data is temporarily unavailable" } };
    }
  }
});

app.http("lineup", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "lineup",
  handler: async request => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: "Request body must be JSON" } };
    }

    let result;
    try {
      result = buildLineupResults(
        await getPlayerRows(),
        body?.players,
        body?.profilePlayer
      );
    } catch (error) {
      if (error instanceof TypeError) return { status: 400, jsonBody: { error: error.message } };
      console.error("Unable to prepare lineup", error);
      return { status: 503, jsonBody: { error: "Lineup calculations are temporarily unavailable" } };
    }

    try {
      const projections = await fetchSpreadsheetProjections(
        body.players,
        body.profilePlayer
      );
      return { jsonBody: { ...result, ...projections } };
    } catch (error) {
      console.error("Spreadsheet projection service unavailable", error);
      return { status: 503, jsonBody: { error: "Spreadsheet projections are temporarily unavailable" } };
    }
  }
});