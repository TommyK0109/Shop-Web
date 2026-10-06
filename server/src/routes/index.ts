import { Router } from "express";
import { authRouter } from "./auth.routes";
import { categoriesRouter } from "./categories.routes";
import { productsRouter } from "./products.routes";
import { sellersRouter } from "./sellers.routes";
import { adminRouter } from "./admin.routes";
import { cartRouter } from "./cart.routes";
import { ordersRouter } from "./orders.routes";
import { paymentsRouter } from "./payments.routes";
import { ragRouter } from "./rag.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/categories", categoriesRouter);
apiRouter.use("/products", productsRouter);
apiRouter.use("/sellers", sellersRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/rag", ragRouter);
