/**
 * Editable page sections.
 *
 * Each page is a list of sections. A section declares its fields (which drive the
 * admin "Pages" editor) and its defaults (the designed copy). Saved values live in
 * the `site_sections` table as JSON; anything missing or malformed falls back to
 * the default here, so the site always renders even on an empty database.
 *
 * Text fields may contain `{count}`-style placeholders that the page fills in
 * (see `fill`).
 */

export type ScalarField = { key: string; label: string; hint?: string } & (
	| { type: 'text'; placeholder?: string }
	| { type: 'textarea'; rows?: number }
	| { type: 'url'; placeholder?: string }
	| { type: 'toggle' }
);

export type Field =
	| ScalarField
	/** `{ label, href }` */
	| { key: string; label: string; hint?: string; type: 'link' }
	/** `{ url, alt }`. `url` may be empty: the page then shows a labelled image slot. */
	| { key: string; label: string; hint?: string; type: 'image' }
	/** `string[]` */
	| { key: string; label: string; hint?: string; type: 'tags' }
	/** Array of objects whose properties are the scalar sub-fields. */
	| {
			key: string;
			label: string;
			hint?: string;
			type: 'list';
			itemLabel: string;
			fields: ScalarField[];
			max?: number;
	  };

export type LinkValue = { label: string; href: string };
export type ImageValue = { url: string; alt: string };

export type SectionDef<D extends Record<string, unknown> = Record<string, unknown>> = {
	title: string;
	description?: string;
	/** Whether editors can switch the whole section off. */
	toggleable?: boolean;
	fields: Field[];
	defaults: D;
};

function section<D extends Record<string, unknown>>(def: SectionDef<D>): SectionDef<D> {
	return def;
}

const link = (label: string, href: string): LinkValue => ({ label, href });
const image = (url: string, alt: string): ImageValue => ({ url, alt });

/* Fields reused across hero sections */
const heroFields = (extra: Field[] = []): Field[] => [
	{ key: 'label', label: 'Label', type: 'text', hint: 'Red mono eyebrow above the headline.' },
	{ key: 'sublabel', label: 'Second label', type: 'text', hint: 'Grey mono text after the rule.' },
	{ key: 'headline', label: 'Headline', type: 'text' },
	...extra,
	{
		key: 'image',
		label: 'Photo',
		type: 'image',
		hint: 'Leave empty to show a labelled image slot until the photo exists.'
	},
	{ key: 'imageLabel', label: 'Image slot label', type: 'text', hint: 'Shown inside the empty slot, e.g. "Photo · the workshop".' },
	{ key: 'caption', label: 'Figure caption', type: 'text' },
	{ key: 'note', label: 'Handwritten note', type: 'text', hint: 'One short line in the Caveat hand. Leave empty to hide.' }
];

