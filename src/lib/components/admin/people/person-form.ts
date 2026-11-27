/**
 * The People admin's form rules, shared by the edit sheet (checks before sending) and the
 * actions (the same checks on the server). Client safe: only type imports from the schema.
 */
import type { PersonKind } from '#lib/server/db/schema.ts';
import { isSafeUrl } from '../form-data.ts';
import { isUuid, type Errors } from '../lists/rows.ts';

export { isUuid };

/** Longest values each field keeps. */
export const PERSON_MAX = { name: 120, role: 120, url: 2000, teamName: 60, teams: 30 } as const;

/** The person as the sheet holds them: text fields as strings, toggles as booleans. */
export type PersonDraft = {
	/** '' for a new person. */
	id: string;
	name: string;
	kind: PersonKind;
	/** A team id, or '' for no team. Ignored for advisors. */
	teamId: string;
	role: string;
	isLead: boolean;
	featured: boolean;
	cohort: string;
	profileUrl: string;
	photoUrl: string;
	visible: boolean;
};

export type PersonValues = {
	name: string;
	kind: PersonKind;
	teamId: string | null;
	role: string | null;
	isLead: boolean;
	featured: boolean;
	cohort: number | null;
	profileUrl: string | null;
	photoUrl: string | null;
	visible: boolean;
};

/** PERSON_KINDS from the schema (a server module, so only its types can be imported here). */
export const KINDS = ['member', 'advisor', 'alumni'] as const satisfies readonly PersonKind[];

export function isPersonKind(value: unknown): value is PersonKind {
	return typeof value === 'string' && (KINDS as readonly string[]).includes(value);
}

export function emptyPerson(teamId = ''): PersonDraft {
	return {
		id: '',
		name: '',
		kind: 'member',
		teamId,
		role: '',
		isLead: false,
		featured: false,
		cohort: '',
		profileUrl: '',
		photoUrl: '',
		visible: true
	};
}

/** The first year a cohort can be, and the latest (next year's intake). */
export const COHORT_RANGE = { min: 1950, max: () => new Date().getFullYear() + 1 } as const;

/**
 * Check a person. `teamIds` is the set of teams that exist (on the server); a team id
 * that is not in it is reported. Errors are keyed by field name.
 */
export function validatePerson(draft: PersonDraft, teamIds?: ReadonlySet<string>): { values: PersonValues; errors: Errors } {
	const errors: Errors = {};
	const name = draft.name.trim().replace(/\s+/g, ' ');
	if (!name) errors.name = 'Add the person’s full name.';
	else if (name.length > PERSON_MAX.name) errors.name = `Keep the name under ${PERSON_MAX.name} characters.`;

	const kind = isPersonKind(draft.kind) ? draft.kind : 'member';
	if (!isPersonKind(draft.kind)) errors.kind = 'Pick Member, Advisor or Alumni.';

	let teamId: string | null = null;
	if (kind !== 'advisor' && draft.teamId) {
		if (!isUuid(draft.teamId) || (teamIds && !teamIds.has(draft.teamId))) {
			errors.teamId = 'That team no longer exists. Pick another one.';
		} else teamId = draft.teamId;
	}

	const role = draft.role.trim().replace(/\s+/g, ' ');
	if (role.length > PERSON_MAX.role) errors.role = `Keep the role under ${PERSON_MAX.role} characters.`;

	const cohortText = draft.cohort.trim();
	let cohort: number | null = null;
	if (cohortText) {
		cohort = /^\d{4}$/.test(cohortText) ? Number(cohortText) : Number.NaN;
		const max = COHORT_RANGE.max();
		if (!Number.isInteger(cohort) || cohort < COHORT_RANGE.min || cohort > max) {
			errors.cohort = `Use the year they joined, from ${COHORT_RANGE.min} to ${max}.`;
		}
	}

	const profileUrl = draft.profileUrl.trim();
	if (profileUrl) {
		if (profileUrl.length > PERSON_MAX.url) errors.profileUrl = `Keep the link under ${PERSON_MAX.url} characters.`;
		else if (!isSafeUrl(profileUrl) || /\s/.test(profileUrl)) errors.profileUrl = 'Use a link that starts with https://';
	}

	const photoUrl = draft.photoUrl.trim();
	if (photoUrl && (!isSafeUrl(photoUrl) || photoUrl.length > PERSON_MAX.url)) {
		errors.photo = 'Use an https:// link or a site path such as /images/..., or upload the photo.';
	}

	return {
		values: {
			name,
			kind,
			teamId,
			role: role || null,
			isLead: draft.isLead,
			featured: draft.featured,
			cohort: Number.isInteger(cohort) ? cohort : null,
			profileUrl: profileUrl || null,
			photoUrl: photoUrl || null,
			visible: draft.visible
		},
		errors
	};
}

/**
 * The group a person is ordered in: advisors together, alumni together, and members by
 * team. Moving up and down, and the end a new person goes to, work within the group.
 */
export function groupKey(kind: PersonKind, teamId: string | null): string {
	if (kind === 'advisor') return 'advisors';
	if (kind === 'alumni') return 'alumni';
	return teamId ? `team:${teamId}` : 'no-team';
}

/* ------------------------------------------------------------------------------------------ */
/* Teams                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/** A team as the Manage teams dialog holds it. `id` is '' for a new team. */
export type TeamDraft = { id: string; name: string };
export type TeamValues = { id: string | null; name: string; sortOrder: number };

/** Filter values the People page uses for its other pills, so no team slug can take them. */
export const RESERVED_SLUGS = ['all', 'everyone', 'advisors', 'alumni', 'hidden', 'no-team', 'members'] as const;

export function validateTeams(drafts: readonly TeamDraft[]): { values: TeamValues[]; errors: Errors; message?: string } {
	const errors: Errors = {};
	const names = new Map<string, number>();
	const ids = new Set<string>();
	const values = drafts.map((draft, i): TeamValues => {
		const name = draft.name.trim().replace(/\s+/g, ' ');
		const key = `teams.${i}.name`;
		if (!name) errors[key] = 'Add the team’s name, or remove the row.';
		else if (name.length > PERSON_MAX.teamName) errors[key] = `Keep the name under ${PERSON_MAX.teamName} characters.`;
		else if (names.has(name.toLowerCase())) errors[key] = 'Another team already has this name.';
		names.set(name.toLowerCase(), i);
		let id: string | null = null;
		if (draft.id) {
			if (!isUuid(draft.id) || ids.has(draft.id)) errors[key] = 'Reload the page and try again.';
			else {
				ids.add(draft.id);
				id = draft.id;
			}
		}
		return { id, name, sortOrder: i + 1 };
	});
	const message = drafts.length > PERSON_MAX.teams ? `Keep it to ${PERSON_MAX.teams} teams or fewer.` : undefined;
	return { values, errors, message };
}

/** "Operations & Support" → "operations-support". Never one of RESERVED_SLUGS; '' for no letters. */
export function slugify(name: string): string {
	const slug = name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50)
		.replace(/-+$/g, '');
	return (RESERVED_SLUGS as readonly string[]).includes(slug) ? `${slug}-team` : slug;
}
