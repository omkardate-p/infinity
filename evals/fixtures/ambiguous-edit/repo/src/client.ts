export function connect(host: string): string {
  const timeout = 1000;
  return `connect ${host} timeout=${timeout}`;
}

export function poll(host: string): string {
  const timeout = 1000;
  return `poll ${host} timeout=${timeout}`;
}
