import { db } from '$lib/db';
import { recordings } from '$lib/db/schema';
import { desc } from 'drizzle-orm';

export const load = async () => {
	const dbRecordings = await db.select().from(recordings).orderBy(desc(recordings.timestamp));

	return {
		recordings: dbRecordings
	};
};
