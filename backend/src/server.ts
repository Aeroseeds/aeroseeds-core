import app from "./app";
import { port } from "./config";

app.listen(port, "0.0.0.0", () => {
  console.log(`Aeroseeds backend listening on http://0.0.0.0:${port}`);
});
