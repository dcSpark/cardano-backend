import { NextFunction, Request, Response, Router } from "express";
import cors from "cors";
import parser from "body-parser";
import compression from "compression";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import responseTime from "response-time";

export const handleCors = (router: Router): Router =>
  router.use(cors({ credentials: true, origin: true }));

export const handleBodyRequestParsing = (router: Router): void => {
  router.use(parser.urlencoded({ extended: true }));
  router.use(parser.json({ limit: "10mb" }));
};

export const handleCompression = (router: Router): void => {
  router.use(compression());
};

const ENDPOINTS_TO_OMIT: Array<string> = [
  "/metrics",
  "/v2/importerhealthcheck",
];
const stripSpaces = (str: string): string => {
  // Loki tool, that collects logs
  // does not like spaces
  if (str.includes(" ")) {
    return `${str.replace(/ /g, "")}`;
  }
  return str;
};

export const handleTiming = (router: Router): void => {
  router.use(
    responseTime((req: Request, res: Response, time: number) => {
      // omit metrics & healthpoints logs
      if (!ENDPOINTS_TO_OMIT.includes(req.url))
        console.log(
          `time=${(time / 1000).toFixed(3)}s url=${req.url} status=${
            res.statusCode
          } headers=${stripSpaces(
            JSON.stringify(req.headers)
          )} req=${JSON.stringify(req.body)}`
        );
      // TODO: how to add body of response?
    })
  );
};

export const logErrors = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errStr = `ERROR url: ${req.url}\n      stack: ${
    err.stack
  }\n      message: ${err.message}\n      request: ${JSON.stringify(req.body)}`;
  console.log(errStr);
  next(err);
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(500).send({ error: { response: err.message } });
};
