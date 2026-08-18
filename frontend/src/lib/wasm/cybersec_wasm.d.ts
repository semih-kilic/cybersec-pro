/* tslint:disable */
/* eslint-disable */

export class ToolSearchEngine {
    free(): void;
    [Symbol.dispose](): void;
    get_all_categories(): any;
    get_tool_ids(): any;
    len(): number;
    constructor(tools_json: string);
    search(query: string, category_filter: string): any;
}

export function generate_tool_schema(tool_json: string, base_url: string): any;

export function generate_tools_page_schema(tools_json: string, base_url: string): any;

export function process_tools(raw_json: string, locale: string): any;

export function validate_json_schema(schema_json: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly generate_tool_schema: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly generate_tools_page_schema: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly process_tools: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly __wbg_toolsearchengine_free: (a: number, b: number) => void;
    readonly toolsearchengine_get_all_categories: (a: number) => any;
    readonly toolsearchengine_get_tool_ids: (a: number) => any;
    readonly toolsearchengine_len: (a: number) => number;
    readonly toolsearchengine_new: (a: number, b: number) => [number, number, number];
    readonly toolsearchengine_search: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly validate_json_schema: (a: number, b: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
