export interface User {
  id: string;
  name: string;
}

const PEOPLE: Record<string, User> = {
  "1": { id: "1", name: "Ada" },
  "2": { id: "2", name: "Grace" },
};

export function fetchUser(id: string): User | undefined {
  return PEOPLE[id];
}
