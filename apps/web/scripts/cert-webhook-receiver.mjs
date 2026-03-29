import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const port = Number(process.env.CERT_WEBHOOK_PORT ?? 4015);
const host = process.env.CERT_WEBHOOK_HOST ?? "127.0.0.1";
const logPath =
  process.env.CERT_WEBHOOK_LOG_PATH ??
  path.join(process.cwd(), "tmp", "cert-webhook-receiver.log");

fs.mkdirSync(path.dirname(logPath), { recursive: true });

const server = http.createServer((req, res) => {
  const chunks = [];

  req.on("data", (chunk) => {
    chunks.push(Buffer.from(chunk));
  });

  req.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    const entry = {
      receivedAt: new Date().toISOString(),
      method: req.method ?? "GET",
      url: req.url ?? "/",
      headers: req.headers,
      body,
    };

    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      status: "listening",
      host,
      port,
      logPath,
    }),
  );
});
