/**
 * Where a media file is used: every text column and JSON field that can hold a file URL,
 * searched for the object path (so plain, transformed and resized URLs all match).
 */
import { sql } from 'drizzle-orm';
import { pages, isPageKey } from '#lib/content/sections.ts';
import { db } from '#lib/server/db/index.ts';
import {
	archivePhotos,
	people,
	posts,
	projects,
	publications,
	siteSections,
	sponsors
} from '#lib/server/db/schema.ts';

export type MediaUse = {
	/** "Project", "Post", "Page"... */
	kind: string;
	/** The item's name, e.g. "Walkie 4" or "Home · Hero". */
	label: string;
	/** Where in the item, e.g. "cover", "gallery", "post body". */
	where: string;
	/** The admin page to fix it on, when there is one. */
	href: string | null;
};

const has = (column: unknown, needle: string) => sql`strpos(coalesce(${column}::text, ''), ${needle}) > 0`;
const contains = (value: string | null | undefined, needle: string) => Boolean(value && value.includes(needle));

export async function findMediaUses(path: string): Promise<MediaUse[]> {
	const needle = path;
	const [projectRows, postRows, peopleRows, sectionRows, archiveRows, sponsorRows, paperRows] = await Promise.all([
		db
			.select({
				id: projects.id,
				title: projects.title,
				coverUrl: projects.coverUrl,
				paperUrl: projects.paperUrl,
				linkUrl: projects.linkUrl,
				gallery: sql<string>`${projects.gallery}::text`
			})
			.from(projects)
			.where(
				sql`${has(projects.coverUrl, needle)} or ${has(projects.paperUrl, needle)} or ${has(projects.linkUrl, needle)} or ${has(projects.repoUrl, needle)} or ${has(projects.gallery, needle)}`
			),
		db
			.select({ id: posts.id, title: posts.title, coverUrl: posts.coverUrl })
			.from(posts)
			.where(sql`${has(posts.coverUrl, needle)} or ${has(posts.body, needle)}`),
		db.select({ id: people.id, name: people.name }).from(people).where(has(people.photoUrl, needle)),
		db
			.select({ page: siteSections.page, key: siteSections.key })
			.from(siteSections)
			.where(has(siteSections.data, needle)),
		db
			.select({ id: archivePhotos.id, caption: archivePhotos.caption })
			.from(archivePhotos)
			.where(has(archivePhotos.imageUrl, needle)),
		db.select({ id: sponsors.id, name: sponsors.name }).from(sponsors).where(has(sponsors.logoUrl, needle)),
		db.select({ id: publications.id, title: publications.title }).from(publications).where(has(publications.url, needle))
	]);

	const uses: MediaUse[] = [];
	for (const p of projectRows) {
		const where = [
			contains(p.coverUrl, needle) && 'cover',
			contains(p.gallery, needle) && 'gallery',
			contains(p.paperUrl, needle) && 'paper',
			contains(p.linkUrl, needle) && 'card link'
		].filter(Boolean);
		uses.push({ kind: 'Project', label: p.title, where: where.join(', ') || 'links', href: `/admin/projects/${p.id}` });
	}
	for (const p of postRows) {
		uses.push({
			kind: 'Post',
			label: p.title,
			where: contains(p.coverUrl, needle) ? 'cover' : 'post body',
			href: `/admin/posts/${p.id}`
		});
	}
	for (const p of peopleRows) uses.push({ kind: 'Person', label: p.name, where: 'photo', href: '/admin/people' });
	for (const s of sectionRows) {
		const page = isPageKey(s.page) ? pages[s.page] : null;
		const section = page ? (page.sections as Record<string, { title: string }>)[s.key] : null;
		uses.push({
			kind: 'Page',
			label: page ? `${page.title} · ${section?.title ?? s.key}` : `${s.page} · ${s.key}`,
			where: 'section',
			href: page ? `/admin/pages/${s.page}` : null
		});
	}
	for (const a of archiveRows) {
		uses.push({ kind: 'Archive photo', label: a.caption || 'Untitled photo', where: 'About page', href: '/admin/lists' });
	}
	for (const s of sponsorRows) uses.push({ kind: 'Sponsor', label: s.name, where: 'logo', href: '/admin/lists' });
	for (const p of paperRows) uses.push({ kind: 'Paper', label: p.title, where: 'link', href: '/admin/lists' });
	return uses;
}
