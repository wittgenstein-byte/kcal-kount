import { fromHono } from "chanfana";
import { Hono } from "hono";
import { TaskCreate } from "./endpoints/taskCreate";
import { TaskDelete } from "./endpoints/taskDelete";
import { TaskFetch } from "./endpoints/taskFetch";
import { TaskList } from "./endpoints/taskList";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/tasks", TaskList);
openapi.post("/api/tasks", TaskCreate);
openapi.get("/api/tasks/:taskSlug", TaskFetch);
openapi.delete("/api/tasks/:taskSlug", TaskDelete);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Image Upload Endpoint (expects JSON with base64 image data)
app.post("/api/images/upload", async (c) => {
	try {
		const body = await c.req.json();
		const base64Data = body.image;
		if (!base64Data) {
			return c.json({ error: "Missing image data" }, 400);
		}

		// Parse the data URL (e.g. data:image/jpeg;base64,...)
		const match = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
		if (!match) {
			return c.json({ error: "Invalid image format" }, 400);
		}

		const contentType = match[1];
		const base64Str = match[2];

		// Decode base64 to binary buffer
		// In Cloudflare Workers, we can use Uint8Array.from(atob(...)) or similar standard browser decoding
		const binaryStr = atob(base64Str);
		const len = binaryStr.length;
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i++) {
			bytes[i] = binaryStr.charCodeAt(i);
		}

		// Generate a unique filename using timestamp and a random string
		const randomId = Math.random().toString(36).substring(2, 10);
		const filename = `meal-${Date.now()}-${randomId}.jpg`;
		const key = `images/${filename}`;

		// Upload to R2 Bucket
		await c.env.BUCKET.put(key, bytes.buffer, {
			httpMetadata: { contentType: contentType || "image/jpeg" },
		});

		// Return the access path
		return c.json({ url: `/api/images/${filename}` });
	} catch (err: any) {
		return c.json({ error: err.message || "Upload failed" }, 500);
	}
});

// Image Fetching Endpoint
app.get("/api/images/:filename", async (c) => {
	const filename = c.req.param("filename");
	const key = `images/${filename}`;

	const object = await c.env.BUCKET.get(key);
	if (!object) {
		return c.text("Image not found", 404);
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	headers.set("Cache-Control", "public, max-age=31536000, immutable");

	return new Response(object.body, {
		headers,
	});
});

// Export the Hono app
export default app;
