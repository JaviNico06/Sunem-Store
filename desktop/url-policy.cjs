function validateSiteUrl(raw) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.port ||
    url.pathname !== "/" ||
    url.hostname.toLowerCase().includes("tu-proyecto")
  )
    throw new Error(
      "Configura una URL HTTPS real del catálogo, sin rutas ni credenciales.",
    );
  return url.origin;
}
function sameOrigin(raw, origin) {
  try {
    return new URL(raw).origin === origin && new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}
module.exports = { validateSiteUrl, sameOrigin };
