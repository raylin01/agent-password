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

async function cleanupDataDir(dataDir) {
  await fs.rm(dataDir, {
    recursive: true,
    force: true
  });
}

test("service creates login card and secret entries with hidden keys", async () => {
  const { dataDir, service } = await createTempService();

  try {
    await service.createLoginEntry({
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
    await service.createSecretEntry({
      label: "Cloudflare",
      provider: "Cloudflare",
      fields: [
        { name: "api_token", value: "cf-token" },
        { name: "account_id", value: "acct_123" }
      ]
    }, {
      actor_type: "agent",
      actor_id: "test"
    });

    const entries = service.listEntries();

    assert.equal(entries.length, 3);
    assert.equal(entries[0].key, "costco");
    assert.equal(entries[0].fields[0].handle, "COSTCO_USERNAME_1");
    assert.equal(entries[1].entryType, "card");
    assert.equal(entries[1].fields.find((field) => field.fieldName === "card_number").previewMasked.endsWith("1111"), true);
    assert.equal(entries[2].entryType, "secret");
    assert.equal(entries[2].fields[0].handle, "CLOUDFLARE_API_TOKEN_1");
  } finally {
    await cleanupDataDir(dataDir);
  }
});

test("service dedupes labels and regenerates handles on rename", async () => {
  const { dataDir, service } = await createTempService();

  try {
    const first = await service.createLoginEntry({
      label: "Costco",
      site: "https://www.costco.com",
      fieldValues: {
        password: "first-password"
      }
    }, {
      actor_type: "agent",
      actor_id: "test"
    });
    const second = await service.createLoginEntry({
      label: "Costco",
      site: "https://www.costco.com/member",
      fieldValues: {
        password: "second-password"
      }
    }, {
      actor_type: "agent",
      actor_id: "test"
    });

    assert.equal(first.label, "Costco");
    assert.equal(second.label, "Costco (1)");
    assert.equal(second.key, "costco-1");
    assert.equal(second.fields[0].handle, "COSTCO_1_PASSWORD_1");

    const renamed = await service.updateEntry(first.id, {
      label: "AWS Prod"
    }, {
      actor_type: "agent",
      actor_id: "test"
    });

    assert.equal(renamed.label, "AWS Prod");
    assert.equal(renamed.key, "aws-prod");
    assert.equal(renamed.fields[0].handle, "AWS_PROD_PASSWORD_1");
  } finally {
    await cleanupDataDir(dataDir);
  }
});

test("service updates and removes free-form secret fields", async () => {
  const { dataDir, service } = await createTempService();

  try {
    const entry = await service.createSecretEntry({
      label: "AWS Prod",
      provider: "AWS",
      fields: [
        { name: "access_key_id", value: "AKIA..." }
      ]
    }, {
      actor_type: "agent",
      actor_id: "test"
    });

    const afterAdd = await service.addField(entry.id, "secret_access_key", "super-secret", {
      actor_type: "agent",
      actor_id: "test"
    });
    const secretField = afterAdd.fields.find((field) => field.fieldName === "secret_access_key");

    assert.equal(secretField.handle, "AWS_PROD_SECRET_ACCESS_KEY_1");

    const afterUpdate = await service.updateField(secretField.id, {
      value: "even-more-secret"
    }, {
      actor_type: "agent",
      actor_id: "test"
    });

    assert.equal(afterUpdate.fields.some((field) => field.previewMasked.includes("even-more-secret")), false);

    const afterRemoval = await service.removeField(secretField.id, {
      actor_type: "agent",
      actor_id: "test"
    });

    assert.equal(afterRemoval.fields.some((field) => field.fieldName === "secret_access_key"), false);
  } finally {
    await cleanupDataDir(dataDir);
  }
});

test("service generates TOTP and enforces browser-fill origin policy", async () => {
  const { dataDir, service } = await createTempService();

  try {
    const entry = await service.createLoginEntry({
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
    await cleanupDataDir(dataDir);
  }
});

test("service renders files with replacement and redacts command output", async () => {
  const { dataDir, service } = await createTempService();
  const templatePath = path.join(dataDir, "login.template.txt");

  try {
    await service.createLoginEntry({
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
    await fs.writeFile(templatePath, "username=COSTCO_USERNAME_1\npassword=COSTCO_PASSWORD_1\n", "utf8");

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
    assert.equal(result.execution.stdout.includes("COSTCO_PASSWORD_1"), true);
  } finally {
    await cleanupDataDir(dataDir);
  }
});

test("service serializes concurrent saves safely", async () => {
  const { dataDir, service } = await createTempService();

  try {
    await Promise.all([
      service.createLoginEntry({
        label: "Costco",
        site: "https://www.costco.com",
        fieldValues: {
          password: "hunter2"
        }
      }, {
        actor_type: "agent",
        actor_id: "test"
      }),
      service.createCardEntry({
        label: "Chase Visa",
        issuer: "Chase",
        fieldValues: {
          card_number: "4111111111111111",
          expiry_month: "12",
          expiry_year: "2030",
          cvv: "123"
        }
      }, {
        actor_type: "agent",
        actor_id: "test"
      }),
      service.createSecretEntry({
        label: "Cloudflare",
        provider: "Cloudflare",
        fields: [
          { name: "api_token", value: "cf-secret" }
        ]
      }, {
        actor_type: "agent",
        actor_id: "test"
      })
    ]);

    const entries = service.listEntries();

    assert.equal(entries.length, 3);
    assert.equal(entries.some((entry) => entry.label === "Costco"), true);
    assert.equal(entries.some((entry) => entry.label === "Chase Visa"), true);
    assert.equal(entries.some((entry) => entry.label === "Cloudflare"), true);
  } finally {
    await cleanupDataDir(dataDir);
  }
});
