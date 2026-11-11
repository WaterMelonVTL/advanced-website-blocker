/** Runs `action` and returns `[error, value]` instead of throwing. */
export function attempt(action) {
  try {
    return [null, action()];
  } catch (error) {
    return [error, undefined];
  }
}

/** Async version of `attempt`: resolves to `[error, value]` instead of rejecting. */
export async function attemptAsync(action) {
  try {
    return [null, await action()];
  } catch (error) {
    return [error, undefined];
  }
}
