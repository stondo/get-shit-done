# GSD MCP Server

Generic MCP (Model Context Protocol) server for GSD (Get Shit Done) - meta-prompting and spec-driven development.

## Overview

This MCP server exposes GSD workflows as MCP tools, making them usable from any compatible MCP client:

- **VS Code (GitHub Copilot)**
- **Claude Desktop**
- **Cursor**
- **Windsurf/Cascade**
- **Zed**
- Other editors/IDEs with MCP support

## Available Tools

### Core Workflow Tools
- `gsd_new_project` - Initialize a new GSD project
- `gsd_discovery_phase` - Initial project discovery and analysis
- `gsd_plan_phase` - Plan a project phase
- `gsd_research_phase` - Research a phase before planning
- `gsd_execute_phase` - Execute a phase
- `gsd_execute_plan` - Execute a specific plan within a phase
- `gsd_verify_work` - Verify completed work
- `gsd_verify_phase` - Verify a phase before considering it complete
- `gsd_discuss_phase` - Discuss implementation details

### Phase Management Tools
- `gsd_add_phase` - Add a new phase to the roadmap
- `gsd_insert_phase` - Insert a decimal phase after an existing phase
- `gsd_remove_phase` - Remove a phase and renumber subsequent phases
- `gsd_list_phase_assumptions` - List assumptions for a specific phase

### Todo Management Tools
- `gsd_add_todo` - Add a new todo to the project
- `gsd_check_todos` - Check status of todos across the project

### Session Management Tools
- `gsd_pause_work` - Pause current work session and save context
- `gsd_resume_work` - Resume work on a paused project
- `gsd_transition` - Transition between work sessions or contexts

### Milestone Tools
- `gsd_new_milestone` - Start a new milestone
- `gsd_complete_milestone` - Complete the current milestone
- `gsd_audit_milestone` - Audit milestone completeness and readiness
- `gsd_plan_milestone_gaps` - Identify gaps in the current milestone plan

### Diagnostic & Configuration Tools
- `gsd_diagnose_issues` - Diagnose project issues and inconsistencies
- `gsd_set_profile` - Set the model profile (quality/balanced/budget)
- `gsd_settings` - Configure GSD settings
- `gsd_health` - Check GSD installation and project health

### Utility Tools
- `gsd_progress` - Show project status
- `gsd_quick` - Quick task execution
- `gsd_map_codebase` - Analyze existing codebase
- `gsd_read_state` - Read project STATE.md file
- `gsd_run_cli` - Run any gsd-tools.js command directly

## Resources

The server also exposes GSD resources accessible via URI:

- `gsd://templates/{name}` - Templates (PROJECT.md, REQUIREMENTS.md, etc.)
- `gsd://workflows/{name}` - Workflow files
- `gsd://references/{name}` - Reference documents
- `gsd://agents/{name}` - Agent definitions

## Installation

### Via npm (recommended)

```bash
npx get-shit-done-cc@latest --mcp --global
```

This will install the MCP server and show configuration instructions for your MCP client.

### Manual

```bash
cd mcp-server
npm install
npm run build
```

## Client Configuration

### Claude Desktop

Add to the file `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gsd": {
      "command": "npx",
      "args": ["get-shit-done-cc@latest", "--mcp-server"]
    }
  }
}
```

### Cursor

In MCP settings (Settings > MCP):

```json
{
  "mcpServers": {
    "gsd": {
      "command": "npx",
      "args": ["get-shit-done-cc@latest", "--mcp-server"]
    }
  }
}
```

### VS Code (GitHub Copilot)

Create `.vscode/mcp.json` in your workspace (or add to user settings via `MCP: Open User Configuration`):

```json
{
  "servers": {
    "gsd": {
      "type": "stdio",
      "command": "npx",
      "args": ["get-shit-done-cc@latest", "--mcp-server"]
    }
  }
}
```

Once added, GSD tools appear in the Copilot Chat tool picker. Resources are available via **Add Context > MCP Resources**, and prompts are accessible as `/mcp.gsd.<promptname>` slash commands.

### Windsurf/Cascade

In Cascade > Settings > MCP:

```json
{
  "mcpServers": {
    "gsd": {
      "command": "npx",
      "args": ["get-shit-done-cc@latest", "--mcp-server"]
    }
  }
}
```

### Local/Development

To use the local server during development:

```json
{
  "mcpServers": {
    "gsd": {
      "command": "node",
      "args": ["/path/to/get-shit-done/mcp-server/dist/index.js"]
    }
  }
}
```

## Usage

Once configured, the MCP client will show available GSD tools. You can:

1. **Start a new project**:
   - Use the `gsd_new_project` tool
   - Provide project name and description

2. **Plan a phase**:
   - Use `gsd_plan_phase` with the phase number
   - The system will create executable plans

3. **Execute a phase**:
   - Use `gsd_execute_phase`
   - The planned work will be executed

4. **Verify the work**:
   - Use `gsd_verify_work`
   - Confirm everything works as expected

## Differences from Claude Code/OpenCode/Gemini

| Feature | Claude Code | OpenCode | Gemini | MCP |
|---------|-------------|----------|--------|-----|
| Interface | Slash commands | Flat commands | TOML files | Tools |
| Storage | `~/.claude/` | `~/.config/opencode/` | `~/.gemini/` | N/A |
| Config | `settings.json` | `opencode.json` | `settings.json` | MCP client config |
| Transport | N/A | N/A | N/A | stdio |

## Architecture

```
mcp-server/
├── src/
│   ├── index.ts          # Entry point server
│   ├── server.ts         # MCP Server setup
│   ├── tools/            # Tool implementations
│   │   ├── index.ts      # Tool registration
│   │   ├── core.ts       # Core GSD tools
│   │   ├── navigation.ts # Navigation tools
│   │   ├── brownfield.ts # Brownfield tools
│   │   ├── milestone.ts  # Milestone tools
│   │   ├── phase.ts      # Phase management
│   │   ├── utility.ts    # Utility tools
│   │   └── session.ts    # Session tools
│   ├── resources/        # Resource providers
│   │   ├── index.ts      # Resource registration
│   │   └── provider.ts   # Resource provider
│   ├── prompts/          # Prompt handlers
│   │   └── index.ts      # Prompt registration
│   └── utils/            # Utilities
│       ├── tool-mapper.ts    # Tool name mapping
│       └── path-resolver.ts  # Path resolution
├── dist/                 # Compiled output
├── package.json
└── tsconfig.json
```

## Development

### Build

```bash
npm run build
```

### Watch mode

```bash
npm run dev
```

### Inspect with MCP Inspector

```bash
npm run inspect
```

## Troubleshooting

### Server not found

If you see the error "MCP server not found":

```bash
npm run build:mcp
```

### Tools not visible

1. Verify the server is configured correctly in the MCP client
2. Restart the MCP client
3. Check server logs in stderr

### Connection failed

- Verify Node.js >= 16.7.0 is installed
- Check the server path is correct
- Ensure no other processes are using the same stdio connection

## License

MIT License - see LICENSE in the main repository.

## Community

- Discord: https://discord.gg/5JJgD5svVS
- GitHub: https://github.com/glittercowboy/get-shit-done
