import { S3Client } from "bun";
import { recordings } from "../src/db/schema";
import { db } from "../src/db";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const s3client = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_ACCESS_SECRET,
  bucket: process.env.S3_BUCKET,
});

const objects = await s3client.list();

const keys: string[] = [];

if (!objects.contents) {
  throw new Error("No contents found in S3 bucket");
}

objects.contents.forEach((object) => {
  keys.push(object.key);
});

if (keys.length === 0) {
  throw new Error("No items found in S3 bucket");
}

const tmpDir = "tmp_migrate";
if (!existsSync(tmpDir)) mkdirSync(tmpDir);

for (const key of keys) {
  try {
    const splitteed = key.split("-");
    const username = splitteed[0];
    const date = splitteed
      .slice(1)
      .join("-")
      .split(".")[0]
      .replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{1,})Z$/, "T$1:$2:$3.$4Z"); // filename -> ISO-ish

    let startTime = new Date(date);
    if (isNaN(startTime.getTime())) {
      console.warn(
        `Could not parse date from filename ${key}, using current time`
      );
      startTime = new Date();
    }

    // download object to local temp file
    const s3file = s3client.file(key);
    const arr = await s3file.arrayBuffer();
    const buf = Buffer.from(arr);
    const localName = path.basename(key);
    const localPath = path.join(tmpDir, localName);
    writeFileSync(localPath, buf);

    // probe duration with ffprobe
    let runtimeSeconds = -1;
    try {
      const probe = spawnSync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        localPath,
      ]);

      if (probe.status === 0) {
        const out = probe.stdout.toString().trim();
        const seconds = parseFloat(out);
        if (!isNaN(seconds)) {
          runtimeSeconds = Math.floor(seconds);
        } else {
          console.warn(
            `ffprobe returned non-number for ${localPath}: "${out}"`
          );
        }
      } else {
        console.warn(
          `ffprobe failed for ${localPath}:`,
          probe.stderr.toString()
        );
      }
    } catch (err) {
      console.error("Error running ffprobe:", err);
    }

    await db.insert(recordings).values({
      s3Key: key,
      username,
      timestamp: startTime,
      runtimeSeconds,
    });

    try {
      unlinkSync(localPath);
    } catch (err) {
      console.warn(`Failed to remove temp file ${localPath}:`, err);
    }
  } catch (err) {
    console.error(`Failed processing ${key}:`, err);
  }
}
