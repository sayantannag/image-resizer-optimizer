import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import sharp from "sharp";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 20);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:5500")
  .split(",").map((v) => v.trim()).filter(Boolean);

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY. Add it to the server environment; never put it in frontend code.");
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.static("public", { extensions: ["html"] }));

const outpaintLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many AI image requests. Please wait and try again." }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    cb(allowed.includes(file.mimetype) ? null : new Error("Upload a PNG, JPG or WebP image."), allowed.includes(file.mimetype));
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "image-resizer-ai" }));

app.post("/api/outpaint", outpaintLimiter, upload.single("image"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI service is not configured. Add OPENAI_API_KEY to the backend environment." });
    if (!req.file) return res.status(400).json({ error: "Please attach an image." });

    const width = Number(req.body.width);
    const height = Number(req.body.height);
    const userPrompt = String(req.body.prompt || "").trim().slice(0, 1200);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 12000 || height > 12000) {
      return res.status(400).json({ error: "Width and height must be whole numbers between 1 and 12,000 pixels." });
    }
    if (Math.max(width, height) / Math.min(width, height) > 3) {
      return res.status(400).json({ error: "AI background extension supports aspect ratios up to 3:1. Use a less extreme output ratio or choose a browser-based fill." });
    }

    // GPT Image 2 accepts dimensions in 16px increments, 655,360–8,294,400 pixels,
    // with a maximum edge of 3,840px. Work at a valid model size, then the browser
    // maps the generated background to the exact user-requested dimensions.
    let scale = Math.max(1, Math.sqrt(655360 / (width * height)));
    scale = Math.min(scale, 3840 / Math.max(width, height));
    let workWidth = Math.max(16, Math.ceil((width * scale) / 16) * 16);
    let workHeight = Math.max(16, Math.ceil((height * scale) / 16) * 16);
    if (Math.max(workWidth, workHeight) > 3840) {
      const down = 3840 / Math.max(workWidth, workHeight);
      workWidth = Math.max(16, Math.floor((workWidth * down) / 16) * 16);
      workHeight = Math.max(16, Math.floor((workHeight * down) / 16) * 16);
    }
    if (workWidth * workHeight < 655360) {
      return res.status(400).json({ error: "The requested aspect ratio cannot be processed at a supported AI image resolution." });
    }

    const normalizedSource = await sharp(req.file.buffer).rotate().png().toBuffer();
    const metadata = await sharp(normalizedSource).metadata();
    if (!metadata.width || !metadata.height) return res.status(400).json({ error: "The uploaded image could not be decoded." });

    const fitScale = Math.min(workWidth / metadata.width, workHeight / metadata.height);
    const placedWidth = Math.max(1, Math.round(metadata.width * fitScale));
    const placedHeight = Math.max(1, Math.round(metadata.height * fitScale));
    const left = Math.round((workWidth - placedWidth) / 2);
    const top = Math.round((workHeight - placedHeight) / 2);

    // Create a transparent target plate with the complete source image centred.
    // The alpha mask marks the source region as protected and the extra canvas as editable.
    const sourceLayer = await sharp(normalizedSource)
      .resize(placedWidth, placedHeight, { fit: "fill", kernel: "lanczos3" })
      .png().toBuffer();
    const basePlate = await sharp({ create: { width: workWidth, height: workHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: sourceLayer, left, top }]).png().toBuffer();
    const maskSvg = Buffer.from(`<svg width="${workWidth}" height="${workHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="${workWidth}" height="${workHeight}" fill="black" fill-opacity="0"/><rect x="${left}" y="${top}" width="${placedWidth}" height="${placedHeight}" fill="white" fill-opacity="1"/></svg>`);
    const mask = await sharp(maskSvg).png().toBuffer();

    const preservationPrompt = [
      "OUTPAINT THE EMPTY CANVAS ONLY.",
      "The provided image contains a protected original image centred on a larger transparent canvas.",
      "Fill only the transparent/empty areas outside the original image with a seamless, photorealistic continuation of the existing scene.",
      "Study the source image's real background, lighting direction, colour temperature, textures, depth of field, shadows and perspective; continue them naturally into the empty areas.",
      "Do not add white bars, blank padding, solid colour panels, frames, borders, mirrored duplicates, blurred duplicate backgrounds or artificial gradients.",
      "Do not crop, move, resize, stretch, squeeze, narrow, repaint or redesign the original image. Preserve all visible text, typography, logos, people, faces, hands, products and foreground objects exactly as supplied.",
      "Do not invent new text, labels, logos or foreground subjects. The generated area must look like it was part of the same original photograph.",
      userPrompt ? `Additional background direction from the user: ${userPrompt}` : "Use the visual context of the source image to determine the most natural continuation.",
      "Return the full canvas at the supplied image dimensions."
    ].join(" ");

    const result = await openai.images.edit({
      model: "gpt-image-2",
      image: new File([basePlate], "outpaint-input.png", { type: "image/png" }),
      mask: new File([mask], "outpaint-mask.png", { type: "image/png" }),
      prompt: preservationPrompt,
      size: `${workWidth}x${workHeight}`,
      quality: "high",
      output_format: "png"
    });
    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error("The AI provider returned no image data.");

    res.set("Cache-Control", "no-store");
    return res.json({ imageBase64, mimeType: "image/png", workWidth, workHeight, placement: { left, top, width: placedWidth, height: placedHeight } });
  } catch (error) {
    const status = error?.status === 429 ? 429 : 500;
    console.error("Outpaint request failed:", error?.message || error);
    return res.status(status).json({ error: error?.status === 429 ? "AI usage limit reached. Please try again later." : (error?.message || "AI background extension failed. Check the backend logs and API configuration.") });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err.message || err);
  const status = err instanceof multer.MulterError ? 413 : 400;
  res.status(status).json({ error: err.message || "The request could not be processed." });
});

app.listen(PORT, () => console.log(`Image Resizer API listening on port ${PORT}`));
