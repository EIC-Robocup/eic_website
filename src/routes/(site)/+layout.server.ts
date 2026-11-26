import { getPageSections } from '#lib/server/content.ts';
import type { LayoutServerLoad } from './$types';

/** Nav and footer copy for every public page (falls back to the designed defaults). */
export const load: LayoutServerLoad = async () => {
	const site = await getPageSections('site');
	return { site };
};
