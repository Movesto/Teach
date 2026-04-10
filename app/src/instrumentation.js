/**
 * OpenTelemetry instrumentation for the Barashada frontend.
 *
 * Captures:
 *   - fetch() calls (lessons, quiz submits, AI chat, auth, etc.)
 *   - XMLHttpRequest calls
 *
 * Traces are sent via OTLP/HTTP to the otel-collector, which forwards
 * them to Tempo. Import this file once at the top of main.jsx, before
 * anything else, so instrumentation is active for the entire session.
 */

import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const collectorUrl =
  import.meta.env.VITE_OTEL_EXPORTER_URL || 'http://localhost:4318/v1/traces';

const provider = new WebTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'teach-frontend',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({ url: collectorUrl }),
    ),
  ],
});

provider.register();

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      // Only trace calls to our own backend, not third-party CDNs
      propagateTraceHeaderCorsUrls: [/localhost/, /\/api\//],
      clearTimingResources: true,
    }),
    new XMLHttpRequestInstrumentation({
      propagateTraceHeaderCorsUrls: [/localhost/, /\/api\//],
    }),
  ],
});
