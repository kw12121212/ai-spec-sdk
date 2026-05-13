export interface IAnswerAgent {
  answer(question: string, context?: string): Promise<string | null>;
}

export class AnswerAgentClient implements IAnswerAgent {
  public async answer(question: string, context?: string): Promise<string | null> {
    // Default implementation returns null, meaning it couldn't answer.
    return null;
  }
}
