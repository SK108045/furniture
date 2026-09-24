export function safeDestination(value) {
  return ['/account', '/checkout', '/collection'].includes(value) ? value : '/account';
}

export function clerkHost(key) {
  if (!/^pk_(test|live)_[A-Za-z0-9+/=]+$/.test(key || '')) return null;
  try {
    const decoded = atob(key.split('_')[2]);
    if (!decoded.endsWith('$')) return null;
    const host = decoded.slice(0, -1);
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(host)) return null;
    return host;
  } catch { return null; }
}
