import { requireEditor } from '#lib/server/auth.ts';
import { blankPost, loadEditorOptions, readPostForm, savePost } from '../posts.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const editor = requireEditor(locals);
	return { post: blankPost(editor), options: await loadEditorOptions(), now: new Date() };
};

export const actions = {
	save: async ({ request, locals }) => {
		const editor = requireEditor(locals);
		const read = await readPostForm(await request.formData());
		if (!read.ok) return read.failure;
		const result = await savePost(editor, null, read);
		if (!result.ok) return result.failure;
		// The page moves on to /admin/posts/<id> itself (so it can clear its local copy first).
		return { message: result.message, id: result.id, slug: result.slug };
	}
} satisfies Actions;
