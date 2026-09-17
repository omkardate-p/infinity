import { fetchUser } from "./api.ts";

export function greet(id: string): string {
  const user = fetchUser(id);
  return user ? `Hello, ${user.name}!` : "Hello there!";
}
