import { ApiError, route } from '../../../../http/route';
import { BACKUP_TABLES, openBackup } from '../../../../services/backup';

/** Decrypts an uploaded backup in memory and reports what it contains. Writes nothing. */
export const POST = route('unlocked', async (req) => {
  const form = await req.formData();
  const file = form.get('file');
  const password = String(form.get('password') ?? '');
  if (!(file instanceof File) || file.size > 200 * 1024 * 1024) throw new ApiError('INVALID_INPUT', 'Choose a backup file.');
  try {
    const backup = openBackup(await file.text(), password);
    const counts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, backup.tables[t]?.length ?? 0]));
    return { createdAt: backup.createdAt, counts };
  } catch {
    throw new ApiError('RESTORE_FAILED', 'The file could not be decrypted with that password, or it is not a Setrya backup.');
  }
});
