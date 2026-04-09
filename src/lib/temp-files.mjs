import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function writeRenderedTempFile({ sourcePath, content }) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "agentpass-"));
  const extension = path.extname(sourcePath || "");
  const filePath = path.join(tempDirectory, `rendered${extension}`);

  await fs.writeFile(filePath, content, {
    encoding: "utf8",
    mode: 0o600
  });
  await fs.chmod(filePath, 0o600);

  return {
    filePath,
    cleanup: async () => {
      await fs.rm(tempDirectory, {
        recursive: true,
        force: true
      });
    }
  };
}
