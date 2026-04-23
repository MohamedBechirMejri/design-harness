/**
 * Terminal types shim.
 *
 * The terminal module was removed in the design-harness pivot. These loose
 * type aliases exist only so dead-but-imported helpers on the web side
 * (terminalStateStore, terminalActivity, tests) keep type-checking without
 * needing a rewrite.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TerminalEvent = { [key: string]: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TerminalSessionSnapshot = { [key: string]: any };
