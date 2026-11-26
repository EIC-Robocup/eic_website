import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireEditor } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { media } from '#lib/server/db/schema.ts';
import { isUuid } from '../../../projects/projects.server.ts';
import { findMediaUses } from '../../usage.server.ts';
import type { RequestHandler } from './$types';

/** GET: where this file is used, as `{ uses: MediaUse[] }`, for the delete warning. */
export const GET: RequestHandler = async ({ params, locals }) => {
	requireEditor(locals);
	if (!isUuid(params.id)) error(404, 'File not found');
	const [row] = await db.select({ path: media.path }).from(media).where(eq(media.id, params.id)).limit(1);
	if (!row) error(404, 'File not found');
	const uses = await findMediaUses(row.path);
	return Response.json({ uses }, { headers: { 'cache-control': 'private, no-store' } });
};
