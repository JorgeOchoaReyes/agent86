import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { userRouter } from "./routers/user";
import { stripeRouter } from "./routers/stripe";
import { squareRouter } from "./routers/square";

export const appRouter = createTRPCRouter({
  user: userRouter,
  stripe: stripeRouter,
  square: squareRouter,
});
 
export type AppRouter = typeof appRouter; 
export const createCaller = createCallerFactory(appRouter);
