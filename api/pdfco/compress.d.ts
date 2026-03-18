import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(
    req: IncomingMessage & { url?: string; method?: string },
    res: ServerResponse
): Promise<void>;
