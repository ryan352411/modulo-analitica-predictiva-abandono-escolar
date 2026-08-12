import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { ExternalLink } from 'lucide-react';

const apiBase = import.meta.env.VITE_API_URL || '/api';
const docsUrl = apiBase.startsWith('http')
  ? `${apiBase.replace(/\/$/, '')}/docs.json`
  : `${window.location.origin}${apiBase.replace(/\/$/, '')}/docs.json`;

export default function ApiDocs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">API REST</h1>
          <p className="text-ink/60 text-sm">
            Documentación interactiva (Swagger / OpenAPI) del backend.
          </p>
        </div>
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5"
        >
          <ExternalLink className="h-4 w-4" /> Ver especificación JSON
        </a>
      </div>

      <div className="rounded-xl border border-ink/10 bg-white p-2">
        <SwaggerUI url={docsUrl} docExpansion="list" />
      </div>
    </div>
  );
}
