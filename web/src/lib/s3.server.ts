import { S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY, S3_ACCESS_SECRET } from '$env/static/private';
import { AwsClient } from 'aws4fetch';

const endpoint = S3_ENDPOINT || 'https://dvr-storage.vrc.bz';

export const aws = new AwsClient({
	accessKeyId: S3_ACCESS_KEY || '',
	secretAccessKey: S3_ACCESS_SECRET || '',
	service: 's3',
	region: 'auto'
});

export const S3 = {
	async listObjects(): Promise<string> {
		const url = `${endpoint}/${S3_BUCKET}`;
		const res = await aws.fetch(url + '?list-type=2');
		if (!res.ok) throw new Error(`S3 listObjects failed: ${res.status} ${res.statusText}`);
		return res.text();
	}
};
