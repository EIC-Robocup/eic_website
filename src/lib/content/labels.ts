/**
 * Display labels and tones for the database enums, plus small formatting helpers.
 * Client safe: only type imports from the server schema.
 */
import type {
	EditorRole,
	MessageTopic,
	PersonKind,
	PostCategory,
	PostStatus,
	ProjectCategory,
	ProjectStatus
} from '#lib/server/db/schema.ts';

/** `success` = green (text-success / bg-success), `muted` = grey (text-ink-muted / bg-ink-muted). */
export type Tone = 'success' | 'muted';

/** Text and dot classes for a tone, e.g. the status line on project cards. */
export const TONE_CLASSES: Record<Tone, { text: string; dot: string }> = {
	success: { text: 'text-success', dot: 'bg-success' },
	muted: { text: 'text-ink-muted', dot: 'bg-ink-muted' }
};

export const POST_CATEGORY_LABELS = {
	competition: 'Competition',
	engineering: 'Engineering',
	research: 'Research',
	'club-life': 'Club life'
} as const satisfies Record<PostCategory, string>;

/** In the order of the Blog filters. */
export const POST_CATEGORY_OPTIONS = (Object.keys(POST_CATEGORY_LABELS) as PostCategory[]).map(
	(value) => ({ value, label: POST_CATEGORY_LABELS[value] })
);

export const POST_STATUS_LABELS = {
	draft: 'Draft',
	published: 'Published'
} as const satisfies Record<PostStatus, string>;

export const POST_STATUS_TONES = {
	draft: 'muted',
	published: 'success'
} as const satisfies Record<PostStatus, Tone>;

export const PROJECT_CATEGORY_LABELS = {
	robot: 'Robot',
	software: 'Software',
	research: 'Research'
} as const satisfies Record<ProjectCategory, string>;

/** Plural labels for the Projects page filters ("All", "Robots", "Software"). */
export const PROJECT_CATEGORY_FILTER_LABELS = {
	robot: 'Robots',
	software: 'Software',
	research: 'Research'
} as const satisfies Record<ProjectCategory, string>;

export const PROJECT_CATEGORY_OPTIONS = (Object.keys(PROJECT_CATEGORY_LABELS) as ProjectCategory[]).map(
	(value) => ({ value, label: PROJECT_CATEGORY_LABELS[value] })
);

export const PROJECT_STATUS_LABELS = {
	ongoing: 'Ongoing',
	active: 'Active',
	archived: 'Archived'
} as const satisfies Record<ProjectStatus, string>;

/** Ongoing and active projects show a green dot, archived ones grey. */
export const PROJECT_STATUS_TONES = {
	ongoing: 'success',
	active: 'success',
	archived: 'muted'
} as const satisfies Record<ProjectStatus, Tone>;

