import { isPivotedRootAgent } from '../utils/orchestrator-identity';

export type TaskPrerouteVerdict =
  | { action: 'passthrough' }
  | { action: 'rewrite'; newSubagentType: string }
  | { action: 'block'; errorMessage: string };

export interface TaskPrerouteContext {
  rootAgent: string | undefined;
  subagentType: string;
  taskId?: string;
  lookupSessionAgent?: (sessionID: string) => Promise<string | undefined>;
  anthropicTaskFallbacks: Record<
    string,
    { shadowAgentName: string }
  >;
}

export async function decideTaskPreroute(
  ctx: TaskPrerouteContext,
): Promise<TaskPrerouteVerdict> {
  const {
    rootAgent,
    subagentType,
    taskId,
    lookupSessionAgent,
    anthropicTaskFallbacks,
  } = ctx;
  const inPivotMode = isPivotedRootAgent(rootAgent);

  if (typeof taskId === 'string' && taskId.length > 0) {
    if (!inPivotMode) return { action: 'passthrough' };
    if (!lookupSessionAgent) return { action: 'passthrough' };

    let resumedAgentName: string | undefined;
    try {
      resumedAgentName = await lookupSessionAgent(taskId);
    } catch {
      return { action: 'passthrough' };
    }

    if (!resumedAgentName) return { action: 'passthrough' };

    const resumedRoute = anthropicTaskFallbacks[resumedAgentName];
    if (!resumedRoute) return { action: 'passthrough' };

    return {
      action: 'block',
      errorMessage:
        `Cannot resume ${resumedAgentName} child session ${taskId} ` +
        `in pivot mode. The original child agent is anthropic-primary; the ` +
        `in-flight session is bound to that model and cannot be ` +
        `retroactively reassigned to its backup shadow agent. Start a new task ` +
        `call without task_id; the new child will spawn under ` +
        `${resumedRoute.shadowAgentName}.`,
    };
  }

  if (!inPivotMode) return { action: 'passthrough' };

  const route = anthropicTaskFallbacks[subagentType];
  if (!route) return { action: 'passthrough' };

  return { action: 'rewrite', newSubagentType: route.shadowAgentName };
}
