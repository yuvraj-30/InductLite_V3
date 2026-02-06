import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;

function parseHeaders(
  headerString?: string,
): Record<string, string> | undefined {
  if (!headerString) return undefined;

  const headers: Record<string, string> = {};

  for (const pair of headerString.split(",")) {
    const [rawKey, ...rest] = pair.split("=");
    const key = rawKey?.trim();
    if (!key) continue;
    const value = rest.join("=").trim();
    if (!value) continue;
    headers[key] = value;
  }

  return Object.keys(headers).length ? headers : undefined;
}

function buildExporter(): OTLPTraceExporter | null {
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!endpoint) return null;

  return new OTLPTraceExporter({
    url: endpoint,
    headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
  });
}

export async function startOpenTelemetry(): Promise<void> {
  if (sdk) return;

  const exporter = buildExporter();
  if (!exporter) return;

  sdk = new NodeSDK({
    traceExporter: exporter,
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME || "inductlite-web",
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.npm_package_version || "0.1.0",
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV || "development",
    }),
  });

  await sdk.start();
}

export async function shutdownOpenTelemetry(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
}
