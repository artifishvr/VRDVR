import { Hono } from "hono";
import { existsSync, mkdirSync, unlinkSync, createReadStream } from "node:fs";
import { spawn, ChildProcess } from "node:child_process";
import { s3, write, S3Client, S3File } from "bun";

const s3client = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_ACCESS_SECRET,
  bucket: process.env.S3_BUCKET,
});

const activeRecordings = new Map<
  string,
  {
    process: ChildProcess;
    startTime: Date;
    filename: string;
    user: string;
  }
>();

if (!existsSync("vods")) {
  mkdirSync("vods");
}

const gracefulShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Gracefully stopping all recordings...`);

  if (activeRecordings.size === 0) {
    console.log("No active recordings to stop.");
    process.exit(0);
  }

  console.log(`Stopping ${activeRecordings.size} active recording(s)...`);

  let stoppedCount = 0;
  const totalRecordings = activeRecordings.size;

  activeRecordings.forEach((recording, user) => {
    console.log(`Stopping recording for user: ${user}`);

    recording.process.on("close", () => {
      stoppedCount++;
      console.log(
        `Recording for ${user} stopped. (${stoppedCount}/${totalRecordings})`
      );
      if (stoppedCount === totalRecordings) {
        console.log("All recordings stopped successfully.");
        process.exit(0);
      }
    });

    if (recording.process.stdin) {
      recording.process.stdin.write("q\n");
    } else {
      recording.process.kill("SIGINT");
    }
  });

  setTimeout(() => {
    console.log("Timeout reached. Force killing remaining processes...");
    activeRecordings.forEach((recording, user) => {
      if (!recording.process.killed) {
        console.log(`Force killing recording for user: ${user}`);
        recording.process.kill("SIGKILL");
      }
    });
    process.exit(1);
  }, 10000); // 10 seconds
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGQUIT", () => gracefulShutdown("SIGQUIT"));

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});

const app = new Hono();

app.post("/record", async (c) => {
  const data = await c.req.json();
  const { user } = data;

  if (activeRecordings.has(user)) {
    return c.json(
      { message: "Recording already in progress for this user" },
      400
    );
  }

  const filename = `${user}-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.ts`;
  const outputPath = `vods/${filename}`;

  const ffmpegProcess = spawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-rw_timeout",
      "30000000", // 30 seconds in microseconds
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "2",
      "-i",
      `https://stream.vrcdn.live/live/${user}.live.ts`,
      "-c",
      "copy",
      outputPath,
    ],
    { stdio: ["pipe", "pipe", "pipe"] }
  );

  activeRecordings.set(user, {
    process: ffmpegProcess,
    startTime: new Date(),
    filename,
    user,
  });

  ffmpegProcess.on("close", (code) => {
    console.log(`Recording for ${user} finished with code ${code}`);
    activeRecordings.delete(user);

    if (code === 0 && existsSync(outputPath)) {
      const oggPath = outputPath.replace(/\.ts$/i, ".ogg");
      console.log(`Converting ${outputPath} -> ${oggPath}`);

      const remuxProcess = spawn(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "warning",
          "-i",
          outputPath,
          "-vn",
          "-c:a",
          "libopus",
          "-b:a",
          "128k",
          "-vbr",
          "on",
          oggPath,
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );

      remuxProcess.on("close", async (rc) => {
        if (rc === 0) {
          console.log(`Converting completed for ${user}: ${oggPath}`);

          const localFile = Bun.file(oggPath);

          const s3file: S3File = s3client.file(oggPath.split("/").pop()!);

          const writer = s3file.writer({
            retry: 3,
            queueSize: 10,
            partSize: 5 * 1024 * 1024,
          });

          writer.write(await localFile.arrayBuffer());

          await writer.end();

          console.log(`Uploaded ${oggPath} to S3 bucket successfully.`);
        } else {
          console.error(`Converting failed for ${user} with code ${rc}`);
        }
      });

      remuxProcess.on("error", (err) => {
        console.error(`Converting error for ${user}:`, err);
      });

      if (process.env.NODE_ENV !== "production") {
        remuxProcess.stderr?.on("data", (data) => {
          console.log(`ffmpeg-ogg [${user}]:`, data.toString());
        });
      }
    } else {
      console.warn(
        `Skipping converting to ogg for ${user}: recording failed or file missing.`
      );
    }
  });

  ffmpegProcess.on("error", (error) => {
    console.error(`Recording error for ${user}:`, error);
    activeRecordings.delete(user);
  });

  if (process.env.NODE_ENV !== "production") {
    ffmpegProcess.stderr?.on("data", (data) => {
      console.log(`ffmpeg [${user}]:`, data.toString());
    });
  }

  console.log(`Started recording for user: ${user}`);

  return c.json({
    message: "Recording requested",
    user,
    filename,
    startTime: new Date(),
  });
});

app.get("/stats", (c) => {
  const stats = Array.from(activeRecordings.entries()).map(
    ([user, recording]) => ({
      user,
      filename: recording.filename,
      startTime: recording.startTime,
      duration: Math.floor((Date.now() - recording.startTime.getTime()) / 1000),
      pid: recording.process.pid,
    })
  );

  return c.json({
    activeRecordings: stats.length,
    recordings: stats,
  });
});

app.get("/stats/:user", (c) => {
  const user = c.req.param("user");
  const recording = activeRecordings.get(user);

  if (!recording) {
    return c.json({ message: "No active recording found for this user" }, 404);
  }

  return c.json({
    user,
    filename: recording.filename,
    startTime: recording.startTime,
    duration: Math.floor((Date.now() - recording.startTime.getTime()) / 1000),
    pid: recording.process.pid,
    status: "recording",
  });
});

export default app;
