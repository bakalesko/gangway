import { ViteDevServer } from "vite";
import { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApiMiddleware() {
  return async (req: Request, res: Response, next: () => void) => {
    if (!req.url?.startsWith("/api/")) {
      return next();
    }

    // Extract the API endpoint name
    const apiPath = req.url.replace("/api/", "").split("?")[0];
    const handlerPath = path.join(__dirname, "api", `${apiPath}.ts`);

    try {
      // Dynamically import the API handler
      const { default: handler } = await import(handlerPath);

      // Create Vercel-style request/response objects
      const vercelReq = {
        ...req,
        query: req.query || {},
        body: req.body,
        headers: req.headers,
        method: req.method,
      };

      const vercelRes = {
        status: (code: number) => ({
          json: (data: any) => {
            res.status(code).json(data);
          },
          send: (data: any) => {
            res.status(code).send(data);
          },
        }),
        json: (data: any) => {
          res.json(data);
        },
        send: (data: any) => {
          res.send(data);
        },
      };

      // Call the handler
      await handler(vercelReq, vercelRes);
    } catch (error) {
      console.error(`API Error for ${req.url}:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal server error",
          details: error.message,
          endpoint: req.url,
        });
      }
    }
  };
}
