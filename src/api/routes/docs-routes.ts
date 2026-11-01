import { readFileSync } from 'node:fs';
import { Router } from 'express';

const SPEC_FILE = new URL('../../../openapi.yaml', import.meta.url);

const DOCS_PAGE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Hotel Booking API</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({ url: '/openapi.yaml', dom_id: '#swagger-ui' });
    </script>
  </body>
</html>
`;

export function docsRoutes(): Router {
  const router = Router();
  const spec = readFileSync(SPEC_FILE, 'utf8');

  router.get('/openapi.yaml', (_req, res) => {
    res.type('text/yaml').send(spec);
  });

  router.get('/docs', (_req, res) => {
    res.type('html').send(DOCS_PAGE);
  });

  return router;
}
