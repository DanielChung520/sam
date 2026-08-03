// sam LINE Agent — Skill Registry
//
// 職責：
//   - 載入 manifest（內建 + 後續可從 DB 載入）
//   - 根據 intent 找出最合適的 skill
//   - 提供 list() 給管理介面 / debugging

import type { Intent, SkillManifest, SkillMatchResult } from './types.js';
import { AgentError } from './errors.js';

import greetingManifest from './skills/manifests/greeting.js';
import slashCommandManifest from './skills/manifests/slashCommand.js';
import webSearchManifest from './skills/manifests/webSearch.js';
import analyzeManifest from './skills/manifests/analyze.js';
import writeManifest from './skills/manifests/write.js';
import ocrManifest from './skills/manifests/ocr.js';
import cardCollectionManifest from './skills/manifests/cardCollection.js';
import fileProcessManifest from './skills/manifests/fileProcess.js';
import sttManifest from './skills/manifests/stt.js';
import readmeManifest from './skills/manifests/readme.js';

const BUILTIN_MANIFESTS: SkillManifest[] = [
  greetingManifest,
  slashCommandManifest,
  webSearchManifest,
  analyzeManifest,
  writeManifest,
  ocrManifest,
  cardCollectionManifest,
  fileProcessManifest,
  sttManifest,
  readmeManifest,
];

export class SkillRegistry {
  private skills = new Map<string, SkillManifest>();

  async load(): Promise<void> {
    for (const m of BUILTIN_MANIFESTS) {
      if (m && typeof m === 'object' && 'id' in m) {
        if (m.enabled === undefined) m.enabled = true;
        this.skills.set(m.id, m);
      }
    }
  }

  register(skill: SkillManifest): void {
    if (skill.enabled === undefined) skill.enabled = true;
    this.skills.set(skill.id, skill);
  }

  setEnabled(id: string, enabled: boolean): boolean {
    const skill = this.skills.get(id);
    if (!skill) return false;
    skill.enabled = enabled;
    return true;
  }

  get(id: string): SkillManifest | null {
    return this.skills.get(id) ?? null;
  }

  list(): SkillManifest[] {
    return Array.from(this.skills.values());
  }

  match(intent: Intent): SkillMatchResult | null {
    switch (intent.type) {
      case 'greeting':
        return this.matchById('greeting', intent, 'intent:greeting', 0.95);
      case 'slash_command':
        return this.matchById('slash-command', intent, 'intent:slash_command', 0.99);
      case 'request_skill': {
        const skill = this.skills.get(intent.skillId);
        if (!skill) return null;
        return {
          skill,
          confidence: 0.85,
          matchedTrigger: `intent:request_skill:${intent.skillId}`,
        };
      }
      default:
        return null;
    }
  }

  private matchById(
    id: string,
    intent: Intent,
    trigger: string,
    confidence: number,
  ): SkillMatchResult | null {
    const skill = this.skills.get(id);
    if (!skill) return null;
    if (skill.enabled === false) {
      throw new AgentError('SKILL_DISABLED', `skill ${id} is disabled`, {
        context: { skillId: id, intent },
      });
    }
    return { skill, confidence, matchedTrigger: trigger };
  }
}

let _registry: SkillRegistry | null = null;

export async function getSkillRegistry(): Promise<SkillRegistry> {
  if (!_registry) {
    _registry = new SkillRegistry();
    await _registry.load();
  }
  return _registry;
}

export function resetSkillRegistry(): void {
  _registry = null;
}