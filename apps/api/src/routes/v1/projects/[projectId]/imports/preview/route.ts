import { CSV_LIMITS } from '@setrya/domain';

import { ApiError, route } from '../../../../../../http/route';
import { createDraft } from '../../../../../../services/imports';
import { requireProjectApi } from '../../../../../../services/projects';
import { getSource } from '../../../../../../services/sources';

/** Multipart upload of one CSV, parsed in memory on this host. Returns the header, ten sample rows and the file hash. */
export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const length = Number(req.headers.get('content-length') ?? '0');
  if (length > CSV_LIMITS.maxBytes + 64 * 1024) throw new ApiError('INVALID_INPUT', `Files are limited to ${CSV_LIMITS.maxBytes / 1024 / 1024} MB.`);
  const form = await req.formData();
  const file = form.get('file');
  const sourceId = String(form.get('sourceId') ?? '');
  if (!(file instanceof File)) throw new ApiError('INVALID_INPUT', 'Choose a CSV file.', { fieldErrors: { file: 'Required' } });
  if (file.size > CSV_LIMITS.maxBytes) throw new ApiError('INVALID_INPUT', `Files are limited to ${CSV_LIMITS.maxBytes / 1024 / 1024} MB.`, { fieldErrors: { file: 'Too large' } });
  if (!/\.(csv|txt|tsv)$/i.test(file.name)) throw new ApiError('INVALID_INPUT', 'Upload a .csv file. Spreadsheet formats are not supported yet.', { fieldErrors: { file: 'Not a CSV' } });
  const source = await getSource(ctx, project.id, sourceId);
  if (!source) throw new ApiError('INVALID_INPUT', 'Choose a revenue source.', { fieldErrors: { sourceId: 'Required' } });
  if (!source.enabled) throw new ApiError('FORBIDDEN', 'This source is disabled. Enable it before importing.');
  return createDraft(ctx, project.id, source, file.name, new Uint8Array(await file.arrayBuffer()));
});
