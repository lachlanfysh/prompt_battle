export const getSocketURL = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = process.env.NODE_ENV === 'production' ? window.location.port : '3001';
  return `${protocol}//${hostname}:${port}`;
};

export const getProxiedImageUrl = (originalUrl) => {
  if (!originalUrl) return originalUrl;

  if (originalUrl.startsWith('https://oaidalleapiprodscus.blob.core.windows.net/')) {
    const baseUrl = process.env.NODE_ENV === 'production'
      ? window.location.origin
      : `${window.location.protocol}//${window.location.hostname}:3001`;
    return `${baseUrl}/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
  }

  return originalUrl;
};
