import { S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY, S3_ACCESS_SECRET } from '$env/static/private';
import { S3Client } from '@aws-sdk/client-s3';

export const s3 = new S3Client({
	region: 'auto',
	endpoint: S3_ENDPOINT,
	credentials: {
		accessKeyId: S3_ACCESS_KEY || '',
		secretAccessKey: S3_ACCESS_SECRET || ''
	}
});
