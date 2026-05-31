import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import {
    DEFAULT_BOX_CALCULATOR_CONFIG,
    mergeBoxCalculatorConfig,
    type BoxCalculatorConfig,
} from './boxCalculatorConfig';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'box-calculator.json');

let cache: BoxCalculatorConfig | null = null;

export async function readBoxCalculatorConfig(): Promise<BoxCalculatorConfig> {
    if (cache) return cache;

    try {
        const raw = await readFile(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<BoxCalculatorConfig>;
        cache = mergeBoxCalculatorConfig(parsed);
        return cache;
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.warn('[BoxCalcConfig] read error:', err);
        }
        cache = { ...DEFAULT_BOX_CALCULATOR_CONFIG, profilePricePerSqM: { ...DEFAULT_BOX_CALCULATOR_CONFIG.profilePricePerSqM } };
        return cache;
    }
}

export async function writeBoxCalculatorConfig(config: Partial<BoxCalculatorConfig>): Promise<BoxCalculatorConfig> {
    const merged = mergeBoxCalculatorConfig(config);
    await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    cache = merged;
    return merged;
}

export function clearBoxCalculatorConfigCache(): void {
    cache = null;
}
