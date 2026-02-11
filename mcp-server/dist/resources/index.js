import { ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "url";
import { dirname, join, resolve, normalize } from "path";
import { readFile, access } from "fs/promises";
import { existsSync, readdirSync } from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resource base path (GSD installation)
function getGsdPath() {
    // Try to find GSD installation
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
        throw new Error("HOME or USERPROFILE environment variable must be set");
    }
    // Check for GSD_CONFIG_DIR env var first
    if (process.env.GSD_CONFIG_DIR) {
        return process.env.GSD_CONFIG_DIR;
    }
    // Default locations
    const possiblePaths = [
        join(homeDir, ".gsd"),
        join(homeDir, ".claude"),
        join(homeDir, ".config", "opencode"),
        join(homeDir, ".gemini"),
    ];
    for (const path of possiblePaths) {
        if (existsSync(join(path, "get-shit-done"))) {
            return path;
        }
    }
    // Fallback to local development path
    return join(dirname(__dirname), "..", "..");
}
const gsdPath = getGsdPath();
const getShitDonePath = join(gsdPath, "get-shit-done");
function listFiles(dir, prefix) {
    const resources = [];
    if (!existsSync(dir)) {
        return resources;
    }
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
            const name = entry.name.replace(".md", "");
            resources.push({
                uri: `gsd://${prefix}/${name}`,
                name: entry.name,
                mimeType: "text/markdown",
                description: `${prefix}/${name}`,
            });
        }
        else if (entry.isDirectory()) {
            const subResources = listFiles(join(dir, entry.name), `${prefix}/${entry.name}`);
            resources.push(...subResources);
        }
    }
    return resources;
}
export function registerResources(server) {
    // List resources handler
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        const resources = [];
        // Templates
        const templatesPath = join(getShitDonePath, "templates");
        resources.push(...listFiles(templatesPath, "templates"));
        // Workflows
        const workflowsPath = join(getShitDonePath, "workflows");
        resources.push(...listFiles(workflowsPath, "workflows"));
        // References
        const referencesPath = join(getShitDonePath, "references");
        resources.push(...listFiles(referencesPath, "references"));
        // Agents (from root)
        const agentsPath = join(gsdPath, "agents");
        if (existsSync(agentsPath)) {
            const agentFiles = readdirSync(agentsPath)
                .filter((f) => f.startsWith("gsd-") && f.endsWith(".md"))
                .map((f) => ({
                uri: `gsd://agents/${f.replace(".md", "")}`,
                name: f,
                mimeType: "text/markdown",
                description: `Agent: ${f.replace(".md", "").replace("gsd-", "")}`,
            }));
            resources.push(...agentFiles);
        }
        return { resources };
    });
    // Read resource handler
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        // Parse gsd:// URI
        const match = uri.match(/^gsd:\/\/(.+)$/);
        if (!match) {
            throw new Error(`Invalid GSD resource URI: ${uri}`);
        }
        const resourcePath = match[1];
        const [category, ...rest] = resourcePath.split("/");
        const fileName = rest.pop() || "";
        const subPath = rest.join("/");
        let filePath;
        let baseDir;
        switch (category) {
            case "templates":
                baseDir = join(getShitDonePath, "templates", subPath);
                filePath = join(baseDir, `${fileName}.md`);
                break;
            case "workflows":
                baseDir = join(getShitDonePath, "workflows");
                filePath = join(baseDir, `${fileName}.md`);
                break;
            case "references":
                baseDir = join(getShitDonePath, "references");
                filePath = join(baseDir, `${fileName}.md`);
                break;
            case "agents":
                baseDir = join(gsdPath, "agents");
                filePath = join(baseDir, `${fileName}.md`);
                break;
            default:
                throw new Error(`Unknown resource category: ${category}`);
        }
        // Security: Resolve and normalize the path
        const resolvedPath = resolve(normalize(filePath));
        const resolvedBaseDir = resolve(normalize(baseDir));
        // Ensure the resolved path is within the allowed base directory
        if (!resolvedPath.startsWith(resolvedBaseDir)) {
            throw new Error(`Access denied: path outside allowed directory`);
        }
        // Check if file exists
        try {
            await access(resolvedPath);
        }
        catch {
            throw new Error(`Resource not found: ${uri}`);
        }
        // Read file async (non-blocking)
        const content = await readFile(resolvedPath, "utf-8");
        return {
            contents: [
                {
                    uri,
                    mimeType: "text/markdown",
                    text: content,
                },
            ],
        };
    });
}
//# sourceMappingURL=index.js.map