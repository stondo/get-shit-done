import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, access, readdir } from "fs/promises";
import { dirname, join, resolve, isAbsolute } from "path";
import { fileURLToPath } from "url";

import { GsdTool, createTool } from "../utils/tool-mapper.js";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to resolve project path
function resolveProjectPath(cwd?: string): string {
  if (cwd && isAbsolute(cwd)) {
    return cwd;
  }
  return process.cwd();
}

// Helper to get gsd-tools.js path
function getGsdToolsPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE;

  if (!homeDir) {
    return resolve(join(dirname(__dirname), "..", "..", "get-shit-done", "bin", "gsd-tools.js"));
  }

  if (process.env.GSD_CONFIG_DIR) {
    const toolsPath = join(process.env.GSD_CONFIG_DIR, "get-shit-done", "bin", "gsd-tools.js");
    return toolsPath;
  }

  const possiblePaths = [
    join(homeDir, ".gsd", "get-shit-done", "bin", "gsd-tools.js"),
    join(homeDir, ".claude", "get-shit-done", "bin", "gsd-tools.js"),
    join(homeDir, ".config", "opencode", "get-shit-done", "bin", "gsd-tools.js"),
    join(homeDir, ".gemini", "get-shit-done", "bin", "gsd-tools.js"),
  ];

  for (const toolsPath of possiblePaths) {
    return toolsPath;
  }

  return resolve(join(dirname(__dirname), "..", "..", "get-shit-done", "bin", "gsd-tools.js"));
}

// Helper to run gsd-tools.js commands
async function runGsdTool(command: string, args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
  const gsdToolsPath = getGsdToolsPath();
  const projectPath = resolveProjectPath(cwd);

  try {
    return await execFileAsync("node", [gsdToolsPath, command, ...args], {
      cwd: projectPath,
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`gsd-tools failed: ${error.message}`);
    }
    throw error;
  }
}

// Helper to read workflow file
async function loadWorkflow(name: string): Promise<string> {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error("HOME or USERPROFILE not set");
  }

  let basePath: string;
  if (process.env.GSD_CONFIG_DIR) {
    basePath = join(process.env.GSD_CONFIG_DIR, "get-shit-done", "workflows");
  } else {
    basePath = join(homeDir, ".claude", "get-shit-done", "workflows");
  }

  const possiblePaths = [
    join(basePath, `${name}.md`),
    join(homeDir, ".gsd", "get-shit-done", "workflows", `${name}.md`),
    join(dirname(__dirname), "..", "..", "get-shit-done", "workflows", `${name}.md`),
  ];

  for (const path of possiblePaths) {
    try {
      const content = await readFile(path, "utf-8");
      return content;
    } catch {
      continue;
    }
  }

  throw new Error(`Workflow '${name}' not found`);
}

// Tool schemas
const NewProjectSchema = z.object({
  name: z.string().describe("Project name"),
  description: z.string().describe("Project description"),
  auto: z.boolean().optional().describe("Auto mode - skip interactive questioning"),
  cwd: z.string().optional().describe("Project directory (absolute path). If not provided, uses current working directory"),
});

