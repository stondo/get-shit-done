import { z } from "zod";

/**
 * GSD Tool type definition
 */
export interface GsdTool {
  name: string;
  description: string;
  schema: z.ZodType<any>;
  handler: (args: any) => Promise<any>;
}

/**
 * Create a GSD tool with proper typing
 */
export function createTool<T extends z.ZodType<any>>(
  name: string,
  description: string,
  schema: T,
  handler: (args: z.infer<T>) => Promise<any>
): GsdTool {
  return {
    name,
    description,
    schema,
    handler,
  };
}

/**
 * Convert Claude tool names to MCP standard names
 */
export function convertToolName(claudeTool: string): string {
  const mapping: Record<string, string> = {
    Read: "read_file",
    Write: "write_file",
    Edit: "replace",
    Bash: "run_command",
    Glob: "find_by_name",
    Grep: "grep_search",
    AskUserQuestion: "ask_user_question",
    Task: "code_search",
    WebSearch: "search_web",
    WebFetch: "fetch_webpage",
    TodoWrite: "todo_list",
  };

  // Handle MCP tools (pass through)
  if (claudeTool.startsWith("mcp__")) {
    return claudeTool;
  }

  return mapping[claudeTool] || claudeTool.toLowerCase();
}

/**
 * Build tool list for agent prompts
 */
export function buildToolList(tools: string[]): string {
  return tools.map((t) => convertToolName(t)).join(", ");
}