export const pages = {
	home: {
		title: 'Home',
		path: '/',
		sections: {
			hero: section({
				title: 'Hero',
				fields: heroFields([
					{ key: 'subline', label: 'Subline', type: 'text' },
					{ key: 'primaryCta', label: 'Main button', type: 'link' },
					{ key: 'secondaryCta', label: 'Second button', type: 'link' }
				]),
				defaults: {
					label: 'EIC Chula',
					sublabel: 'RoboCup@Home team',
					headline: 'Robots that help at home.',
					subline: 'Student robotics at Chulalongkorn University.',
					primaryCta: link('Meet Walkie 4', '/projects/walkie-4'),
					secondaryCta: link('Projects', '/projects'),
					image: image('', ''),
					imageLabel: 'Photo · Walkie 4 in action',
					caption: 'Walkie 4 at RoboCup@Home 2026',
					note: 'meet Walkie 4'
				}
			}),
			stats: section({
				title: 'Numbers',
				description: 'The strip of big numbers under the hero. The first one is the red highlight.',
				fields: [
					{
						key: 'items',
						label: 'Numbers',
						type: 'list',
						itemLabel: 'number',
						max: 4,
						fields: [
							{ key: 'value', label: 'Value', type: 'text', placeholder: '6th' },
							{ key: 'label', label: 'Label', type: 'text', placeholder: 'of 24 · RoboCup@Home 2026' }
						]
					}
				],
				defaults: {
					items: [
						{ value: '6th', label: 'of 24 · RoboCup@Home 2026' },
						{ value: '7 DOF', label: 'per arm · two arms' },
						{ value: 'Ø152', label: 'omni wheels · ×4' },
						{ value: '41', label: 'people · five teams' }
					]
				}
			}),
			featured: section({
				title: 'Featured project',
				description:
					'The big card shows the project marked "Feature on home page" in the Projects editor.',
				fields: [
					{ key: 'eyebrow', label: 'Section label', type: 'text' },
					{ key: 'chips', label: 'Chips on the card', type: 'tags', hint: 'Short subsystem names.' },
					{ key: 'cta', label: 'Card link text', type: 'text', placeholder: 'Explore Walkie 4 →' }
				],
				defaults: {
					eyebrow: 'Featured',
					chips: ['VLA + voice', '7 DOF arms', 'Lidar SLAM', 'Omni base'],
					cta: 'Explore {title} →'
				}
			}),
			olderRobots: section({
				title: 'Older robots',
				description: 'Three smaller cards for the next projects in the Projects order.',
				toggleable: true,
				fields: [],
				defaults: {}
			}),
			stories: section({
				title: 'Latest stories',
				description: 'Shows the three newest published posts.',
				toggleable: true,
				fields: [
					{ key: 'eyebrow', label: 'Section label', type: 'text' },
					{ key: 'heading', label: 'Heading', type: 'text' }
				],
				defaults: { eyebrow: 'From the lab', heading: 'Latest stories' }
			}),
			people: section({
				title: 'People strip',
				description: 'Shows people marked "Show on home page" (leadership and advisors).',
				toggleable: true,
				fields: [
					{ key: 'eyebrow', label: 'Section label', type: 'text' },
					{ key: 'heading', label: 'Heading', type: 'text', hint: '{count} becomes the number of people.' },
					{ key: 'cta', label: 'Button', type: 'link' }
				],
				defaults: {
					eyebrow: 'People',
					heading: '{count} people. One robot.',
					cta: link('Meet the team', '/people')
				}
			}),
			join: section({
				title: 'Join band',
				description: 'Red call to action above the footer.',
				toggleable: true,
				fields: [
					{ key: 'eyebrow', label: 'Label', type: 'text' },
					{ key: 'heading', label: 'Heading', type: 'text' },
					{ key: 'primaryCta', label: 'Main button', type: 'link' },
					{ key: 'secondaryCta', label: 'Second button', type: 'link' }
				],
				defaults: {
					eyebrow: 'Join us',
					heading: 'Build the next Walkie with us.',
					primaryCta: link('Join EIC', '/about#join'),
					secondaryCta: link('Partner with us', '/about#join')
				}
			})
		}
	},
	projects: {
		title: 'Projects',
		path: '/projects',
		sections: {
			hero: section({
				title: 'Hero',
				fields: heroFields([{ key: 'subline', label: 'Subline', type: 'text' }]),
				defaults: {
					label: 'Projects',
					sublabel: '{count} builds',
					headline: 'Built. Tested. Competed.',
					subline: 'Robots, code and papers.',
					image: image('', ''),
					imageLabel: 'Photo · the workshop',
					caption: 'Where the robots get built',
					note: 'measure twice, build once'
				}
			}),
			publications: section({
				title: 'Publications',
				description: 'Papers are edited under Achievements and lists.',
				toggleable: true,
				fields: [
					{ key: 'eyebrow', label: 'Section label', type: 'text' },
					{ key: 'heading', label: 'Heading', type: 'text' }
				],
				defaults: { eyebrow: 'Publications', heading: 'Papers' }
			})
		}
	},
	people: {
		title: 'People',
		path: '/people',
		sections: {
			hero: section({
				title: 'Hero',
				fields: heroFields(),
				defaults: {
					label: 'People',
					sublabel: '2026 team',
					headline: 'The team.',
					image: image('', ''),
					imageLabel: 'Photo · the 2026 team',
					caption: 'Team EIC Chula in Incheon',
					note: "that's us!"
				}
			}),
			alumni: section({
				title: 'Alumni band',
				toggleable: true,
				fields: [
					{ key: 'eyebrow', label: 'Label', type: 'text' },
					{ key: 'heading', label: 'Heading', type: 'text' },
					{ key: 'cta', label: 'Button', type: 'link' }
				],
				defaults: {
					eyebrow: 'Alumni',
					heading: 'Built a Walkie before?',
					cta: link('Add me as an alum', '/about#contact')
				}
			})
		}
	},
	blog: {
		title: 'Blog',
		path: '/blog',
		sections: {
			hero: section({
				title: 'Hero',
				fields: [
					{ key: 'label', label: 'Label', type: 'text' },
					{ key: 'sublabel', label: 'Second label', type: 'text' },
					{ key: 'headline', label: 'Headline', type: 'text' }
				],
				defaults: { label: 'Blog', sublabel: 'Lab notes', headline: 'Notes from the lab.' }
			})
		}
	},
	about: {
		title: 'About',
		path: '/about',
		sections: {
			hero: section({
				title: 'Hero',
				fields: heroFields([{ key: 'subline', label: 'Subline', type: 'text' }]),
				defaults: {
					label: 'About EIC',
					sublabel: 'Since 2006',
					headline: 'Students who build real robots.',
					subline: 'Engineering Innovator Club, Chulalongkorn University.',
					image: image(
						'/images/archive/robocup-2022-team.webp',
						'The EIC Chula team holding the EIC CHULA banner at RoboCup@Home 2022'
					),
					imageLabel: 'Photo · the team',
					caption: 'The RoboCup@Home 2022 team',
					note: "that's us!"
				}
			}),
			pillars: section({
				title: 'What we do',
				fields: [
					{
						key: 'items',
						label: 'Pillars',
						type: 'list',
						itemLabel: 'pillar',
						max: 3,
						fields: [
							{ key: 'title', label: 'Title', type: 'text' },
							{ key: 'text', label: 'Line', type: 'text' },
							{ key: 'linkLabel', label: 'Link text', type: 'text' },
							{ key: 'href', label: 'Link', type: 'url' }
						]
					}
				],
				defaults: {
					items: [
						{ title: 'Compete', text: 'Walkie at RoboCup@Home.', linkLabel: 'Meet Walkie 4 →', href: '/projects/walkie-4' },
						{ title: 'Research', text: "Papers with our advisors' labs.", linkLabel: 'See papers →', href: '/projects#publications' },
						{ title: 'Share', text: 'Our robot code is open source.', linkLabel: 'Browse GitHub →', href: 'https://github.com/robocup-eic' }
					]
				}
			}),
			achievements: section({
				title: 'Achievements',
				description: 'The timeline reads from Achievements and lists.',
				fields: [
					{ key: 'eyebrow', label: 'Section label', type: 'text' },
					{ key: 'heading', label: 'Heading', type: 'text' }
				],
				defaults: { eyebrow: 'Achievements', heading: 'Twenty years of competition' }
			}),
			archive: section({
				title: 'From the archive',
				description: 'Polaroids read from Achievements and lists.',
				toggleable: true,
				fields: [
					{ key: 'eyebrow', label: 'Section label', type: 'text' },
					{ key: 'heading', label: 'Heading', type: 'text' }
				],
				defaults: { eyebrow: 'From the archive', heading: 'Pinned to the lab wall' }
			}),
			join: section({
				title: 'Join EIC',
				fields: [
					{ key: 'eyebrow', label: 'Section label', type: 'text' },
					{ key: 'heading', label: 'Heading', type: 'text' },
					{ key: 'studentsLabel', label: 'Students: label', type: 'text' },
					{ key: 'studentsHeading', label: 'Students: heading', type: 'text' },
					{ key: 'studentsText', label: 'Students: line', type: 'text' },
					{ key: 'studentsCta', label: 'Students: button', type: 'link' },
					{ key: 'partnersLabel', label: 'Partners: label', type: 'text' },
					{ key: 'partnersHeading', label: 'Partners: heading', type: 'text' },
					{ key: 'partnersText', label: 'Partners: line', type: 'text' },
					{ key: 'partnersCta', label: 'Partners: button', type: 'link' }
				],
				defaults: {
					eyebrow: 'Join EIC',
					heading: 'Two ways in',
					studentsLabel: 'For students',
					studentsHeading: 'Build the next Walkie.',
					studentsText: 'Pick a team. Ship real work onto a real robot.',
					studentsCta: link('Tell us about you', '#contact'),
					partnersLabel: 'For partners',
					partnersHeading: 'Back a team that ships.',
					partnersText: 'Sponsorship, joint research, open source.',
					partnersCta: link('Start a conversation', '#contact')
				}
			}),
			sponsors: section({
				title: 'Supported by',
				description: 'Sponsor logos read from Achievements and lists. Hidden while there are none.',
				toggleable: true,
				fields: [{ key: 'heading', label: 'Label', type: 'text' }],
				defaults: { heading: 'Supported by' }
			}),
			contact: section({
				title: 'Contact',
				fields: [
					{ key: 'eyebrow', label: 'Section label', type: 'text' },
					{ key: 'heading', label: 'Heading', type: 'text' },
					{ key: 'address', label: 'Where to find us', type: 'text' },
					{ key: 'personName', label: 'Contact person', type: 'text' },
					{ key: 'personEmail', label: 'Contact email', type: 'text' },
					{ key: 'formEnabled', label: 'Show the message form', type: 'toggle' }
				],
				defaults: {
					eyebrow: 'Contact',
					heading: 'Come say hi',
					address: 'Engineering Building 1 · Chulalongkorn University',
					personName: 'Taratorn Assawadejmetakul',
					personEmail: 'chula.intania.eic@gmail.com',
					formEnabled: true
				}
			})
		}
	},
	site: {
		title: 'Footer and contact',
		path: '/',
		sections: {
			nav: section({
				title: 'Navigation',
				fields: [{ key: 'cta', label: 'Button', type: 'link' }],
				defaults: { cta: link('Join EIC', '/about#join') }
			}),
			footer: section({
				title: 'Footer',
				fields: [
					{ key: 'tagline', label: 'Tagline', type: 'text' },
					{ key: 'email', label: 'Email', type: 'text' },
					{ key: 'address', label: 'Address', type: 'text' },
					{ key: 'facebook', label: 'Facebook', type: 'url' },
					{ key: 'instagram', label: 'Instagram', type: 'url' },
					{ key: 'github', label: 'GitHub', type: 'url' },
					{ key: 'thaiName', label: 'Thai name', type: 'text' },
					{ key: 'coordinates', label: 'Coordinates', type: 'text' }
				],
				defaults: {
					tagline: 'Engineering Innovator Club, Chulalongkorn University.',
					email: 'chula.intania.eic@gmail.com',
					address: 'Engineering Building 1, Chulalongkorn University, Bangkok',
					facebook: 'https://www.facebook.com/eicchulalongkorn',
					instagram: 'https://www.instagram.com/walkie_eic/',
					github: 'https://github.com/robocup-eic',
					thaiName: 'ชมรมนักประดิษฐ์วิศวกรรม',
					coordinates: '13°44′N 100°31′E'
				}
			})
		}
	}
} satisfies Record<string, { title: string; path: string; sections: Record<string, SectionDef> }>;