export const PROJECT_STATUS_OPTIONS = (Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(
	(value) => ({ value, label: PROJECT_STATUS_LABELS[value] })
);

export const PERSON_KIND_LABELS = {
	member: 'Member',
	advisor: 'Advisor',
	alumni: 'Alumni'
} as const satisfies Record<PersonKind, string>;

export const PERSON_KIND_OPTIONS = (Object.keys(PERSON_KIND_LABELS) as PersonKind[]).map((value) => ({
	value,
	label: PERSON_KIND_LABELS[value]
}));

/** Contact form "I am interested in" options, in the designed order. */
export const MESSAGE_TOPIC_LABELS = {
	joining: 'Joining the team',
	sponsorship: 'Sponsorship',
	research: 'Joint research',
	'open-source': 'Open source',
	other: 'Something else'
} as const satisfies Record<MessageTopic, string>;

export const MESSAGE_TOPIC_OPTIONS = (Object.keys(MESSAGE_TOPIC_LABELS) as MessageTopic[]).map(
	(value) => ({ value, label: MESSAGE_TOPIC_LABELS[value] })
);

export const EDITOR_ROLE_LABELS = {
	owner: 'Owner',
	editor: 'Editor'
} as const satisfies Record<EditorRole, string>;

/** Look up a label, falling back to the raw value for anything unknown. */
export function labelFor<K extends string>(labels: Record<K, string>, value: string | null | undefined): string {
	if (!value) return '';
	return (labels as Record<string, string>)[value] ?? value;
}

/* ------------------------------------------------------------------------- */
/* Placements and ordinals                                                    */
/* ------------------------------------------------------------------------- */

export type Placement = {
	/** "6" for "6th"; the whole text for non numeric placements ("Finalist"). */
	number: string;
	/** "th" for "6th"; empty for non numeric placements. */
	suffix: string;
	/** Anything after the ordinal, e.g. " of 24 teams" for "6th of 24 teams". */
	rest: string;
	numeric: boolean;
};

/**
 * Split a placement for the big numeral style ("6" + small "th").
 * splitPlacement('6th') -> { number: '6', suffix: 'th', rest: '', numeric: true }
 * splitPlacement('Finalist') -> { number: 'Finalist', suffix: '', rest: '', numeric: false }
 */
export function splitPlacement(placement: string | null | undefined): Placement {
	const text = (placement ?? '').trim();
	const match = /^(\d+)\s*(st|nd|rd|th)\b(.*)$/i.exec(text);
	if (match) return { number: match[1], suffix: match[2].toLowerCase(), rest: match[3], numeric: true };
	const bare = /^(\d+)$/.exec(text);
	if (bare) return { number: bare[1], suffix: ordinalSuffix(Number(bare[1])), rest: '', numeric: true };
	return { number: text, suffix: '', rest: '', numeric: false };
}

/** 1 -> 'st', 2 -> 'nd', 3 -> 'rd', 4 -> 'th', 11 -> 'th', 22 -> 'nd'. */
export function ordinalSuffix(n: number): string {
	const mod100 = Math.abs(n) % 100;
	if (mod100 >= 11 && mod100 <= 13) return 'th';
	switch (Math.abs(n) % 10) {
		case 1:
			return 'st';
		case 2:
			return 'nd';
		case 3:
			return 'rd';
		default:
			return 'th';
	}
}

/** 6 -> '6th'. */
export function ordinal(n: number): string {
	return `${n}${ordinalSuffix(n)}`;
}

/* ------------------------------------------------------------------------- */
/* People and dates                                                           */
/* ------------------------------------------------------------------------- */

const TITLE_PREFIX = /^(Assoc\.\s*Prof\.|Asst\.\s*Prof\.|Prof\.|Dr\.)\s*/i;

/** Initials for an avatar: the first letters of the first two words, without academic titles. */
export function initials(name: string): string {
	return name
		.replace(TITLE_PREFIX, '')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => Array.from(word)[0]?.toUpperCase() ?? '')
		.join('');
}

/** The line under a person's name: their role, or "<Team> team" when the role is empty. */
export function displayRole(role: string | null | undefined, teamName: string | null | undefined): string {
	if (role?.trim()) return role.trim();
	if (teamName) return `${teamName} team`;
	return '';
}

/** The club's time zone: dates are shown as they were in Bangkok. */
export const SITE_TIME_ZONE = 'Asia/Bangkok';

// Numeric parts only: ICU spells some short months differently ("Sept" in en-GB).
const dateParts = new Intl.DateTimeFormat('en-US', {
	day: 'numeric',
	month: 'numeric',
	year: 'numeric',
	timeZone: SITE_TIME_ZONE
});
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "8 Jul 2026", as the date was in Bangkok. Returns '' for an empty or invalid date. */
export function formatDate(value: Date | string | null | undefined): string {
	if (!value) return '';
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const parts = Object.fromEntries(dateParts.formatToParts(date).map((p) => [p.type, p.value]));
	return `${Number(parts.day)} ${MONTHS[Number(parts.month) - 1]} ${parts.year}`;
}
