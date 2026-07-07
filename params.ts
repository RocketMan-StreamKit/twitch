/**
 * Merges partial updates into the stored addon parameter blob.
 * `api.config.updateParams` replaces the full blob, so callers must preserve existing keys.
 */
export const patchParams = async (
  patch: Record<string, unknown>
): Promise<void> => {
  const params = await api.config.getParams();
  await api.config.updateParams({ ...params, ...patch });
};
