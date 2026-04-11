export type AgentExecutionState =
  | "idle"
  | "running"
  | "paused"
  | "waiting_for_input"
  | "error"
  | "completed";

export interface StateTransitionEvent {
  sessionId: string;
  from: AgentExecutionState;
  to: AgentExecutionState;
  trigger: string;
  timestamp: string;
}

type TransitionListener = (event: StateTransitionEvent) => void;

const VALID_TRANSITIONS: Record<AgentExecutionState, ReadonlySet<AgentExecutionState>> = {
  idle: new Set(["running", "error"] as AgentExecutionState[]),
  running: new Set(["completed", "waiting_for_input", "paused", "error"] as AgentExecutionState[]),
  paused: new Set(["running", "error"] as AgentExecutionState[]),
  waiting_for_input: new Set(["running", "error"] as AgentExecutionState[]),
  error: new Set(["idle"] as AgentExecutionState[]),
  completed: new Set([] as AgentExecutionState[]),
};

export class AgentStateMachine {
  private _state: AgentExecutionState;
  private readonly _sessionId: string;
  private readonly _listeners: TransitionListener[] = [];

  constructor(sessionId: string, initialState: AgentExecutionState = "idle") {
    this._sessionId = sessionId;
    this._state = initialState;
  }

  get state(): AgentExecutionState {
    return this._state;
  }

  transition(to: AgentExecutionState, trigger: string): boolean {
    const allowed = VALID_TRANSITIONS[this._state];
    if (!allowed.has(to)) {
      return false;
    }

    const event: StateTransitionEvent = {
      sessionId: this._sessionId,
      from: this._state,
      to,
      trigger,
      timestamp: new Date().toISOString(),
    };

    this._state = to;

    for (const listener of this._listeners) {
      listener(event);
    }

    return true;
  }

  onTransition(listener: TransitionListener): void {
    this._listeners.push(listener);
  }
}
