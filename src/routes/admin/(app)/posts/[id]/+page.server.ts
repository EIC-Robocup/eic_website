import { error, fail, redirect } from '@sveltejs/kit';
import { readText } from '#lib/components/admin/form-data.ts';
import { requireEditor } from '#lib/server/auth.ts';
import { deletePost, loadEditorOptions, loadEditorPost, readPostForm, savePost } from '../posts.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requireEditor(locals);
	const [post, options] = await Promise.all([loadEditorPost(params.id), loadEditorOptions()]);
	if (!post) error(404, 'This post does not exist. It may have been deleted.');
	return { post, options, now: new Date() };
};

export const actions = {
	save: async ({ request, locals, params }) => {
		const editor = requireEditor(locals);
		const read = await readPostForm(await request.formData());
		if (!read.ok) return read.failure;
		const result = await savePost(editor, params.id, read);
		if (!result.ok) return result.failure;
		return { message: result.message, id: result.id, slug: result.slug };
	},
	delete: async ({ request, locals, params }) => {
		const editor = requireEditor(locals);
		const form = await request.formData();
		const id = readText(form, 'id');
		if (id !== params.id) return fail(400, { message: 'That is not this post. Reload the page and try again.' });
		const title = await deletePost(editor, id);
		if (title === null) return fail(404, { message: 'This post was already deleted.' });
		redirect(303, `/admin/posts?deleted=${encodeURIComponent(id)}`);
	}
} satisfies Actions;