const PlanPhaseSchema = z.object({
  phase: z.number().describe("Phase number to plan"),
  skipResearch: z.boolean().optional().describe("Skip research step"),
  skipVerify: z.boolean().optional().describe("Skip plan verification"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const ExecutePhaseSchema = z.object({
  phase: z.number().describe("Phase number to execute"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const VerifyWorkSchema = z.object({
  phase: z.number().describe("Phase number to verify"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const DiscussPhaseSchema = z.object({
  phase: z.number().describe("Phase number to discuss"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const ProgressSchema = z.object({
  format: z.enum(["json", "table", "bar"]).optional().default("table").describe("Output format"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const QuickSchema = z.object({
  description: z.string().describe("Quick task description"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const MapCodebaseSchema = z.object({
  deep: z.boolean().optional().describe("Deep analysis mode"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const NewMilestoneSchema = z.object({
  name: z.string().optional().describe("Milestone name"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const CompleteMilestoneSchema = z.object({
  version: z.string().optional().describe("Version tag"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const ReadStateSchema = z.object({
  section: z.string().optional().describe("Specific section to read (e.g., 'current', 'progress', 'metrics')"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const RunCliSchema = z.object({
  command: z.string().describe("Command to run (e.g., 'state load', 'progress json', 'todo complete my-todo')"),
  args: z.array(z.string()).optional().describe("Additional arguments"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const HealthSchema = z.object({
  cwd: z.string().optional().describe("Project directory to check (absolute path). If not provided, uses current working directory"),
});

const AddPhaseSchema = z.object({
  description: z.string().describe("Phase description"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const InsertPhaseSchema = z.object({
  after: z.number().describe("Phase number to insert after"),
  description: z.string().describe("New phase description"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const RemovePhaseSchema = z.object({
  phase: z.number().describe("Phase number to remove"),
  force: z.boolean().optional().describe("Force removal without confirmation"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const ResearchPhaseSchema = z.object({
  phase: z.number().describe("Phase number to research"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const AddTodoSchema = z.object({
  description: z.string().describe("Todo description"),
  area: z.string().optional().describe("Todo area/category"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const CheckTodosSchema = z.object({
  area: z.string().optional().describe("Filter by area/category"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const ResumeWorkSchema = z.object({
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const PauseWorkSchema = z.object({
  notes: z.string().optional().describe("Notes about where work was paused"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const AuditMilestoneSchema = z.object({
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const VerifyPhaseSchema = z.object({
  phase: z.number().describe("Phase number to verify"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const ExecutePlanSchema = z.object({
  phase: z.number().describe("Phase number"),
  plan: z.number().describe("Plan number to execute"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const DiagnoseIssuesSchema = z.object({
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const SetProfileSchema = z.object({
  profile: z.enum(["quality", "balanced", "budget"]).describe("Model profile to use"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const SettingsSchema = z.object({
  key: z.string().optional().describe("Setting key to get/set"),
  value: z.string().optional().describe("Setting value (if setting a key)"),
  list: z.boolean().optional().describe("List all settings"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const ListPhaseAssumptionsSchema = z.object({
  phase: z.number().describe("Phase number to list assumptions for"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const PlanMilestoneGapsSchema = z.object({
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const DiscoveryPhaseSchema = z.object({
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});

const TransitionSchema = z.object({
  from: z.string().optional().describe("What you're transitioning from"),
  to: z.string().optional().describe("What you're transitioning to"),
  cwd: z.string().optional().describe("Project directory (absolute path)"),
});
// Tool implementations
const tools: GsdTool[] = [
  createTool(
    "gsd_new_project",
    "Initialize a new project with GSD workflow",
    NewProjectSchema,
    async (args) => {
      const workflow = await loadWorkflow("new-project");
      return {
        content: [
          {
            type: "text",
            text: `## Initializing new project: ${args.name}\n\n${args.description}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Auto Mode\n${args.auto ? "✓ Auto mode enabled - skip deep questioning\n" : "Auto mode disabled - will ask clarifying questions"}\n\n### Project Location\n${args.cwd ? `Directory: ${args.cwd}` : `Current directory: ${process.cwd()}`}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_plan_phase",
    "Research and create plans for a phase",
    PlanPhaseSchema,
    async (args) => {
      const workflow = await loadWorkflow("plan-phase");
      return {
        content: [
          {
            type: "text",
            text: `## Planning Phase ${args.phase}\n\n${args.skipResearch ? "⚠ Skip research enabled\n" : ""}${args.skipVerify ? "⚠ Skip verification enabled\n" : ""}\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Phase: ${args.phase}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_execute_phase",
    "Execute all plans in a phase",
    ExecutePhaseSchema,
    async (args) => {
      const workflow = await loadWorkflow("execute-phase");
      return {
        content: [
          {
            type: "text",
            text: `## Executing Phase ${args.phase}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Phase: ${args.phase}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_verify_work",
    "Verify phase completion with user acceptance testing",
    VerifyWorkSchema,
    async (args) => {
      const workflow = await loadWorkflow("verify-work");
      return {
        content: [
          {
            type: "text",
            text: `## Verifying Phase ${args.phase}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Phase: ${args.phase}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_discuss_phase",
    "Discuss phase implementation details before planning",
    DiscussPhaseSchema,
    async (args) => {
      const workflow = await loadWorkflow("discuss-phase");
      return {
        content: [
          {
            type: "text",
            text: `## Discussing Phase ${args.phase}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Phase: ${args.phase}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_progress",
    "Show current project progress and status",
    ProgressSchema,
    async (args) => {
      const projectPath = resolveProjectPath(args.cwd);
      const statePath = join(projectPath, ".planning", "STATE.md");
      
      try {
        const content = await readFile(statePath, "utf-8");
        const result = await runGsdTool("progress", [args.format || "table"], args.cwd);
        return {
          content: [
            {
              type: "text",
              text: `## Project Progress (${args.format})\n\n${result.stdout || result.stderr || content.slice(0, 2000)}`,
            },
          ],
        };
      } catch {
        const workflow = await loadWorkflow("progress");
        return {
          content: [
            {
              type: "text",
              text: `## Project Progress (${args.format})\n\nNo STATE.md found at ${statePath}.\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\nTo see progress, ensure you have initialized a project with \`gsd_new_project\` first.`,
            },
          ],
        };
      }
    }
  ),

  createTool(
    "gsd_quick",
    "Execute a quick ad-hoc task",
    QuickSchema,
    async (args) => {
      const workflow = await loadWorkflow("quick");
      return {
        content: [
          {
            type: "text",
            text: `## Quick Task: ${args.description}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Task Details\n- Description: ${args.description}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_map_codebase",
    "Analyze existing codebase",
    MapCodebaseSchema,
    async (args) => {
      const workflow = await loadWorkflow("map-codebase");
      return {
        content: [
          {
            type: "text",
            text: `## Mapping Codebase${args.deep ? " (Deep Mode)" : ""}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Mode: ${args.deep ? "Deep analysis" : "Standard analysis"}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_new_milestone",
    "Start a new milestone",
    NewMilestoneSchema,
    async (args) => {
      const workflow = await loadWorkflow("new-milestone");
      return {
        content: [
          {
            type: "text",
            text: `## Starting New Milestone${args.name ? `: ${args.name}` : ""}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n${args.name ? `- Name: ${args.name}\n` : ""}- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_complete_milestone",
    "Complete current milestone",
    CompleteMilestoneSchema,
    async (args) => {
      const workflow = await loadWorkflow("complete-milestone");
      return {
        content: [
          {
            type: "text",
            text: `## Completing Milestone${args.version ? ` v${args.version}` : ""}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n${args.version ? `- Version: ${args.version}\n` : ""}- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_read_state",
    "Read project STATE.md file",
    ReadStateSchema,
    async (args) => {
      const projectPath = resolveProjectPath(args.cwd);
      const statePath = join(projectPath, ".planning", "STATE.md");
      
      try {
        const content = await readFile(statePath, "utf-8");
        
        if (args.section) {
          const sectionRegex = new RegExp(`## ${args.section}([\\s\\S]*?)(?=## |$)`, "i");
          const match = content.match(sectionRegex);
          if (match) {
            return {
              content: [
                {
                  type: "text",
                  text: `## State Section: ${args.section}\n\n${match[1].trim()}`,
                },
              ],
            };
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: `## Project State\n\nLocation: ${statePath}\n\n${content}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `## Error Reading State\n\nNo STATE.md found at ${statePath}.\n\nHave you initialized a project with \`gsd_new_project\`?`,
            },
          ],
          isError: true,
        };
      }
    }
  ),

  createTool(
    "gsd_run_cli",
    "Run any gsd-tools.js command directly",
    RunCliSchema,
    async (args) => {
      const extraArgs = args.args || [];
      const result = await runGsdTool(args.command, extraArgs, args.cwd);
      
      return {
        content: [
          {
            type: "text",
            text: `## gsd-tools ${args.command}\n\n**stdout:**\n\`\`\`\n${result.stdout || "(no output)"}\n\`\`\`\n\n**stderr:**\n\`\`\`\n${result.stderr || "(no output)"}\n\`\`\``,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_health",
    "Check GSD installation and project health",
    HealthSchema,
    async (args) => {
      const checks: string[] = [];
      const errors: string[] = [];
      
      const gsdToolsPath = getGsdToolsPath();
      checks.push(`✓ gsd-tools.js path resolved: ${gsdToolsPath}`);
      
      const projectPath = resolveProjectPath(args.cwd);
      checks.push(`✓ Project path: ${projectPath}`);
      
      const planningPath = join(projectPath, ".planning");
      try {
        await access(planningPath);
        checks.push(`✓ .planning/ directory exists`);
        
        const keyFiles = ["PROJECT.md", "REQUIREMENTS.md", "ROADMAP.md", "STATE.md"];
        for (const file of keyFiles) {
          try {
            await access(join(planningPath, file));
            checks.push(`✓ ${file} exists`);
          } catch {
            errors.push(`✗ ${file} missing`);
          }
        }
        
        const phasesPath = join(planningPath, "phases");
        try {
          const phases = await readdir(phasesPath);
          checks.push(`✓ ${phases.length} phase directories found`);
        } catch {
          errors.push(`✗ No phases directory (project not planned yet?)`);
        }
      } catch {
        errors.push(`✗ .planning/ directory not found - project not initialized`);
      }
      
      try {
        await access(join(projectPath, ".git"));
        checks.push(`✓ Git repository initialized`);
      } catch {
        errors.push(`✗ No git repository`);
      }
      
      return {
        content: [
          {
            type: "text",
            text: `## GSD Health Check\n\n### Passed (${checks.length})\n${checks.map(c => `- ${c}`).join("\n")}\n\n### Issues (${errors.length})\n${errors.map(e => `- ${e}`).join("\n") || "None!"}\n\n---\n\n**Recommendation:** ${errors.length === 0 ? "Project looks healthy! Ready to work." : `Run \`gsd_new_project\` to initialize or check the project path.`}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_add_phase",
    "Add a new phase to the project roadmap",
    AddPhaseSchema,
    async (args) => {
      const workflow = await loadWorkflow("add-phase");
      return {
        content: [
          {
            type: "text",
            text: `## Adding New Phase\n\n**Description:** ${args.description}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Description: ${args.description}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_insert_phase",
    "Insert a new decimal phase after an existing phase",
    InsertPhaseSchema,
    async (args) => {
      const workflow = await loadWorkflow("insert-phase");
      return {
        content: [
          {
            type: "text",
            text: `## Inserting Phase After ${args.after}\n\n**Description:** ${args.description}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Insert After: Phase ${args.after}\n- Description: ${args.description}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_remove_phase",
    "Remove a phase from the roadmap and renumber subsequent phases",
    RemovePhaseSchema,
    async (args) => {
      const workflow = await loadWorkflow("remove-phase");
      return {
        content: [
          {
            type: "text",
            text: `## Removing Phase ${args.phase}\n\n${args.force ? "⚠️ **FORCE MODE ENABLED** - Will skip confirmations\n\n" : ""}### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Phase to Remove: ${args.phase}\n- Force: ${args.force || false}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_research_phase",
    "Research a phase before planning to gather context and requirements",
    ResearchPhaseSchema,
    async (args) => {
      const workflow = await loadWorkflow("research-phase");
      return {
        content: [
          {
            type: "text",
            text: `## Researching Phase ${args.phase}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Phase: ${args.phase}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_add_todo",
    "Add a new todo to the project",
    AddTodoSchema,
    async (args) => {
      const workflow = await loadWorkflow("add-todo");
      return {
        content: [
          {
            type: "text",
            text: `## Adding Todo\n\n**Description:** ${args.description}\n${args.area ? `**Area:** ${args.area}\n` : ""}\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Description: ${args.description}\n${args.area ? `- Area: ${args.area}\n` : ""}- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_check_todos",
    "Check status of todos across the project",
    CheckTodosSchema,
    async (args) => {
      const workflow = await loadWorkflow("check-todos");
      return {
        content: [
          {
            type: "text",
            text: `## Checking Todos${args.area ? ` (Area: ${args.area})` : ""}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n${args.area ? `- Area Filter: ${args.area}\n` : ""}- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_resume_work",
    "Resume work on a paused project",
    ResumeWorkSchema,
    async (args) => {
      const workflow = await loadWorkflow("resume-project");
      return {
        content: [
          {
            type: "text",
            text: `## Resuming Work\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_pause_work",
    "Pause current work session and save context",
    PauseWorkSchema,
    async (args) => {
      const workflow = await loadWorkflow("pause-work");
      return {
        content: [
          {
            type: "text",
            text: `## Pausing Work\n\n${args.notes ? `**Notes:** ${args.notes}\n\n` : ""}### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n${args.notes ? `- Notes: ${args.notes}\n` : ""}- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_audit_milestone",
    "Audit milestone completeness and readiness",
    AuditMilestoneSchema,
    async (args) => {
      const workflow = await loadWorkflow("audit-milestone");
      return {
        content: [
          {
            type: "text",
            text: `## Auditing Milestone\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_verify_phase",
    "Verify a phase before considering it complete",
    VerifyPhaseSchema,
    async (args) => {
      const workflow = await loadWorkflow("verify-phase");
      return {
        content: [
          {
            type: "text",
            text: `## Verifying Phase ${args.phase}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Phase: ${args.phase}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_execute_plan",
    "Execute a specific plan within a phase",
    ExecutePlanSchema,
    async (args) => {
      const workflow = await loadWorkflow("execute-plan");
      return {
        content: [
          {
            type: "text",
            text: `## Executing Plan ${args.plan} in Phase ${args.phase}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Phase: ${args.phase}\n- Plan: ${args.plan}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_diagnose_issues",
    "Diagnose project issues and inconsistencies",
    DiagnoseIssuesSchema,
    async (args) => {
      const workflow = await loadWorkflow("diagnose-issues");
      return {
        content: [
          {
            type: "text",
            text: `## Diagnosing Project Issues\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_set_profile",
    "Set the model profile (quality/balanced/budget)",
    SetProfileSchema,
    async (args) => {
      const workflow = await loadWorkflow("set-profile");
      return {
        content: [
          {
            type: "text",
            text: `## Setting Model Profile\n\n**Profile:** ${args.profile}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Profile: ${args.profile}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_settings",
    "Configure GSD settings",
    SettingsSchema,
    async (args) => {
      const workflow = await loadWorkflow("settings");
      return {
        content: [
          {
            type: "text",
            text: `## GSD Settings\n\n${args.list ? "**Listing all settings**\n\n" : ""}${args.key ? `**Key:** ${args.key}\n` : ""}${args.value ? `**Value:** ${args.value}\n` : ""}\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n${args.key ? `- Key: ${args.key}\n` : ""}${args.value ? `- Value: ${args.value}\n` : ""}${args.list ? "- Action: List all settings\n" : ""}- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_list_phase_assumptions",
    "List assumptions for a specific phase",
    ListPhaseAssumptionsSchema,
    async (args) => {
      const workflow = await loadWorkflow("list-phase-assumptions");
      return {
        content: [
          {
            type: "text",
            text: `## Listing Assumptions for Phase ${args.phase}\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Phase: ${args.phase}\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_plan_milestone_gaps",
    "Identify gaps in the current milestone plan",
    PlanMilestoneGapsSchema,
    async (args) => {
      const workflow = await loadWorkflow("plan-milestone-gaps");
      return {
        content: [
          {
            type: "text",
            text: `## Planning Milestone Gaps\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_discovery_phase",
    "Initial project discovery and analysis",
    DiscoveryPhaseSchema,
    async (args) => {
      const workflow = await loadWorkflow("discovery-phase");
      return {
        content: [
          {
            type: "text",
            text: `## Project Discovery Phase\n\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),

  createTool(
    "gsd_transition",
    "Transition between work sessions or contexts",
    TransitionSchema,
    async (args) => {
      const workflow = await loadWorkflow("transition");
      return {
        content: [
          {
            type: "text",
            text: `## Transitioning Work\n\n${args.from ? `**From:** ${args.from}\n` : ""}${args.to ? `**To:** ${args.to}\n` : ""}\n### Workflow Instructions\n\n${workflow}\n\n---\n\n### Execution Context\n${args.from ? `- From: ${args.from}\n` : ""}${args.to ? `- To: ${args.to}\n` : ""}- Project: ${args.cwd || process.cwd()}`,
          },
        ],
      };
    }
  ),
];

export function registerTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.schema),
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const args = tool.schema.parse(rawArgs);
      return await tool.handler(args);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          content: [
            {
              type: "text",
              text: `Validation error in tool ${name}:\n${error.errors.map(e => `- ${e.path.join('.')}: ${e.message}`).join("\n")}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });
}

function zodToJsonSchema(schema: z.ZodType<any>): object {
  const jsonSchema: any = {
    type: "object",
    properties: {},
    required: [],
  };

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as z.ZodTypeAny;
      jsonSchema.properties[key] = zodTypeToJsonSchema(zodType);
      if (!zodType.isOptional()) {
        jsonSchema.required.push(key);
      }
    }
  }

  return jsonSchema;
}

function zodTypeToJsonSchema(zodType: z.ZodTypeAny): object {
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }
  
  if (zodType instanceof z.ZodDefault) {
    return zodTypeToJsonSchema(zodType.removeDefault());
  }

  if (zodType instanceof z.ZodString) {
    return { type: "string", description: zodType.description };
  }
  if (zodType instanceof z.ZodNumber) {
    return { type: "number", description: zodType.description };
  }
  if (zodType instanceof z.ZodBoolean) {
    return { type: "boolean", description: zodType.description };
  }
  if (zodType instanceof z.ZodArray) {
    return { 
      type: "array", 
      items: zodTypeToJsonSchema(zodType.element),
      description: zodType.description 
    };
  }
  if (zodType instanceof z.ZodEnum) {
    return { 
      type: "string", 
      enum: zodType.options,
      description: zodType.description 
    };
  }
  if (zodType instanceof z.ZodObject) {
    const shape = zodType.shape;
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      const innerType = value as z.ZodTypeAny;
      properties[key] = zodTypeToJsonSchema(innerType);
      if (!innerType.isOptional()) {
        required.push(key);
      }
    }
    return { type: "object", properties, required, description: zodType.description };
  }

  return { type: "string", description: zodType.description };
}
