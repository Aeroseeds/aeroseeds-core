import express, { Request, Response } from "express";
import cors from "cors";
import diagnoseRoutes from "./routes/diagnoseRoutes";

const app = express();

app.use(cors());
app.use("/", diagnoseRoutes);

app.get("/health", (req: Request, res: Response) => res.json({ status: "ok" }));

export default app;
