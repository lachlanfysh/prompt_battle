const buildBaseUrl = (portOverride = null) => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = portOverride !== null ? portOverride : window.location.port;
  const portSegment = port ? `:${port}` : '';
  return `${protocol}//${hostname}${portSegment}`;
};

export const getSocketURL = () => {
  if (process.env.NODE_ENV === 'production') {
    return buildBaseUrl();
  }

  return buildBaseUrl('3001');
};

export const getProxiedImageUrl = (originalUrl) => {
  if (!originalUrl) return originalUrl;

  const baseUrl = process.env.NODE_ENV === 'production'
    ? buildBaseUrl()
    : buildBaseUrl('3001');

  if (originalUrl.startsWith('https://oaidalleapiprodscus.blob.core.windows.net/')) {
    return `${baseUrl}/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
  }

  if (/^https?:\/\//i.test(originalUrl) || originalUrl.startsWith('data:')) {
    return originalUrl;
  }

  if (originalUrl.startsWith('/')) {
    return `${baseUrl}${originalUrl}`;
  }

  return originalUrl;
};
