/**
 * Server side of the People admin: the queries the page needs, and the writes (each in a
 * transaction). People are ordered within their group (a team's members, the advisors, the
 * alumni), by sort order then name, the same order as the public People page.
 */
import { and, asc, count, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { readBool, readText } from '#lib/components/admin/form-data.ts';
import { diffRows, type Diff } from '#lib/components/admin/lists/rows.ts';
import { groupKey, slugify, type PersonDraft, type PersonValues, type TeamValues } from '#lib/components/admin/people/person-form.ts';
import { db } from '#lib/server/db/index.ts';
import { people, teams, type PersonKind } from '#lib/server/db/schema.ts';
import { NON_TEAM_SLUGS } from '#lib/server/queries/site.ts';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AdminTeam = { id: string; slug: string; name: string; sortOrder: number; count: number; isGroup: boolean };

export async function listTeams(): Promise<AdminTeam[]> {
	const rows = await db
		.select({ id: teams.id, slug: teams.slug, name: teams.name, sortOrder: teams.sortOrder, count: count(people.id) })
		.from(teams)
		.leftJoin(people, eq(people.teamId, teams.id))
		.groupBy(teams.id)
		.orderBy(asc(teams.sortOrder), asc(teams.name));
	return rows.map((row) => ({ ...row, isGroup: NON_TEAM_SLUGS.includes(row.slug) }));
}

export async function listPeople() {
	return db
		.select({
			id: people.id,
			name: people.name,
			role: people.role,
			kind: people.kind,
			teamId: people.teamId,
			isLead: people.isLead,
			featured: people.featured,
			cohort: people.cohort,
			photoUrl: people.photoUrl,
			profileUrl: people.profileUrl,
			visible: people.visible,
			sortOrder: people.sortOrder
		})
		.from(people)
		.orderBy(asc(people.sortOrder), asc(people.name));
}

/** What the edit sheet submitted. */
export function readPersonDraft(form: FormData): PersonDraft {
	const t = (name: string, max = 2000) => readText(form, name, { max });
	return {
		id: t('id', 60),
		name: t('name', 400),
		kind: t('kind', 20) as PersonKind,
		teamId: t('teamId', 60).replace(/^none$/, ''),
		role: t('role', 400),
		isLead: readBool(form, 'isLead'),
		featured: readBool(form, 'featured'),
		cohort: t('cohort', 20),
		profileUrl: t('profileUrl', 4000),
		photoUrl: t('photoUrl', 4000),
		visible: readBool(form, 'visible')
	};
}

export async function teamIds(): Promise<Set<string>> {
	const rows = await db.select({ id: teams.id }).from(teams);
	return new Set(rows.map((r) => r.id));
}

/** The SQL condition for everyone in a person's group. */
function inGroup(kind: PersonKind, teamId: string | null): SQL {
	if (kind === 'advisor') return eq(people.kind, 'advisor');
	if (kind === 'alumni') return eq(people.kind, 'alumni');
	return and(eq(people.kind, 'member'), teamId ? eq(people.teamId, teamId) : isNull(people.teamId)) as SQL;
}

async function nextSortOrder(tx: Tx, kind: PersonKind, teamId: string | null): Promise<number> {
	const [row] = await tx
		.select({ max: sql<number | null>`max(${people.sortOrder})` })
		.from(people)
		.where(inGroup(kind, teamId));
	return (row?.max ?? 0) + 1;
}

/** Add a person at the end of their group. Returns the new id. */
export async function createPerson(values: PersonValues): Promise<string> {
	return db.transaction(async (tx) => {
		const sortOrder = await nextSortOrder(tx, values.kind, values.teamId);
		const [row] = await tx.insert(people).values({ ...values, sortOrder }).returning({ id: people.id });
		return row.id;
	});
}

/**
 * Save a person. Moving them to another group (a new team, or member to alumni) puts them
 * at the end of it. Returns false when the person no longer exists.
 */
export async function updatePerson(id: string, values: PersonValues): Promise<boolean> {
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select({ kind: people.kind, teamId: people.teamId })
			.from(people)
			.where(eq(people.id, id))
			.for('update');
		if (!current) return false;
		const moved = groupKey(current.kind, current.teamId) !== groupKey(values.kind, values.teamId);
		const sortOrder = moved ? await nextSortOrder(tx, values.kind, values.teamId) : undefined;
		await tx
			.update(people)
			.set({ ...values, ...(sortOrder === undefined ? {} : { sortOrder }) })
			.where(eq(people.id, id));
		return true;
	});
}

