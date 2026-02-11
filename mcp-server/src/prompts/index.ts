import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListPromptsRequestSchema, GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";

interface Prompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

const prompts: Prompt[] = [
  {
    name: "gsd_new_project",
    description: "Configure a new GSD project",
    arguments: [
      {
        name: "name",
        description: "Project name",
        required: true,
      },
      {
        name: "description",
        description: "What do you want to build?",
        required: true,
      },
      {
        name: "auto",
        description: "Auto mode (skip interactive questioning)",
        required: false,
      },
    ],
  },
  {
    name: "gsd_discuss_phase",
    description: "Discuss phase implementation details",
    arguments: [
      {
        name: "phase",
        description: "Phase number",
        required: true,
      },
      {
        name: "focus",
        description: "Focus area (ui, api, content, organization)",
        required: false,
      },
    ],
  },
  {
    name: "gsd_plan_phase",
    description: "Plan a phase with options",
    arguments: [
      {
        name: "phase",
        description: "Phase number",
        required: true,
      },
      {
        name: "skip_research",
        description: "Skip research step",
        required: false,
      },
      {
        name: "skip_verify",
        description: "Skip plan verification",
        required: false,
      },
    ],
  },
  {
    name: "gsd_quick",
    description: "Quick ad-hoc task",
    arguments: [
      {
        name: "task",
        description: "What do you want to do?",
        required: true,
      },
    ],
  },
];

export function registerPrompts(server: Server) {
  // List prompts handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts };
  });

  // Get prompt handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    const prompt = prompts.find((p) => p.name === name);
    if (!prompt) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    // Build prompt text based on arguments
    let promptText = "";
    
    switch (name) {
      case "gsd_new_project":
        promptText = `Initialize a new GSD project.\n\n`;
        if (args?.name) {
          promptText += `Project name: ${args.name}\n`;
        }
        if (args?.description) {
          promptText += `Description: ${args.description}\n`;
        }
        if (args?.auto === "true") {
          promptText += `\nAuto mode enabled - will run without interactive questioning.\n`;
        }
        promptText += `\nThis will create:\n- .planning/PROJECT.md\n- .planning/REQUIREMENTS.md\n- .planning/ROADMAP.md\n- .planning/STATE.md`;
        break;
        
      case "gsd_discuss_phase":
        promptText = `Discuss phase ${args?.phase || "N"} implementation details.\n\n`;
        if (args?.focus) {
          promptText += `Focus area: ${args.focus}\n\n`;
        }
        promptText += `This will help capture your implementation preferences before planning.`;
        break;
        
      case "gsd_plan_phase":
        promptText = `Plan phase ${args?.phase || "N"}.\n\n`;
        if (args?.skip_research === "true") {
          promptText += `- Skip research: Yes\n`;
        }
        if (args?.skip_verify === "true") {
          promptText += `- Skip verification: Yes\n`;
        }
        promptText += `\nThis will research, create plans, and verify them.`;
        break;
        
      case "gsd_quick":
        promptText = `Quick task: ${args?.task || ""}\n\nThis will create an atomic plan and execute it immediately.`;
        break;
        
      default:
        promptText = `GSD prompt: ${name}`;
    }

    return {
      description: prompt.description,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: promptText,
          },
        },
      ],
    };
  });
}
