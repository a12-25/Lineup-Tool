import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DefaultAzureCredential } from "@azure/identity";
import { BlockBlobClient } from "@azure/storage-blob";

const localDataPath = fileURLToPath(new URL("../../private/players.json", import.meta.url));
let cachedRows;
let loadingRows;

async function loadFromBlob(blobUrl) {
  const blob = BlockBlobClient.fromBlobUrl(blobUrl, new DefaultAzureCredential());
  const content = await blob.downloadToBuffer();
  return JSON.parse(content.toString("utf8"));
}

export async function getPlayerRows() {
  if (cachedRows) return cachedRows;
  if (loadingRows) return loadingRows;

  loadingRows = process.env.PLAYER_DATA_BLOB_URL
    ? loadFromBlob(process.env.PLAYER_DATA_BLOB_URL)
    : readFile(localDataPath, "utf8").then(JSON.parse);

  try {
    const rows = await loadingRows;
    if (!Array.isArray(rows)) throw new Error("Player dataset must be a JSON array");
    cachedRows = rows;
    return cachedRows;
  } finally {
    loadingRows = undefined;
  }
}