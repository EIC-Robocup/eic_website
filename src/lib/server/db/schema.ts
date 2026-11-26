/**
 * Database schema: the single source of truth for the EIC Chula database.
 *
 * `pnpm db:generate` turns changes here into SQL migrations in supabase/migrations,
 * which the Supabase GitHub integration (or `pnpm db:migrate`) applies.
 *
 * Every table has row level security enabled and no policies. The site reads and
 * writes through a direct Postgres connection on the server (which bypasses RLS),
 * so Supabase's public Data API cannot read or change any of these tables.
 */
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp('updated_at', { withTimezone: true })
	.notNull()
	.defaultNow()
	.$onUpdate(() => new Date());

export const EDITOR_ROLES = ['owner', 'editor'] as const;
export type EditorRole = (typeof EDITOR_ROLES)[number];

/** People allowed into the admin panel. Sign in works only for emails listed here. */
export const editors = pgTable(
	'editors',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** Always stored lower case. */
		email: text('email').notNull().unique(),
		name: text('name'),
		role: text('role', { enum: EDITOR_ROLES }).notNull().default('editor'),
		/** Supabase auth user id, filled in on first sign in. */
		userId: uuid('user_id'),
		invitedBy: text('invited_by'),
		lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
		createdAt,
		updatedAt
	},
	(t) => [check('editors_role_check', sql`${t.role} in ('owner', 'editor')`)]
).enableRLS();

/** Teams on the People page, in display order. */
export const teams = pgTable('teams', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt,
	updatedAt
}).enableRLS();

export const PERSON_KINDS = ['member', 'advisor', 'alumni'] as const;
export type PersonKind = (typeof PERSON_KINDS)[number];

export const people = pgTable(
	'people',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		/** Shown under the name. Empty means "<team> team". */
		role: text('role'),
		kind: text('kind', { enum: PERSON_KINDS }).notNull().default('member'),
		teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
		/** Leads get their role in brand red. */
		isLead: boolean('is_lead').notNull().default(false),
		/** Shown in the People strip on the home page. */
		featured: boolean('featured').notNull().default(false),
		/** Year the person joined. */
		cohort: integer('cohort'),
		photoUrl: text('photo_url'),
		profileUrl: text('profile_url'),
		visible: boolean('visible').notNull().default(true),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt,
		updatedAt
	},
	(t) => [
		check('people_kind_check', sql`${t.kind} in ('member', 'advisor', 'alumni')`),
		index('people_team_idx').on(t.teamId)
	]
).enableRLS();

export const PROJECT_CATEGORIES = ['robot', 'software', 'research'] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];
export const PROJECT_STATUSES = ['ongoing', 'active', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectSystem = { title: string; description: string };
export type ProjectPart = { qty: string; part: string; note: string };
export type GalleryImage = { url: string; alt: string; caption: string };

export const projects = pgTable(
	'projects',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull().unique(),
		title: text('title').notNull(),
		category: text('category', { enum: PROJECT_CATEGORIES }).notNull().default('robot'),
		/** First (or only) year. */
		year: integer('year'),
		/** Last year, for projects that ran several years ("2006 to 2008"). */
		yearEnd: integer('year_end'),
		status: text('status', { enum: PROJECT_STATUSES }).notNull().default('ongoing'),
		/** Short line under the title, e.g. "Listens. Navigates. Grasps." */
		tagline: text('tagline'),
		/** One line used on cards and in meta descriptions. */
		summary: text('summary'),
		event: text('event'),
		place: text('place'),
		result: text('result'),
		teamSize: integer('team_size'),
		/** Big numeral beside the hero photo, e.g. "6th". */
		highlightValue: text('highlight_value'),
		/** Mono caption under the numeral, e.g. "RoboCup@Home 2026 · Incheon". */
		highlightLabel: text('highlight_label'),
		/** Handwritten note next to the numeral, e.g. "of 24 teams!". */
		highlightNote: text('highlight_note'),
		coverUrl: text('cover_url'),
		coverAlt: text('cover_alt'),
		coverCaption: text('cover_caption'),
		tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
		systems: jsonb('systems').$type<ProjectSystem[]>().notNull().default([]),
		parts: jsonb('parts').$type<ProjectPart[]>().notNull().default([]),
		software: text('software').array().notNull().default(sql`'{}'::text[]`),
		gallery: jsonb('gallery').$type<GalleryImage[]>().notNull().default([]),
		/** When set, cards link here instead of the project page (e.g. a GitHub repo). */
		linkUrl: text('link_url'),
		repoUrl: text('repo_url'),
		paperUrl: text('paper_url'),
		/** Listed on the Projects page. */
		published: boolean('published').notNull().default(true),
		/** Big card on the home page. */
		featured: boolean('featured').notNull().default(false),
		showGallery: boolean('show_gallery').notNull().default(true),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt,
		updatedAt
	},
	(t) => [
		check('projects_category_check', sql`${t.category} in ('robot', 'software', 'research')`),
		check('projects_status_check', sql`${t.status} in ('ongoing', 'active', 'archived')`)
	]
).enableRLS();