export type Pages = typeof pages;
export type PageKey = keyof Pages;
export type SectionKey<P extends PageKey> = keyof Pages[P]['sections'] & string;
export type SectionData<P extends PageKey, S extends SectionKey<P>> =
	Pages[P]['sections'][S] extends SectionDef<infer D> ? D : never;

/** A resolved section: saved values merged over defaults. */
export type Resolved<D> = { enabled: boolean; data: D };

export type ResolvedPage<P extends PageKey> = {
	[S in SectionKey<P>]: Resolved<SectionData<P, S>>;
};

export const PAGE_KEYS = Object.keys(pages) as PageKey[];

export function isPageKey(value: string): value is PageKey {
	return Object.hasOwn(pages, value);
}

export function getSectionDef(page: PageKey, key: string): SectionDef | undefined {
	const sections = pages[page].sections as Record<string, SectionDef>;
	return Object.hasOwn(sections, key) ? sections[key] : undefined;
}

/* ---------- Coercion: unknown JSON -> section data, never throws ---------- */

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback: string, max = 2000): string =>
	typeof v === 'string' ? v.slice(0, max) : fallback;

/** Allow only http(s), mailto, tel, site-relative paths and in-page anchors. */
export function safeHref(v: string): string {
	const value = v.trim();
	if (value === '') return '';
	if (value.startsWith('/') && !value.startsWith('//')) return value;
	if (value.startsWith('#')) return value;
	if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
	return '';
}

