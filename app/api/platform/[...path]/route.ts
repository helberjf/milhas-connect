import { createPlatformHandler } from '../../../../lib/platform/handler.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = createPlatformHandler();
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