export const POST_CATEGORIES = ['competition', 'engineering', 'research', 'club-life'] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];
export const POST_STATUSES = ['draft', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const posts = pgTable(
	'posts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull().unique(),
		title: text('title').notNull(),
		excerpt: text('excerpt'),
		/** Markdown. Rendered and sanitised on the server. */
		body: text('body').notNull().default(''),
		category: text('category', { enum: POST_CATEGORIES }).notNull().default('engineering'),
		/** Byline, e.g. "AI Team" or a person's name. */
		authorName: text('author_name'),
		status: text('status', { enum: POST_STATUSES }).notNull().default('draft'),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		coverUrl: text('cover_url'),
		coverAlt: text('cover_alt'),
		coverCaption: text('cover_caption'),
		tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
		projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
		/** The big card at the top of the Blog page. */
		featured: boolean('featured').notNull().default(false),
		updatedBy: text('updated_by'),
		createdAt,
		updatedAt
	},
	(t) => [
		check(
			'posts_category_check',
			sql`${t.category} in ('competition', 'engineering', 'research', 'club-life')`
		),
		check('posts_status_check', sql`${t.status} in ('draft', 'published')`),
		index('posts_status_published_idx').on(t.status, t.publishedAt)
	]
).enableRLS();

export const publications = pgTable('publications', {
	id: uuid('id').primaryKey().defaultRandom(),
	year: integer('year').notNull(),
	title: text('title').notNull(),
	venue: text('venue'),
	authors: text('authors'),
	url: text('url'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt,
	updatedAt
}).enableRLS();

export const achievements = pgTable('achievements', {
	id: uuid('id').primaryKey().defaultRandom(),
	year: integer('year').notNull(),
	/** e.g. "6th", "1st", "Finalist". */
	placement: text('placement').notNull(),
	/** Full name, e.g. "RoboCup@Home Open League". */
	competition: text('competition').notNull(),
	/** Short label on the timeline, e.g. "@Home". */
	shortName: text('short_name'),
	location: text('location'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt,
	updatedAt
}).enableRLS();

/** Polaroid photos in the About page's "From the archive" section. */
export const archivePhotos = pgTable('archive_photos', {
	id: uuid('id').primaryKey().defaultRandom(),
	imageUrl: text('image_url').notNull(),
	alt: text('alt').notNull().default(''),
	caption: text('caption'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt,
	updatedAt
}).enableRLS();

export const sponsors = pgTable('sponsors', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	logoUrl: text('logo_url'),
	url: text('url'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt,
	updatedAt
}).enableRLS();

/** Files uploaded through the admin panel into the Supabase Storage "media" bucket. */
export const media = pgTable('media', {
	id: uuid('id').primaryKey().defaultRandom(),
	/** Object path inside the bucket. */
	path: text('path').notNull().unique(),
	url: text('url').notNull(),
	filename: text('filename').notNull(),
	mimeType: text('mime_type').notNull(),
	size: integer('size').notNull(),
	alt: text('alt').notNull().default(''),
	uploadedBy: text('uploaded_by'),
	createdAt
}).enableRLS();

/**
 * Editable copy and switches for each page section. `data` is validated against the
 * section's field definitions in src/lib/content/sections.ts; missing keys fall back
 * to the defaults defined there.
 */
export const siteSections = pgTable(
	'site_sections',
	{
		page: text('page').notNull(),
		key: text('key').notNull(),
		data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
		enabled: boolean('enabled').notNull().default(true),
		updatedBy: text('updated_by'),
		updatedAt
	},
	(t) => [primaryKey({ columns: [t.page, t.key] })]
).enableRLS();

export const MESSAGE_TOPICS = ['joining', 'sponsorship', 'research', 'open-source', 'other'] as const;
export type MessageTopic = (typeof MESSAGE_TOPICS)[number];

/** Submissions from the contact form on the About page. Read in the admin Inbox. */
export const messages = pgTable(
	'messages',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		email: text('email').notNull(),
		topic: text('topic', { enum: MESSAGE_TOPICS }).notNull().default('other'),
		body: text('body').notNull(),
		readAt: timestamp('read_at', { withTimezone: true }),
		archived: boolean('archived').notNull().default(false),
		createdAt
	},
	(t) => [
		check(
			'messages_topic_check',
			sql`${t.topic} in ('joining', 'sponsorship', 'research', 'open-source', 'other')`
		),
		index('messages_created_idx').on(t.createdAt)
	]
).enableRLS();

/** Feed for "Recent edits" on the admin dashboard. */
export const activity = pgTable(
	'activity',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id'),
		label: text('label').notNull(),
		action: text('action').notNull(),
		actorEmail: text('actor_email'),
		actorName: text('actor_name'),
		createdAt
	},
	(t) => [index('activity_created_idx').on(t.createdAt)]
).enableRLS();

export type Editor = typeof editors.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Publication = typeof publications.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type ArchivePhoto = typeof archivePhotos.$inferSelect;
export type Sponsor = typeof sponsors.$inferSelect;
export type Media = typeof media.$inferSelect;
export type SiteSection = typeof siteSections.$inferSelect;
export type Activity = typeof activity.$inferSelect;
export type Message = typeof messages.$inferSelect;