function coerceScalar(field: ScalarField, value: unknown, fallback: unknown): unknown {
	switch (field.type) {
		case 'toggle':
			return typeof value === 'boolean' ? value : Boolean(fallback);
		case 'url':
			return typeof value === 'string' ? safeHref(value.slice(0, 2000)) : fallback;
		case 'text':
			return str(value, String(fallback ?? ''), 500);
		case 'textarea':
			return str(value, String(fallback ?? ''), 5000);
	}
}

function coerceField(field: Field, value: unknown, fallback: unknown): unknown {
	switch (field.type) {
		case 'link': {
			const fb = (isRecord(fallback) ? fallback : { label: '', href: '' }) as LinkValue;
			if (!isRecord(value)) return fb;
			return {
				label: str(value.label, fb.label, 200),
				href: typeof value.href === 'string' ? safeHref(value.href.slice(0, 2000)) : fb.href
			};
		}
		case 'image': {
			const fb = (isRecord(fallback) ? fallback : { url: '', alt: '' }) as ImageValue;
			if (!isRecord(value)) return fb;
			return {
				url: typeof value.url === 'string' ? safeHref(value.url.slice(0, 2000)) : fb.url,
				alt: str(value.alt, fb.alt, 500)
			};
		}
		case 'tags': {
			if (!Array.isArray(value)) return fallback;
			return value
				.filter((t): t is string => typeof t === 'string')
				.map((t) => t.trim().slice(0, 60))
				.filter(Boolean)
				.slice(0, 20);
		}
		case 'list': {
			if (!Array.isArray(value)) return fallback;
			const items = value.filter(isRecord).slice(0, field.max ?? 50);
			return items.map((item) => {
				const out: Record<string, unknown> = {};
				for (const sub of field.fields) {
					const empty = sub.type === 'toggle' ? false : '';
					out[sub.key] = coerceScalar(sub, item[sub.key], empty);
				}
				return out;
			});
		}
		default:
			return coerceScalar(field, value, fallback);
	}
}

