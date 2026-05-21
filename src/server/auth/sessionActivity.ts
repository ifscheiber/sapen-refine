export function shouldUpdateLastSeenAt(params: {
  lastSeenAt: Date | null | undefined;
  now: Date;
  intervalSeconds: number;
}) {
  if (!params.lastSeenAt) return true;
  return (
    params.now.getTime() - params.lastSeenAt.getTime() >=
    params.intervalSeconds * 1000
  );
}
