# Admin building blocks

Everything an admin page needs, styled for the EIC admin designs (`AdminNav`, `AdminPosts`,
`AdminPostEdit`, `AdminProjectEdit`, `AdminPeople`, `AdminLists`, `AdminPages`). Pages live in
`src/routes/admin/(app)/` and render inside the shell from `(app)/+layout.svelte`: sidebar,
mobile top bar, a 1200px content column with padding and `gap-6` between children, and the
`<Toaster />`. Don't add another `<main>`, Toaster or page padding.

Import with the extension: `#lib/components/admin/PageHeader.svelte`,
`#lib/components/admin/form.svelte.ts`, `#lib/components/admin/styles.ts`.

## 1. Page anatomy

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { Input } from '#lib/components/ui/input/index.js';
  import AdminButton from '#lib/components/admin/AdminButton.svelte';
  import FormField from '#lib/components/admin/FormField.svelte';
  import PageHeader from '#lib/components/admin/PageHeader.svelte';
  import Panel from '#lib/components/admin/Panel.svelte';
  import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
  import { AdminForm } from '#lib/components/admin/form.svelte.ts';
  import { inputClass } from '#lib/components/admin/styles.ts';
  import type { PageProps } from './$types';

  const { data }: PageProps = $props();
  const save = new AdminForm({ success: 'Project saved.' });
</script>