/**
 * Merge saved JSON over a section's defaults. Unknown keys are dropped and every
 * value is coerced to its field type, so the result always matches the defaults' shape.
 */
export function resolveSection<D extends Record<string, unknown>>(
	def: SectionDef<D>,
	saved?: { data?: unknown; enabled?: boolean } | null
): Resolved<D> {
	const data: Record<string, unknown> = { ...def.defaults };
	const raw = isRecord(saved?.data) ? saved.data : {};
	for (const field of def.fields) {
		if (Object.hasOwn(raw, field.key)) {
			data[field.key] = coerceField(field, raw[field.key], def.defaults[field.key]);
		}
	}
	return {
		enabled: def.toggleable ? (saved?.enabled ?? true) : true,
		data: data as D
	};
}

/** Validate an editor's submission for a section. Returns clean data to store. */
export function cleanSectionInput(def: SectionDef, input: unknown): Record<string, unknown> {
	const raw = isRecord(input) ? input : {};
	const out: Record<string, unknown> = {};
	for (const field of def.fields) {
		out[field.key] = coerceField(field, raw[field.key], def.defaults[field.key]);
	}
	return out;
}

/** Replace `{name}` placeholders, e.g. fill('{count} builds', { count: 6 }). */
export function fill(text: string, values: Record<string, string | number>): string {
	return text.replace(/\{(\w+)\}/g, (match, name: string) =>
		Object.hasOwn(values, name) ? String(values[name]) : match
	);
}
