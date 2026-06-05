import { Service } from "encore.dev/service";
import { validateStartup } from "./startup.ts";

validateStartup();
export default new Service("auth");
