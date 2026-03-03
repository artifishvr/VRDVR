import { json } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { LISTINGS_PASSWORD } from '$env/static/private';
import { db } from '$lib/db';
import { recordings } from '$lib/db/schema';

const PASSWORD_HEADER = 'x-vrdvr-password';

export const GET = async ({ request }) => {
	if (!LISTINGS_PASSWORD) {
		return json(
			{ message: 'Listings password not configured.' },
			{ status: 500 }
		);
	}

	const providedPassword = request.headers.get(PASSWORD_HEADER) ?? '';
	if (providedPassword !== LISTINGS_PASSWORD) {
		return json({ message: 'Unauthorized.' }, { status: 401 });
	}

	const dbRecordings = await db.select().from(recordings).orderBy(desc(recordings.timestamp));

	return json({ recordings: dbRecordings });
};
