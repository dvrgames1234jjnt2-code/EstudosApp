import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  DEFAULT_SIMULADOS_CONFIG,
  normalizeSimuladosConfig,
  type SimuladosConfig,
} from "@/lib/simuladosConfig";

const DATA_DIR = path.join(process.cwd(), ".data");
const CONFIG_FILE = path.join(DATA_DIR, "simulados-config.json");

async function readConfigFile(): Promise<SimuladosConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<SimuladosConfig>;
    return normalizeSimuladosConfig(parsed);
  } catch {
    return normalizeSimuladosConfig(DEFAULT_SIMULADOS_CONFIG);
  }
}

async function writeConfigFile(config: SimuladosConfig): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpFile = `${CONFIG_FILE}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(config, null, 2), "utf8");
  await fs.rename(tmpFile, CONFIG_FILE);
}

export async function GET() {
  const config = await readConfigFile();
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { config?: Partial<SimuladosConfig> } | Partial<SimuladosConfig>;
    const rawConfig =
      body && typeof body === "object" && "config" in body && body.config
        ? body.config
        : (body as Partial<SimuladosConfig>);

    const normalized = normalizeSimuladosConfig(rawConfig);
    await writeConfigFile(normalized);
    return NextResponse.json({ ok: true, config: normalized });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar configurações.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
