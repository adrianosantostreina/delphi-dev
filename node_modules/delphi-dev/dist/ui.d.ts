import { Ora } from 'ora';
export declare function step(message: string): void;
export declare function success(message: string): void;
export declare function warn(message: string): void;
export declare function error(message: string): void;
export declare function header(title: string): void;
export declare function spinner(text: string): Ora;
export declare function summary(items: Array<{
    label: string;
    ok: boolean;
    note?: string;
}>): void;
//# sourceMappingURL=ui.d.ts.map