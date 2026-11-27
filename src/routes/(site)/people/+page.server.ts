import { getPageSections } from '#lib/server/content.ts';
import { listPeopleByTeam, type PersonCard } from '#lib/server/queries/site.ts';
import type { PageServerLoad } from './$types';

/** Only what the person card shows, so the page payload stays small. */
const toCard = (p: PersonCard) => ({
	id: p.id,
	name: p.name,
	role: p.role,
	isLead: p.isLead,
	photoUrl: p.photoUrl,
	profileUrl: p.profileUrl
});

export const load: PageServerLoad = async () => {
	const [sections, people] = await Promise.all([getPageSections('people'), listPeopleByTeam()]);

	return {
		sections,
		totals: people.totals,
		groups: people.groups.map((g, i) => ({
			id: g.id,
			name: g.name,
			/** Numbered in page order, and kept when the list is filtered. */
			no: i + 1,
			people: g.people.map(toCard)
		})),
		alumni: sections.alumni.enabled ? people.alumni.map(toCard) : []
	};
};
