"""
OpenTelemetry setup for the Barashada backend.

Wires up three signals:
  Traces  — FastAPI requests, psycopg2 queries, and httpx calls are
            auto-instrumented and exported via OTLP gRPC to the collector.
  Logs    — Python's standard logging is bridged into OTel and forwarded
            to the collector, which ships them to Loki.
  Metrics — prometheus-fastapi-instrumentator exposes /metrics so
            Prometheus can scrape HTTP request counts, latency histograms,
            and error rates directly from the app.

Call setup_telemetry(app) once, after FastAPI() is created but before the
first request is handled (i.e. inside the lifespan startup hook).
"""

import logging
import os

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter

from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor

from prometheus_fastapi_instrumentator import Instrumentator


def setup_telemetry(app) -> None:
    """Initialise tracing, logging, and metrics. Call once at startup."""
    collector = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")

    resource = Resource.create({
        "service.name": os.getenv("OTEL_SERVICE_NAME", "teach-backend"),
        "service.version": "1.0.0",
        "deployment.environment": os.getenv("ENVIRONMENT", "production"),
    })

    # ── Traces ────────────────────────────────────────────────────────────────
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(endpoint=collector, insecure=True)
        )
    )
    trace.set_tracer_provider(tracer_provider)

    # ── Logs ──────────────────────────────────────────────────────────────────
    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(
        BatchLogRecordProcessor(
            OTLPLogExporter(endpoint=collector, insecure=True)
        )
    )
    set_logger_provider(logger_provider)

    # Bridge Python's standard logging into OTel (INFO and above)
    otel_handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
    logging.getLogger().addHandler(otel_handler)
    logging.getLogger().setLevel(logging.INFO)

    # ── Auto-instrumentation ──────────────────────────────────────────────────
    FastAPIInstrumentor.instrument_app(app)   # traces every HTTP request
    HTTPXClientInstrumentor().instrument()    # traces calls to Qwen, NLLB, etc.
    Psycopg2Instrumentor().instrument()       # traces every DB query

    # ── Metrics (/metrics endpoint for Prometheus) ────────────────────────────
    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        excluded_handlers=["/metrics", "/api/health"],
    ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

    logging.getLogger(__name__).info("Telemetry initialised (collector=%s)", collector)
