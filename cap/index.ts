import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { ofetch } from "ofetch";

const DEFAULT_RELATIVE = ["AppData", "LocalLow", "VRChat", "VRChat"];

function getDefaultLogDir(): string {
  const user = process.env.USERPROFILE || process.env.HOME;
  if (!user) return path.join(".");
  return path.join(user, ...DEFAULT_RELATIVE);
}

function isLogFile(name: string) {
  // VRChat logs are typically named output_log.txt or output_log_YYYY-MM-DD_HH-MM-SS.txt
  return /^output_log.*\.txt$/i.test(name);
}

async function findNewestLog(dir: string): Promise<string | null> {
  try {
    const entries = await fsp.readdir(dir);
    let newest: { file: string; mtimeMs: number } | null = null;
    for (const name of entries) {
      if (!isLogFile(name)) continue;
      const full = path.join(dir, name);
      try {
        const st = await fsp.stat(full);
        if (!st.isFile()) continue;
        if (!newest || st.mtimeMs > newest.mtimeMs)
          newest = { file: full, mtimeMs: st.mtimeMs };
      } catch (e) {
        // ignore stat errors for individual files
      }
    }
    return newest ? newest.file : null;
  } catch (e) {
    return null;
  }
}

async function tailFile(
  filePath: string,
  onLine: (line: string) => void,
  stopSignal: { stop: boolean }
) {
  let pos = 0;
  try {
    const st = await fsp.stat(filePath);
    pos = st.size; // start at end (only new lines)
  } catch (e) {
    pos = 0;
  }

  const readNew = async () => {
    try {
      const st = await fsp.stat(filePath);
      if (st.size > pos) {
        const toRead = st.size - pos;
        const fd = await fsp.open(filePath, "r");
        const buf = Buffer.allocUnsafe(toRead);
        await fd.read(buf, 0, toRead, pos);
        await fd.close();
        pos = st.size;
        // Split into lines and call onLine for each
        const text = buf.toString("utf8");
        const lines = text.split(/\r?\n/);
        for (const l of lines) {
          if (l.length > 0) onLine(l);
        }
      }
    } catch (e) {
      // ignore read errors
    }
  };

  // Watch for changes on the file. If the file is rotated/replaced, 'rename' will fire;
  // callers should handle switching to a new file if necessary.

  const watcher = fs.watch(filePath, (evt) => {
    if (stopSignal.stop) return;
    if (evt === "change") void readNew();
    if (evt === "rename") {
      // file replaced or removed; attempt a final read then stop
      void readNew();
    }
  });

  // Also poll periodically in case fs.watch misses events
  const interval = setInterval(() => {
    if (stopSignal.stop) return;
    void readNew();
  }, 1000);

  return () => {
    stopSignal.stop = true;
    watcher.close();
    clearInterval(interval);
  };
}

function extractVrcdnStream(line: string): string | null {
  try {
    // Match either "Resolving URL" or "Attempting to resolve URL"
    const m = line.match(
      /(?:Attempting to resolve|Resolving)\s+URL\s+['"]([^'"]+)['"]/i
    );
    if (!m || !m[1]) return null;
    const url: string = m[1];
    console.log("Saw URL:", url);
    if (url.includes("vr-m.net")) {
      console.warn("nya.llc btw");
    }
    if (!/vrcdn\.live/i.test(url)) return null;
    // Grab last non-empty path segment
    const parts = url.split(/\//).filter((s) => s.length > 0);
    if (parts.length === 0) return null;
    const last = parts[parts.length - 1];
    if (last?.length === 0) return null;

    return last?.replace(".live.ts", "") || null;
  } catch (e) {
    return null;
  }
}

async function onVrcdnStreamDetected(streamName: string) {
  console.log(`VRCDN stream detected: ${streamName}`);

  const response = await ofetch("https://api.dvr.vrc.bz/record", {
    method: "POST",
    body: { user: streamName },
  }).catch((e) => {
    console.error("Error sending fetch request:", e);
  });

  console.log("Fetch response:", response);
}

async function main() {
  const logDir = getDefaultLogDir();

  let currentFile: string | null = await findNewestLog(logDir);
  if (!currentFile) {
    console.log("No log files found yet. Will watch directory for new logs...");
  } else {
    console.log("Tailing newest log:", currentFile);
  }

  let stopTail = { stop: false };
  let stopTailFn: (() => void) | null = null;

  const startTail = async (file: string) => {
    if (stopTailFn) stopTailFn();
    stopTail = { stop: false };
    stopTailFn = await tailFile(
      file,
      (line) => {
        const name = extractVrcdnStream(line);
        if (name) onVrcdnStreamDetected(name);
      },
      stopTail
    );
    currentFile = file;
  };

  if (currentFile) await startTail(currentFile);

  // Watch directory for new or rotated logs
  let dirExists = true;
  try {
    await fsp.access(logDir);
  } catch (e) {
    dirExists = false;
  }

  if (!dirExists) {
    // Periodically check for directory creation
    const dirCheck = setInterval(async () => {
      try {
        await fsp.access(logDir);
        clearInterval(dirCheck);
        console.log(`Log directory created: ${logDir}`);
        // continue to set up watchers below by calling main again
        void main();
      } catch (e) {
        // still not there
      }
    }, 2000);
    return;
  }

  const dirWatcher = fs.watch(logDir, async (evt, name) => {
    try {
      const newest = await findNewestLog(logDir);
      if (newest && newest !== currentFile) {
        console.log("Switching to newer log:", newest);
        await startTail(newest);
      }
    } catch (e) {
      // ignore
    }
  });

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("Stopping...");
    if (stopTailFn) stopTailFn();
    dirWatcher.close();
    process.exit(0);
  });
}

void main();
