// Taskforge HTTP client — proxy to the taskforge engine on port 9900.
//
// Used by the LINE webhook slash-command router to spawn sub-agent plans
// (collect / analyze / write) and poll for results.

const TASKFORGE_BASE = process.env.TASKFORGE_BASE_URL || 'http://localhost:9900';

export type TaskType =
  | 'collect'
  | 'analyze'
  | 'outline'
  | 'write'
  | 'review'
  | 'assemble'
  | 'research';

export interface TaskforgeTask {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  depends_on?: string[];
  status?: string;
  output?: string;
}

export interface TaskforgePlan {
  id: string;
  goal: string;
  status: string;
  tasks: TaskforgeTask[];
  output?: string;
  current_task?: string;
  error?: string | null;
}

export interface CreatePlanResponse {
  plan_id: string;
  status: string;
  tasks: TaskforgeTask[];
}

export interface ExecutePlanResponse {
  plan_id: string;
  status: string;
  task_count: number;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j.error || fallback;
  } catch {
    return fallback + ': ' + text.slice(0, 200);
  }
}

export async function createPlan(
  goal: string,
  context = '',
  prebuiltTasks?: TaskforgeTask[],
): Promise<CreatePlanResponse> {
  const body: Record<string, unknown> = { goal, context };
  if (prebuiltTasks && prebuiltTasks.length > 0) {
    body.tasks = prebuiltTasks.map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      description: t.description,
      depends_on: t.depends_on ?? [],
    }));
  }
  const res = await fetch(`${TASKFORGE_BASE}/v1/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`createPlan: ${await readError(res, res.statusText)}`);
  return (await res.json()) as CreatePlanResponse;
}

export async function executePlan(planId: string): Promise<ExecutePlanResponse> {
  const res = await fetch(`${TASKFORGE_BASE}/v1/plans/${encodeURIComponent(planId)}/execute`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`executePlan: ${await readError(res, res.statusText)}`);
  return (await res.json()) as ExecutePlanResponse;
}

export async function getPlan(planId: string): Promise<TaskforgePlan> {
  const res = await fetch(`${TASKFORGE_BASE}/v1/plans/${encodeURIComponent(planId)}`);
  if (!res.ok) throw new Error(`getPlan: ${await readError(res, res.statusText)}`);
  const j = (await res.json()) as { plan: TaskforgePlan; output?: string };
  return j.plan;
}

// Poll plan until status is terminal. Returns the final plan.
export async function waitForPlan(
  planId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<TaskforgePlan> {
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000; // 5 min default
  const intervalMs = opts.intervalMs ?? 2000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const plan = await getPlan(planId);
    if (plan.status === 'completed' || plan.status === 'failed') return plan;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitForPlan: timed out after ${timeoutMs}ms`);
}