export async function deletePerson(id: string): Promise<string | null> {
	const [row] = await db.delete(people).where(eq(people.id, id)).returning({ name: people.name });
	return row?.name ?? null;
}

/**
 * Move a person one place up or down within their group, renumbering the group 1..n so
 * equal sort orders can't make a move do nothing. Null when the person doesn't exist.
 */
export async function movePerson(
	id: string,
	direction: 'up' | 'down'
): Promise<{ name: string; moved: boolean } | null> {
	return db.transaction(async (tx) => {
		const [person] = await tx
			.select({ name: people.name, kind: people.kind, teamId: people.teamId })
			.from(people)
			.where(eq(people.id, id));
		if (!person) return null;
		const group = await tx
			.select({ id: people.id, sortOrder: people.sortOrder })
			.from(people)
			.where(inGroup(person.kind, person.teamId))
			.orderBy(asc(people.sortOrder), asc(people.name))
			.for('update');
		const index = group.findIndex((row) => row.id === id);
		const to = direction === 'up' ? index - 1 : index + 1;
		if (index < 0 || to < 0 || to >= group.length) return { name: person.name, moved: false };
		const order = group.map((row) => row.id);
		[order[index], order[to]] = [order[to], order[index]];
		const current = new Map(group.map((row) => [row.id, row.sortOrder]));
		for (const [i, rowId] of order.entries()) {
			if (current.get(rowId) !== i + 1) await tx.update(people).set({ sortOrder: i + 1 }).where(eq(people.id, rowId));
		}
		return { name: person.name, moved: true };
	});
}

export type TeamsResult =
	| { ok: false; status: number; message: string }
	| { ok: true; diff: Diff<TeamValues>; insertedIds: string[]; before: Map<string, string> };

/**
 * Save the teams list from the Manage teams dialog: add, rename, reorder, and delete the
 * teams nobody is in. One transaction; refuses to delete a team that still has people.
 */
export async function saveTeams(values: TeamValues[]): Promise<TeamsResult> {
	return db.transaction(async (tx): Promise<TeamsResult> => {
		const existing = await tx
			.select({ id: teams.id, name: teams.name, slug: teams.slug, sortOrder: teams.sortOrder })
			.from(teams)
			.orderBy(asc(teams.sortOrder), asc(teams.name))
			.for('update');
		const diff = diffRows(
			existing.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
			values
		);
		if (diff.missing.length) {
			return { ok: false, status: 409, message: 'Someone else changed the teams. Close the dialog, reload the page and try again.' };
		}
		if (diff.deletes.length) {
			const used = await tx
				.select({ teamId: people.teamId, n: count() })
				.from(people)
				.where(inArray(people.teamId, diff.deletes))
				.groupBy(people.teamId);
			const busy = used.find((row) => row.n > 0);
			if (busy) {
				const name = existing.find((t) => t.id === busy.teamId)?.name ?? 'that team';
				const who = busy.n === 1 ? '1 person' : `${busy.n} people`;
				return { ok: false, status: 400, message: `Move the ${who} in ${name} to another team before removing it.` };
			}
			await tx.delete(teams).where(inArray(teams.id, diff.deletes));
		}
		for (const { id, ...set } of diff.updates) await tx.update(teams).set(set).where(eq(teams.id, id));

		const insertedIds: string[] = [];
		if (diff.inserts.length) {
			const taken = new Set(existing.filter((t) => !diff.deletes.includes(t.id)).map((t) => t.slug));
			for (const team of diff.inserts) {
				const base = slugify(team.name) || 'team';
				let slug = base;
				for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
				taken.add(slug);
				const [row] = await tx.insert(teams).values({ ...team, slug }).returning({ id: teams.id });
				insertedIds.push(row.id);
			}
		}
		return { ok: true, diff, insertedIds, before: new Map(existing.map((t) => [t.id, t.name])) };
	});
}
