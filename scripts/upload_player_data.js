import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

const storageUrl = process.env.PLAYER_DATA_STORAGE_ACCOUNT_URL;
const containerName = process.env.PLAYER_DATA_CONTAINER;
const datasetPath = fileURLToPath(new URL("../private/players.json", import.meta.url));

if (!storageUrl || !containerName) {
  throw new Error("Set PLAYER_DATA_STORAGE_ACCOUNT_URL and PLAYER_DATA_CONTAINER first");
}

const container = new BlobServiceClient(storageUrl, new DefaultAzureCredential())
  .getContainerClient(containerName);
const properties = await container.getProperties();
if (properties.publicAccess) {
  throw new Error("Refusing to upload player data to a container with public access enabled");
}

const blob = container.getBlockBlobClient("players.json");
await blob.uploadFile(datasetPath, {
  blobHTTPHeaders: { blobContentType: "application/json" }
});
console.log(`Uploaded private player dataset to ${blob.url}`);