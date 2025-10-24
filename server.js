// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Resend } from "resend";

dotenv.config();

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

const FRONT_URL = "https://mail-front-jnb4.onrender.com";

const allowed = new Set([
  FRONT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      cb(null, allowed.has(origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

app.use(express.json());

app.use("/api/send", rateLimit({ windowMs: 60_000, max: 10 }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const EmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
});

app.post("/api/send", async (req, res) => {
  const parsed = EmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.flatten() });
  }

  const { to, subject, html, cc, bcc } = parsed.data;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL, // ex: "noreply@ashtone.io"
      to,
      subject,
      html,
      cc,
      bcc,
    });

    if (error)
      return res
        .status(502)
        .json({ error: error.message || "Erreur fournisseur" });
    return res.json({ id: data?.id || "sent" });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Échec envoi" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Mail API prête sur http://localhost:${PORT}`)
);
