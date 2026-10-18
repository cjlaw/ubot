export function formatError(err: unknown): string {
  return err instanceof Error ? (err.stack ?? err.message) : String(err);
}
