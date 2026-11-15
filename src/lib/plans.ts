/** Subscription plans for Broomy (renting access to the Qwen model). */
export interface Plan {
  id: "basic" | "pro";
  name: string;
  priceCents: number;
  /** max concurrent in-flight requests for this tier */
  concurrent: number;
  /** days of access granted per successful payment */
  accessDays: number;
  description: string;
}

export const PLANS: Record<Plan["id"], Plan> = {
  basic: {
    id: "basic",
    name: "Basic",
    priceCents: 3900,
    concurrent: 1,
    accessDays: 31,
    description: "1 concurrent request, unlimited tokens.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 9900,
    concurrent: 3,
    accessDays: 31,
    description: "3 concurrent requests, priority queue. Busy hours can add a wait.",
  },
};

export function planById(id: string): Plan | undefined {
  return (PLANS as Record<string, Plan>)[id];
}
