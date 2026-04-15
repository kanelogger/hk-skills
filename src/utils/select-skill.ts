import readline from "node:readline";

export async function promptSelectSkill(
  message: string,
  choices: { name: string; subpath: string }[]
): Promise<string | null> {
  console.log(message);
  choices.forEach((c, i) => {
    console.log(`${i + 1}) ${c.name} (${c.subpath || "root"})`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        rl.close();
        resolve(null);
      }
    };

    rl.on("SIGINT", cleanup);
    rl.on("close", () => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });

    rl.question("Enter number: ", (answer) => {
      if (resolved) return;
      resolved = true;
      rl.close();
      const num = parseInt(answer.trim(), 10);
      if (isNaN(num) || num < 1 || num > choices.length) {
        resolve(null);
      } else {
        resolve(choices[num - 1]?.subpath ?? null);
      }
    });
  });
}
