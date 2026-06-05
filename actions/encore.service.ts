import { Service } from "encore.dev/service";
import { validateStartup } from "../auth/startup.ts";

validateStartup();
export default new Service("actions");
