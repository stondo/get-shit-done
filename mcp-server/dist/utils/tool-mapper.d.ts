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
export declare function createTool<T extends z.ZodType<any>>(name: string, description: string, schema: T, handler: (args: z.infer<T>) => Promise<any>): GsdTool;
/**
 * Convert Claude tool names to MCP standard names
 */
export declare function convertToolName(claudeTool: string): string;
/**
 * Build tool list for agent prompts
 */
export declare function buildToolList(tools: string[]): string;
//# sourceMappingURL=tool-mapper.d.ts.map