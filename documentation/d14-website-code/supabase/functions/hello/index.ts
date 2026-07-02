import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve((_req) => {
  return new Response("Hello, World!", {
    headers: { "Content-Type": "text/plain" },
  });
});
