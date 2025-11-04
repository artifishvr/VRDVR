import { timestamp, pgTable, varchar, integer } from "drizzle-orm/pg-core";
import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const length = 12;

const nanoid = customAlphabet(alphabet, length);

export const recordings = pgTable("recordings", {
  id: varchar({ length: 12 })
    .primaryKey()
    .$default(() => nanoid()),
  s3Key: varchar({ length: 255 }).notNull(),
  username: varchar({ length: 255 }).notNull(),
  timestamp: timestamp().notNull(),
  runtimeSeconds: integer().notNull(),
});
