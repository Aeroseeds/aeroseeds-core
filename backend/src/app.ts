import express, { Request, Response } from "express";
import cors from "cors";
import diagnoseRoutes from "./routes/diagnoseRoutes";
import farmRoutes from "./routes/farmRoutes";
import scanRoutes from "./routes/scanRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import reportRoutes from "./routes/reportRoutes";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/", diagnoseRoutes);
app.use("/", farmRoutes);
app.use("/", scanRoutes);
app.use("/", dashboardRoutes);
app.use("/", reportRoutes);

app.get("/health", (req: Request, res: Response) => res.json({ status: "ok" }));

export default app;
