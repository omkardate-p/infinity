import { fetchUser } from "./api.ts";

export function profileLine(id: string): string {
  const user = fetchUser(id);
  return user ? `${user.name} (${user.id})` : "unknown user";
}
