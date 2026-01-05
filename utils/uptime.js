const startedAt = Date.now();

export const getUptimeSeconds = () => Math.floor((Date.now() - startedAt) / 1000);

