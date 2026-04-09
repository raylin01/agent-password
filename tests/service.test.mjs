import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { AgentPassService } from "../src/lib/vault-service.mjs";

async function createTempService() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentpass-service-"));
  const service = new AgentPassService({
    dataDir
  });

  await service.init("top-secret-passphrase", {
    actor_type: "system",
    actor_id: "test"
  });

  return {
    dataDir,
    service
  };
}

test("service creates typed login and card entries safely", async () => {
  const { dataDir, service } = await createTempService();

  try {
    await service.createLoginEntry({
      key: "costco.com",
      label: "Costco",
      site: "https://www.costco.com",
      fieldValues: {
        username: "ray@example.com",
        password: "hunter2",
        totp_seed: "JBSWY3DPEHPK3PXP"
      }
    }, {
      actor_type: "agent",
      actor_id: "test"
    });
    await service.createCardEntry({
      key: "chase-visa",
      label: "Chase Visa",
      issuer: "Chase",
      fieldValues: {
        cardholder_name: "Ray Lin",
        card_number: "4111111111111111",
        expiry_month: "12",
        expiry_year: "2030",
        cvv: "123",
        billing_postal_code: "94105"
      }
    }, {
      actor_type: "agent",
      actor_id: "test"
    });

    const entries = service.listEntries();

    assert.equal(entries.length, 2);
    assert.equal(entries[0].entryType, "login");
    assert.equal(entries[0].fields[0].handle, "COSTCO_COM_USERNAME_1");
    assert.equal(entries[0].fields.some((field) => field.previewMasked.includes("hunter2")), false);
    assert.equal(entries[1].entryType, "card");
    assert.equal(entries[1].fields.find((field) => field.fieldName === "card_number").previewMasked.endsWith("1111"), true);
  } finally {
    await fs.rm(dataDir, {
      recursive: true,
      force: true
    });
  }
});

test("service updates and removes fields and entries", async () => {
  const { dataDir, service } = await createTempService();

  try {
    const entry = await service.createLoginEntry({
      key: "github.com",
      label: "GitHub",
      site: "https://github.com",
      fieldValues: {
        email: "ray@example.com",
        password: "old-password"
      }
    }, {
      actor_type: "agent",
      actor_id: "test"
    });
    const passwordField = entry.fields.find((field) => field.fieldName === "password");

    await service.updateField(passwordField.id, {
      value: "new-password"
    }, {
      actor_type: "agent",
      actor_id: "test"
    });

    const emailField = entry.fields.find((field) => field.fieldName === "email");
    const afterRemoval = await service.removeField(emailField.id, {
      actor_type: "agent",
      actor_id: "test"
    });

    assert.equal(afterRemoval.fields.some((field) => field.fieldName === "email"), false);

    const removal = await service.removeEntry(entry.id, {
      actor_type: "agent",
      actor_id: "test"
    });

    assert.equal(removal.removed, true);
    assert.equal(service.listEntries().length, 0);
  } finally {
    await fs.rm(dataDir, {
      recursive: true,
      force: true
    });
  }
});

test("service generates TOTP and enforces browser-fill origin policy", async () => {
  const { dataDir, service } = await createTempService();

  try {
    const entry = await service.createLoginEntry({
      key: "costco.com",
      label: "Costco",
      site: "https://www.costco.com",
      fieldValues: {
        password: "hunter2",
        totp_seed: "JBSWY3DPEHPK3PXP"
      }
    }, {
      actor_type: "agent",
      actor_id: "test"
    });
    const passwordField = entry.fields.find((field) => field.fieldName === "password");

    await service.updateField(passwordField.handle, {
      policy: {
        allowedUseModes: ["browser_fill"],
        allowedOrigins: ["https://www.costco.com"]
      }
    }, {
      actor_type: "agent",
      actor_id: "test"
    });

    const fillResult = await service.prepareBrowserFill(passwordField.handle, "https://www.costco.com/login", {
      actor_type: "agent",
      actor_id: "test"
    });
    const totpField = entry.fields.find((field) => field.fieldName === "totp_seed");
    const totpResult = await service.generateTotpCode(totpField.handle, {
      actor_type: "agent",
      actor_id: "test"
    });

    assert.equal(fillResult.value, "hunter2");
    assert.equal(totpResult.code.length, 6);

    await assert.rejects(async () => {
      await service.prepareBrowserFill(passwordField.handle, "https://evil.example/login", {
        actor_type: "agent",
        actor_id: "test"
      });
    }, /not allowed/i);
  } finally {
    await fs.rm(dataDir, {
      recursive: true,
      force: true
    });
  }
});

test("service renders files with replacement and redacts command output", async () => {
  const { dataDir, service } = await createTempService();
  const templatePath = path.join(dataDir, "login.template.txt");

  try {
    await service.createLoginEntry({
      key: "costco.com",
      label: "Costco",
      site: "https://www.costco.com",
      fieldValues: {
        username: "ray@example.com",
        password: "hunter2"
      }
    }, {
      actor_type: "agent",
      actor_id: "test"
    });
    await fs.writeFile(templatePath, "username=COSTCO_COM_USERNAME_1\npassword=COSTCO_COM_PASSWORD_1\n", "utf8");

    const result = await service.renderFile({
      templatePath,
      command: [
        "node",
        "-e",
        "console.log(require('node:fs').readFileSync(process.argv[1], 'utf8'))",
        "AGENTPASS_RENDERED_FILE"
      ],
      actor: {
        actor_type: "agent",
        actor_id: "test"
      }
    });

    assert.equal(result.execution.stdout.includes("hunter2"), false);
    assert.equal(result.execution.stdout.includes("COSTCO_COM_PASSWORD_1"), true);
  } finally {
    await fs.rm(dataDir, {
      recursive: true,
      force: true
    });
  }
});
