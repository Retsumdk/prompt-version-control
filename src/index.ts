import { v4 as uuidv4 } from 'uuid';
import { diffLines, diffWords, diffChars, Change } from 'diff';
import * as fs from 'fs';
import * as path from 'path';

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  content: string;
  message: string;
  parentId?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface Prompt {
  id: string;
  name: string;
  currentVersion: number;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface Branch {
  id: string;
  name: string;
  promptId: string;
  headVersionId: string;
  createdAt: number;
}

export interface DiffOptions {
  type?: 'lines' | 'words' | 'chars';
}

export interface PromptStoreConfig {
  storagePath?: string;
}

export class PromptVersionControl {
  private storagePath: string;
  private prompts: Map<string, Prompt> = new Map();
  private versions: Map<string, PromptVersion[]> = new Map();
  private branches: Map<string, Branch[]> = new Map();

  constructor(config: PromptStoreConfig = {}) {
    this.storagePath = config.storagePath || './prompt-store';
    this.ensureStorage();
    this.load();
  }

  private ensureStorage(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  private load(): void {
    const promptsFile = path.join(this.storagePath, 'prompts.json');
    const versionsFile = path.join(this.storagePath, 'versions.json');
    const branchesFile = path.join(this.storagePath, 'branches.json');

    if (fs.existsSync(promptsFile)) {
      const data = JSON.parse(fs.readFileSync(promptsFile, 'utf-8'));
      this.prompts = new Map(Object.entries(data));
    }

    if (fs.existsSync(versionsFile)) {
      const data = JSON.parse(fs.readFileSync(versionsFile, 'utf-8'));
      this.versions = new Map(
        Object.entries(data).map(([k, v]) => [k, v as PromptVersion[]])
      );
    }

    if (fs.existsSync(branchesFile)) {
      const data = JSON.parse(fs.readFileSync(branchesFile, 'utf-8'));
      this.branches = new Map(
        Object.entries(data).map(([k, v]) => [k, v as Branch[]])
      );
    }
  }

  private save(): void {
    const promptsFile = path.join(this.storagePath, 'prompts.json');
    const versionsFile = path.join(this.storagePath, 'versions.json');
    const branchesFile = path.join(this.storagePath, 'branches.json');

    fs.writeFileSync(promptsFile, JSON.stringify(Object.fromEntries(this.prompts), null, 2));
    fs.writeFileSync(versionsFile, JSON.stringify(Object.fromEntries(this.versions), null, 2));
    fs.writeFileSync(branchesFile, JSON.stringify(Object.fromEntries(this.branches), null, 2));
  }

  createPrompt(name: string, initialContent: string, message = 'Initial version', metadata?: Record<string, unknown>): Prompt {
    const promptId = uuidv4();
    const versionId = uuidv4();

    const prompt: Prompt = {
      id: promptId,
      name,
      currentVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata,
    };

    const version: PromptVersion = {
      id: versionId,
      promptId,
      version: 1,
      content: initialContent,
      message,
      createdAt: Date.now(),
    };

    this.prompts.set(promptId, prompt);
    this.versions.set(promptId, [version]);
    this.save();

    return prompt;
  }

  getPrompt(promptId: string): Prompt | null {
    return this.prompts.get(promptId) || null;
  }

  getPromptByName(name: string): Prompt | null {
    for (const prompt of this.prompts.values()) {
      if (prompt.name === name) return prompt;
    }
    return null;
  }

  listPrompts(): Prompt[] {
    return Array.from(this.prompts.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  update(promptId: string, content: string, message: string, metadata?: Record<string, unknown>): PromptVersion {
    const prompt = this.prompts.get(promptId);
    if (!prompt) throw new Error(`Prompt ${promptId} not found`);

    const versions = this.versions.get(promptId) || [];
    const parentVersion = versions[versions.length - 1];
    const newVersionNum = prompt.currentVersion + 1;

    const version: PromptVersion = {
      id: uuidv4(),
      promptId,
      version: newVersionNum,
      content,
      message,
      parentId: parentVersion?.id,
      createdAt: Date.now(),
      metadata,
    };

    prompt.currentVersion = newVersionNum;
    prompt.updatedAt = Date.now();

    versions.push(version);
    this.versions.set(promptId, versions);
    this.save();

    return version;
  }

  getVersion(promptId: string, versionNum: number): PromptVersion | null {
    const versions = this.versions.get(promptId);
    if (!versions) return null;
    return versions.find(v => v.version === versionNum) || null;
  }

  getLatestVersion(promptId: string): PromptVersion | null {
    const versions = this.versions.get(promptId);
    if (!versions || versions.length === 0) return null;
    return versions[versions.length - 1];
  }

  getVersionHistory(promptId: string): PromptVersion[] {
    return this.versions.get(promptId) || [];
  }

  diff(v1: PromptVersion, v2: PromptVersion, options: DiffOptions = {}): Change[] {
    const type = options.type || 'lines';

    switch (type) {
      case 'chars':
        return diffChars(v1.content, v2.content);
      case 'words':
        return diffWords(v1.content, v2.content);
      default:
        return diffLines(v1.content, v2.content);
    }
  }

  diffVersions(promptId: string, fromVersion: number, toVersion: number, options: DiffOptions = {}): Change[] {
    const v1 = this.getVersion(promptId, fromVersion);
    const v2 = this.getVersion(promptId, toVersion);

    if (!v1 || !v2) throw new Error('Version not found');

    return this.diff(v1, v2, options);
  }

  rollback(promptId: string, toVersion: number): PromptVersion {
    const targetVersion = this.getVersion(promptId, toVersion);
    if (!targetVersion) throw new Error(`Version ${toVersion} not found`);

    return this.update(promptId, targetVersion.content, `Rolled back to version ${toVersion}`);
  }

  createBranch(promptId: string, branchName: string): Branch {
    const latest = this.getLatestVersion(promptId);
    if (!latest) throw new Error(`No versions found for prompt ${promptId}`);

    const existingBranches = this.branches.get(promptId) || [];
    if (existingBranches.some(b => b.name === branchName)) {
      throw new Error(`Branch ${branchName} already exists`);
    }

    const branch: Branch = {
      id: uuidv4(),
      name: branchName,
      promptId,
      headVersionId: latest.id,
      createdAt: Date.now(),
    };

    existingBranches.push(branch);
    this.branches.set(promptId, existingBranches);
    this.save();

    return branch;
  }

  listBranches(promptId: string): Branch[] {
    return this.branches.get(promptId) || [];
  }

  switchBranch(promptId: string, branchName: string): PromptVersion {
    const branches = this.branches.get(promptId) || [];
    const branch = branches.find(b => b.name === branchName);
    if (!branch) throw new Error(`Branch ${branchName} not found`);

    const versions = this.versions.get(promptId) || [];
    const version = versions.find(v => v.id === branch.headVersionId);
    if (!version) throw new Error('Branch head version not found');

    return version;
  }

  mergeBranch(promptId: string, branchName: string, message: string): PromptVersion {
    const version = this.switchBranch(promptId, branchName);
    return this.update(promptId, version.content, message);
  }

  deletePrompt(promptId: string): boolean {
    if (!this.prompts.has(promptId)) return false;

    this.prompts.delete(promptId);
    this.versions.delete(promptId);
    this.branches.delete(promptId);
    this.save();

    return true;
  }

  export(promptId: string): { prompt: Prompt; versions: PromptVersion[]; branches: Branch[] } {
    const prompt = this.prompts.get(promptId);
    if (!prompt) throw new Error(`Prompt ${promptId} not found`);

    return {
      prompt,
      versions: this.versions.get(promptId) || [],
      branches: this.branches.get(promptId) || [],
    };
  }

  import(data: { prompt: Prompt; versions: PromptVersion[]; branches: Branch[] }): void {
    const { prompt, versions, branches } = data;

    this.prompts.set(prompt.id, prompt);
    this.versions.set(prompt.id, versions);
    this.branches.set(prompt.id, branches);
    this.save();
  }
}

export default PromptVersionControl;
