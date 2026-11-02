export interface AppConfig {
    port: number;
    host: string;
    corsOrigin: string | string[];
    geminiApiKey?: string;
    dbPath: string;
    isDev: boolean;
}
export declare const env: AppConfig;
