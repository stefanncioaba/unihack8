// Normalizes the public Spring Boot URL configured for this phone.
export function apiBaseUrl(value = process.env.EXPO_PUBLIC_API_URL) {
  if (!value) {
    throw new Error('Set EXPO_PUBLIC_API_URL to the Spring Boot server URL');
  }

  return value.replace(/\/+$/, '');
}

// Makes a JSON GET request; feature services can use this when endpoints exist.
export async function apiGet(path, options = {}) {
  const baseUrl = apiBaseUrl(options.baseUrl);
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(`${baseUrl}/${path.replace(/^\/+/, '')}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}
