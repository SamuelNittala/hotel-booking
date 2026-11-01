import { AddressInfo } from 'node:net';
import { createApp } from '../../src/api/create-app';
import { AppOptions, AppServices, createServices } from '../../src/app/create-services';

export type TestServer = {
  services: AppServices;
  /** Sends a request. A JSON `body` is sent as JSON. The reply body is parsed when there is one. */
  call: (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>;
  /** Sends text as the request body exactly as given, for testing broken JSON. */
  callRaw: (method: string, path: string, rawBody: string) => Promise<{ status: number; body: any }>;
  close: () => Promise<void>;
};

/** Starts the real app on a free port, so tests go through real HTTP. */
export async function startTestServer(options: AppOptions = {}): Promise<TestServer> {
  const services = createServices(options);
  const server = createApp(services).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const send = async (method: string, path: string, rawBody?: string) => {
    const response = await fetch(baseUrl + path, {
      method,
      headers: rawBody === undefined ? undefined : { 'content-type': 'application/json' },
      body: rawBody,
    });
    const text = await response.text();
    return { status: response.status, body: text === '' ? undefined : JSON.parse(text) };
  };

  return {
    services,
    call: (method, path, body) => send(method, path, body === undefined ? undefined : JSON.stringify(body)),
    callRaw: (method, path, rawBody) => send(method, path, rawBody),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
