import { S3 } from '$lib/s3.server';
import { error } from '@sveltejs/kit';

export const load = async () => {
	const xml = await S3.listObjects();

	const keys: string[] = [];
	const keyRegex = /<Key>(.*?)<\/Key>/g;
	let match;
	while ((match = keyRegex.exec(xml)) !== null) {
		keys.push(match[1]);
	}

	const items: { username: string; date: string; url: string }[] = [];

	keys.forEach((key) => {
		const splitteed = key.split('-');
		const username = splitteed[0];
		const date = splitteed
			.slice(1)
			.join('-')
			.split('.')[0]
			.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{1,})Z$/, 'T$1:$2:$3.$4Z');
		const url = `https://dvr-storage.vrc.bz/${key}`;

		items.push({ username, date, url });
	});

	if (items.length === 0) {
		return error(404, 'No items found');
	}

	return { items };
};