<form method="POST" action="?/save" use:enhance={save.submit} class="contents">
  <PageHeader back={{ label: 'Projects', href: '/admin/projects' }} title={data.project.title} size="md">
    {#snippet badge()}<StatusBadge status={data.project.published ? 'published' : 'draft'} />{/snippet}
    {#snippet actions()}
      <AdminButton variant="outline" href="/projects/{data.project.slug}" external>Preview</AdminButton>
      <AdminButton type="submit" pending={save.pending}>Save project</AdminButton>
    {/snippet}
  </PageHeader>

  <div class="flex flex-wrap items-start gap-6">
    <div class="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
      <Panel title="Basics">
        <FormField label="Title" error={save.errors.title}>
          {#snippet children(attrs)}
            <Input {...attrs} name="title" value={data.project.title} class={inputClass} required />
          {/snippet}
        </FormField>
      </Panel>
    </div>
    <aside class="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
      <Panel title="Visibility" size="sm" padding="sm">...</Panel>
    </aside>
  </div>
</form>
```

- Main column + aside: `flex flex-wrap` with `flex-[999_1_520px]` / `flex-[1_1_300px]` (the
  designs' layout). It stacks by itself on phones; nothing may overflow at 360px.
- Wide tables: put them in `<Panel padding="none">` with an inner `overflow-x-auto` wrapper.
- `PageHeader` sets `<title>` to "Title · EIC Admin". Breadcrumbs follow the sidebar groups:
  `[{ label: 'Content' }, { label: 'Posts' }]`, `[{ label: 'Site' }, { label: 'Pages' }]`.
- A `<form>` can wrap the header so the header's submit button saves (as above), or put the
  buttons inside the form. Several forms on one page each get their own `new AdminForm()`.

## 2. Actions: the contract

Every load and action starts with `requireEditor(locals)` (or `requireOwner`). Validate on the
server. Then:

| Outcome | Return | What the page shows |
| --- | --- | --- |
| Validation problem | `return fail(400, { message: 'Check the highlighted fields.', errors: { title: 'Add a title.' } })` | red toast with `message`, `errors.title` under the field, values kept |
| Saved | `return { message: 'Project saved.' }` | green toast, page data refreshed, values kept |
| Created / deleted, go elsewhere | `redirect(303, '/admin/posts/' + id)` | toast from the `success` option (if a string), then navigates |
| Not allowed / broken | `error(403, 'Only owners can do this.')` (thrown) | red toast; the page stays as it was |

- `errors` keys are the field `name`s. `message` is one plain sentence (no dashes).
- Call `logActivity(editor, { entityType, entityId, label, action })` after every create,
  update and delete (`action`: 'created' | 'updated' | 'deleted' | 'published').
- Never return secrets or whole DB rows you don't need in `data`/`form`.

```ts
// +page.server.ts
import { fail } from '@sveltejs/kit';
import { requireEditor } from '#lib/server/auth.ts';
import { logActivity } from '#lib/server/activity.ts';
import { readBool, readImage, readRows, readTags, readText } from '#lib/components/admin/form-data.ts';

export const actions = {
  save: async ({ request, locals, params }) => {
    const editor = requireEditor(locals);
    const form = await request.formData();
    const title = readText(form, 'title', { max: 200 });
    const cover = readImage(form, 'cover');
    const errors: Record<string, string> = {};
    if (!title) errors.title = 'Add a title.';
    if (cover.invalid) errors.cover = 'Use an https:// link or upload the image.';
    if (Object.keys(errors).length) return fail(400, { message: 'Check the highlighted fields.', errors });
    // ... update, then:
    await logActivity(editor, { entityType: 'project', entityId: params.id, label: title, action: 'updated' });
    return { message: 'Project saved.' };
  }
} satisfies Actions;
```

## 3. Submitting: `AdminForm` and `toastEnhance`

`new AdminForm(options)` (form.svelte.ts) gives you `submit` (for `use:enhance`), `pending`,
`errors`, `message`, `error(field)` and `clear()`. Options (all optional, see enhance.ts):

- `success`: toast text, a function of the returned data, or `false`. Default: the action's
  `message`, else "Saved.". Shown before a redirect only when it is a string.
- `failure`: fallback failure toast. `reset`: reset the form after success (default `false`;
  use `true` for "add" forms). `refreshAll` (default `true`). `navigate` (default `false`:
  results apply to the current page even if the action lives on another route).
- `onSubmit(input)` (return `false` to cancel), `onSuccess(data)`, `onFailure(data, status)`,
  `onError(message, status)`.

Only one submission per form runs at a time. An expired session shows a toast with a
"Sign in" button. `toastEnhance(options)` (enhance.ts) is the same without the $state.

## 4. Components

All props are documented in each file's JSDoc. Quick reference:

| Component | Use | Key props |
| --- | --- | --- |
| `PageHeader` | top of every page | `title`, `breadcrumb?: {label, href?}[]`, `back?: {label, href}`, `description?`, `size: 'lg'\|'md'`, snippets `badge`, `actions`, `documentTitle?` |
| `Panel` | surface-200 card | `title?`, `description?`, `number?` ("01"), `padding: 'default'\|'sm'\|'none'`, `size: 'md'\|'sm'`, `stacked?`, `as?`, snippets `actions`, `header` |
| `AdminButton` | every button and button link | `variant: 'primary'\|'outline'\|'ghost'\|'danger'\|'danger-text'`, `size: 'md'\|'sm'\|'icon'\|'icon-sm'`, `pending?`, `pendingLabel?`, `href?`, `external?`, `bind:ref` |
| `StatusBadge` | Published / Draft pills | `status?` ('published', 'draft', 'active', 'archived', 'unread'...), `label?`, `tone?: 'success'\|'neutral'\|'brand'`, `dot?` |
| `FormField` | label + control + hint + error | `label`, `hint?`, `error?`, `optional?`, `hideLabel?`, `id?`, snippet `children(attrs)` |
| `ToggleRow` | labelled switch (Visibility panels) | `label`, `hint?`, `name?`, `bind:checked`, `divided?` |
| `TagsInput` | chips | `bind:tags`, `name?`, `max?` (30), `maxLength?` (40), `placeholder?` |
| `ImageField` | upload / link an image | `folder`, `name?`, `bind:url`, `bind:alt`, `label?`, `hint?`, `error?`, `aspect?` ("16 / 10"), `variant: 'drop'\|'avatar'`, `initials?`, `showAlt?`, `allowUrl?`, `compact?`, `accept?`, `disabled?`, `qualityOption?`, `bind:keepOriginal`, `bind:uploading`, `onupload?`, `onchange?` |
| `ListEditor` | repeatable rows | `bind:items`, `create`, snippet `row(item, index)`, `name?`, `itemLabel?`, `max?`, `min?`, `numbered?`, `reorderable?`, `rowClass?`, snippets `header`, `empty`, `addPosition`, `bind:this` → `add()` |
| `ConfirmDelete` | delete with an alert dialog | `action`, `id`, `idName?`, `fields?`, `title`, `description?`, `triggerLabel?`, `variant: 'text'\|'outline'`, snippet `trigger(props)`, `confirmLabel?`, `success?`, `ondeleted?` |
| `EmptyState` | nothing here yet | `title`, `description?`, `icon?` (a Lucide component), `compact?`, snippet `actions` |

Also: `AdminSidebar`, `AdminTopBar`, `BrandMark`, `AuthCard` (used by the shell and sign in),
`nav.ts` (`ADMIN_NAV`, `isActiveAdminPath`, `AdminCounts`), `upload.ts` (`uploadFile`,
`compressImage`, `checkFile`, `acceptAttribute`, `savings`, `UPLOAD_FOLDERS`; see section 5),
`styles.ts`, `form-data.ts`.

### What each control submits

| Control | Form fields | Read on the server (form-data.ts) |
| --- | --- | --- |
| `<Input name="title">` | `title` | `readText(form, 'title', { max })`, `readOptional`, `readInt` |
| `ToggleRow name="published"` | `published=on` when on, nothing when off | `readBool(form, 'published')` |
| `TagsInput name="tags"` | one `tags` field per tag | `readTags(form, 'tags')` |
| `ImageField name="cover"` | `coverUrl`, `coverAlt` (match the coverUrl/coverAlt columns) | `readImage(form, 'cover')` → `{ url, alt, invalid? }` |
| `ListEditor name="systems"` | `systems` = JSON of the rows | `readRows(form, 'systems', ['title', 'description'])` or `readJson` |
| `ConfirmDelete id={x}` | `id` (+ `fields`) | `readText(form, 'id')` |

### Controls from `ui/`

shadcn controls default to 36px. Size them with the class strings in `styles.ts`:
`inputClass` (44px), `titleInputClass` (the big post title), `monoInputClass` (slugs, URLs,
years), `textareaClass`, `selectTriggerClass`, plus `labelClass` and `hintClass`. For
`<Select>` and `<Checkbox>` use the ui components directly; a native select is not styled.

## 5. Uploads

Call `uploadFile(file, { folder, alt?, keepOriginal?, onProgress?, signal? })` from `upload.ts`
(`ImageField`, the Media library's `UploadQueue` in `media/uploads.svelte.ts` and the post
editor already do). It resolves to `{ id, url, path, filename, mimeType, size, originalSize,
width?, height?, alt, compressed }` and rejects with an `UploadError` whose message fits a
toast (or an `AbortError` when `signal` aborts). `savings(media)` gives "4.2 MB → 380 KB".
The file never passes through Vercel, so its 4.5 MB request limit doesn't apply:

1. **Check and compress in the browser.** `checkFile` refuses unknown types (by MIME type, or
   by extension for `.glb`/`.gltf`, which browsers report as empty). `compressImage` resizes
   JPEG, PNG and WebP to at most 2400 px on the long side and re-encodes them as WebP (0.82),
   applying the EXIF orientation and dropping metadata such as GPS. Without a WebP encoder
   (older Safari) it uses JPEG, or PNG when there is transparency. GIF (animation) and AVIF
   are left as they are, and a file is never made bigger. `keepOriginal` ("Keep original
   quality") skips the resize and re-encode; JPEGs still lose their metadata, and a rotated
   JPEG is re-encoded upright (JPEG 0.95).
2. **Ask for a signed upload URL.** `POST /admin/api/upload` with JSON
   `{ filename, mimeType, size, folder, width?, height? }`. The server checks the folder, the
   type and that type's size limit, and answers `{ path, signedUrl, token, publicUrl,
   mimeType, maxBytes }`. The path is `<folder>/<stamp>-<random>-<name>[-WxH].<ext>`.
3. **PUT the file to Supabase Storage.** `XMLHttpRequest` (for progress) to `signedUrl`, the
   same request supabase-js `uploadToSignedUrl` makes, with the type the server settled on and
   `x-upsert: false`. The CSP's `connect-src https:` allows it.
4. **Record it.** `POST /admin/api/upload/complete` with
   `{ path, filename, mimeType, size, width?, height?, alt? }`. The server checks the path is
   one it hands out and that the stored object exists with an allowed type and size (it deletes
   a file that fails), then writes the `media` row and an activity entry and answers 201
   `{ id, url, path, filename, mimeType, size, width, height, alt }`. A retry for the same path
   answers the same row.

Errors from both endpoints are `{ message, errors? }` with 400 (invalid), 401 (signed out),
413 (request too large), 500 (unexpected), 502 (Storage refused) or 503 (`SUPABASE_URL` or
`SUPABASE_SECRET_KEY` missing). The old multipart `POST /admin/api/upload` (`file`, `folder`,
`alt`) still works for files under Vercel's 4.5 MB limit; don't use it in new code.

| Kind | Types | Limit (after compression) |
| --- | --- | --- |
| Images | PNG, JPEG, WebP, GIF, AVIF (no SVG) | 10 MB |
| Documents | PDF | 20 MB |
| 3D models | GLB, glTF | 25 MB |
| Video | MP4, WebM | 50 MB |

Folders (`UPLOAD_FOLDERS`): `projects`, `posts`, `people`, `pages`, `archive`, `sponsors`,
`media`. The limits live in `UPLOAD_LIMITS` (upload.ts) and `UPLOAD_RULES`
(`src/lib/server/storage.ts`); keep them, the `media_bucket_types` migration and
`[storage.buckets.media]` in `supabase/config.toml` in step. Show media photos through
`optimizedSrc()` / `srcset()` from `#lib/image.ts`, which resize them with Vercel Image
Optimization.

## 6. Gotchas

- **Keep typed text:** spread only stable objects onto `Input`/`Textarea`. The `attrs` from
  `FormField` are stable. Spreading a freshly built object (`{...{ id, 'aria-invalid': x }}`)
  makes Svelte re-read every prop, which wipes what the editor typed into an unbound input.
  Either pass attributes one by one or `bind:value`.
- **Lists need $state:** `let rows = $state(structuredClone(data.project.systems));` then
  `<ListEditor bind:items={rows}>`. Editing rows mutates that copy, not `data`.
- **Don't put `text-label` or `text-spec` through `cn()`** (it reads them as colours and drops
  one). Use a class array: `class={['text-label', 'text-ink-muted']}`.
- **One red moment per region:** the primary button. Use `outline` / `ghost` for the rest.
- **Ctrl/Cmd+B toggles the sidebar** (shadcn default, listens on window). A Markdown editor that
  binds Ctrl+B should call `event.stopPropagation()` in its own keydown handler.
- **Sidebar active state** comes from `page.url`: Dashboard only on `/admin`, other items on their
  path and anything under it. Counts come from the layout (`data.counts`, may be `null` if the
  database is down); after an action, `refreshAll` updates them.
- **Refreshing the badges:** the layout load `depends('admin:counts')`; call
  `invalidate('admin:counts')` after changes made outside a form action.
