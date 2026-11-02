export interface SqliteDatabase {
    exec(sql: string): void;
    prepare(sql: string): {
        run(...params: unknown[]): unknown;
        all(...params: unknown[]): unknown[];
        get(...params: unknown[]): unknown;
    };
    close(): void;
}
export declare function getDatabase(): SqliteDatabase;
export declare function closeDatabase(): void;
