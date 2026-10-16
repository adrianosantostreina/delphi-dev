/**
 * JavaScript plugin that OpenCode auto-loads from ~/.config/opencode/plugins/.
 * It only shells out to the committed runtime bundles; every failure is swallowed.
 */
export function renderOpencodePlugin(checkoutDir: string): string {
  const root = checkoutDir.replace(/\\/g, '/').replace(/\/+$/, '');
  return `// delphi-dev (gerenciado: regenerado por \`kb-cli install\`; nao edite)
import { spawnSync } from "node:child_process";

const ROOT = ${JSON.stringify(root)};
const FIX_ENCODING = ROOT + "/runtime/hook-fix-encoding.mjs";
const INJECT = ROOT + "/runtime/hook-inject.mjs";
const EDIT_TOOLS = new Set(["edit", "write", "patch", "apply_patch", "multiedit"]);

function run(script, payload) {
  try {
    const r = spawnSync("node", [script], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
    });
    return r.status === 0 && typeof r.stdout === "string" ? r.stdout : "";
  } catch {
    return "";
  }
}

function safeCwd(ctx) {
  try {
    return (ctx && (ctx.directory || ctx.worktree)) || process.cwd();
  } catch {
    return "";
  }
}

export default async function DelphiDev(ctx) {
  const cwd = safeCwd(ctx);
  let lastPrompt = "";
  return {
    "chat.message": async (_input, output) => {
      try {
        const parts = (output && output.parts) || [];
        lastPrompt = parts
          .filter((p) => p && p.type === "text" && typeof p.text === "string")
          .map((p) => p.text)
          .join("\\n");
      } catch {}
    },
    "experimental.chat.system.transform": async (_input, output) => {
      try {
        if (!lastPrompt || !output || !Array.isArray(output.system)) return;
        const raw = run(INJECT, { prompt: lastPrompt, cwd });
        if (!raw) return;
        const context = JSON.parse(raw)?.hookSpecificOutput?.additionalContext;
        if (typeof context === "string" && context) output.system.push(context);
      } catch {}
    },
    "tool.execute.after": async (input) => {
      try {
        const tool = input && input.tool;
        if (!EDIT_TOOLS.has(String(tool).toLowerCase())) return;
        run(FIX_ENCODING, { tool_name: tool, tool_input: input.args || {}, cwd });
      } catch {}
    },
  };
}
`;
}
