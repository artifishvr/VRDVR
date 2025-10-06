import { ListObjectsCommand } from '@aws-sdk/client-s3';
import { S3_BUCKET } from '$env/static/private';
import { s3 } from '$lib/s3.server';
import { error } from '@sveltejs/kit';

export const load = async () => {
	const command = new ListObjectsCommand({
		Bucket: S3_BUCKET
	});
	const response = await s3.send(command);

	let items: { username: string; date: string; url: string }[] = [];

	response.Contents?.forEach((item) => {
		if (item.Key) {
			const splitteed = item.Key.split('-');
			const username = splitteed[0];
			const date = splitteed
				.slice(1)
				.join('-')
				.split('.')[0]
				.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{1,})Z$/, 'T$1:$2:$3.$4Z');
			const url = `https://dvr-storage.vrc.bz/${item.Key}`;

			items.push({ username, date, url });
		}
	});

	if (items.length === 0) {
		return error(404, 'No items found');
	}

	return { items };
};
