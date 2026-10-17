/**
 * Minimal ambient declarations for Node's built-in `node:sqlite` module.
 *
 * The project pins `@types/node@20`, which predates `node:sqlite` (added in
 * Node.js 22.5). The runtime (`node >= 24`) provides the module, so we only
 * declare the surface this application actually uses instead of pulling in a
 * newer `@types/node` release.
 *
 * Delete this file if `@types/node` is ever upgraded to >= 22.
 */
declare module "node:sqlite" {
  export type SQLInputValue = null | number | bigint | string | Uint8Array;

  export type SQLOutputValue = null | number | bigint | string | Uint8Array;

  export type SqlRow = Record<string, SQLOutputValue>;

  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export interface StatementSync {
    all(...anonymousParameters: SQLInputValue[]): SqlRow[];
    get(...anonymousParameters: SQLInputValue[]): SqlRow | undefined;
    run(...anonymousParameters: SQLInputValue[]): StatementResultingChanges;
    setAllowBareNamedParameters(enabled: boolean): void;
    setReadBigInts(enabled: boolean): void;
  }

  export interface DatabaseSyncOptions {
    open?: boolean;
    readOnly?: boolean;
    enableForeignKeyConstraints?: boolean;
    timeout?: number;
    allowExtension?: boolean;
  }

  export class DatabaseSync {
    constructor(path: string, options?: DatabaseSyncOptions);
    open(): void;
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
