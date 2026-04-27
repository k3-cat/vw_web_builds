import { version } from "../package.json";
import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { getWebInstrumentations, initializeFaro, InternalLoggerLevel } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";
import clarity from "@microsoft/clarity";

import { AppModule } from "./app/app.module";

const faro = initializeFaro({
  url: process.env.VITE_FARO_DSN,
  app: {
    name: "web-vault",
    version,
    environment: process.env.NODE_ENV,
  },
  internalLoggerLevel: InternalLoggerLevel.WARN,
  sessionTracking: {
    samplingRate: 1,
    persistent: true,
  },
  instrumentations: [
    ...getWebInstrumentations(),
    new TracingInstrumentation({
      instrumentationOptions: {
        fetchInstrumentationOptions: {
          applyCustomAttributesOnSpan: (span, request, _response) => {
            const headers = new Headers(request.headers);
            if (!headers) {
              return;
            }

            const cfRay = headers.get("cf-ray")?.split("-");
            if (cfRay) {
              span.setAttribute("cloudflare.ray_id", cfRay[0]);
              span.setAttribute("cloudflare.colo", cfRay[1]);
            }
          },
        },
      },
    }),
  ],
});

clarity.init(process.env.VITE_CLARITY_ID);

if (process.env.NODE_ENV === "production") {
  enableProdMode();
}

void platformBrowserDynamic().bootstrapModule(AppModule);
