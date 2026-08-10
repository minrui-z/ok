export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    const source = "export const env = new Proxy({}, { get(_target, key) { return globalThis.__COLLAB_TEST_ENV?.[key]; } });";
    return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
