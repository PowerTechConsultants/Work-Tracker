declare module 'better-sqlite3' {
  namespace BetterSqlite3 {
    interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }
    interface Statement {
      get(...params: any[]): any;
      all(...params: any[]): any[];
      run(...params: any[]): RunResult;
    }
    interface Database {
      prepare(sql: string): Statement;
      exec(sql: string): void;
      pragma(pragma: string, options?: any): any;
      close(): void;
    }
  }
  interface DatabaseConstructor {
    new (filename: string, options?: Record<string, unknown>): BetterSqlite3.Database;
    (filename: string, options?: Record<string, unknown>): BetterSqlite3.Database;
  }
  const Database: DatabaseConstructor;
  export default Database;
}
