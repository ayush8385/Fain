import express from "express";
import { env } from "./config/env";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { ingestionRouter } from "./routes/ingestion";
import { transactionsRouter } from "./routes/transactions";
import { categoriesRouter } from "./routes/categories";
import { pushRouter } from "./routes/push";
import { pubsubRouter } from "./ingestion/pubsubListener";
import { startScheduler } from "./jobs/scheduler";

const app = express();

app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(ingestionRouter);
app.use(transactionsRouter);
app.use(categoriesRouter);
app.use(pushRouter);
app.use(pubsubRouter);

app.listen(env.port, () => {
  console.log(`Fain backend listening on port ${env.port}`);
  startScheduler();
});
