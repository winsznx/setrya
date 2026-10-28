export function projectPath(projectId: string, rest = ''): string {
  return `/app/p/${projectId}${rest}`;
}
