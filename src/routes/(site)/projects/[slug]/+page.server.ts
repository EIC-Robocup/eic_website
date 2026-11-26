import { error } from '@sveltejs/kit';
import { getProjectBySlug } from '#lib/server/queries/site.ts';
import { PROJECT_STATUS_LABELS, labelFor } from '#lib/content/labels.ts';
import { projectCategoryLabel } from '#lib/components/site/format.ts';
import { cardMeta, isGitHub } from '../project-meta.ts';
import type { PageServerLoad } from './$types';

/** Gallery photos captioned like "Parts laid out" go beside the parts list instead. */
const PARTS_PHOTO = /\bparts\b/i;

const clean = (v: string | null | undefined) => v?.trim() || '';

export const load: PageServerLoad = async ({ params }) => {
	const project = await getProjectBySlug(params.slug);
	if (!project) error(404, 'Project not found');

	const parts = project.parts.filter((p) => clean(p.part));
	const software = project.software.map((s) => s.trim()).filter(Boolean);
	// "Show gallery" off hides every gallery photo, the parts photo included.
	const gallery = project.showGallery
		? project.gallery.filter((g) => clean(g.url) || clean(g.caption) || clean(g.alt))
		: [];
	const partsPhoto = parts.length
		? (gallery.find((g) => PARTS_PHOTO.test(g.caption) || PARTS_PHOTO.test(g.alt)) ?? null)
		: null;

	const statusLabel = labelFor(PROJECT_STATUS_LABELS, project.status);
	const teamSize = project.teamSize && project.teamSize > 0 ? project.teamSize : null;
	const facts = [
		{ key: 'Status', value: statusLabel },
		{ key: 'Event', value: clean(project.event) },
		{ key: 'Place', value: clean(project.place) },
		{ key: 'Result', value: clean(project.result) },
		{ key: 'Team', value: teamSize ? `${teamSize} ${teamSize === 1 ? 'person' : 'people'}` : '' }
	].filter((f) => f.value);

	const repoUrl = clean(project.repoUrl);
	const paperUrl = clean(project.paperUrl);

	return {
		project: {
			slug: project.slug,
			title: project.title,
			category: project.category,
			status: project.status,
			/** "Robot · RoboCup@Home 2026"; without an event, the card's line ("Open source · Python"). */
			meta: clean(project.event)
				? `${projectCategoryLabel(project.category)} · ${clean(project.event)}`
				: cardMeta(project),
			tagline: clean(project.tagline),
			summary: clean(project.summary),
			coverUrl: clean(project.coverUrl) || null,
			coverAlt: clean(project.coverAlt),
			coverCaption: clean(project.coverCaption),
			highlight: clean(project.highlightValue)
				? {
						value: clean(project.highlightValue),
						label: clean(project.highlightLabel),
						note: clean(project.highlightNote)
					}
				: null,
			facts,
			repo: repoUrl
				? { href: repoUrl, label: isGitHub(repoUrl) ? 'View code on GitHub' : 'View the code' }
				: null,
			paperUrl: paperUrl || null,
			systems: project.systems.filter((s) => clean(s.title)),
			parts,
			software,
			partsPhoto,
			gallery: gallery.filter((g) => g !== partsPhoto),
			related: project.relatedPosts
		}
	};
};
