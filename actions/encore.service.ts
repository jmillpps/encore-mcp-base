import { Service } from "encore.dev/service";
import { validateStartup } from "../auth/startup.ts";
import { rejectDuplicateAuthorizationHeaders } from "./authorization-header-middleware.ts";

validateStartup();
export default new Service("actions", { middlewares: [rejectDuplicateAuthorizationHeaders] });
