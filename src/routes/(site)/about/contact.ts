/**
 * The contact form's fields, limits and validation. Client safe: the page runs the same
 * checks before sending (for instant inline errors) and the action runs them again.
 */
import { MESSAGE_TOPIC_LABELS } from '#lib/content/labels.ts';
import type { MessageTopic } from '#lib/server/db/schema.ts';

export const LIMITS = {
	name: 120,
	email: 254,
	messageMin: 10,
	messageMax: 5000
} as const;

/** Field names in the form, shared by the page and the action. */
export const FIELD = {
	name: 'name',
	email: 'email',
	topic: 'topic',
	message: 'message',
	/** Honeypot: hidden from people, tempting to bots. Anything in it means spam. */
	honeypot: 'website',
	/** Signed render time, see spam.server.ts. */
	token: 'token'
} as const;

export const TOPICS = Object.keys(MESSAGE_TOPIC_LABELS) as MessageTopic[];

export function isTopic(value: unknown): value is MessageTopic {
	return typeof value === 'string' && (TOPICS as string[]).includes(value);
}

export type ContactValues = { name: string; email: string; topic: string; message: string };
export type ContactField = keyof ContactValues;
export type ContactErrors = Partial<Record<ContactField, string>>;

/** The order errors are announced and focused in. */
export const FIELD_ORDER: ContactField[] = ['name', 'email', 'topic', 'message'];

// Pragmatic: one @, no spaces, a dot in the domain. The reply is the real test.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Read the four visible fields from submitted form data, trimmed. */
export function readValues(data: FormData): ContactValues {
	const get = (key: string) => {
		const value = data.get(key);
		return typeof value === 'string' ? value : '';
	};
	return {
		name: get(FIELD.name).trim(),
		email: get(FIELD.email).trim(),
		topic: get(FIELD.topic).trim(),
		// Keep the message's own line breaks; only trim the ends. Normalise CRLF so the
		// length matches what the person typed.
		message: get(FIELD.message).replace(/\r\n?/g, '\n').trim()
	};
}

/** Count characters the way people do (an emoji is one), not UTF-16 units. */
const length = (s: string) => Array.from(s).length;

export function validate(values: ContactValues): ContactErrors {
	const errors: ContactErrors = {};

	if (!values.name) errors.name = 'Enter your name.';
	else if (length(values.name) > LIMITS.name)
		errors.name = `Keep your name to ${LIMITS.name} characters or fewer.`;

	if (!values.email) errors.email = 'Enter your email address, so we can reply.';
	else if (values.email.length > LIMITS.email || !EMAIL.test(values.email))
		errors.email = 'Enter a valid email address, like name@example.com.';

	if (!isTopic(values.topic)) errors.topic = 'Pick what you are interested in.';

	const size = length(values.message);
	if (size === 0) errors.message = 'Write us a message.';
	else if (size < LIMITS.messageMin)
		errors.message = `Write at least ${LIMITS.messageMin} characters, so we know how to help.`;
	else if (size > LIMITS.messageMax)
		errors.message = `Keep the message to ${LIMITS.messageMax.toLocaleString('en-US')} characters or fewer.`;

	return errors;
}

/** What the action returns, as the page's `form` prop. */
export type ContactFailure = {
	values: ContactValues;
	errors: ContactErrors;
	/** A message for the whole form (rate limits, expired page, database down). */
	formError?: string;
	/** A fresh or still valid token for the next attempt. */
	token: string;
};
