import { fail } from '@sveltejs/kit';
import { and, count, gt, sql } from 'drizzle-orm';
import { getPageSections } from '#lib/server/content.ts';
import { db } from '#lib/server/db/index.ts';
import { MESSAGE_TOPICS, messages, type MessageTopic } from '#lib/server/db/schema.ts';
import { listAchievements, listArchivePhotos, listSponsors } from '#lib/server/queries/site.ts';
import { FIELD, readValues, validate, type ContactFailure } from './contact.ts';
import { checkToken, isRateLimited, issueToken, recordSend } from './spam.server.ts';
import type { Actions, PageServerLoad } from './$types';

/** Messages one email address may send in a day. */
const EMAIL_DAILY_MAX = 20;

/** A list the page can live without: log the error and show nothing. */
async function optional<T>(label: string, read: () => Promise<T[]>): Promise<T[]> {
	try {
		return await read();
	} catch (err) {
		console.error(`About page: could not load ${label}`, err);
		return [];
	}
}

export const load: PageServerLoad = async () => {
	const [sections, achievements, archive, sponsors, token] = await Promise.all([
		getPageSections('about'),
		optional('achievements', listAchievements),
		optional('archive photos', listArchivePhotos),
		optional('sponsors', listSponsors),
		issueToken()
	]);

	return {
		sections,
		achievements: achievements.map((a) => ({
			id: a.id,
			year: a.year,
			placement: a.placement,
			competition: a.competition,
			shortName: a.shortName,
			location: a.location
		})),
		archive: sections.archive.enabled
			? archive.map((p) => ({ id: p.id, imageUrl: p.imageUrl, alt: p.alt, caption: p.caption }))
			: [],
		sponsors: sections.sponsors.enabled
			? sponsors.map((s) => ({ id: s.id, name: s.name, logoUrl: s.logoUrl, url: s.url }))
			: [],
		token
	};
};

function clientAddress(getClientAddress: () => string): string {
	try {
		return getClientAddress() || 'unknown';
	} catch {
		return 'unknown';
	}
}

export const actions = {
	default: async ({ request, getClientAddress }) => {
		const data = await request.formData();
		const values = readValues(data);
		const submitted = data.get(FIELD.token);
		const token = typeof submitted === 'string' ? submitted : '';

		const failure = async (status: number, body: Omit<ContactFailure, 'values' | 'token'>, keepToken = true) =>
			fail(status, {
				...body,
				values,
				token: keepToken ? token : await issueToken()
			} satisfies ContactFailure);

		// Honeypot filled in: pretend it worked so the bot moves on.
		const trap = data.get(FIELD.honeypot);
		if (typeof trap === 'string' && trap.trim() !== '') return { success: true as const };

		const contact = await getPageSections('about').then((s) => s.contact.data);
		if (!contact.formEnabled) {
			return failure(403, {
				errors: {},
				formError: contact.personEmail
					? `The form is switched off for now. Email us at ${contact.personEmail}.`
					: 'The form is switched off for now.'
			});
		}

		const tokenCheck = await checkToken(token);
		if (tokenCheck === 'too-fast') {
			return failure(400, {
				errors: {},
				formError: 'That was quick. Wait a few seconds, then send it again.'
			});
		}
		if (tokenCheck !== 'ok') {
			return failure(
				400,
				{
					errors: {},
					formError:
						tokenCheck === 'expired'
							? 'This page was open for a long time. Wait a few seconds, then send it again.'
							: 'We could not check this form. Wait a few seconds, then send it again.'
				},
				false
			);
		}

		const errors = validate(values);
		if (Object.keys(errors).length > 0) return failure(400, { errors });
		const topic = values.topic as MessageTopic;
		if (!MESSAGE_TOPICS.includes(topic)) return failure(400, { errors: { topic: 'Pick what you are interested in.' } });

		const ip = clientAddress(getClientAddress);
		const tooMany = {
			errors: {},
			formError: 'You have sent a lot of messages in a short time. Please try again later.'
		};
		if (isRateLimited(ip)) return failure(429, tooMany);

		try {
			const [{ sent }] = await db
				.select({ sent: count() })
				.from(messages)
				.where(
					and(
						sql`lower(${messages.email}) = ${values.email.toLowerCase()}`,
						gt(messages.createdAt, sql`now() - interval '1 day'`)
					)
				);
			if (sent >= EMAIL_DAILY_MAX) return failure(429, tooMany);

			await db.insert(messages).values({
				name: values.name,
				email: values.email,
				topic,
				body: values.message
			});
		} catch (err) {
			console.error('Contact form: could not save the message', err);
			return failure(503, {
				errors: {},
				formError: contact.personEmail
					? `We could not send your message just now. Try again in a minute, or email us at ${contact.personEmail}.`
					: 'We could not send your message just now. Try again in a minute.'
			});
		}

		recordSend(ip);
		return { success: true as const };
	}
} satisfies Actions;
