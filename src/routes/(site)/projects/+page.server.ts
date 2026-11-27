import { getPageSections } from '#lib/server/content.ts';
import { listProjects, listPublications } from '#lib/server/queries/site.ts';
import { cardMeta } from './project-meta.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const sections = await getPageSections('projects');
	const [projects, publications] = await Promise.all([
		listProjects(),
		sections.publications.enabled ? listPublications() : Promise.resolve([])
	]);

	return {
		sections,
		projects: projects.map((p) => ({
			slug: p.slug,
			title: p.title,
			category: p.category,
			status: p.status,
			tags: p.tags,
			coverUrl: p.coverUrl,
			coverAlt: p.coverAlt,
			linkUrl: p.linkUrl,
			meta: cardMeta(p)
		})),
		publications: publications.map((r) => ({
			id: r.id,
			year: r.year,
			title: r.title,
			venue: r.venue?.trim() || null,
			authors: r.authors?.trim() || null,
			url: r.url?.trim() || null
		}))
	};
};
